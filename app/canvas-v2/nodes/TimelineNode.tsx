'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconMinus } from './icons';

// ============================================================
// 导演流程时间刻度条(照原网 Timeline.tsx 极简复刻)
// 一条横线 + 锯齿刻度(每秒小齿/每5秒大齿) + 末尾 +30s + 缩放 −/+
// 每个大刻度(5秒)上方一个观赏性连接端口(不传数据,纯视觉)
// 整卡可拖动;刻度区域不拦截拖动
// ============================================================

const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const PORT = 'rgba(96,165,250,0.9)';

function TimelineNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const duration = (data.config as any).duration ?? 60;
  const zoom = (data.config as any).zoom ?? 1;
  const pixelsPerSecond = 20 * zoom;
  const timelineWidth = duration * pixelsPerSecond;

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };
  const addThirty = () => updateConfig(id, { duration: duration + 30 } as any);
  const zoomIn = () => updateConfig(id, { zoom: Math.min(zoom * 1.5, 5) } as any);
  const zoomOut = () => updateConfig(id, { zoom: Math.max(zoom / 1.5, 0.2) } as any);

  // 每秒一个锯齿(每5秒大齿)
  const ticks: { pos: number; large: boolean; sec: number }[] = [];
  for (let i = 0; i <= duration; i++) ticks.push({ pos: i * pixelsPerSecond, large: i % 5 === 0, sec: i });
  // 大刻度(每5秒)放一个观赏性连接端口
  const portTicks = ticks.filter((t) => t.large);

  if (collapsed) {
    return (
      <div onDoubleClick={toggleCollapse} style={{ width: 160, height: 40, background: 'rgba(24,24,27,0.85)', border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a1a1aa', fontSize: 12, backdropFilter: 'blur(20px)' }}>
        ⏱ 时间轴
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 6px' }}>
      {/* 拖动手柄(整条标题区可拖) + 收起 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab' }}>
        <span style={{ fontSize: 11, color: '#a1a1aa' }}>导演流程 · 时间轴 ({duration}s)</span>
        <button onClick={toggleCollapse} className="nodrag" style={miniBtn} title="收起"><IconMinus /></button>
      </div>

      {/* 刻度线 + 锯齿 + 观赏性端口(整块不滚动,随 zoom 变宽) */}
      <div style={{ position: 'relative', width: timelineWidth, height: 40 }}>
        {/* 横线 */}
        <div style={{ position: 'absolute', top: 22, left: 0, right: 0, height: 2, background: '#9ca3af' }} />
        {/* 锯齿 */}
        {ticks.map((tk, i) => (
          <div key={i} style={{ position: 'absolute', top: 22, left: tk.pos, width: 2, height: tk.large ? 12 : 6, background: '#9ca3af', transform: 'translateY(-100%)' }} />
        ))}
        {/* 秒数标注(每5秒) */}
        {portTicks.map((tk) => (
          <div key={`l${tk.sec}`} style={{ position: 'absolute', top: 26, left: tk.pos, fontSize: 9, color: '#71717a', transform: 'translateX(-50%)' }}>{tk.sec}s</div>
        ))}
        {/* 每个大刻度一个观赏性连接端口(在线条上方,蓝点) */}
        {portTicks.map((tk) => (
          <Handle
            key={`p${tk.sec}`}
            id={`tick-${tk.sec}`}
            type="source"
            position={Position.Top}
            isConnectableStart={false}
            style={{
              position: 'absolute', top: 6, left: tk.pos, transform: 'translateX(-50%)',
              width: 9, height: 9, borderRadius: '50%', background: PORT, border: '2px solid #18181b',
              minWidth: 0, minHeight: 0,
            }}
          />
        ))}
      </div>

      {/* 控制条:缩放 + 加长 */}
      <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={zoomOut} style={zoomBtn} title="缩小刻度">−</button>
        <span style={{ fontSize: 11, color: '#9ca3af', minWidth: 38, textAlign: 'center', fontFamily: 'monospace' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} style={zoomBtn} title="放大刻度">+</button>
        <button onClick={addThirty} style={addBtn} title="增加30秒">+30s</button>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.4)', color: '#d4d4d8',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const zoomBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const addBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '4px 10px', background: 'rgba(34,197,94,0.85)', border: '1px solid rgba(34,197,94,0.5)',
  borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

export const TimelineNode = memo(TimelineNodeComponent);
