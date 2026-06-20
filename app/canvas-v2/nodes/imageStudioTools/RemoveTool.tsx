'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { uploadMaskToStorage, getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// Remove 消除工具 — 涂抹要删除的对象，背景自动填充
// 使用 bria/eraser，涂白=要删除区域，无需 prompt
// ============================================================

const BRUSH_SIZES = [16, 32, 64];

export function RemoveTool(ctx: ToolContext) {
  const { imageUrl, displaySize, imgNatural, overlaySlot, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(32);
  const [eraser, setEraser] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const drawing = useRef(false);

  // 图片/尺寸变化时重置 mask canvas
  useEffect(() => {
    if (!imgNatural) return;
    const c = maskCanvasRef.current;
    if (!c) return;
    c.width = imgNatural.w;
    c.height = imgNatural.h;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasMask(false);
  }, [imgNatural, imageUrl]);

  const toCanvasXY = (e: React.PointerEvent) => {
    const c = maskCanvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * c.width,
      y: (e.clientY - rect.top) / rect.height * c.height,
    };
  };

  const paint = (e: React.PointerEvent) => {
    const c = maskCanvasRef.current;
    if (!c || !displaySize.w) return;
    const ctx2 = c.getContext('2d');
    if (!ctx2) return;
    const { x, y } = toCanvasXY(e);
    const scale = c.width / displaySize.w;
    const r = (brushSize / 2) * scale;
    ctx2.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
    ctx2.fillStyle = 'rgba(255, 80, 80, 1)'; // 红色涂抹，视觉上表示"要删除"
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fill();
    if (!eraser) setHasMask(true);
  };

  const onDown = (e: React.PointerEvent) => {
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    paint(e);
  };
  const onMove = (e: React.PointerEvent) => { if (drawing.current) paint(e); };
  const onUp = () => { drawing.current = false; };

  const clearMask = () => {
    const c = maskCanvasRef.current;
    if (!c) return;
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setHasMask(false);
  };

  // 导出 mask：涂红区域 → 白色（bria/eraser 白=要删除区域）
  const exportMaskBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const src = maskCanvasRef.current!;
      const out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const ctx2 = out.getContext('2d')!;
      const srcData = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
      const outData = ctx2.createImageData(src.width, src.height);
      for (let i = 0; i < srcData.data.length; i += 4) {
        const painted = srcData.data[i + 3] > 10;
        const v = painted ? 255 : 0; // 白=删除区，黑=保留
        outData.data[i] = v; outData.data[i+1] = v; outData.data[i+2] = v; outData.data[i+3] = 255;
      }
      ctx2.putImageData(outData, 0, 0);
      out.toBlob((b) => { if (b) resolve(b); else reject(new Error('mask 导出失败')); }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    setError('');
    if (!hasMask) { setError('请先涂抹要删除的对象'); return; }
    setBusy(true);
    try {
      const blob = await exportMaskBlob();
      const maskUrl = await uploadMaskToStorage(blob);
      if (!maskUrl) { setBusy(false); return; }
      const userId = await getUserId();
      const res = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, maskUrl, prompt: '', mode: 'remove', provider: 'fal', userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '消除失败');

      const { requestId, endpoint } = data;
      if (!requestId) throw new Error('未返回 requestId');
      let attempts = 0;
      const poll = async (): Promise<string> => {
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.error) throw new Error(qData.error);
        if (attempts > 60) throw new Error('消除超时');
        return poll();
      };
      const newUrl = await poll();
      pushVersion(newUrl);
      clearMask();
    } catch (e: any) {
      setError(e.message || '消除失败');
    } finally {
      setBusy(false);
    }
  };

  // 覆盖层：红色涂抹 canvas
  const overlay = overlaySlot && createPortal(
    <canvas
      ref={maskCanvasRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      style={{
        position: 'absolute', inset: 0,
        width: displaySize.w || '100%', height: displaySize.h || '100%',
        cursor: 'crosshair', opacity: 0.55, touchAction: 'none',
      }}
    />,
    overlaySlot
  );

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fff5f5', border: '1px solid rgba(220,38,38,0.15)', fontSize: 12, color: '#7f1d1d', lineHeight: 1.6 }}>
        用画笔<span style={{ color: '#dc2626', fontWeight: 600 }}>涂抹要删除的对象</span>，AI 自动填充背景，无需输入描述。
      </div>
      <div>
        <div style={lbl}>画笔</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BRUSH_SIZES.map((s) => (
            <button key={s} onClick={() => { setBrushSize(s); setEraser(false); }} style={chip(brushSize === s && !eraser, false)}>{s}</button>
          ))}
          <button onClick={() => setEraser(!eraser)} style={chip(eraser, false)}>橡皮</button>
          <button onClick={clearMask} style={chip(false, false)}>清除</button>
        </div>
      </div>
      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '消除中…' : '消除（0.5元/次）'}
      </button>
    </div>,
    panelSlot
  );

  return <>{overlay}{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const chip = (active: boolean, danger: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(45,140,90,0.5)' : 'rgba(0,0,0,0.1)'),
  background: active ? 'rgba(45,140,90,0.08)' : '#fff',
  color: active ? '#2d8c5a' : '#52525b',
});
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
