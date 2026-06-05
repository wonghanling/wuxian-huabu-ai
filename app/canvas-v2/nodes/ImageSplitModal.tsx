'use client';

import { useState, useRef } from 'react';

// ============================================================
// 图片切割弹窗(照原网 ImageSplitModal 1:1 复刻)
// 画布功能(非卡片):上传图片 → 三种模式切割 → JSZip 打包下载
//   grid   等分切割(行列预设/自定义)
//   custom 自定义切线(点击加横线/Shift加竖线/拖动/右键删)
//   select 框选切割(拖动框选区域/右键删框)
// ============================================================

export function ImageSplitModal({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [mode, setMode] = useState<'grid' | 'custom' | 'select'>('grid');
  const [hLines, setHLines] = useState<number[]>([]);
  const [vLines, setVLines] = useState<number[]>([]);
  const [draggingLine, setDraggingLine] = useState<{ type: 'h' | 'v'; idx: number } | null>(null);
  const [boxes, setBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  };

  // 切线模式
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingLine) return;
    const rect = previewRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const threshold = 0.02;
    const nearH = hLines.findIndex((l) => Math.abs(l - y) < threshold);
    const nearV = vLines.findIndex((l) => Math.abs(l - x) < threshold);
    if (nearH >= 0 || nearV >= 0) return;
    if (e.shiftKey) setVLines((prev) => [...prev, x].sort((a, b) => a - b));
    else setHLines((prev) => [...prev, y].sort((a, b) => a - b));
  };
  const handleLineMouseDown = (e: React.MouseEvent, type: 'h' | 'v', idx: number) => {
    e.stopPropagation();
    setDraggingLine({ type, idx });
  };
  const handleCustomMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingLine) return;
    const rect = previewRef.current!.getBoundingClientRect();
    if (draggingLine.type === 'h') {
      const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
      setHLines((prev) => { const n = [...prev]; n[draggingLine.idx] = y; return [...n].sort((a, b) => a - b); });
    } else {
      const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      setVLines((prev) => { const n = [...prev]; n[draggingLine.idx] = x; return [...n].sort((a, b) => a - b); });
    }
  };
  const handleLineContextMenu = (e: React.MouseEvent, type: 'h' | 'v', idx: number) => {
    e.preventDefault(); e.stopPropagation();
    if (type === 'h') setHLines((prev) => prev.filter((_, i) => i !== idx));
    else setVLines((prev) => prev.filter((_, i) => i !== idx));
  };

  // 框选模式
  const getRelPos = (e: React.MouseEvent) => {
    const rect = previewRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };
  const handleSelectMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setDrawing(getRelPos(e)); setCurrentBox(null);
  };
  const handleSelectMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const pos = getRelPos(e);
    setCurrentBox({ x: Math.min(drawing.x, pos.x), y: Math.min(drawing.y, pos.y), w: Math.abs(pos.x - drawing.x), h: Math.abs(pos.y - drawing.y) });
  };
  const handleSelectMouseUp = () => {
    if (currentBox && currentBox.w > 0.01 && currentBox.h > 0.01) setBoxes((prev) => [...prev, currentBox]);
    setDrawing(null); setCurrentBox(null);
  };

  const handleSplit = async () => {
    if (!image) return;
    setIsSplitting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const W = image.naturalWidth, H = image.naturalHeight;
      if (mode === 'grid') {
        const cellW = Math.floor(W / cols), cellH = Math.floor(H / rows);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const canvas = document.createElement('canvas');
          canvas.width = cellW; canvas.height = cellH;
          canvas.getContext('2d')!.drawImage(image, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          zip.file(`${r + 1}-${c + 1}.png`, blob);
        }
      } else if (mode === 'custom') {
        const xs = [0, ...vLines.map((v) => Math.round(v * W)), W];
        const ys = [0, ...hLines.map((h) => Math.round(h * H)), H];
        let idx = 1;
        for (let r = 0; r < ys.length - 1; r++) for (let c = 0; c < xs.length - 1; c++) {
          const x = xs[c], y = ys[r], w = xs[c + 1] - xs[c], h = ys[r + 1] - ys[r];
          if (w <= 0 || h <= 0) continue;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(image, x, y, w, h, 0, 0, w, h);
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          zip.file(`${idx++}.png`, blob);
        }
      } else {
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          const x = Math.round(b.x * W), y = Math.round(b.y * H), w = Math.round(b.w * W), h = Math.round(b.h * H);
          if (w <= 0 || h <= 0) continue;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(image, x, y, w, h, 0, 0, w, h);
          const blob = await new Promise<Blob>((res) => canvas.toBlob((bl) => res(bl!), 'image/png'));
          zip.file(`${i + 1}.png`, blob);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'grid' ? `split_${rows}x${cols}.zip` : 'split_custom.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsSplitting(false);
    }
  };

  const PRESETS = [{ label: '2×2', r: 2, c: 2 }, { label: '3×3', r: 3, c: 3 }, { label: '4×4', r: 4, c: 4 }, { label: '5×5', r: 5, c: 5 }];
  const customPieceCount = (hLines.length + 1) * (vLines.length + 1);
  const splitDisabled = !image || isSplitting ||
    (mode === 'custom' && hLines.length === 0 && vLines.length === 0) ||
    (mode === 'select' && boxes.length === 0);
  const splitLabel = isSplitting ? '切割中…' :
    mode === 'grid' ? `切割并下载 (${rows * cols} 张)` :
    mode === 'custom' ? `切割并下载 (${customPieceCount} 张)` :
    `切割并下载 (${boxes.length} 张)`;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999 }} onClick={onClose} />
      <div className="cv2-scroll" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10000, width: 520, maxHeight: '90vh', overflowY: 'auto', background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.7)', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontWeight: 600, fontSize: 16, margin: 0 }}>图片切割</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: '#a1a1aa', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        {/* 模式切换 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['grid', 'custom', 'select'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.05)',
                color: mode === m ? '#fff' : '#a1a1aa',
                border: `1px solid ${mode === m ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
              {m === 'grid' ? '等分切割' : m === 'custom' ? '自定义切线' : '框选切割'}
            </button>
          ))}
        </div>

        {/* 上传区 */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{ border: `2px dashed ${isDragging ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 12, padding: image ? 12 : 28, textAlign: 'center', cursor: 'pointer', marginBottom: 16, transition: 'border-color .2s' }}
        >
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} />
          {image ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={image.src} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#fff', fontSize: 13, margin: 0, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageFile?.name}</p>
                <p style={{ color: '#71717a', fontSize: 11, margin: '2px 0 0' }}>{image.naturalWidth} × {image.naturalHeight}px · 点击更换</p>
              </div>
            </div>
          ) : (
            <p style={{ color: '#a1a1aa', fontSize: 13, margin: 0 }}>点击或拖拽上传图片</p>
          )}
        </div>

        {/* 等分模式 */}
        {mode === 'grid' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => { setRows(p.r); setCols(p.c); }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: rows === p.r && cols === p.c ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: rows === p.r && cols === p.c ? '#fff' : '#a1a1aa',
                    border: `1px solid ${rows === p.r && cols === p.c ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#71717a', fontSize: 11, margin: '0 0 4px' }}>列数</p>
                <input type="number" min={1} max={20} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#71717a', fontSize: 11, margin: '0 0 4px' }}>行数</p>
                <input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            {image && <p style={{ color: '#52525b', fontSize: 11, margin: '8px 0 0' }}>每张 {Math.floor(image.naturalWidth / cols)} × {Math.floor(image.naturalHeight / rows)}px，共 {rows * cols} 张</p>}
          </div>
        )}

        {/* 自定义切线模式 */}
        {mode === 'custom' && image && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#a1a1aa', fontSize: 11, margin: '0 0 2px' }}>点击添加横线，Shift+点击添加竖线，拖动调整，右键删除</p>
            <p style={{ color: '#52525b', fontSize: 11, margin: '0 0 8px' }}>{hLines.length} 横线 · {vLines.length} 竖线 · 共 {customPieceCount} 块</p>
            <div ref={previewRef} style={{ position: 'relative', width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', cursor: 'crosshair', userSelect: 'none', aspectRatio: `${image.naturalWidth}/${image.naturalHeight}` }}
              onClick={handlePreviewClick} onMouseMove={handleCustomMouseMove} onMouseUp={() => setDraggingLine(null)} onMouseLeave={() => setDraggingLine(null)}>
              <img src={image.src} style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} draggable={false} />
              {hLines.map((y, i) => (
                <div key={`h-${i}`} style={{ position: 'absolute', left: 0, right: 0, top: `${y * 100}%`, height: 10, transform: 'translateY(-50%)', zIndex: 10, cursor: 'row-resize' }}
                  onMouseDown={(e) => handleLineMouseDown(e, 'h', i)} onContextMenu={(e) => handleLineContextMenu(e, 'h', i)}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 2, background: 'rgba(250,204,21,0.8)' }} />
                </div>
              ))}
              {vLines.map((x, i) => (
                <div key={`v-${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${x * 100}%`, width: 10, transform: 'translateX(-50%)', zIndex: 10, cursor: 'col-resize' }}
                  onMouseDown={(e) => handleLineMouseDown(e, 'v', i)} onContextMenu={(e) => handleLineContextMenu(e, 'v', i)}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 4, width: 2, background: 'rgba(96,165,250,0.8)' }} />
                </div>
              ))}
            </div>
            <button onClick={() => { setHLines([]); setVLines([]); }} style={{ marginTop: 8, fontSize: 11, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}>清除所有切线</button>
          </div>
        )}

        {/* 框选模式 */}
        {mode === 'select' && image && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#a1a1aa', fontSize: 11, margin: '0 0 2px' }}>在图片上拖动鼠标框选要切割的区域，右键删除框</p>
            <p style={{ color: '#52525b', fontSize: 11, margin: '0 0 8px' }}>已框选 {boxes.length} 个区域</p>
            <div ref={previewRef} style={{ position: 'relative', width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: 8, overflow: 'hidden', userSelect: 'none', cursor: 'crosshair', aspectRatio: `${image.naturalWidth}/${image.naturalHeight}` }}
              onMouseDown={handleSelectMouseDown} onMouseMove={handleSelectMouseMove} onMouseUp={handleSelectMouseUp} onMouseLeave={handleSelectMouseUp}>
              <img src={image.src} style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} draggable={false} />
              {boxes.map((b, i) => (
                <div key={i} style={{ position: 'absolute', border: '2px solid rgba(74,222,128,0.8)', background: 'rgba(74,222,128,0.1)', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                  onContextMenu={(e) => { e.preventDefault(); setBoxes((prev) => prev.filter((_, j) => j !== i)); }}>
                  <span style={{ position: 'absolute', top: 2, left: 4, color: '#86efac', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                </div>
              ))}
              {currentBox && (
                <div style={{ position: 'absolute', border: '2px solid rgba(96,165,250,0.8)', background: 'rgba(96,165,250,0.1)', pointerEvents: 'none', left: `${currentBox.x * 100}%`, top: `${currentBox.y * 100}%`, width: `${currentBox.w * 100}%`, height: `${currentBox.h * 100}%` }} />
              )}
            </div>
            <button onClick={() => setBoxes([])} style={{ marginTop: 8, fontSize: 11, color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}>清除所有框</button>
          </div>
        )}

        {mode !== 'grid' && !image && (
          <p style={{ color: '#71717a', fontSize: 11, marginBottom: 16 }}>请先上传图片</p>
        )}

        <button onClick={handleSplit} disabled={splitDisabled}
          style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 600,
            background: splitDisabled ? 'rgba(255,255,255,0.08)' : '#fff', color: splitDisabled ? '#52525b' : '#000',
            cursor: splitDisabled ? 'not-allowed' : 'pointer' }}>
          {splitLabel}
        </button>
      </div>
    </>
  );
}
