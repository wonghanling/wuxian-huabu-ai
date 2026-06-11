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
  // @ 引用:输入 @ 弹出素材列表,选中插入 [图N]。每项 {label, ref} ref如"[图1]"
  mentionItems?: { label: string; ref: string; thumb?: string }[];
}

export function PromptArea({ connectedText, value, onChange, onGenerate, placeholder, style, mentionItems }: Props) {
  const [local, setLocal] = useState(value);
  const [mentionOpen, setMentionOpen] = useState(false);
  const composingRef = useRef(false);
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

  // 选中某素材:把用户输入里最后一个 @ 替换成 [图N]
  const pickMention = (ref: string) => {
    const next = local.replace(/@(?=[^@]*$)/, ref + ' ');  // 替换最后一个 @
    setLocal(next);
    writeGlobal(next);
    setMentionOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        className="nodrag nopan nowheel cv2-scroll"
        value={displayValue}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onChange={(e) => {
          // 按行切:前缀占固定行数,之后的所有行才是用户输入。不做字符级 slice。
          const lines = e.target.value.split('\n');
          const user = prefix ? lines.slice(prefixLineCount - 1).join('\n') : e.target.value;
          setLocal(user);
          writeGlobal(user);
          // @ 触发:非中文输入中、有素材、末尾刚输入 @ → 弹列表
          if (mentionItems && mentionItems.length > 0 && !composingRef.current) {
            setMentionOpen(/@[^@]*$/.test(user) && /@$/.test(user));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.();
          if (e.key === 'Escape') setMentionOpen(false);
        }}
        style={style}
      />
      {/* @ 素材下拉 */}
      {mentionOpen && mentionItems && mentionItems.length > 0 && (
        <div className="nodrag" style={{ position: 'absolute', bottom: '100%', left: 8, zIndex: 30, marginBottom: 4, background: 'rgba(28,28,32,0.97)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 6, maxHeight: 200, overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', minWidth: 160 }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 10, color: '#71717a', padding: '2px 6px 4px' }}>选择要引用的素材</div>
          {mentionItems.map((m) => (
            <button key={m.ref} onClick={() => pickMention(m.ref)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: '#e4e4e7', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {m.thumb && <img src={m.thumb} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
              <span style={{ fontSize: 12 }}>{m.label}</span>
              <span style={{ fontSize: 10, color: '#a78bfa', marginLeft: 'auto' }}>{m.ref}</span>
            </button>
          ))}
        </div>
      )}
      {prefix && (
        <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2, marginBottom: 4 }}>· 开头文案来自连接卡片,在下方空行输入你的内容</div>
      )}
    </div>
  );
}
