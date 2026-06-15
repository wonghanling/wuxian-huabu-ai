'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { uploadImageToStorage } from '../lib/api';

// ============================================================
// 涂鸦编辑弹窗(Doodle Edit)
// 在图片上涂抹/画圈/写文字标注 → 「保存涂鸦」合成为一张新图片卡(不扣费,不自动生成)
// 用户之后自己连线到图片生成卡,或在新卡上点生成。
// 双层 canvas:底层原图 + 上层涂鸦(线条+文字);图用 fetch→blob 加载规避跨域污染
// ============================================================

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#000000'];
const SIZES = [4, 8, 16];

type Tool = 'pen' | 'eraser' | 'text';

interface Props {
  imageUrl: string;
  onClose: () => void;
  onConfirm: (args: { doodleUrl: string }) => void;
}

export function DoodleModal({ imageUrl, onClose, onConfirm }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);   // 底图层
  const drawRef = useRef<HTMLCanvasElement>(null);   // 涂鸦层(线条+文字)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<Tool>('pen');
  const [busy, setBusy] = useState(false);
  // 文字输入态:点击位置出现输入框
  const [textInput, setTextInput] = useState<{ x: number; y: number; cx: number; cy: number; value: string } | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  // 加载图片(fetch→blob→objectURL,规避跨域污染)
  useEffect(() => {
    let revoked = '';
    (async () => {
      try {
        const res = await fetch(imageUrl, { mode: 'cors' });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        const img = new Image();
        img.onload = () => setImgEl(img);
        img.src = url;
      } catch {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImgEl(img);
        img.src = imageUrl;
      }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [imageUrl]);

  // 图片加载后画底图(等比,最长边 1024)
  useEffect(() => {
    if (!imgEl || !baseRef.current || !drawRef.current) return;
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
    const w = Math.round(imgEl.naturalWidth * scale);
    const h = Math.round(imgEl.naturalHeight * scale);
    [baseRef.current, drawRef.current].forEach((c) => { c.width = w; c.height = h; });
    baseRef.current.getContext('2d')?.drawImage(imgEl, 0, 0, w, h);
  }, [imgEl]);

  // 显示坐标 → canvas 内部像素
  const getPos = (e: React.PointerEvent | React.MouseEvent) => {
    const c = drawRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
      rect,
    };
  };

  const onDown = (e: React.PointerEvent) => {
    if (tool === 'text') {
      // 文字模式:点击处弹输入框
      const p = getPos(e);
      setTextInput({ x: p.x, y: p.y, cx: e.clientX - p.rect.left, cy: e.clientY - p.rect.top, value: '' });
      setTimeout(() => textRef.current?.focus(), 0);
      return;
    }
    drawing.current = true;
    last.current = getPos(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current || tool === 'text') return;
    const ctx = drawRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === 'eraser' ? size * 2.5 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  };
  const onUp = () => { drawing.current = false; last.current = null; };

  // 提交文字:把输入的字画到涂鸦层
  const commitText = () => {
    if (!textInput || !drawRef.current) { setTextInput(null); return; }
    const v = textInput.value.trim();
    if (v) {
      const ctx = drawRef.current.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      const fontSize = Math.max(20, size * 3.5);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(v, textInput.x, textInput.y);
    }
    setTextInput(null);
  };

  const clearDoodle = () => {
    const c = drawRef.current; if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setTextInput(null);
  };

  // 保存涂鸦:合成底图+涂鸦 → File → 上传 → 回传(不生成、不扣费)
  const handleSave = useCallback(async () => {
    if (!baseRef.current || !drawRef.current || busy) return;
    setBusy(true);
    try {
      const w = baseRef.current.width, h = baseRef.current.height;
      const merged = document.createElement('canvas');
      merged.width = w; merged.height = h;
      const mctx = merged.getContext('2d')!;
      mctx.drawImage(baseRef.current, 0, 0);
      mctx.drawImage(drawRef.current, 0, 0);
      const blob: Blob = await new Promise((resolve, reject) =>
        merged.toBlob((b) => b ? resolve(b) : reject(new Error('合成失败')), 'image/jpeg', 0.92));
      const file = new File([blob], `doodle-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadImageToStorage(file);
      if (!url) throw new Error('上传失败');
      onConfirm({ doodleUrl: url });
      onClose();
    } catch (e: any) {
      alert('保存失败: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm, onClose]);

  return (
    <div
      className="nodrag nopan nowheel"
      style={overlay}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="nodrag nopan nowheel" style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>涂鸦编辑</span>
          <span style={{ fontSize: 12, color: '#8b8b92' }}>涂抹/画圈/写文字标注,保存后连线到图片生成卡使用</span>
          <button onClick={onClose} style={closeBtn} title="关闭">✕</button>
        </div>

        {/* 工具条 */}
        <div style={toolbar}>
          <span style={{ fontSize: 12, color: '#8b8b92', marginRight: 2 }}>颜色</span>
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              style={{ ...swatch, background: c, outline: color === c ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.2)', outlineOffset: 1 }} />
          ))}
          <span style={divider} />
          <span style={{ fontSize: 12, color: '#8b8b92', marginRight: 2 }}>粗细</span>
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              style={{ ...sizeBtn, outline: size === s ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ width: s, height: s, borderRadius: '50%', background: '#e4e4e7', display: 'block' }} />
            </button>
          ))}
          <span style={divider} />
          <button onClick={() => setTool('pen')} style={toolBtnStyle(tool === 'pen')}>✏ 画笔</button>
          <button onClick={() => setTool('text')} style={toolBtnStyle(tool === 'text')}>T 文字</button>
          <button onClick={() => setTool('eraser')} style={toolBtnStyle(tool === 'eraser')}>橡皮擦</button>
          <button onClick={clearDoodle} style={textBtn}>清空</button>
        </div>

        {/* 画布区 */}
        <div style={canvasWrap} className="cv2-scroll">
          <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
            <canvas ref={baseRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '64vh', borderRadius: 10 }} />
            <canvas ref={drawRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: tool === 'text' ? 'text' : 'crosshair', touchAction: 'none' }} />
            {/* 文字输入浮层 */}
            {textInput && (
              <input
                ref={textRef}
                value={textInput.value}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onBlur={commitText}
                onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null); }}
                placeholder="输入文字,回车确认"
                style={{
                  position: 'absolute', left: textInput.cx, top: textInput.cy,
                  font: `bold ${Math.max(16, size * 3)}px sans-serif`, color,
                  background: 'rgba(0,0,0,0.5)', border: `1px solid ${color}`, borderRadius: 6,
                  padding: '2px 6px', outline: 'none', minWidth: 120, zIndex: 5,
                }}
              />
            )}
            {!imgEl && <div style={{ padding: 60, color: '#71717a', fontSize: 13 }}>加载图片中…</div>}
          </div>
        </div>

        {/* 底部:保存(不扣费) */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: 12, color: '#8b8b92', flex: 1 }}>保存为新图片卡(免费,不生成);之后连线到图片生成卡或在新卡点生成</span>
          <button onClick={onClose} style={cancelBtn}>取消</button>
          <button onClick={handleSave} disabled={busy || !imgEl}
            style={{ ...genBtn, opacity: (busy || !imgEl) ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? '保存中…' : '保存涂鸦'}
          </button>
        </div>
      </div>
    </div>
  );
}

const toolBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
  border: active ? '1px solid rgba(16,185,129,0.55)' : '1px solid rgba(255,255,255,0.14)',
  background: active ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.05)',
  color: active ? '#6ee7b7' : '#d4d4d8', transition: 'all .15s',
});

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  background: 'rgba(6,10,8,0.8)', backdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};
const panel: React.CSSProperties = {
  width: 'min(1200px, 96vw)', height: 'min(900px, 95vh)',
  background: 'linear-gradient(180deg,#1a1d1b 0%,#141613 100%)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 22, boxShadow: '0 40px 120px rgba(0,0,0,0.85), 0 0 0 1px rgba(16,185,129,0.06) inset',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)',
};
const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 34, height: 34, borderRadius: 11,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
  color: '#a1a1aa', cursor: 'pointer', fontSize: 15,
};
const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px',
  borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap',
};
const divider: React.CSSProperties = { width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 8px' };
const swatch: React.CSSProperties = {
  width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', padding: 0, border: 'none',
};
const sizeBtn: React.CSSProperties = {
  width: 36, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const textBtn: React.CSSProperties = {
  padding: '8px 15px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
};
const canvasWrap: React.CSSProperties = {
  padding: 24, overflow: 'auto', textAlign: 'center',
  background: 'repeating-conic-gradient(#191c1a 0% 25%, #1f231f 0% 50%) 50% / 26px 26px',
  flex: 1, minHeight: 0,
};
const cancelBtn: React.CSSProperties = {
  padding: '11px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', cursor: 'pointer', fontSize: 14,
};
const genBtn: React.CSSProperties = {
  padding: '11px 26px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontSize: 14, fontWeight: 600,
  boxShadow: '0 8px 24px -6px rgba(16,185,129,0.6)',
};
