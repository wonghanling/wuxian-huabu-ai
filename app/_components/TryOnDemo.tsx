'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 角色换衣(虚拟试衣)· 功能演示(主页)
// 版式:上方居中标题 + 居中"换装公式"(人物 + 衣服 = 结果),两组真实示例自动轮播
// 与其它板块(左文右图)版式不同,避免重复
// ============================================================

const EXAMPLES = [
  { person: '/huanzhuang2.webp', cloth: '/huanzhuang4.webp', result: '/huanzhuang3.webp' },
  { person: '/huanzhuang5.webp', cloth: '/huanzhuang4.webp', result: '/huanzhuang6.webp' },
];

export function TryOnDemo() {
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);   // 0空 1人物 2衣服 3结果
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = (i: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setIdx(i); setStep(0);
    timers.current.push(setTimeout(() => setStep(1), 300));
    timers.current.push(setTimeout(() => setStep(2), 1000));
    timers.current.push(setTimeout(() => setStep(3), 1900));
    timers.current.push(setTimeout(() => run((i + 1) % EXAMPLES.length), 5400));
  };
  useEffect(() => { run(0); return () => timers.current.forEach(clearTimeout); }, []);

  const ex = EXAMPLES[idx];

  return (
    <div>
      {/* 顶部标题(居中) */}
      <div className="text-center mb-14 reveal">
        <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-4">Feature · 角色换衣</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">上传人物和衣服，秒速换装</h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          一张人物图、一张衣服图，AI 自动把衣服穿到人物身上，保留姿势与身形
        </p>
      </div>

      {/* 居中换装公式:人物 + 衣服 = 结果 */}
      <div className="reveal flex items-center justify-center gap-4 md:gap-7 flex-wrap">
        <Frame src={ex.person} label="人物" show={step >= 1} highlight={false} />
        <Op show={step >= 2}>+</Op>
        <Frame src={ex.cloth} label="衣服" show={step >= 2} highlight={false} />
        <Op show={step >= 3}>=</Op>
        <Frame src={ex.result} label="换装结果" show={step >= 3} highlight />
      </div>

      {/* 示例切换点 */}
      <div className="flex items-center justify-center gap-2 mt-10">
        {EXAMPLES.map((_, i) => (
          <button key={i} onClick={() => run(i)}
            className="transition-all"
            style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 99, background: i === idx ? '#fff' : 'rgba(255,255,255,0.25)' }} />
        ))}
      </div>

      {/* 委婉提示 */}
      <p className="text-center text-xs text-zinc-500 mt-6">
        换装侧重快速预览与灵感参考，多换几套挑选最满意的效果 · ¥0.3/次
      </p>
    </div>
  );
}

function Frame({ src, label, show, highlight }: { src: string; label: string; show: boolean; highlight: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3"
      style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)', transition: 'all 0.6s cubic-bezier(.2,.8,.2,1)' }}>
      <div
        className="rounded-2xl overflow-hidden bg-black/30"
        style={{
          width: 'clamp(150px, 22vw, 240px)', aspectRatio: '3/4',
          border: highlight ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: highlight ? '0 0 0 4px rgba(255,255,255,0.12), 0 20px 50px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.4)',
        }}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" draggable={false} />
      </div>
      <span className="text-sm" style={{ color: highlight ? '#fff' : '#a1a1aa', fontWeight: highlight ? 600 : 400 }}>
        {highlight && '✓ '}{label}
      </span>
    </div>
  );
}

function Op({ children, show }: { children: React.ReactNode; show: boolean }) {
  return (
    <span className="text-3xl md:text-4xl font-light text-zinc-500 mb-7"
      style={{ opacity: show ? 1 : 0, transition: 'opacity 0.4s ease' }}>
      {children}
    </span>
  );
}
