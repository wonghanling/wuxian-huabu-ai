'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';

// ============================================================
// 导演流程时间刻度条(照原网 Timeline.tsx 极简复刻)
// 一条横线 + 锯齿刻度(每秒小齿/每5秒大齿) + 末尾 +30s + 下方缩放 −/+
// 仅作外观:表示视频顺序。左右端口连接视频卡。
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

function TimelineNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);
  const [spawnOpen, setSpawnOpen] = useState(false);

  const duration = (data.config as any).duration ?? 60;
  const zoom = (data.config as any).zoom ?? 1;
  const pixelsPerSecond = 20 * zoom;          // 照原网:每秒像素 = 20 × zoom
  const timelineWidth = duration * pixelsPerSecond;
  const H = 64;

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };
  const addThirty = () => updateConfig(id, { duration: duration + 30 } as any);
  const zoomIn = () => updateConfig(id, { zoom: Math.min(zoom * 1.5, 5) } as any);
  const zoomOut = () => updateConfig(id, { zoom: Math.max(zoom / 1.5, 0.2) } as any);

  // 每秒一个锯齿(每5秒大齿),照原网 generateTicks
  const ticks: { pos: number; large: boolean }[] = [];
  for (let i = 0; i <= duration; i++) ticks.push({ pos: i * pixelsPerSecond, large: i % 5 === 0 });

  if (collapsed) {
    return (
      <>
        <Ports />
        <div onDoubleClick={toggleCollapse} style={{ width: 160, height: 44, background: GLASS_BG, border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a1a1aa', fontSize: 12, backdropFilter: 'blur(20px)' }}>
          ⏱ 时间轴
        </div>
      </>
    );
  }

  return (
    <>
      <Ports />
      <div style={{
        position: 'relative', padding: '8px 4px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 8,
        // 原版:开放的刻度线段,不封闭成卡片框(无边框/背景/圆角)
      }}>
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        {/* 时间轴线条 + 锯齿刻度(可横向滚动) */}
        <div style={{ height: H, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' }} className="nodrag nopan">
          <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', width: timelineWidth + 70 }}>
            <div style={{ position: 'relative', width: timelineWidth, height: '100%' }}>
              {/* 横线 */}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: '#9ca3af' }} />
              {/* 锯齿 */}
              {ticks.map((tk, i) => (
                <div key={i} style={{ position: 'absolute', top: '50%', left: tk.pos, width: 2, height: tk.large ? 12 : 6, background: '#9ca3af', transform: 'translateY(-100%)' }} />
              ))}
            </div>
            {/* +30s 加长线段 */}
            <button onClick={addThirty} className="nodrag" style={addBtn} title="增加30秒">+30s</button>
          </div>
        </div>

        {/* 缩放控制 −/百分比/+ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={zoomOut} className="nodrag" style={zoomBtn} title="缩小">−</button>
          <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 40, textAlign: 'center', fontFamily: 'monospace' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} className="nodrag" style={zoomBtn} title="放大">+</button>
          <span style={{ fontSize: 10, color: '#52525b', marginLeft: 'auto' }}>{duration}s</span>
        </div>
      </div>
    </>
  );

  function Ports() {
    return (
      <>
        {/* 端口在时间轴上方(照原网):左上输入,右上输出 */}
        <Handle type="target" position={Position.Top} className="rf-port" style={{ ...portCircle(INPUT_PORT), top: -16, left: 24 }} />
        <Handle id="main-out" type="source" position={Position.Top} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), top: -16, left: 'auto', right: 24 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}>
          <span style={{ pointerEvents: 'none', display: 'flex' }}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
}

const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 7,
  border: 'none', background: 'rgba(0,0,0,0.4)', color: '#d4d4d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
};
const addBtn: React.CSSProperties = {
  marginLeft: 16, padding: '4px 10px', flexShrink: 0,
  background: 'rgba(34,197,94,0.85)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: 8,
  color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const zoomBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
function portCircle(color: string): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', background: color, border: '3px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };
}

export const TimelineNode = memo(TimelineNodeComponent);
