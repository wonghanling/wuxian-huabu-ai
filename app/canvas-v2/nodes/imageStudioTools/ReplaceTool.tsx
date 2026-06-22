'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { uploadMaskToStorage, getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// Replace 替换工具 — 涂抹区域 + 描述想替换成什么
// 复用涂抹逻辑，右面板突出"替换描述"
// 模型：ideogram-v2-edit（语义理解强，适合物体替换）
// ============================================================

const BRUSH_SIZES = [16, 32, 64];

const EXAMPLES = [
  '换成金色香水瓶',
  '替换成亚洲女性模特',
  '改成红色跑车',
  '换成白色背景',
  '替换成木质纹理',
];

export function ReplaceTool(ctx: ToolContext) {
  const { imageUrl, displaySize, imgNatural, overlaySlot, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [hasMask, setHasMask] = useState(false);
  const drawing = useRef(false);

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
    ctx2.fillStyle = 'rgba(99, 102, 241, 1)'; // 紫色涂抹，视觉上区别于 remove 的红色
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

  // ideogram: 黑=重绘，白=保留 → 涂过的区域输出为黑色
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
        // ideogram v3 白=重绘，黑=保留
        const v = painted ? 255 : 0;
        outData.data[i] = v; outData.data[i+1] = v; outData.data[i+2] = v; outData.data[i+3] = 255;
      }
      ctx2.putImageData(outData, 0, 0);
      out.toBlob((b) => { if (b) resolve(b); else reject(new Error('mask 导出失败')); }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    setError('');
    if (!hasMask) { setError('请先涂抹要替换的对象'); return; }
    if (!prompt.trim()) { setError('请描述要替换成什么'); return; }
    setBusy(true);
    try {
      const blob = await exportMaskBlob();
      const maskUrl = await uploadMaskToStorage(blob);
      if (!maskUrl) { setBusy(false); return; }
      const userId = await getUserId();
      const res = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl, maskUrl,
          prompt: prompt.trim(),
          mode: 'replace',
          provider: 'fal',
          model: 'ideogram-v2-edit',
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '替换失败');
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
        if (attempts > 60) throw new Error('替换超时');
        return poll();
      };
      const newUrl = await poll();
      pushVersion(newUrl);
      clearMask();
    } catch (e: any) {
      setError(e.message || '替换失败');
    } finally {
      setBusy(false);
    }
  };

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
        cursor: 'crosshair', opacity: 0.5, touchAction: 'none',
      }}
    />,
    overlaySlot
  );

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={lbl}>画笔</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BRUSH_SIZES.map((s) => (
            <button key={s} onClick={() => { setBrushSize(s); setEraser(false); }} style={chip(brushSize === s && !eraser)}>{s}</button>
          ))}
          <button onClick={() => setEraser(!eraser)} style={chip(eraser)}>橡皮</button>
          <button onClick={clearMask} style={chip(false)}>清除</button>
        </div>
      </div>

      <div>
        <div style={lbl}>替换成什么？</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="建议英文输入效果更好，例如：replace with a golden perfume bottle / replace with Asian female model"
          rows={3}
          style={textarea}
        />
        {/* 示例快选 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                border: '1px solid rgba(0,0,0,0.1)', background: '#f4f4f5', color: '#52525b',
              }}
            >{ex}</button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '替换中…' : '替换（0.5元/次）'}
      </button>

      <p style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
        涂抹要替换的对象，描述替换后的样子。支持中文。
      </p>
    </div>,
    panelSlot
  );

  return <>{overlay}{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(45,140,90,0.5)' : 'rgba(0,0,0,0.1)'),
  background: active ? 'rgba(45,140,90,0.08)' : '#fff',
  color: active ? '#2d8c5a' : '#52525b',
});
const textarea: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: 10, color: '#18181b', fontSize: 13, resize: 'vertical', outline: 'none',
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
