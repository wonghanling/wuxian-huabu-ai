'use client';

import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { uploadMaskToStorage, getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// GPT 高级编辑工具 — 两种模式:
// A. 涂抹局部编辑(有 mask + prompt)— 更精准
// B. 智能整图改图(无 mask,只 prompt)— 可能改变非目标区域
// 三档质量: low ¥0.15 / medium ¥0.5 / high ¥1.6
// ============================================================

const BRUSH_SIZES = [16, 32, 64];

const QUALITY_OPTIONS = [
  { value: 'gpt-edit-low', label: '低质量', price: 0.15, desc: '速度快,适合预览' },
  { value: 'gpt-edit-medium', label: '中质量', price: 0.5, desc: '日常编辑推荐' },
  { value: 'gpt-edit-high', label: '高质量', price: 1.6, desc: '最精细,适合成品' },
];

export function GptEditTool(ctx: ToolContext) {
  const { imageUrl, displaySize, imgNatural, overlaySlot, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(32);
  const [eraser, setEraser] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState('gpt-edit-medium');
  const [useMask, setUseMask] = useState(true); // 默认涂抹模式
  const [hasMask, setHasMask] = useState(false);
  const drawing = useRef(false);

  const selectedQuality = QUALITY_OPTIONS.find((q) => q.value === quality) ?? QUALITY_OPTIONS[1];

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
    ctx2.fillStyle = 'rgba(59, 130, 246, 1)'; // 蓝色涂抹
    ctx2.beginPath();
    ctx2.arc(x, y, r, 0, Math.PI * 2);
    ctx2.fill();
    if (!eraser) setHasMask(true);
  };

  const onDown = (e: React.PointerEvent) => {
    if (!useMask) return;
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

  // 导出 mask: 白=重绘区, 黑=保留
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
        const v = painted ? 255 : 0;
        outData.data[i] = v; outData.data[i + 1] = v; outData.data[i + 2] = v; outData.data[i + 3] = 255;
      }
      ctx2.putImageData(outData, 0, 0);
      out.toBlob((b) => { if (b) resolve(b); else reject(new Error('mask 导出失败')); }, 'image/png');
    });
  };

  const handleGenerate = async () => {
    setError('');
    if (!prompt.trim()) { setError('请输入编辑描述'); return; }
    if (useMask && !hasMask) { setError('请先涂抹要修改的区域，或切换到整图模式'); return; }
    setBusy(true);
    try {
      let maskUrl: string | undefined;
      if (useMask && hasMask) {
        const blob = await exportMaskBlob();
        maskUrl = await uploadMaskToStorage(blob) || undefined;
        if (!maskUrl) { setBusy(false); return; }
      }
      const userId = await getUserId();
      const res = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          maskUrl,
          prompt: prompt.trim(),
          mode: 'gpt-edit',
          provider: 'fal',
          model: quality,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '编辑失败');

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
        if (attempts > 60) throw new Error('编辑超时');
        return poll();
      };
      const newUrl = await poll();
      pushVersion(newUrl);
      if (useMask) clearMask();
    } catch (e: any) {
      setError(e.message || '编辑失败');
    } finally {
      setBusy(false);
    }
  };

  // 覆盖层:蓝色涂抹 canvas(仅涂抹模式显示)
  const overlay = overlaySlot && useMask && createPortal(
    <canvas
      ref={maskCanvasRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        cursor: 'crosshair', opacity: 0.5, touchAction: 'none',
      }}
    />,
    overlaySlot
  );

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 模式切换 */}
      <div>
        <div style={lbl}>编辑模式</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setUseMask(true)} style={modeBtn(useMask)}>涂抹局部编辑</button>
          <button onClick={() => setUseMask(false)} style={modeBtn(!useMask)}>智能整图改图</button>
        </div>
        <p style={{ color: '#a1a1aa', fontSize: 11, marginTop: 6 }}>
          {useMask ? '涂抹哪里就改哪里，更精准' : '不涂抹，直接用文字描述整体修改，可能影响整张图'}
        </p>
      </div>

      {/* 画笔(仅涂抹模式) */}
      {useMask && (
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
      )}

      {/* Prompt */}
      <div>
        <div style={lbl}>编辑描述</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={useMask ? '描述要修改的内容，如：把衣服换成红色' : '描述整体修改，如：把背景改成赛博朋克城市'}
          rows={4}
          style={textarea}
        />
      </div>

      {/* 质量选择 */}
      <div>
        <div style={lbl}>质量档位</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {QUALITY_OPTIONS.map((q) => (
            <button
              key={q.value}
              onClick={() => setQuality(q.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid ' + (quality === q.value ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.1)'),
                background: quality === q.value ? 'rgba(59,130,246,0.08)' : '#fff',
                color: quality === q.value ? '#2563eb' : '#18181b',
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: quality === q.value ? 600 : 400 }}>{q.label}</span>
              <span style={{ color: '#a1a1aa', fontSize: 11 }}>¥{q.price}/次 · {q.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '编辑中…' : `GPT 编辑（¥${selectedQuality.price}/次）`}
      </button>
    </div>,
    panelSlot
  );

  return <>{overlay}{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px', fontSize: 12, borderRadius: 7, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.12)'),
  background: active ? 'rgba(59,130,246,0.12)' : '#fff',
  color: active ? '#2563eb' : '#52525b',
});
const modeBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '8px 10px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
  border: '1px solid ' + (active ? 'rgba(59,130,246,0.5)' : 'rgba(0,0,0,0.1)'),
  background: active ? 'rgba(59,130,246,0.08)' : '#fff',
  color: active ? '#2563eb' : '#52525b',
});
const textarea: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: 10, color: '#18181b', fontSize: 13, resize: 'vertical', outline: 'none',
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
