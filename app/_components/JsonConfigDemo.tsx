'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// JSON 配置 · 功能演示(主页)
// 演示图片卡的 {} JSON 控制:点击快捷注入 → JSON 填入 → 每次生成按此 JSON
// 纯展示,无后端;循环高亮"服装装备设计"快捷键 → 文本区打字注入
// ============================================================

const PRESETS = ['服装装备设计'];

const SAMPLE = `{
  "agent_name": "Costume & Equipment Designer",
  "mission": "design production-ready costume
   and equipment technical sheets",
  "required_output": {
    "costume_system": { "headgear", "upper_body",
      "footwear", "belt_system", "accessories" },
    "equipment_system": { "primary", "tools",
      "safety", "utility_items" },
    "material_system": { "fabric", "metal", "rubber" }
  },
  "image_sheet": { "front", "back", "side",
    "equipment_breakdown", "material_breakdown" },
  "style": "technical design board, white background"
}`;

export function JsonConfigDemo() {
  const [phase, setPhase] = useState(0);  // 0空 1高亮快捷键 2打字注入 3完成
  const [typed, setTyped] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(0); setTyped(0);
    timers.current.push(setTimeout(() => setPhase(1), 500));   // 高亮快捷键
    timers.current.push(setTimeout(() => setPhase(2), 1500));  // 开始打字
    timers.current.push(setTimeout(() => setPhase(3), 4200));  // 完成
    timers.current.push(setTimeout(run, 7000));
  };

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout); }, []);

  // 打字机推进
  useEffect(() => {
    if (phase < 2) { setTyped(0); return; }
    let i = 0;
    const id = setInterval(() => {
      i += 6;
      setTyped(Math.min(i, SAMPLE.length));
      if (i >= SAMPLE.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* 左:文案 */}
      <div className="reveal order-2 lg:order-1">
        <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-4">Feature · JSON 配置</p>
        <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">用一段 JSON，锁定生成风格</h3>
        <p className="text-zinc-300 leading-relaxed mb-8 text-[15px]">
          图片生成卡片自带 <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-sm">{'{ }'}</span> JSON 控制。
          点开它，一键注入"服装装备设计"等专业模板，或写下你自己的 JSON——
          之后这张卡每次生成，都会把这段 JSON 作为系统级指令优先执行，输出稳定、专业、可复用。
        </p>

        <div className="space-y-3.5 mb-9">
          {[
            { t: '点击 { } 按钮', d: '就在 prompt 工具栏，复制按钮左边' },
            { t: '快捷注入专业模板', d: '服装装备设计等预置 JSON，一键填入，更多开发中' },
            { t: '也能写自己的 JSON', d: '完全自定义，每次生成都按它走，所见即所得' },
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
          {['系统级控制', '专业模板', '可自定义', '稳定可复用'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-white/10 text-zinc-300">{tag}</span>
          ))}
        </div>
      </div>

      {/* 右:JSON 弹窗演示 */}
      <div className="reveal order-1 lg:order-2">
        <div
          className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/70 to-black/50 overflow-hidden cursor-pointer"
          onClick={run}
          title="点击重播"
        >
          {/* 弹窗顶栏 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-white/[0.02]">
            <span className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="font-mono text-zinc-400">{'{ }'}</span> JSON 控制
            </span>
            <span className="w-7 h-7 rounded-lg border border-white/12 bg-white/5 flex items-center justify-center text-zinc-400 text-xs">✕</span>
          </div>

          <div className="p-5">
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              每次生成都会作为系统级指令注入，优先于下方 prompt。
            </p>

            {/* 快捷注入 chips */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <span className="text-[11px] text-zinc-600">快捷注入</span>
              {PRESETS.map((p, i) => {
                const hot = i === 0;        // 服装装备设计被演示点亮
                const active = hot && phase >= 1;
                return (
                  <span
                    key={p}
                    className="text-xs px-3 py-1.5 rounded-full border transition-all duration-300"
                    style={{
                      borderColor: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
                      background: active ? '#fff' : 'rgba(255,255,255,0.05)',
                      color: active ? '#000' : (hot ? '#d4d4d8' : '#71717a'),
                      transform: active ? 'scale(1.05)' : 'scale(1)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {p}
                  </span>
                );
              })}
              <span className="text-xs px-3 py-1.5 rounded-full border border-dashed border-white/12 text-zinc-600">更多开发中…</span>
            </div>

            {/* JSON 文本区 */}
            <div className="rounded-xl border border-white/12 bg-[#0c0c0d] p-4 min-h-[260px]">
              {phase < 2 ? (
                <span className="text-zinc-700 text-[13px] font-mono">点击上方「服装装备设计」一键注入，或在此输入你的 JSON…</span>
              ) : (
                <pre className="text-[12.5px] leading-[1.7] font-mono text-zinc-200 whitespace-pre-wrap break-words m-0">
                  {SAMPLE.slice(0, typed)}
                  <span className="cursor-blink text-zinc-500">▋</span>
                </pre>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-end gap-2.5 mt-4">
              <span className="px-4 py-2 rounded-lg border border-white/14 bg-white/5 text-zinc-300 text-sm">取消</span>
              <span
                className="px-5 py-2 rounded-lg text-sm font-semibold text-black transition-all duration-300"
                style={{
                  background: phase >= 3 ? '#fff' : 'linear-gradient(135deg,#e4e4e7,#a1a1aa)',
                  boxShadow: phase >= 3 ? '0 0 0 3px rgba(255,255,255,0.18)' : 'none',
                }}
              >
                {phase >= 3 ? '✓ 已保存' : '保存'}
              </span>
            </div>
          </div>
        </div>

        {/* 成果图:按此 JSON 生成出的装备分解图(保存后淡入) */}
        <div
          className="mt-4 rounded-2xl border border-white/10 bg-black/30 overflow-hidden"
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8">
            <span className="w-2 h-2 rounded-full bg-white/60" />
            <span className="text-xs text-zinc-400">按此 JSON 生成 · 装备技术分解图</span>
          </div>
          <img
            src="/zhuangbeifenjie2.webp"
            alt="装备分解成果图"
            className="w-full h-auto block max-h-[300px] object-contain bg-black/20"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
