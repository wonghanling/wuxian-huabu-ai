'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 角色换衣(虚拟试衣)· 功能演示(主页)
// 流程动画:人物图 + 衣服图 → 合成 → 试穿结果
// 纯展示,无后端;循环播放
// phase: 0 空 / 1 两图淡入 / 2 合成中 / 3 出结果
// 注:演示图为占位,可替换为真实"试穿前/衣服/试穿后"素材
// ============================================================

const PERSON_IMG = '/renwusheji1.webp';
const CLOTH_IMG = '/zhuangbeifenjie.webp';
const RESULT_IMG = '/renwusheji2.webp';

export function TryOnDemo() {
  const [phase, setPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(0);
    timers.current.push(setTimeout(() => setPhase(1), 400));
    timers.current.push(setTimeout(() => setPhase(2), 1800));
    timers.current.push(setTimeout(() => setPhase(3), 3000));
    timers.current.push(setTimeout(run, 6400));
  };
  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout); }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* 左:文案 */}
      <div className="reveal order-2 lg:order-1">
        <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-4">Feature · 角色换衣</p>
        <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">上传人物和衣服，秒速换装</h3>
        <p className="text-zinc-300 leading-relaxed mb-6 text-[15px]">
          一张人物图、一张衣服图，AI 自动把衣服穿到人物身上，保留姿势与身形。
          电商上身预览、服装设计打样、角色造型试装，都能快速出图、反复尝试。
        </p>

        <div className="space-y-3.5 mb-6">
          {[
            { t: '人物图 + 衣服图', d: '人物可上传或从画布连线，衣服图上传即可' },
            { t: '保留姿势换装', d: 'AI 分析人物身形姿态，衣服自然贴合' },
            { t: '结果可连线复用', d: '换装结果作为新图，继续连给其它卡片创作' },
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

        {/* 诚实提示 */}
        <div className="flex items-start gap-2.5 mb-8 px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/8">
          <span className="text-zinc-500 text-sm mt-0.5">ⓘ</span>
          <p className="text-xs text-zinc-500 leading-relaxed">
            换装侧重快速预览与灵感参考，多换几套挑选最满意的效果～
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {['一键换装', '保留姿势', '快速预览', '¥0.3/次'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-white/10 text-zinc-300">{tag}</span>
          ))}
        </div>
      </div>

      {/* 右:流程动画舞台(固定高度,不抖) */}
      <div className="reveal order-1 lg:order-2">
        <div
          className="relative rounded-2xl border border-white/10 overflow-hidden cursor-pointer"
          onClick={run}
          title="点击重播"
          style={{ height: 420, background: 'radial-gradient(circle at 50% 40%, #15171a 0%, #0a0b0c 70%)' }}
        >
          {/* 输入两图(phase 1-2 显示,phase3 淡出) */}
          <div
            className="absolute inset-0 flex items-center justify-center gap-4 px-8"
            style={{ opacity: phase >= 1 && phase < 3 ? 1 : 0, transition: 'opacity 0.6s ease' }}
          >
            <Thumb src={PERSON_IMG} label="人物图" />
            <span className="text-2xl text-zinc-500">+</span>
            <Thumb src={CLOTH_IMG} label="衣服图" />
          </div>

          {/* 合成中提示 */}
          <div
            className="absolute left-1/2 bottom-6 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs backdrop-blur-sm"
            style={{ opacity: phase === 2 ? 1 : 0, transition: 'opacity 0.4s ease' }}
          >
            AI 换装合成中…
          </div>

          {/* 结果图(phase3 淡入) */}
          <div
            className="absolute inset-0 flex items-center justify-center p-6"
            style={{ opacity: phase >= 3 ? 1 : 0, transform: `scale(${phase >= 3 ? 1 : 1.04})`, transition: 'all 0.7s cubic-bezier(.2,.8,.2,1)' }}
          >
            <div className="relative h-full">
              <img src={RESULT_IMG} alt="换装结果" className="h-full w-auto object-contain rounded-xl border border-white/20 shadow-2xl" draggable={false} />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold shadow-xl whitespace-nowrap">
                ✓ 换装完成
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Thumb({ src, label }: { src: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl overflow-hidden border border-white/15 bg-black/30" style={{ width: 130, height: 175 }}>
        <img src={src} alt={label} className="w-full h-full object-cover" draggable={false} />
      </div>
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}
