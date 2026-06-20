'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RegionEditTool } from './imageStudioTools/RegionEditTool';
import { ExpandTool } from './imageStudioTools/ExpandTool';
import { RemoveTool } from './imageStudioTools/RemoveTool';
import { ReplaceTool } from './imageStudioTools/ReplaceTool';
import { BgReplaceTool } from './imageStudioTools/BgReplaceTool';
import { ExtractTool } from './imageStudioTools/ExtractTool';
import type { ImageTool, ToolContext } from './imageStudioTools/types';

// ============================================================
// Image Studio — 全屏图片编辑中心（浅色，对标 Canva/Photopea）
// 左工具栏 + 中大图编辑区 + 右操作面板 + 版本历史
// 工具插件化：TOOLS 注册表，加能力=加模块
// ============================================================

interface ImageStudioProps {
  initialImageUrl: string;
  onApply: (finalUrl: string) => void;   // 关闭时把最终版本写回画布
  onClose: () => void;
}

// 工具注册表（V1 只 region-edit 可用）
const TOOLS: ImageTool[] = [
  { id: 'region-edit', label: '局部重绘', enabled: true,  render: (ctx) => <RegionEditTool {...ctx} /> },
  { id: 'expand',      label: '扩图',    enabled: true,  render: (ctx) => <ExpandTool {...ctx} /> },
  { id: 'remove',      label: '消除',    enabled: true,  render: (ctx) => <RemoveTool {...ctx} /> },
  { id: 'replace',     label: '替换',    enabled: true,  render: (ctx) => <ReplaceTool {...ctx} /> },
  { id: 'bg-replace',  label: '换背景',  enabled: true,  render: (ctx) => <BgReplaceTool {...ctx} /> },
  { id: 'extract',     label: '抠图',    enabled: true,  render: (ctx) => <ExtractTool {...ctx} /> },
];

export function ImageStudio({ initialImageUrl, onApply, onClose }: ImageStudioProps) {
  const [activeTool, setActiveTool] = useState('region-edit');
  const [versions, setVersions] = useState<string[]>([initialImageUrl]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const currentUrl = versions[currentIdx];

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [overlaySlot, setOverlaySlot] = useState<HTMLElement | null>(null);
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null);

  // 图加载 → 算显示尺寸（编辑区最大 70vh / 64vw）
  const onImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    setImgNatural({ w: nw, h: nh });
    const maxW = Math.min(900, window.innerWidth * 0.5);
    const maxH = window.innerHeight * 0.7;
    const scale = Math.min(1, maxW / nw, maxH / nh);
    setDisplaySize({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
  }, []);

  // currentUrl 变化时重新测尺寸
  useEffect(() => { setImgNatural(null); }, [currentUrl]);

  const pushVersion = (url: string) => {
    setVersions((prev) => {
      const next = [...prev.slice(0, currentIdx + 1), url];
      setCurrentIdx(next.length - 1);
      return next;
    });
    setErr('');
  };

  const handleClose = () => {
    // 有编辑（版本>1 或当前非原图）→ 写回画布
    if (currentUrl && currentUrl !== initialImageUrl) onApply(currentUrl);
    onClose();
  };

  const tool = TOOLS.find((t) => t.id === activeTool)!;
  const ctx: ToolContext = {
    imageUrl: currentUrl, displaySize, imgNatural,
    overlaySlot, panelSlot, busy, setBusy, pushVersion, setError: setErr,
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#F8F9FB', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部条 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#18181b' }}>设计师专用</span>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>图片编辑中心</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleClose} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#18181b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>完成并返回画布</button>
          <button onClick={onClose} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: '#52525b', fontSize: 13, cursor: 'pointer' }}>✕</button>
        </div>
      </div>

      {/* 主体三栏 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左工具栏 */}
        <div style={{ width: 88, borderRight: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => t.enabled && setActiveTool(t.id)}
              disabled={!t.enabled}
              title={t.enabled ? t.label : t.hint}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px',
                borderRadius: 10, border: 'none', cursor: t.enabled ? 'pointer' : 'not-allowed',
                background: activeTool === t.id ? 'rgba(45,140,90,0.12)' : 'transparent',
                color: !t.enabled ? '#c4c4c8' : activeTool === t.id ? '#2d8c5a' : '#52525b',
                fontSize: 12, fontWeight: 500,
              }}
            >
              {t.label}
              {!t.enabled && <span style={{ fontSize: 9, color: '#c4c4c8' }}>即将上线</span>}
            </button>
          ))}
        </div>

        {/* 中编辑区 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 24 }}>
          {!currentUrl ? (
            /* 无图时：上传区 */
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, width: 360, height: 280, borderRadius: 16, border: '2px dashed rgba(0,0,0,0.15)', background: '#fff', cursor: 'pointer', color: '#a1a1aa' }}>
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#18181b', marginBottom: 6 }}>上传图片开始编辑</div>
                <div style={{ fontSize: 12 }}>支持 JPG、PNG、WebP</div>
              </div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                const f = e.target.files?.[0]; e.currentTarget.value = '';
                if (!f) return;
                const { uploadImageToStorage } = await import('../lib/api');
                const url = await uploadImageToStorage(f);
                if (url) { setVersions([url]); setCurrentIdx(0); }
              }} />
            </label>
          ) : (
            <div style={{ position: 'relative', width: displaySize.w || 'auto', height: displaySize.h || 'auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.12)', background: '#fff' }}>
              <img
                ref={imgRef}
                src={currentUrl}
                onLoad={onImgLoad}
                crossOrigin="anonymous"
                alt=""
                style={{ display: 'block', width: displaySize.w || 'auto', height: displaySize.h || 'auto', maxWidth: '50vw', maxHeight: '70vh', userSelect: 'none', pointerEvents: 'none' }}
              />
              {/* 工具覆盖层挂载点 */}
              <div ref={setOverlaySlot} style={{ position: 'absolute', inset: 0 }} />
              {busy && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.6)', color: '#18181b', fontSize: 14, fontWeight: 600 }}>
                  生成中…
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右面板 */}
        <div style={{ width: 320, borderLeft: '1px solid rgba(0,0,0,0.08)', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div style={{ padding: 18, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', marginBottom: 14 }}>{tool.label}</div>
            {/* 工具面板挂载点 */}
            <div ref={setPanelSlot} />
            {err && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{err}</div>}
          </div>

          {/* 版本历史 */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: 16 }}>
            <div style={{ fontSize: 12, color: '#52525b', fontWeight: 500, marginBottom: 10 }}>历史版本</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {versions.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  title={i === 0 ? '原图' : `版本 ${i}`}
                  style={{
                    width: 52, height: 52, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', padding: 0,
                    border: '2px solid ' + (currentIdx === i ? '#2d8c5a' : 'rgba(0,0,0,0.1)'),
                  }}
                >
                  <img src={v} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 当前工具（用 slot 渲染 overlay/panel）*/}
      {overlaySlot && panelSlot && tool.render(ctx)}
    </div>,
    document.body
  );
}
