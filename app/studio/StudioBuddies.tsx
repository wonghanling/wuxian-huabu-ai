'use client';

// ============================================================
// 生图页中间区域的小角色
//
// 两种形态:
//   空态   三只静静浮着，眼睛跟着鼠标 —— 页面不至于空白一片
//   生成中 一只在转，配一句进度文案
//
// 复用登录页那套黑白灰配色，不用彩色 —— 生图页是白底极简，
// 四色小角色在这里太跳。
//
// 不复用 PeekingBuddies 本体:那个是为登录页左栏设计的(尺寸大、贴底裁切、
// 四只并排)，这里空间小得多、形态需求也不同。共享的是设计语言。
// ============================================================

import { useEffect, useRef, useState } from 'react';

type Buddy = { bg: string; shade: string; size: number; round: number; rot: number; delay: number };

const IDLE: Buddy[] = [
  { bg: '#3f3f46', shade: '#18181b', size: 46, round: 0.45, rot: -6, delay: 0 },
  { bg: '#a1a1aa', shade: '#71717a', size: 58, round: 0.3, rot: 3, delay: 0.7 },
  { bg: '#27272a', shade: '#09090b', size: 40, round: 0.5, rot: 8, delay: 1.4 },
];

/** 空态:三只小角色 + 一句引导 */
export function IdleBuddies() {
  const mouse = useRef({ x: 0, y: 0 });
  const [, force] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (raf.current == null) {
        raf.current = requestAnimationFrame(() => { raf.current = null; force((n) => n + 1); });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', userSelect: 'none' }}>
      <style>{`
        @keyframes sb-float {
          0%,100% { transform: translateY(0)    rotate(var(--rot)); }
          50%     { transform: translateY(-9px) rotate(var(--rot)); }
        }
        @keyframes sb-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }
        .sb     { animation: sb-float 4.4s ease-in-out infinite; }
        .sb-eye { animation: sb-blink var(--blink) ease-in-out infinite; transform-origin: center; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 22 }}>
        {IDLE.map((b, i) => <Body key={i} b={b} mouse={mouse} />)}
      </div>

      <div style={{ fontSize: 14, color: '#1d1d1f', fontWeight: 500, marginBottom: 6 }}>
        开始你的第一张作品
      </div>
      <div style={{ fontSize: 12, color: '#86868b', lineHeight: 1.7 }}>
        左侧写下想画的画面，或从 300 条配方模板里挑一个
      </div>
    </div>
  );
}

/** 生成中:一只转圈的小角色 */
export function BusyBuddy({ label }: { label?: string }) {
  return (
    <div style={{ textAlign: 'center', userSelect: 'none' }}>
      <style>{`
        @keyframes sb-bob  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes sb-ring { to { transform: rotate(360deg); } }
        .sb-bob  { animation: sb-bob 1.5s ease-in-out infinite; }
        .sb-ring { animation: sb-ring 1.1s linear infinite; }
      `}</style>

      <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 20px' }}>
        {/* 转圈的环 —— 比进度条省地方，也不用假装知道百分比 */}
        <div
          className="sb-ring"
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid rgba(0,0,0,.07)', borderTopColor: '#1d1d1f',
          }}
        />
        <div
          className="sb-bob"
          style={{
            position: 'absolute', inset: 22, borderRadius: 16,
            background: 'linear-gradient(160deg, #3f3f46, #18181b)',
            boxShadow: '0 8px 18px -8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {[0, 1].map((i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff' }}>
              <span style={{
                display: 'block', width: 4, height: 4, borderRadius: '50%',
                background: '#111114', margin: '2.5px auto 0',
              }} />
            </span>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#1d1d1f', fontWeight: 500, marginBottom: 5 }}>正在生成</div>
      {label && (
        <div style={{
          fontSize: 11.5, color: '#86868b', maxWidth: 260, margin: '0 auto',
          lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function Body({ b, mouse }: { b: Buddy; mouse: React.RefObject<{ x: number; y: number }> }) {
  const blink = useRef(3 + Math.random() * 4);
  const l = useRef<HTMLSpanElement>(null);
  const r = useRef<HTMLSpanElement>(null);

  const eye = b.size * 0.23;
  const pupil = eye * 0.44;
  const travel = (eye - pupil) / 2 - 0.5;

  const off = (el: HTMLElement | null) => {
    if (!el || !mouse.current) return { x: 0, y: 0 };
    const rc = el.getBoundingClientRect();
    const dx = mouse.current.x - (rc.left + rc.width / 2);
    const dy = mouse.current.y - (rc.top + rc.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    // 远处夹在半径上限，否则瞳孔会跑出眼白
    const k = Math.min(d, 200) / 200;
    return { x: (dx / d) * travel * k, y: (dy / d) * travel * k };
  };

  const lo = off(l.current);
  const ro = off(r.current);

  return (
    <div
      className="sb"
      style={{
        ['--rot' as any]: `${b.rot}deg`,
        animationDelay: `${b.delay}s`,
        width: b.size, height: b.size, flexShrink: 0,
        borderRadius: b.size * b.round,
        background: `linear-gradient(160deg, ${b.bg}, ${b.shade})`,
        boxShadow: `0 10px 20px -10px ${b.shade}88, inset 0 1px 0 rgba(255,255,255,.16)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: b.size * 0.1,
      }}
    >
      {[l, r].map((ref, i) => {
        const o = i === 0 ? lo : ro;
        return (
          <span
            key={i}
            ref={ref}
            className="sb-eye"
            style={{
              ['--blink' as any]: `${blink.current}s`,
              width: eye, height: eye, borderRadius: '50%', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,.2)',
            }}
          >
            <span style={{
              width: pupil, height: pupil, borderRadius: '50%', background: '#111114',
              transform: `translate(${o.x}px, ${o.y}px)`, transition: 'transform .09s linear',
            }} />
          </span>
        );
      })}
    </div>
  );
}
