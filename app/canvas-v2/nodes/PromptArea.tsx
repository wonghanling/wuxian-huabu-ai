'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';

// ============================================================
// PromptArea — 完整复刻原网 CustomCard 输入框机制
// 核心:本地 state(localPrompt) + 防抖写全局,打字时不触发全局重渲染,
//      中文输入法不被打断。连接文案作前缀显示在框内,下方紫色标注。
// ============================================================

interface Props {
  connectedText?: string;          // 连接来的上游文案(只读前缀)
  value: string;                   // 全局值(用户输入部分)
  onChange: (v: string) => void;   // 防抖后写全局
  onGenerate?: () => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
}

export function PromptArea({ connectedText, value, onChange, onGenerate, placeholder, style }: Props) {
  const [local, setLocal] = useState(value);          // 本地即时 state
  const isComposing = useRef(false);                  // 中文输入法组合中
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 外部 value 变化(如切换卡片/连线传参)时同步本地(非聚焦编辑场景)
  useEffect(() => { setLocal(value); }, [value]);

  // 防抖写全局(打字时不每次都更新全局,避免重渲染打断输入)
  const writeGlobal = (v: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { onChange(v); }, 300);
  };

  const prefix = connectedText ? connectedText : '';
  // 显示值 = 连接前缀 + 本地输入
  const displayValue = prefix ? `${prefix}${local ? '\n' + local : ''}` : local;

  const extractUser = (full: string) => {
    const pre = prefix ? prefix + '\n' : '';
    return pre && full.startsWith(pre) ? full.slice(pre.length)
      : (prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full);
  };

  return (
    <>
      <textarea
        className="nodrag nopan nowheel cv2-scroll"
        value={displayValue}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={(e) => {
          isComposing.current = false;
          const u = extractUser((e.target as HTMLTextAreaElement).value);
          setLocal(u);
          writeGlobal(u);
        }}
        onChange={(e) => {
          const u = extractUser(e.target.value);
          setLocal(u);                                 // 本地即时更新(textarea 立即响应)
          if (!isComposing.current) writeGlobal(u);    // 组合中不写全局
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.(); }}
        style={style}
      />
      {prefix && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, marginBottom: 4 }}>· 开头文案来自连接卡片(将自动拼入生成)</div>
      )}
    </>
  );
}
