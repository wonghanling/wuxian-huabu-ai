'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';

// ============================================================
// PromptArea — 输入框
// 连接文案作只读前缀显示在第一行,用户输入自动在【下一行】开始。
// onChange 只取最后一行之后的用户输入(按连接文案行数切分),不做前缀字符匹配,
// 用户天然在下一行打字,光标不碰前缀边界 → 中文输入不被打断。
// 本地 state + 防抖写全局。
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
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setLocal(value); }, [value]);

  const writeGlobal = (v: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 300);
  };

  const prefix = connectedText ? connectedText : '';
  // 显示:连接文案 + 空行 + 用户输入(用户天然在下一行)
  const displayValue = prefix ? `${prefix}\n${local}` : local;
  const prefixLineCount = prefix ? prefix.split('\n').length + 1 : 0; // 前缀占的行数(含空行)

  return (
    <>
      <textarea
        className="nodrag nopan nowheel cv2-scroll"
        value={displayValue}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          // 按行切:前缀占固定行数,之后的所有行才是用户输入。不做字符级 slice。
          const lines = e.target.value.split('\n');
          const user = prefix ? lines.slice(prefixLineCount - 1).join('\n') : e.target.value;
          setLocal(user);
          writeGlobal(user);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.(); }}
        style={style}
      />
      {prefix && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, marginBottom: 4 }}>· 开头文案来自连接卡片,在下方空行输入你的内容</div>
      )}
    </>
  );
}
