'use client';

import { useEffect, useState } from 'react';

// ============================================================
// 画布加载动画(overlay 覆盖在 ReactFlow 上,不阻断挂载)
// loading=true 显示;loading 转 false 后淡出再卸载(衔接画布黑底)
// 纯 UI,绿色光晕脉冲,无功能逻辑
// ============================================================

export function CanvasLoader({ loading }: { loading: boolean }) {
  const [show, setShow] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!loading) {
      setFading(true);                       // 触发淡出
      const t = setTimeout(() => setShow(false), 480);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (!show) return null;

  return (
    <div style={{ ...wrap, opacity: fading ? 0 : 1 }}>
      <style>{KEYFRAMES}</style>
      <div style={ring}>
        <div style={{ ...orbit, animationDelay: '0s' }} />
        <div style={{ ...orbit, animationDelay: '-0.6s', opacity: 0.6 }} />
        <div style={core} />
      </div>
      <div style={label}>正在加载画布</div>
      <div style={dots}>
        <span style={{ ...dot, animationDelay: '0s' }} />
        <span style={{ ...dot, animationDelay: '0.18s' }} />
        <span style={{ ...dot, animationDelay: '0.36s' }} />
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes cv2loader-spin { to { transform: rotate(360deg); } }
@keyframes cv2loader-pulse { 0%,100% { transform: scale(0.82); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } }
@keyframes cv2loader-bounce { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-6px); opacity: 1; } }
`;

const wrap: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 50,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22,
  background: 'radial-gradient(circle at 50% 42%, #0f1512 0%, #080a09 60%, #050605 100%)',
  transition: 'opacity 0.45s ease', pointerEvents: 'none',
};

const ring: React.CSSProperties = {
  position: 'relative', width: 84, height: 84,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const orbit: React.CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: '50%',
  border: '2px solid transparent', borderTopColor: '#10b981', borderRightColor: '#34d399',
  animation: 'cv2loader-spin 1.1s linear infinite',
  boxShadow: '0 0 24px rgba(16,185,129,0.35)',
};

const core: React.CSSProperties = {
  width: 30, height: 30, borderRadius: '50%',
  background: 'radial-gradient(circle, #6ee7b7 0%, #10b981 70%)',
  boxShadow: '0 0 28px rgba(16,185,129,0.6)',
  animation: 'cv2loader-pulse 1.4s ease-in-out infinite',
};

const label: React.CSSProperties = {
  fontSize: 14, letterSpacing: 2, color: '#d1fae5', fontWeight: 500,
};

const dots: React.CSSProperties = { display: 'flex', gap: 7 };
const dot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', background: '#10b981',
  display: 'block', animation: 'cv2loader-bounce 1s ease-in-out infinite',
};
