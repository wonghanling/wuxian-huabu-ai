'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// 眼睛跟着鼠标转的小角色
//
// 实现要点：
//   瞳孔位置    监听鼠标，算出相对每只眼球中心的方向，把瞳孔按该方向推到
//               眼白半径内 —— 不是直接跟随坐标，否则鼠标远离时瞳孔会跑出眼白
//   浮动        纯 CSS，每个角色错开延迟，避免整排同步上下像机械装置
//   眨眼        随机间隔（3~7 秒）而非固定周期，固定周期看着像坏了
//
// 鼠标监听只挂一个 window 事件、用 ref 存坐标再 rAF 批量更新，
// 避免每次 mousemove 都触发 React 重渲染。
// ============================================================

type Buddy = {
  id: string;
  bg: string;        // 身体主色
  shade: string;     // 底部暗色，做一点体积感
  size: number;
  /** 圆角比例:0.12 近方块、0.3 圆角方、0.5 正圆 —— 四个形状各异才不呆板 */
  round: number;
  rotate: number;
  delay: number;     // 浮动动画错开
};

const BUDDIES: Buddy[] = [
  { id: 'a', bg: '#f97316', shade: '#c2410c', size: 72, round: 0.5,  rotate: -7, delay: 0 },
  { id: 'b', bg: '#8b5cf6', shade: '#6d28d9', size: 90, round: 0.28, rotate: 4,  delay: 0.7 },
  { id: 'c', bg: '#facc15', shade: '#ca8a04', size: 66, round: 0.14, rotate: 10, delay: 1.4 },
  { id: 'd', bg: '#34d399', shade: '#059669', size: 80, round: 0.42, rotate: -4, delay: 2.1 },
];

export function PeekingBuddies() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const [, force] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      // 合并到下一帧再重渲染 —— mousemove 每秒可触发上百次，
      // 直接 setState 会让 React 疲于奔命
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          force((n) => n + 1);
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 18, userSelect: 'none' }}
      aria-hidden
    >
      <style>{`
        @keyframes buddy-float {
          0%,100% { transform: translateY(0)     rotate(var(--rot)); }
          50%     { transform: translateY(-9px)  rotate(var(--rot)); }
        }
        @keyframes buddy-blink {
          0%,92%,100% { transform: scaleY(1);    }
          95%         { transform: scaleY(0.08); }
        }
        .buddy      { animation: buddy-float 4.2s ease-in-out infinite; }
        .buddy-eye  { animation: buddy-blink var(--blink) ease-in-out infinite; transform-origin: center; }
      `}</style>

      {BUDDIES.map((b) => (
        <BuddyBody key={b.id} buddy={b} mouse={mouse} />
      ))}
    </div>
  );
}

function BuddyBody({
  buddy,
  mouse,
}: {
  buddy: Buddy;
  mouse: React.RefObject<{ x: number; y: number }>;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  // 眨眼周期随机化 —— 三个角色同时眨眼会显得是同一个装置
  const blink = useRef(3 + Math.random() * 4);

  const eyeSize = buddy.size * 0.27;
  const pupilSize = eyeSize * 0.46;
  /** 瞳孔可移动的最大半径:留一点余量，免得贴到眼白边缘 */
  const travel = (eyeSize - pupilSize) / 2 - 1;

  /** 算某只眼的瞳孔偏移。按方向推到半径上限，而非直接跟随坐标 */
  const pupilOffset = (el: HTMLElement | null) => {
    if (!el || !mouse.current) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouse.current.x - cx;
    const dy = mouse.current.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    // 近处线性跟随、远处夹在半径上 —— 让"看向鼠标"在鼠标贴近时也自然
    const k = Math.min(dist, 140) / 140;
    return { x: (dx / dist) * travel * k, y: (dy / dist) * travel * k };
  };

  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);
  const lo = pupilOffset(leftEyeRef.current);
  const ro = pupilOffset(rightEyeRef.current);

  return (
    <div
      ref={bodyRef}
      className="buddy"
      style={{
        // rot 交给 CSS 变量，让浮动动画能保留旋转而不互相覆盖
        ['--rot' as any]: `${buddy.rotate}deg`,
        animationDelay: `${buddy.delay}s`,
        width: buddy.size,
        height: buddy.size,
        borderRadius: buddy.size * buddy.round,
        background: `linear-gradient(160deg, ${buddy.bg} 0%, ${buddy.shade} 100%)`,
        boxShadow: `0 12px 26px -10px ${buddy.shade}aa, inset 0 2px 0 rgba(255,255,255,.25)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: buddy.size * 0.1,
      }}
    >
      {[leftEyeRef, rightEyeRef].map((ref, i) => {
        const off = i === 0 ? lo : ro;
        return (
          <div
            key={i}
            ref={ref}
            className="buddy-eye"
            style={{
              ['--blink' as any]: `${blink.current}s`,
              width: eyeSize,
              height: eyeSize,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,.18)',
            }}
          >
            <div
              style={{
                width: pupilSize,
                height: pupilSize,
                borderRadius: '50%',
                background: '#18181b',
                transform: `translate(${off.x}px, ${off.y}px)`,
                transition: 'transform .09s linear',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
