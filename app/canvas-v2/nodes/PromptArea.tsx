'use client';

import { useRef, type CSSProperties } from 'react';

// ============================================================
// PromptArea — 连接文案紫色 + 用户输入白色的可编辑文本框
// HTML textarea 无法分色,用叠层方案:
//   底层 div 渲染彩色文字(连接文案紫/用户白)
//   上层 textarea 文字透明、光标可见,接收输入
//   两层 padding/fontSize/lineHeight 完全一致 + 滚动同步
// connectedText:来自连接的只读前缀(紫色);value:用户可编辑部分(白色)
// ============================================================

interface Props {
  connectedText?: string;          // 连接来的文案(紫色,只读)
  value: string;                   // 用户输入(白色,可编辑)
  onChange: (v: string) => void;
  onGenerate?: () => void;         // Cmd/Ctrl+Enter
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;           // 复用各卡片的 promptInput
}

export function PromptArea({ connectedText, value, onChange, onGenerate, placeholder, style }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const prefix = connectedText ? connectedText : '';
  // textarea 实际承载的全文 = 连接前缀 + 换行 + 用户输入
  const fullValue = prefix ? `${prefix}${value ? '\n' + value : ''}` : value;

  // 共享排版(两层必须完全一致才能对齐)
  const shared: CSSProperties = {
    margin: 0,
    padding: style?.padding ?? '18px 16px 10px',
    fontSize: style?.fontSize ?? 15,
    fontFamily: (style?.fontFamily as string) ?? 'inherit',
    lineHeight: style?.lineHeight ?? 1.65,
    letterSpacing: 'normal',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
    width: '100%',
    minHeight: style?.minHeight ?? 200,
  };

  const syncScroll = () => {
    if (overlayRef.current && taRef.current) {
      overlayRef.current.scrollTop = taRef.current.scrollTop;
      overlayRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 底层:彩色文字镜像(只读展示) */}
      <div
        ref={overlayRef}
        aria-hidden
        className="cv2-scroll"
        style={{
          ...shared,
          position: 'absolute', inset: 0,
          overflow: 'auto', pointerEvents: 'none',
          color: '#e4e4e7',
        }}
      >
        {prefix && <span style={{ color: '#a78bfa' }}>{prefix}</span>}
        {prefix && value ? '\n' : ''}
        <span style={{ color: '#e4e4e7' }}>{value}</span>
        {/* 末尾占位,保证最后一行换行高度被计入 */}
        {'​'}
      </div>

      {/* 上层:透明文字 textarea(承载光标 + 输入) */}
      <textarea
        ref={taRef}
        className="nodrag nopan nowheel cv2-scroll"
        value={fullValue}
        placeholder={placeholder}
        onScroll={syncScroll}
        onChange={(e) => {
          const full = e.target.value;
          const pre = prefix ? prefix + '\n' : '';
          // 连接前缀只读:用户编辑只改自己那部分
          const userInput = pre && full.startsWith(pre)
            ? full.slice(pre.length)
            : (prefix && full.startsWith(prefix) ? full.slice(prefix.length) : full);
          onChange(userInput);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.(); }}
        style={{
          ...shared,
          position: 'relative',
          background: 'transparent', border: 'none', outline: 'none', resize: 'none',
          color: 'transparent', caretColor: '#fff',
          overflow: 'auto',
          WebkitTextFillColor: 'transparent',
        }}
      />
    </div>
  );
}
