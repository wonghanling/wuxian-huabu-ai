'use client';

import { IconCopy, IconPaste } from './icons';

// ============ prompt 框的复制/粘贴按钮(三种卡片共用) ============
// 一键复制当前 prompt;一键粘贴剪贴板内容到 prompt

export function PromptTools({ value, onPaste }: { value: string; onPaste: (text: string) => void }) {
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
  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()}>
      <button style={btn} onClick={copy} title="复制 prompt"><IconCopy size={13} /></button>
      <button style={btn} onClick={paste} title="粘贴到 prompt"><IconPaste size={13} /></button>
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
