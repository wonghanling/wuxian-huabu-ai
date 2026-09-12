'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// 从底部探出半截的小怪物，眼睛跟着鼠标转
//
// 尺寸刻意做大并让下半身被容器裁掉 —— 只露出上半身的"探头"姿态比
// 完整的小方块更有存在感，也不会跟表单抢中心位置。
//
// 实现要点：
//   瞳孔    按方向推到眼白半径内，而非直接跟随坐标 —— 否则鼠标远离时
//           瞳孔会跑出眼白
//   浮动    纯 CSS，各角色错开延迟，避免整排同步像机械装置
//   眨眼    随机间隔（3~7 秒）；固定周期看着像坏了
//   性能    mousemove 每秒上百次，坐标写 ref + rAF 合并到下一帧再重渲染
// ============================================================

type Buddy = {
  id: string;
  bg: string;
  shade: string;
  size: number;
  /** 0.12 近方块 · 0.3 圆角方 · 0.5 正圆 */
  round: number;
  rotate: number;
  delay: number;
  /** 底部被裁掉多少，做"探出"效果 */
  sink: number;
};

// 只有一只带颜色（做视觉落点），其余黑白灰 —— 全彩会破坏极简调性
const BUDDIES: Buddy[] = [
  { id: 'a', bg: '#3f3f46', shade: '#18181b', size: 150, round: 0.46, rotate: -6, delay: 0,   sink: 38 },
  { id: 'b', bg: '#f97316', shade: '#c2410c', size: 188, round: 0.3,  rotate: 3,  delay: 0.8, sink: 44 },
  { id: 'c', bg: '#a1a1aa', shade: '#71717a', size: 132, round: 0.16, rotate: 9,  delay: 1.5, sink: 32 },
  { id: 'd', bg: '#27272a', shade: '#09090b', size: 164, round: 0.5,  rotate: -3, delay: 2.2, sink: 48 },
];

export function PeekingBuddies() {
  const mouse = useRef({ x: 0, y: 0 });
  const [, force] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
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
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 14,
        // 容器高度小于怪物尺寸 + overflow hidden = 下半身被裁掉
        height: 166,
        overflow: 'hidden',
        userSelect: 'none',
      }}
      aria-hidden
    >
      <style>{`
        @keyframes buddy-float {
          0%,100% { transform: translateY(var(--sink))              rotate(var(--rot)); }
          50%     { transform: translateY(calc(var(--sink) - 10px)) rotate(var(--rot)); }
        }
        @keyframes buddy-blink {
          0%,92%,100% { transform: scaleY(1);    }
          95%         { transform: scaleY(0.08); }
        }
        .buddy     { animation: buddy-float 4.6s ease-in-out infinite; flex-shrink: 0; }
        .buddy-eye { animation: buddy-blink var(--blink) ease-in-out infinite; transform-origin: center; }
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
  const blink = useRef(3 + Math.random() * 4);
  const leftEyeRef = useRef<HTMLDivElement>(null);
  const rightEyeRef = useRef<HTMLDivElement>(null);

  const eyeSize = buddy.size * 0.23;
  const pupilSize = eyeSize * 0.44;
  const travel = (eyeSize - pupilSize) / 2 - 1;

  const pupilOffset = (el: HTMLElement | null) => {
    if (!el || !mouse.current) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const dx = mouse.current.x - (r.left + r.width / 2);
    const dy = mouse.current.y - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy) || 1;
    // 近处线性跟随、远处夹在半径上限，让鼠标贴近时的"看过来"也自然
    const k = Math.min(dist, 170) / 170;
    return { x: (dx / dist) * travel * k, y: (dy / dist) * travel * k };
  };

  const lo = pupilOffset(leftEyeRef.current);
  const ro = pupilOffset(rightEyeRef.current);

  return (
    <div
      className="buddy"
      style={{
        // rot / sink 走 CSS 变量，否则浮动动画的 transform 会覆盖初始倾斜与下沉
        ['--rot' as any]: `${buddy.rotate}deg`,
        ['--sink' as any]: `${buddy.sink}px`,
        width: buddy.size,
        height: buddy.size,
        borderRadius: buddy.size * buddy.round,
        background: `linear-gradient(160deg, ${buddy.bg} 0%, ${buddy.shade} 100%)`,
        boxShadow: `0 16px 34px -14px ${buddy.shade}99, inset 0 2px 0 rgba(255,255,255,.18)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: buddy.size * 0.09,
        // 眼睛落在上半身 —— 下半身要被裁掉，眼睛太低会一起被切走
        paddingBottom: buddy.size * 0.3,
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
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,.22)',
            }}
          >
            <div
              style={{
                width: pupilSize,
                height: pupilSize,
                borderRadius: '50%',
                background: '#111114',
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
