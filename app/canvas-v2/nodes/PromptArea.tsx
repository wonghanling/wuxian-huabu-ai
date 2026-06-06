'use client';

import { useRef, type CSSProperties } from 'react';

// ============================================================
// PromptArea — 连接文案 + 用户输入的可编辑文本框
// 说明:HTML textarea 无法"部分文字紫色"且同时兼容中文输入法
// (透明叠层方案会让 IME 组合中的拼音不可见)。
// 故采用原网做法:文字正常可见 + 下方紫色"·来自连接卡片"标注。
// 中文输入法安全:组合中不提交,组合结束才提交。
// ============================================================

interface Props {
  connectedText?: string;
  value: string;
  onChange: (v: string) => void;
  onGenerate?: () => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
}

export function PromptArea({ connectedText, value, onChange, onGenerate, placeholder, style }: Props) {
  const composingRef = useRef(false);

  const prefix = connectedText ? connectedText : '';
  // textarea 显示全文 = 连接前缀 + 用户输入
  const fullValue = prefix ? `${prefix}${value ? '\n' + value : ''}` : value;

  const commit = (full: string) => {
    const pre = prefix ? prefix + '\n' : '';
    const userInput = pre && full.startsWith(pre)
      ? full.slice(pre.length)
      : (prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full);
    onChange(userInput);
  };

  return (
    <>
      <textarea
        className="nodrag nopan nowheel cv2-scroll"
        value={fullValue}
        placeholder={placeholder}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => { composingRef.current = false; commit((e.target as HTMLTextAreaElement).value); }}
        onChange={(e) => { if (composingRef.current) return; commit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.(); }}
        style={style}
      />
      {prefix && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, marginBottom: 4 }}>· 开头文案来自连接卡片(将自动拼入生成)</div>
      )}
    </>
  );
}
