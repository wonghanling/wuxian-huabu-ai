'use client';

import { useState, useRef, useEffect, type CSSProperties } from 'react';

// ============================================================
// PromptArea — 输入框
// 连接文案作只读前缀显示在第一行,用户输入自动在【下一行】开始。
// onChange 只取最后一行之后的用户输入(按连接文案行数切分),不做前缀字符匹配,
// 用户天然在下一行打字,光标不碰前缀边界 → 中文输入不被打断。
// 本地 state + 防抖写全局。
// @ 引用:在文案任意位置输入 @ → 弹参考素材列表,选中在光标处插入 @图片N。
// ============================================================

interface Props {
  connectedText?: string;
  value: string;
  onChange: (v: string) => void;
  onGenerate?: () => void;
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
  // @ 引用素材:每项 {label, ref, thumb} ref 如 "@图片1"
  mentionItems?: { label: string; ref: string; thumb?: string }[];
}

export function PromptArea({ connectedText, value, onChange, onGenerate, placeholder, style, mentionItems }: Props) {
  const [local, setLocal] = useState(value);
  const [mentionOpen, setMentionOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
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
  // displayValue 中用户输入起始的字符偏移(光标位置换算用)
  const userStartOffset = prefix ? prefix.length + 1 : 0;

  // 把 textarea 当前光标位置换算成"用户输入文本(local)内的位置"
  const cursorInUser = (): number => {
    const ta = taRef.current;
    if (!ta) return local.length;
    return Math.max(0, (ta.selectionStart ?? displayValue.length) - userStartOffset);
  };

  // 选中素材:在光标处(用户文本内)替换最近的 @ 为 @图片N
  const pickMention = (ref: string) => {
    const pos = cursorInUser();
    const before = local.slice(0, pos);
    const after = local.slice(pos);
    // 光标前最后一个 @(及其后未空格的查询字符)替换为 ref
    const atIdx = before.lastIndexOf('@');
    const newBefore = atIdx >= 0 ? before.slice(0, atIdx) + ref + ' ' : before + ref + ' ';
    const next = newBefore + after;
    setLocal(next);
    writeGlobal(next);
    setMentionOpen(false);
    // 还原光标到插入点之后
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        const caret = userStartOffset + newBefore.length;
        ta.focus();
        ta.setSelectionRange(caret, caret);
      }
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
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
          // @ 触发:有素材、非中文输入中、光标前刚输入 @ → 弹列表
          if (mentionItems && mentionItems.length > 0 && !composingRef.current) {
            const caret = (e.target.selectionStart ?? 0) - userStartOffset;
            const before = caret >= 0 ? user.slice(0, caret) : '';
            // 光标前最后一个 @ 之后没有空格/换行 → 正在输入引用
            const m = before.match(/@[^\s@]*$/);
            setMentionOpen(!!m);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onGenerate?.();
          if (e.key === 'Escape') setMentionOpen(false);
        }}
        onBlur={() => { setTimeout(() => setMentionOpen(false), 150); }}
        style={style}
      />
      {/* @ 素材选择弹窗(照同类产品:输入@即弹,选中插入光标处) */}
      {mentionOpen && mentionItems && mentionItems.length > 0 && (
        <div className="nodrag nowheel cv2-scroll" style={{ position: 'absolute', bottom: '100%', left: 8, zIndex: 40, marginBottom: 6, background: 'rgba(28,28,32,0.98)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: 6, maxHeight: 220, overflowY: 'auto', boxShadow: '0 14px 44px rgba(0,0,0,0.65)', minWidth: 180 }}
          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.preventDefault()}>
          <div style={{ fontSize: 10, color: '#a1a1aa', padding: '2px 6px 6px' }}>选择要引用的参考图</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {mentionItems.map((m) => (
              <button key={m.ref} onClick={() => pickMention(m.ref)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#e4e4e7', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                {m.thumb && <img src={m.thumb} alt="" style={{ width: '100%', aspectRatio: '1', borderRadius: 6, objectFit: 'cover' }} />}
                <span style={{ fontSize: 10 }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {prefix && (
        <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 2, marginBottom: 4 }}>· 开头文案来自连接卡片,在下方空行输入你的内容</div>
      )}
    </div>
  );
}
