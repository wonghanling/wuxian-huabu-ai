'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconMinus } from './icons';
import { SpawnMenu } from './SpawnMenu';

// ============================================================
// 导演流程时间刻度条(照原网 timeline shape)
// 画布上一条时间轴,形式上连接视频卡表示顺序。用处偏形式。
// 横向刻度(0~duration秒),可连接上下游。
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
  const W = 800, H = 100;
  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 每 5 秒一个主刻度
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += 5) ticks.push(t);

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
        width: W, height: H, background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 16, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        position: 'relative', padding: '14px 20px', boxSizing: 'border-box',
      }}>
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>
        <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 10 }}>导演流程 · 时间轴 ({duration}s)</div>
        {/* 刻度条 */}
        <div style={{ position: 'relative', height: 36, marginTop: 4 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: 'rgba(255,255,255,0.2)' }} />
          {ticks.map((t) => (
            <div key={t} style={{ position: 'absolute', left: `${(t / duration) * 100}%`, top: 0 }}>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.35)' }} />
              <div style={{ fontSize: 9, color: '#71717a', marginTop: 2, transform: 'translateX(-50%)' }}>{t}s</div>
            </div>
          ))}
        </div>
      </div>

      {/* 顶部:时长调节 */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: 11, color: '#a1a1aa' }}>时长</span>
          {[30, 60, 120, 180].map((d) => (
            <button key={d} onClick={() => updateConfig(id, { duration: d } as any)}
              style={{ ...toolBtn, width: 'auto', padding: '0 10px', background: duration === d ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)' }}>{d}s</button>
          ))}
        </div>
      </NodeToolbar>
    </>
  );

  function Ports() {
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }} />
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
}

const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 7,
  border: 'none', background: 'rgba(0,0,0,0.4)', color: '#d4d4d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
};
const toolRow: React.CSSProperties = {
  display: 'flex', gap: 6, alignItems: 'center', padding: 6, background: 'rgba(28,28,32,0.92)',
  borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
};
const toolBtn: React.CSSProperties = {
  height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', cursor: 'pointer', fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
function portCircle(color: string): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', background: color, border: '3px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };
}

export const TimelineNode = memo(TimelineNodeComponent);
