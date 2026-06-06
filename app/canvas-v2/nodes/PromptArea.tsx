'use client';

import { type CSSProperties } from 'react';

// ============================================================
// PromptArea — 用户输入的可编辑文本框(朴素受控)
// 中文输入正常:直接 onChange,不做 composition 门控。
// 连接文案不再拼进输入框,只在下方显示一行灰色提示;
// 生成时拼入上游文案的逻辑在各卡片 handleGenerate 里。
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
  return (
    <>
      <textarea
        className="nodrag nopan nowheel cv2-scroll"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.(); }}
        style={style}
      />
      {connectedText && (
        <div style={{ fontSize: 10, color: '#71717a', marginTop: 2, marginBottom: 4 }}>已连接上游文案,生成时自动拼入</div>
      )}
    </>
  );
}
