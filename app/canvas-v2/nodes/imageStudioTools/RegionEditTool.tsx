'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { editDesignImage, uploadMaskToStorage, getUserId, type DesignEditMode } from '../../lib/api';
import type { ToolContext } from './types';
import { MASK_PRESETS } from './presets';

// ============================================================
// Region Edit 工具 — 涂抹区域 + prompt 局部重绘
// 用户选"预设(任务)"，内部映射 provider/model；mask 极性按所选模型反转
// ============================================================

const BRUSH_SIZES = [16, 32, 64];

export function RegionEditTool(ctx: ToolContext) {
  const { imageUrl, displaySize, imgNatural, overlaySlot, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(32);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [presetId, setPresetId] = useState(MASK_PRESETS[0]?.id ?? '');
  const [hasMask, setHasMask] = useState(false);
  const drawing = useRef(false);

  const preset = MASK_PRESETS.find((p) => p.id === presetId) ?? MASK_PRESETS[0];

  // imgNatural 确定后初始化 mask canvas（与原图等像素）
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
    ctx2.fillStyle = 'rgba(45,140,90,1)';
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

  // 按 model 极性导出 mask（黑底）。用户涂区=重绘区
  // ideogram v3: 白=重绘区域 → 直接导出；flux-fill 也是白=重绘 → 直接
  const exportMaskBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const src = maskCanvasRef.current!;
      const out = document.createElement('canvas');
      out.width = src.width; out.height = src.height;
      const ctx2 = out.getContext('2d')!;
      const srcData = src.getContext('2d')!.getImageData(0, 0, src.width, src.height);
      const outData = ctx2.createImageData(src.width, src.height);
      // ideogram v3 和 flux-fill 都是白=重绘,无需反转
      for (let i = 0; i < srcData.data.length; i += 4) {
        const painted = srcData.data[i + 3] > 10;
        const v = painted ? 255 : 0;
        outData.data[i] = v; outData.data[i + 1] = v; outData.data[i + 2] = v; outData.data[i + 3] = 255;
      }
      ctx2.putImageData(outData, 0, 0);
      out.toBlob((b) => { if (b) resolve(b); else reject(new Error('mask 导出失败')); }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    setError('');
    if (!hasMask) { setError('请先涂抹要修改的区域'); return; }
    if (!prompt.trim()) { setError('请输入描述'); return; }
    setBusy(true);
    try {
      const blob = await exportMaskBlob();
      const maskUrl = await uploadMaskToStorage(blob) || undefined;
      if (!maskUrl) { setBusy(false); return; }
      const userId = await getUserId();
      const newUrl = await editDesignImage({
        imageUrl,
        maskUrl,
        prompt: prompt.trim(),
        mode: 'region-edit' as DesignEditMode,
        provider: preset.provider,
        model: preset.model,
        userId,
      });
      pushVersion(newUrl);
      clearMask();
    } catch (e: any) {
      setError(e.message || '生成失败');
    } finally {
      setBusy(false);
    }
  };

  // ── 覆盖层：mask 涂抹 canvas（叠在图上）──
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

  // ── 右面板：画笔 + prompt + 模型 + 生成 ──
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
        <div style={lbl}>描述要生成的内容</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="例如：把衣服换成红色 / 替换成蓝天背景"
          rows={4}
          style={textarea}
        />
        {/* 快速 prompt 按钮 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <button onClick={() => setPrompt('替换成纯白背景，保留主体')} style={quickBtn}>白底</button>
          <button onClick={() => setPrompt('改成红色')} style={quickBtn}>改颜色</button>
          <button onClick={() => setPrompt('删除该区域，背景自然填充')} style={quickBtn}>删除对象</button>
        </div>
      </div>
      <div>
        <div style={lbl}>预设能力</div>
        <select value={presetId} onChange={(e) => setPresetId(e.target.value)} style={select}>
          {MASK_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <p style={{ color: '#a1a1aa', fontSize: 11, margin: '6px 0 0' }}>{preset?.desc}</p>
        <p style={{ color: '#c4c4c8', fontSize: 10, margin: '3px 0 0' }}>模型：{preset?.model}</p>
      </div>
      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '生成中…' : `生成（${preset.price}元/次）`}
      </button>
      <p style={{ color: '#71717a', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
        涂抹要修改的区域，输入描述后生成。仅重绘选中区域。
      </p>
    </div>,
    panelSlot
  );

  return <>{overlay}{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const quickBtn: React.CSSProperties = {
  fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
  border: '1px solid rgba(0,0,0,0.1)', background: '#f4f4f5', color: '#52525b',
};
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(45,140,90,0.5)' : 'rgba(0,0,0,0.12)'),
  background: active ? 'rgba(45,140,90,0.12)' : '#fff',
  color: active ? '#2d8c5a' : '#52525b',
});
const textarea: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: 10, color: '#18181b', fontSize: 13, resize: 'vertical', outline: 'none',
};
const select: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: '8px 10px', color: '#18181b', fontSize: 13, outline: 'none',
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
