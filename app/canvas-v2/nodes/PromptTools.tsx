'use client';

import { useState } from 'react';
import { IconCopy, IconPaste } from './icons';

// ============ prompt 框的复制/粘贴/翻译按钮(各卡共用) ============
// 一键复制当前 prompt;一键粘贴剪贴板内容到 prompt;一键中英互译
// 翻译:仅替换输入框文本(用户手动点),不改任何生成/传参逻辑

export function PromptTools({ value, onPaste }: { value: string; onPaste: (text: string) => void }) {
  const [translating, setTranslating] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(value || ''); } catch {}
  };
  const paste = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const text = await navigator.clipboard.readText();
      if (text) onPaste(text);
    } catch {}
  };
  // 含中文 → 译英,否则 → 译中。专有名词/参数/@引用原样保留
  const translate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const src = (value || '').trim();
    if (!src || translating) return;
    const target = /[一-龥]/.test(src) ? 'en' : 'zh';
    setTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: src, target }),
      });
      const data = await res.json();
      if (data.translated) onPaste(data.translated);
    } catch {}
    finally { setTranslating(false); }
  };
  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()}>
      <button style={btn} onClick={copy} title="复制 prompt"><IconCopy size={13} /></button>
      <button style={btn} onClick={paste} title="粘贴到 prompt"><IconPaste size={13} /></button>
      <button style={{ ...btn, width: 'auto', padding: '0 7px', fontSize: 11, color: translating ? '#c4b5fd' : '#a1a1aa', cursor: translating ? 'wait' : 'pointer' }}
        onClick={translate} disabled={translating} title="中英互译">
        {translating ? '…' : '译'}
      </button>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 5,
};
const btn: React.CSSProperties = {
  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', cursor: 'pointer',
  transition: 'background .15s, color .15s',
};
