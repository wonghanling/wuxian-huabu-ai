'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { editDesignImage, uploadMaskToStorage, getUserId, type DesignEditMode } from '../lib/api';

// ============================================================
// EditModal — Design Workflow 统一编辑弹窗
// V1：手涂 mask + prompt → 局部重绘（region-edit）
// 预留：Auto Select(SAM2)、remove/replace/expand
// ============================================================

interface EditModalProps {
  imageUrl: string;
  onResult: (newUrl: string) => void;
  onClose: () => void;
}

type SelectMode = 'brush' | 'auto';
type ModelKey = 'ideogram-v2-edit' | 'flux-inpainting';

const BRUSH_SIZES = [16, 32, 64];

export function EditModal({ imageUrl, onResult, onClose }: EditModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [selectMode, setSelectMode] = useState<SelectMode>('brush');
  const [brushSize, setBrushSize] = useState(32);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ModelKey>('ideogram-v2-edit');
  const [hasMask, setHasMask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const drawing = useRef(false);

  // 图片加载完成 → 拿到原始尺寸，按容器算显示尺寸
  const onImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    setImgNatural({ w: nw, h: nh });
    // 显示区最大 560x560，等比缩放
    const max = 560;
    const scale = Math.min(1, max / Math.max(nw, nh));
    setDisplaySize({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
  }, []);

  // 显示尺寸确定后，初始化 mask canvas（与原图等像素，保证导出精度）
  useEffect(() => {
    if (!imgNatural) return;
    const c = maskCanvasRef.current;
    if (!c) return;
    c.width = imgNatural.w;
    c.height = imgNatural.h;
    const ctx = c.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, c.width, c.height); }
    setHasMask(false);
  }, [imgNatural]);

  // 把显示坐标换算到 canvas 原始像素坐标
  const toCanvasXY = (e: React.PointerEvent) => {
    const c = maskCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * c.width;
    const y = (e.clientY - rect.top) / rect.height * c.height;
    return { x, y };
  };

  const paint = (e: React.PointerEvent) => {
    const c = maskCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const { x, y } = toCanvasXY(e);
    // 画笔半径按显示比例换算到原始像素
    const scale = c.width / displaySize.w;
    const r = (brushSize / 2) * scale;
    ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,1)'; // 用户涂白=重绘区
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (!eraser) setHasMask(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (selectMode !== 'brush') return;
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    paint(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    paint(e);
  };
  const onPointerUp = () => { drawing.current = false; };

  const clearMask = () => {
    const c = maskCanvasRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasMask(false);
  };

  // 按选中 model 的极性导出 mask PNG（黑底）
  // 用户涂白=重绘区。ideogram: 黑=重绘 → 反转；flux: 白=重绘 → 直接
  const exportMaskBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const src = maskCanvasRef.current!;
      const out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      const ctx = out.getContext('2d')!;
      const srcCtx = src.getContext('2d')!;
      const srcData = srcCtx.getImageData(0, 0, src.width, src.height);
      const outData = ctx.createImageData(src.width, src.height);
      const invert = model === 'ideogram-v2-edit'; // ideogram 黑=重绘
      for (let i = 0; i < srcData.data.length; i += 4) {
        const painted = srcData.data[i + 3] > 10; // 该像素被涂过（alpha>0）
        // 重绘区目标色：flux=白(255)，ideogram=黑(0)
        // 保留区目标色：相反
        let v: number;
        if (invert) v = painted ? 0 : 255;   // ideogram: 涂过→黑，没涂→白
        else        v = painted ? 255 : 0;   // flux: 涂过→白，没涂→黑
        outData.data[i] = v;
        outData.data[i + 1] = v;
        outData.data[i + 2] = v;
        outData.data[i + 3] = 255;
      }
      ctx.putImageData(outData, 0, 0);
      out.toBlob((b) => { if (b) resolve(b); else reject(new Error('mask 导出失败')); }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    setErr('');
    if (!hasMask) { setErr('请先涂抹要修改的区域'); return; }
    if (!prompt.trim()) { setErr('请输入描述'); return; }
    setBusy(true);
    try {
      const blob = await exportMaskBlob();
      const maskUrl = await uploadMaskToStorage(blob);
      if (!maskUrl) { setBusy(false); return; }
      const userId = await getUserId();
      const newUrl = await editDesignImage({
        imageUrl,
        maskUrl,
        prompt: prompt.trim(),
        mode: 'region-edit' as DesignEditMode,
        provider: 'fal',
        model,
        userId,
      });
      onResult(newUrl);
    } catch (e: any) {
      setErr(e.message || '生成失败');
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#0f0f11', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
        width: 'min(960px, 95vw)', maxHeight: '92vh', overflow: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>AI Edit · 局部重绘</span>
            {/* 选区方式切换（Auto Select 预留） */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3 }}>
              <button
                onClick={() => setSelectMode('brush')}
                style={tabBtn(selectMode === 'brush')}
              >Brush 涂抹</button>
              <button
                disabled
                title="即将上线：点击物体自动选区"
                style={{ ...tabBtn(false), opacity: 0.4, cursor: 'not-allowed' }}
              >Auto Select · 即将上线</button>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* 主体：左画布 + 右操作 */}
        <div style={{ display: 'flex', gap: 18, padding: 18, flexWrap: 'wrap' }}>
          {/* 左：图 + mask canvas 叠层 */}
          <div style={{ flex: '1 1 420px', minWidth: 300 }}>
            <div style={{ position: 'relative', width: displaySize.w || '100%', height: displaySize.h || 'auto', margin: '0 auto', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
              <img
                ref={imgRef}
                src={imageUrl}
                onLoad={onImgLoad}
                crossOrigin="anonymous"
                alt=""
                style={{ display: 'block', width: displaySize.w || '100%', height: displaySize.h || 'auto', userSelect: 'none', pointerEvents: 'none' }}
              />
              <canvas
                ref={maskCanvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{
                  position: 'absolute', inset: 0,
                  width: displaySize.w || '100%', height: displaySize.h || '100%',
                  cursor: 'crosshair', opacity: 0.5,
                  touchAction: 'none',
                }}
              />
            </div>
            {/* 工具栏 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#71717a', fontSize: 12 }}>画笔</span>
              {BRUSH_SIZES.map((s) => (
                <button key={s} onClick={() => { setBrushSize(s); setEraser(false); }} style={sizeBtn(brushSize === s && !eraser)}>{s}</button>
              ))}
              <button onClick={() => setEraser(!eraser)} style={sizeBtn(eraser)}>橡皮擦</button>
              <button onClick={clearMask} style={{ ...sizeBtn(false), marginLeft: 'auto' }}>清除</button>
            </div>
          </div>

          {/* 右：prompt + 模型 + 生成 */}
          <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={lbl}>描述要生成的内容</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：把这件衣服换成红色 / 替换成蓝天背景"
                rows={4}
                style={textarea}
              />
            </div>
            <div>
              <label style={lbl}>模型</label>
              <select value={model} onChange={(e) => setModel(e.target.value as ModelKey)} style={select}>
                <option value="ideogram-v2-edit">Ideogram V2（海报/文字/广告，推荐）</option>
                <option value="flux-inpainting">Flux Inpainting（纯图像重绘）</option>
              </select>
            </div>
            {err && <div style={{ color: '#f87171', fontSize: 12 }}>{err}</div>}
            <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
              {busy ? '生成中…' : '生成（0.5元/次）'}
            </button>
            <p style={{ color: '#52525b', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
              涂抹要修改的区域，输入描述后生成。仅重绘选中区域，其余保持不变。
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', fontSize: 12, borderRadius: 6, border: 'none', cursor: 'pointer',
  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
  color: active ? '#fff' : '#a1a1aa',
});
const sizeBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(45,106,79,0.6)' : 'rgba(255,255,255,0.12)'),
  background: active ? 'rgba(45,106,79,0.2)' : 'rgba(255,255,255,0.04)',
  color: active ? '#6db891' : '#d4d4d8',
});
const lbl: React.CSSProperties = { display: 'block', color: '#a1a1aa', fontSize: 12, marginBottom: 6 };
const textarea: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, resize: 'vertical', outline: 'none',
};
const select: React.CSSProperties = {
  width: '100%', background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 13, outline: 'none',
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#3f3f46' : '#fff', color: busy ? '#a1a1aa' : '#000', fontWeight: 600, fontSize: 14,
});
