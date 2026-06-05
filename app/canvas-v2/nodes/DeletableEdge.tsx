'use client';

import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';

// ============================================================
// 可删除连接线 — hover 时中间显示 × 按钮,点击删除该连线
// ============================================================
export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [hover, setHover] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {/* 透明加宽热区:方便 hover 到细线 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            opacity: hover ? 1 : 0,
            transition: 'opacity .15s',
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setEdges((edges) => edges.filter((ed) => ed.id !== id)); }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(28,28,32,0.95)', color: '#f87171',
              cursor: 'pointer', fontSize: 13, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
            title="删除连线"
          >×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
