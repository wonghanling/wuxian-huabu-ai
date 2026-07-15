'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { uploadImageToStorage, getUserId } from '../lib/api';

// ============================================================
// 涂鸦工作台(Doodle Studio)
// 从画布顶栏打开的大弹窗:上传图片 → 涂抹/画圈/写文字 → 发送到画布(新建图片卡)
// portal 渲染到 body,规避 React Flow 节点 transform 导致 fixed 定位错乱
// 双层 canvas:底层原图 + 上层涂鸦;图用 fetch→blob 加载规避跨域污染
// ============================================================

const COLORS = ['#ff3b30', '#ffcc00', '#34c759', '#0a84ff', '#ffffff', '#000000'];
const SIZES = [4, 8, 16];

// Seedream 5.0 Pro 交互编辑三种模式的引导预设(用户可再修改)
const EDIT_MODES: { key: string; label: string; hint: string; preset: string }[] = [
  { key: 'free', label: '自由编辑', hint: '涂抹/圈选标记区域，描述要做什么',
    preset: '' },
  { key: 'mark', label: '任意标记', hint: '用画笔圈出/箭头标记区域，描述在标记处添加或替换的内容',
    preset: '根据手绘草图对图像进行编辑，在标记区域内生成对应内容，移除所有草图线条，保持构图不变，让新内容自然融入原场景。' },
  { key: 'coord', label: '精准坐标', hint: '在图上点标记点，描述各标记点对应的编辑',
    preset: '根据图中的标记对应关系进行局部编辑：将标注位置的元素按描述替换/定位。' },
  { key: 'layer', label: '图层分离', hint: '无需标记，直接描述如何重排图层元素',
    preset: '对输入图进行精确图层分离，识别并独立拆分标题文字、主体、背景与装饰元素，重新排版为更协调的构图。' },
];

type Tool = 'pen' | 'eraser' | 'text';

interface Props {
  imageUrl?: string;   // 可选:从图片卡带入的图;不传则显示上传入口
  onClose: () => void;
  onConfirm: (args: { doodleUrl: string }) => void;
  onGenerated?: (args: { imageUrl: string; prompt: string }) => void; // Seedream 生成结果 → 新建图片卡
}

export function DoodleModal({ imageUrl, onClose, onConfirm, onGenerated }: Props) {
  const baseRef = useRef<HTMLCanvasElement>(null);   // 底图层
  const drawRef = useRef<HTMLCanvasElement>(null);   // 涂鸦层(线条+文字)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | undefined>(imageUrl); // 当前底图来源(上传后更新)
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [tool, setTool] = useState<Tool>('pen');
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState('free');       // Seedream 交互编辑模式
  const [prompt, setPrompt] = useState('');                // 编辑指令
  const [generating, setGenerating] = useState(false);     // Seedream 生成中
  const [resultUrl, setResultUrl] = useState<string | null>(null); // 生成结果(弹窗内预览,不直接关窗)
  // 文字输入态:点击位置出现输入框
  const [textInput, setTextInput] = useState<{ x: number; y: number; cx: number; cy: number; value: string } | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  // 加载图片(fetch→blob→objectURL,规避跨域污染)
  useEffect(() => {
    if (!srcUrl) { setImgEl(null); return; }
    let revoked = '';
    (async () => {
      try {
        const res = await fetch(srcUrl, { mode: 'cors' });
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
        img.src = srcUrl;
      }
    })();
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [srcUrl]);

  // 上传图片(本地文件 → objectURL 当底图)
  const handleUpload = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setSrcUrl(URL.createObjectURL(f));
  };

  // 图片加载后画底图(等比,最长边 1024)
  useEffect(() => {
    if (!imgEl || !baseRef.current || !drawRef.current) return;
    const maxSide = 1600;
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

  // 用 Seedream 5.0 Pro 生成:合成底图+涂鸦 → 上传 → 调火山编辑 → 结果新建图片卡
  const handleGenerate = useCallback(async () => {
    if (!baseRef.current || !drawRef.current || generating) return;
    if (!prompt.trim()) { alert('请先填写编辑指令'); return; }
    setGenerating(true);
    try {
      const w = baseRef.current.width, h = baseRef.current.height;
      const merged = document.createElement('canvas');
      merged.width = w; merged.height = h;
      const mctx = merged.getContext('2d')!;
      mctx.drawImage(baseRef.current, 0, 0);
      mctx.drawImage(drawRef.current, 0, 0);
      const blob: Blob = await new Promise((resolve, reject) =>
        merged.toBlob((b) => b ? resolve(b) : reject(new Error('合成失败')), 'image/jpeg', 0.92));
      const file = new File([blob], `doodle-edit-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const uploadedUrl = await uploadImageToStorage(file);
      if (!uploadedUrl) throw new Error('上传失败');

      const userId = await getUserId();
      const res = await fetch('/api/design/seedream-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadedUrl, prompt: prompt.trim(), userId }),
      });
      const data = await res.json();
      if (data.failed) { alert(data.reason || '审核未通过'); return; }
      if (!res.ok || !data.imageUrl) throw new Error(data.error || '生成失败');

      // 生成成功:弹窗内直接预览结果，不立即关窗(用户看效果后再决定发送到画布)
      setResultUrl(data.imageUrl);
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  }, [generating, prompt, onGenerated, onClose]);

  return createPortal((
    <div
      className="nodrag nopan nowheel"
      style={overlay}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="nodrag nopan nowheel" style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>图片交互编辑</span>
          <span style={{ fontSize: 12, color: '#8b8b92' }}>上传图片，涂抹/圈选/标记 + 编辑指令，用 Seedream 5.0 Pro 生成</span>
          <button onClick={onClose} style={closeBtn} title="关闭">✕</button>
        </div>

        {/* 工具条 */}
        <div style={toolbar}>
          <label style={{ ...textBtn, cursor: 'pointer' }}>
            上传图片
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
          </label>
          <span style={divider} />
          <span style={{ fontSize: 12, color: '#8b8b92', marginRight: 2 }}>颜色</span>
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              style={{ ...swatch, background: c, outline: color === c ? '2px solid #e4e4e7' : '1px solid rgba(255,255,255,0.2)', outlineOffset: 1 }} />
          ))}
          <span style={divider} />
          <span style={{ fontSize: 12, color: '#8b8b92', marginRight: 2 }}>粗细</span>
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              style={{ ...sizeBtn, outline: size === s ? '2px solid #e4e4e7' : '1px solid rgba(255,255,255,0.15)' }}>
              <span style={{ width: s, height: s, borderRadius: '50%', background: '#e4e4e7', display: 'block' }} />
            </button>
          ))}
          <span style={divider} />
          <button onClick={() => setTool('pen')} style={toolBtnStyle(tool === 'pen')}>画笔</button>
          <button onClick={() => setTool('text')} style={toolBtnStyle(tool === 'text')}>文字</button>
          <button onClick={() => setTool('eraser')} style={toolBtnStyle(tool === 'eraser')}>橡皮擦</button>
          <button onClick={clearDoodle} style={textBtn}>清空</button>
        </div>

        {/* 生成结果预览浮层:成功后不关窗，先在弹窗内展示，用户决定发送到画布或继续编辑 */}
        {resultUrl && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(10,12,11,0.94)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          }}>
            <div style={{ fontSize: 13, color: '#34c759', fontWeight: 600 }}>✓ 生成成功</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultUrl} alt="生成结果" style={{ maxWidth: '80%', maxHeight: '62vh', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  // 把刚生成的图作为新底图，可继续涂鸦/编辑(迭代);清空指令与预览
                  setSrcUrl(resultUrl);
                  setPrompt('');
                  setResultUrl(null);
                }}
                style={cancelBtn}>
                在此图上继续编辑
              </button>
              <button
                onClick={() => { onGenerated?.({ imageUrl: resultUrl, prompt: prompt.trim() }); onClose(); }}
                style={genBtn}>
                发送到画布
              </button>
            </div>
          </div>
        )}

        {/* 画布区:图片直接铺,无容器无滚动条 */}
        <div style={canvasWrap} className="cv2-scroll">
          {srcUrl ? (
            <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, verticalAlign: 'top' }}>
              <canvas ref={baseRef} style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(94vh - 210px)', width: 'auto', height: 'auto', borderRadius: 8 }} />
              <canvas ref={drawRef}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', cursor: tool === 'text' ? 'text' : 'crosshair', touchAction: 'none' }} />
              {/* 文字输入浮层(相对画布定位) */}
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
                    font: `bold ${Math.max(15, size * 2.5)}px sans-serif`, color, lineHeight: 1.2,
                    background: 'rgba(0,0,0,0.6)', border: `1px solid ${color}`, borderRadius: 6,
                    padding: '2px 6px', outline: 'none', width: 180, maxWidth: '60%', zIndex: 5,
                  }}
                />
              )}
              {!imgEl && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: 13 }}>加载图片中…</div>}
            </div>
          ) : (
            <label style={uploadDrop}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
              <div style={{ fontSize: 15, color: '#e4e4e7', marginBottom: 6 }}>点击上传图片</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>上传后即可在图上涂抹、画圈、写文字标注</div>
            </label>
          )}
        </div>

        {/* 底部:编辑模式 + 指令 + 生成/发送 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 编辑模式选择 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {EDIT_MODES.map((m) => (
              <button key={m.key}
                onClick={() => { setEditMode(m.key); if (m.preset) setPrompt(m.preset); }}
                style={toolBtnStyle(editMode === m.key)}>
                {m.label}
              </button>
            ))}
            <span style={{ fontSize: 11.5, color: '#71717a', marginLeft: 4 }}>
              {EDIT_MODES.find((m) => m.key === editMode)?.hint}
            </span>
          </div>
          {/* 编辑指令 */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要的编辑，例如：把标记处替换成一杯咖啡，移除草图线条，自然融入场景"
            rows={2}
            style={{
              width: '100%', resize: 'none', borderRadius: 10, padding: '9px 12px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fafafa', fontSize: 13, lineHeight: 1.5, outline: 'none',
            }}
          />
          {/* 按钮行 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11.5, color: '#71717a', flex: 1, minWidth: 0 }}>
              Seedream 5.0 Pro 编辑 ¥0.6/次；或免费发送标注图到画布
            </span>
            <button onClick={onClose} style={cancelBtn}>取消</button>
            <button onClick={handleSave} disabled={busy || generating || !imgEl || !srcUrl}
              style={{ ...cancelBtn, opacity: (busy || generating || !imgEl || !srcUrl) ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {busy ? '处理中…' : '发送到画布(免费)'}
            </button>
            <button onClick={handleGenerate} disabled={generating || busy || !imgEl || !srcUrl || !prompt.trim()}
              style={{ ...genBtn, opacity: (generating || busy || !imgEl || !srcUrl || !prompt.trim()) ? 0.5 : 1, cursor: generating ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {generating ? '生成中…' : '用 Seedream 生成'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

const toolBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
  border: active ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.14)',
  background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
  color: active ? '#fafafa' : '#d4d4d8', transition: 'all .15s',
});

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 2147483647,
  background: 'rgba(6,10,8,0.8)', backdropFilter: 'blur(12px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};
const panel: React.CSSProperties = {
  position: 'relative',
  width: '92vw', maxWidth: 1400, height: '94vh', maxHeight: '94vh',
  background: 'linear-gradient(180deg,#1a1d1b 0%,#141613 100%)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 20, boxShadow: '0 40px 120px rgba(0,0,0,0.85), 0 0 0 1px rgba(16,185,129,0.06) inset',
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
  flex: 1, minHeight: 0, overflow: 'auto',
  padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#0e100e',
};
const uploadDrop: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  width: 'min(680px,80vw)', height: 'min(440px,60vh)', cursor: 'pointer',
  border: '2px dashed rgba(255,255,255,0.18)', borderRadius: 16, background: 'rgba(255,255,255,0.02)',
  textAlign: 'center',
};
const cancelBtn: React.CSSProperties = {
  padding: '11px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', cursor: 'pointer', fontSize: 14,
};
const genBtn: React.CSSProperties = {
  padding: '11px 26px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#e4e4e7,#a1a1aa)', color: '#0a0a0a', fontSize: 14, fontWeight: 600,
  boxShadow: '0 8px 24px -6px rgba(255,255,255,0.25)',
};
