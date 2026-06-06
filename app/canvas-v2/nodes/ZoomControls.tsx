'use client';

import { useEffect, useState } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';
import { useCanvasStore } from '../store';

// ============================================================
// 画布缩放器(照原网 ZoomControlsExternal 左下角胶囊条)
// 适应屏幕 | 重置 | − | 滑块 | + | 百分比 | 分隔 | 全部收起卡片
// 真实画布 zoom(useReactFlow) + 卡片收起(collapseAll)
// ============================================================

export function ZoomControls() {
  const rf = useReactFlow();
  const collapseAll = useCanvasStore((s) => s.collapseAll);
  const liveZoom = useStore((s) => s.transform[2]); // 实时 zoom
  const [zoom, setZoom] = useState(100);

  useEffect(() => { setZoom(Math.round((liveZoom ?? 1) * 100)); }, [liveZoom]);

  const applyZoom = (pct: number) => {
    const z = Math.max(25, Math.min(200, pct));
    rf.zoomTo(z / 100, { duration: 150 });
  };

  return (
    <div style={wrap}>
      <button onClick={() => rf.fitView({ duration: 200, padding: 0.2 })} style={iconBtn} title="适应屏幕">
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
      </button>
      <button onClick={() => applyZoom(100)} style={iconBtn} title="重置缩放">
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      </button>
      <button onClick={() => applyZoom(zoom - 10)} style={{ ...iconBtn, fontSize: 16, fontWeight: 700 }} title="缩小">−</button>
      <input type="range" min={25} max={200} value={zoom} onChange={(e) => applyZoom(Number(e.target.value))}
        className="cv2-zoom-slider" style={{ width: 80, height: 4, cursor: 'pointer' }} title={`${zoom}%`} />
      <button onClick={() => applyZoom(zoom + 10)} style={{ ...iconBtn, fontSize: 16, fontWeight: 700 }} title="放大">+</button>
      <div style={{ minWidth: 34, textAlign: 'center', color: '#fff', fontSize: 11, fontWeight: 500 }}>{zoom}%</div>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)', margin: '0 2px' }} />
      <button onClick={() => collapseAll(true)} style={{ ...iconBtn, fontSize: 16, fontWeight: 700 }} title="全部收起卡片">−</button>
      <button onClick={() => collapseAll(false)} style={{ ...iconBtn, fontSize: 13 }} title="全部展开卡片">＋</button>

      <style>{`
        .cv2-zoom-slider { -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.2); border-radius: 99px; }
        .cv2-zoom-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; }
        .cv2-zoom-slider::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fff; cursor: pointer; border: none; }
      `}</style>
    </div>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'rgba(24,24,27,0.9)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
  padding: '6px 10px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
};
const iconBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent',
  color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
};
