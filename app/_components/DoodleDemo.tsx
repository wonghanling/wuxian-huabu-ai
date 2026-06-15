'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 涂鸦标注 · 功能演示(主页)
// 自包含动画:标注图完整淡入 → 点"发送到画布" → 缩小移到一角并落定为卡片
// 关键:容器不固定比例,图片始终完整可见(object-contain),绝不裁切
// phase: 0 空 / 1 标注图淡入 / 2 显示发送按钮 / 3 飞向角落 / 4 落定为卡片
// ============================================================

const STEPS = ['上传图片', '涂抹标注', '发送到画布', '生成新卡片'];

export function DoodleDemo() {
  const [phase, setPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(0);
    timers.current.push(setTimeout(() => setPhase(1), 400));
    timers.current.push(setTimeout(() => setPhase(2), 1800));
    timers.current.push(setTimeout(() => setPhase(3), 2900));
    timers.current.push(setTimeout(() => setPhase(4), 3900));
    timers.current.push(setTimeout(run, 6800));
  };

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout); }, []);

  const flying = phase >= 3;
  const landed = phase >= 4;

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* 左:动画舞台 — 高度自适应,图片完整不裁切 */}
      <div className="reveal">
        <div
          className="relative rounded-2xl overflow-hidden border border-white/10 cursor-pointer select-none"
          onClick={run}
          title="点击重播"
          style={{ background: 'radial-gradient(circle at 50% 40%, #15171a 0%, #0a0b0c 70%)' }}
        >
          {/* 画布网格背景 */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '34px 34px',
              opacity: landed ? 0.7 : 0.25,
              transition: 'opacity 0.6s ease',
            }}
          />

          {/* 图片包裹:用 padding 留边,图片本体始终 object-contain 完整显示 */}
          <div className="relative p-5" style={{ minHeight: 360 }}>
            <div
              className="mx-auto"
              style={{
                width: flying ? '40%' : '100%',
                transform: flying ? 'translateX(28%)' : 'translateX(0)',
                transition: 'all 0.9s cubic-bezier(.45,.05,.2,1)',
              }}
            >
              <div
                className="relative rounded-xl overflow-hidden border shadow-2xl"
                style={{
                  borderColor: landed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
                  opacity: phase >= 1 ? 1 : 0,
                  filter: phase >= 1 ? 'none' : 'blur(8px)',
                  transition: 'opacity 0.7s ease, filter 0.7s ease, border-color 0.4s ease',
                }}
              >
                <img
                  src="/tuyabiaozhu.webp"
                  alt="涂鸦标注演示"
                  className="w-full h-auto block max-h-[460px] object-contain"
                  draggable={false}
                />
                {/* 落定后右上角完成勾 */}
                <div
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-sm font-bold shadow-lg"
                  style={{
                    opacity: landed ? 1 : 0,
                    transform: landed ? 'scale(1)' : 'scale(0.4)',
                    transition: 'all 0.4s cubic-bezier(.2,.8,.2,1) 0.2s',
                  }}
                >
                  ✓
                </div>
              </div>
              {/* 卡片标题(落定后) */}
              <div
                className="mt-2 text-[11px] text-zinc-400 text-center"
                style={{ opacity: landed ? 1 : 0, transition: 'opacity 0.4s ease 0.3s' }}
              >
                标注图 · 参考卡片
              </div>
            </div>
          </div>

          {/* "发送到画布"按钮(蓄势出现,飞行时隐藏) */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: '6%',
              opacity: phase === 2 ? 1 : 0,
              transform: `translateX(-50%) translateY(${phase === 2 ? '0' : '12px'})`,
              transition: 'all 0.4s cubic-bezier(.2,.8,.2,1)',
              pointerEvents: 'none',
            }}
          >
            <div className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold shadow-2xl flex items-center gap-2">
              发送到画布 <span className="text-base leading-none">→</span>
            </div>
          </div>

          {/* 落定提示 */}
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: '6%',
              opacity: landed ? 1 : 0,
              transform: `translateX(-50%) translateY(${landed ? '0' : '-10px'})`,
              transition: 'all 0.5s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-xs font-medium backdrop-blur-sm">
              已添加到画布 · 可连线生成
            </div>
          </div>
        </div>

        {/* 步骤指示 */}
        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          {STEPS.map((s, i) => {
            const on = phase >= i + 1;
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className="text-xs px-2.5 py-1 rounded-full border transition-all duration-300"
                  style={{
                    borderColor: on ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                    background: on ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: on ? '#fff' : '#71717a',
                  }}
                >
                  {s}
                </span>
                {i < STEPS.length - 1 && <span className="text-zinc-700 text-xs">→</span>}
              </div>
            );
          })}
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
