'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IMAGE_MODELS } from '../imageModels';
import { uploadImageToStorage } from '../lib/api';

// ============================================================
// 涂鸦编辑弹窗(Doodle Edit)
// 在图片上涂抹/画圈/画箭头 + 选模型 + 写需求 → 合成图当参考图 → 回传给 ImageNode 新建图片卡
// 双层 canvas:底层原图 + 上层涂鸦;生成时合成 → toBlob → File → uploadImageToStorage 拿 URL
// 图片用 fetch→blob→objectURL 加载,规避 Supabase 跨域导致 canvas 污染
// ============================================================

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#000000'];
const SIZES = [4, 8, 16];

// 可选模型:仅支持参考图(图生图)的 edit 模型
const EDIT_MODELS = IMAGE_MODELS.filter((m) => m.supportsImage);

interface Props {
  imageUrl: string;
  onClose: () => void;
  onConfirm: (args: { doodleUrl: string; model: string; prompt: string }) => void;
}

export function DoodleModal({ imageUrl, onClose, onConfirm }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);   // 底图层
  const drawRef = useRef<HTMLCanvasElement>(null);   // 涂鸦层
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [model, setModel] = useState(EDIT_MODELS[0]?.id || 'nano-banana-pro');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const composing = useRef(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

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
        // 兜底:直接用 crossOrigin
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setImgEl(img);
        img.src = imageUrl;
      }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [imageUrl]);

  // 图片加载后,把底图画上 canvas(等比,最长边 1024)
  useEffect(() => {
    if (!imgEl || !baseRef.current || !drawRef.current) return;
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
    const w = Math.round(imgEl.naturalWidth * scale);
    const h = Math.round(imgEl.naturalHeight * scale);
    [baseRef.current, drawRef.current].forEach((c) => { c.width = w; c.height = h; });
    const ctx = baseRef.current.getContext('2d');
    ctx?.drawImage(imgEl, 0, 0, w, h);
  }, [imgEl]);

  // 画布坐标换算(canvas 显示尺寸 → 内部像素)
  const getPos = (e: React.PointerEvent) => {
    const c = drawRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    };
  };

  const onDown = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = getPos(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = drawRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = eraser ? size * 2.5 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  };
  const onUp = () => { drawing.current = false; last.current = null; };

  const clearDoodle = () => {
    const c = drawRef.current; if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  };

  // 生成:合成底图+涂鸦 → File → 上传 → 回传
  const handleGenerate = useCallback(async () => {
    if (!baseRef.current || !drawRef.current || busy) return;
    if (!prompt.trim()) { alert('请填写涂鸦区域的需求'); return; }
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
      onConfirm({ doodleUrl: url, model, prompt: prompt.trim() });
      onClose();
    } catch (e: any) {
      alert('涂鸦生成失败: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }, [busy, prompt, model, onConfirm, onClose]);

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>涂鸦编辑</span>
          <span style={{ fontSize: 12, color: '#71717a' }}>在图上标注需要修改的位置,写出需求</span>
          <button onClick={onClose} style={closeBtn} title="关闭">✕</button>
        </div>

        {/* 工具条 */}
        <div style={toolbar}>
          {COLORS.map((c) => (
            <button key={c} onClick={() => { setColor(c); setEraser(false); }}
              style={{ ...swatch, background: c, outline: (!eraser && color === c) ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)' }} />
          ))}
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              style={{ ...sizeBtn, outline: size === s ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ width: s, height: s, borderRadius: '50%', background: '#e4e4e7', display: 'block' }} />
            </button>
          ))}
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
          <button onClick={() => setEraser(!eraser)} style={{ ...textBtn, color: eraser ? '#a78bfa' : '#d4d4d8', borderColor: eraser ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.15)' }}>橡皮</button>
          <button onClick={clearDoodle} style={textBtn}>清空</button>
        </div>

        {/* 画布区 */}
        <div style={canvasWrap} className="cv2-scroll">
          <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
            <canvas ref={baseRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '50vh', borderRadius: 8 }} />
            <canvas ref={drawRef}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }} />
            {!imgEl && <div style={{ padding: 40, color: '#71717a', fontSize: 13 }}>加载图片中…</div>}
          </div>
        </div>

        {/* 模型 + 需求 + 生成 */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>模型</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={select}>
              {EDIT_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onCompositionStart={() => { composing.current = true; }}
            onCompositionEnd={() => { composing.current = false; }}
            placeholder="描述涂鸦区域要改成什么,例如:把圈住的部分换成一顶红色帽子"
            style={promptArea}
            className="cv2-scroll"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={cancelBtn}>取消</button>
            <button onClick={handleGenerate} disabled={busy || !imgEl}
              style={{ ...genBtn, opacity: (busy || !imgEl) ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? '处理中…' : '生成(新建图片卡)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 99999,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};
const panel: React.CSSProperties = {
  width: 'min(820px, 95vw)', maxHeight: '92vh',
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 16, boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const closeBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 28, height: 28, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
  color: '#a1a1aa', cursor: 'pointer', fontSize: 13,
};
const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap',
};
const swatch: React.CSSProperties = {
  width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0,
};
const sizeBtn: React.CSSProperties = {
  width: 30, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.05)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const textBtn: React.CSSProperties = {
  padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer', fontSize: 12,
};
const canvasWrap: React.CSSProperties = {
  padding: 16, overflow: 'auto', textAlign: 'center', background: 'rgba(0,0,0,0.25)',
};
const select: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)', color: '#e4e4e7', fontSize: 13, outline: 'none',
};
const promptArea: React.CSSProperties = {
  width: '100%', minHeight: 60, resize: 'vertical', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
  padding: 10, color: '#e4e4e7', fontSize: 13, lineHeight: 1.6, outline: 'none',
};
const cancelBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', cursor: 'pointer', fontSize: 13,
};
const genBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 9, border: 'none',
  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 600,
};
