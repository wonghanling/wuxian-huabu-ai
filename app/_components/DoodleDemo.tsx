'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 涂鸦标注 · 功能演示(主页)
// 自包含 CSS 动画:底图上逐步画出标注(圈/箭头/文字)→ "发送到画布"
// 纯展示,无后端;循环播放,点击可重播
// ============================================================

const STEPS = ['上传图片', '圈出要改的地方', '写下你的需求', '发送到画布'];

export function DoodleDemo() {
  const [phase, setPhase] = useState(0);   // 0上传 1圈选 2文字 3发送
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(0);
    timers.current.push(setTimeout(() => setPhase(1), 900));
    timers.current.push(setTimeout(() => setPhase(2), 2000));
    timers.current.push(setTimeout(() => setPhase(3), 3300));
    timers.current.push(setTimeout(run, 6200));   // 循环
  };

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout); }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* 左:动画演示舞台 */}
      <div className="reveal">
        <div
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer select-none"
          onClick={run}
          title="点击重播"
        >
          {/* 真实涂鸦标注图(底图已含标注) */}
          <img src="/tuyabiaozhu.webp" alt="涂鸦标注演示" className="w-full h-auto block" draggable={false} />

          {/* 扫描揭示遮罩:从上往下揭开,模拟"正在标注" */}
          <div
            className="absolute inset-x-0 top-0 bg-black"
            style={{
              height: phase >= 1 ? '0%' : '100%',
              transition: 'height 1.1s cubic-bezier(.4,0,.2,1)',
            }}
          />
          {/* 扫描线 */}
          <div
            className="absolute inset-x-0 h-[2px]"
            style={{
              top: phase >= 1 ? '100%' : '0%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
              boxShadow: '0 0 14px rgba(255,255,255,0.7)',
              opacity: phase === 0 || phase >= 2 ? 0 : 1,
              transition: 'top 1.1s cubic-bezier(.4,0,.2,1), opacity 0.3s ease',
            }}
          />

          {/* "已发送到画布" 提示 */}
          <div
            className="absolute left-1/2"
            style={{
              bottom: '6%',
              transform: `translateX(-50%) translateY(${phase >= 3 ? '0' : '14px'})`,
              opacity: phase >= 3 ? 1 : 0,
              transition: 'all 0.5s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <div className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-2xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black/70 inline-block" />
              已发送到画布
            </div>
          </div>
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center justify-center gap-2 mt-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className="text-xs px-2.5 py-1 rounded-full border transition-all duration-300"
                style={{
                  borderColor: phase >= i ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                  background: phase >= i ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: phase >= i ? '#fff' : '#71717a',
                }}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="text-zinc-700 text-xs">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* 右:文案 */}
      <div className="reveal">
        <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-4">Feature · 涂鸦标注</p>
        <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">在图上画一笔，AI 就懂你的意思</h3>
        <p className="text-zinc-300 leading-relaxed mb-8 text-[15px]">
          不用反复打字描述"哪里要改"。直接在图片上圈出位置、画个箭头、写句话——
          涂鸦标注会把你的手绘意图和原图一起送进画布，作为参考图引导 AI 精准改图。所见即所得，改哪指哪。
        </p>

        <div className="space-y-3.5 mb-9">
          {[
            { t: '上传任意图片', d: '本地图片或画布生成的成品，都能拿来标注' },
            { t: '画笔 / 文字 / 箭头', d: '圈重点、标位置、写需求，像在纸上批注一样自然' },
            { t: '一键发送到画布', d: '标注图作为参考图新建卡片，连线给生成卡即可改图' },
          ].map((s) => (
            <div key={s.t} className="flex gap-3.5 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
              <div>
                <span className="text-white font-medium text-[15px]">{s.t}</span>
                <span className="text-zinc-500 text-sm ml-2">{s.d}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {['手绘批注', '画笔/文字/橡皮', '所见即所得', '免费不扣费'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-white/10 text-zinc-300">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
