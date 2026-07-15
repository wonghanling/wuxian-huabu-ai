'use client';

import { useEffect, useState } from 'react';

// ============================================================
// 画布加载动画(overlay 覆盖在 ReactFlow 上,不阻断挂载)
// loading=true 显示;loading 转 false 后淡出再卸载(衔接画布黑底)
// 纯 UI,黑白灰光晕脉冲,无功能逻辑
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
        <div style={{ ...orbit, animationDelay: '-0.6s', opacity: 0.5 }} />
        <div style={core} />
      </div>
      <div style={label}>
        <span style={{ color: '#f4f4f5', fontWeight: 800, letterSpacing: 5 }}>FILMAVO</span>
      </div>
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
@keyframes cv2loader-bounce { 0%,100% { transform: translateY(0); opacity: 0.35; } 50% { transform: translateY(-6px); opacity: 1; } }
`;

const wrap: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 50,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30,
  background: 'radial-gradient(circle at 50% 42%, #121212 0%, #0a0a0a 60%, #000 100%)',
  transition: 'opacity 0.45s ease', pointerEvents: 'none',
};

const ring: React.CSSProperties = {
  position: 'relative', width: 96, height: 96,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const orbit: React.CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: '50%',
  border: '2px solid transparent', borderTopColor: '#e4e4e7', borderRightColor: '#a1a1aa',
  animation: 'cv2loader-spin 1.1s linear infinite',
  boxShadow: '0 0 22px rgba(255,255,255,0.12)',
};

const core: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'radial-gradient(circle, #ffffff 0%, #a1a1aa 70%)',
  boxShadow: '0 0 26px rgba(255,255,255,0.35)',
  animation: 'cv2loader-pulse 1.4s ease-in-out infinite',
};

const label: React.CSSProperties = {
  fontSize: 30, display: 'flex', alignItems: 'center',
};

const dots: React.CSSProperties = { display: 'flex', gap: 8 };
const dot: React.CSSProperties = {
  width: 7, height: 7, borderRadius: '50%', background: '#d4d4d8',
  display: 'block', animation: 'cv2loader-bounce 1s ease-in-out infinite',
};
