'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

// 共享 hover 放大逻辑:鼠标移到图上 → Portal 渲染大图到 body 顶层(按真实比例)
export function HoverZoomImg({ url, style }: { url: string; style?: React.CSSProperties }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const previewBox = (() => {
    if (!natural) return { w: 240, h: 240 };
    const max = 320;
    const scale = Math.min(1, max / Math.max(natural.w, natural.h));
    return { w: Math.round(natural.w * scale), h: Math.round(natural.h * scale) };
  })();

  return (
    <>
      <img
        src={url}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        }}
        onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'zoom-in', ...style }}
      />
      {pos && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', left: pos.x + 20, top: Math.max(8, pos.y - previewBox.h / 2),
          width: previewBox.w, height: previewBox.h, borderRadius: 12, overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.2)', boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
          zIndex: 999999, pointerEvents: 'none', background: '#111',
        }}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        </div>,
        document.body
      )}
    </>
  );
}

// 参考图缩略图 — hover 时通过 Portal 渲染到 body 顶层
// 完全绕过所有 overflow:hidden 限制；预览按图片真实比例显示

export function RefThumb({
  url,
  index,
  onRemove,
  size = 56,
  ratio = 'square', // 缩略图形状:'square' 方形 | 'wide' 16:9
}: {
  url: string;
  index: number;
  onRemove: () => void;
  size?: number;
  ratio?: 'square' | 'wide';
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // 预览按真实比例,最长边 280
  const previewBox = (() => {
    if (!natural) return { w: 240, h: 240 };
    const max = 280;
    const scale = Math.min(1, max / Math.max(natural.w, natural.h));
    return { w: Math.round(natural.w * scale), h: Math.round(natural.h * scale) };
  })();

  return (
    <div
      style={{
        position: 'relative',
        width: ratio === 'wide' ? '100%' : size,
        aspectRatio: ratio === 'wide' ? '16/9' : '1',
        height: ratio === 'wide' ? undefined : size,
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(0,0,0,0.25)',
        flexShrink: 0,
        cursor: 'zoom-in',
      }}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
    >
      <img
        src={url}
        alt=""
        onLoad={(e) => {
          const img = e.currentTarget;
          if (img.naturalWidth && img.naturalHeight) {
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
      />
      <button
        style={{
          position: 'absolute', top: 2, right: 2, width: 16, height: 16,
          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)',
          color: '#fff', fontSize: 11, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onMouseEnter={(e) => { e.stopPropagation(); setPos(null); }}
      >×</button>
      <span style={{
        position: 'absolute', bottom: 2, left: 2, fontSize: 9, color: '#fff',
        background: 'rgba(0,0,0,0.7)', padding: '0 4px', borderRadius: 4, pointerEvents: 'none',
      }}>{index + 1}</span>

      {/* Portal — 渲染到 body 顶层,按真实比例显示 */}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            left: pos.x + 20,
            top: Math.max(8, pos.y - previewBox.h / 2),
            width: previewBox.w,
            height: previewBox.h,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1.5px solid rgba(255,255,255,0.2)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.9)',
            zIndex: 999999,
            pointerEvents: 'none',
            background: '#111',
          }}
        >
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

