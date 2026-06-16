'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 分镜设计(Step2 + Step4)· 功能演示(主页)
// Step2(纯文本):故事模式/时空模式 输出分镜提示词 → 连图片卡生成(打字机,不配图)
// Step4(出图):导演级分镜表格模板,用真实成果图 step4-1/2/3 轮播
// 纯展示,无后端
// ============================================================

const STORY_LINES = [
  'PANEL 01　全景　雨夜天台，孤影伫立',
  'PANEL 02　中景　转身，目光扫过城市',
  'PANEL 03　特写　手中硬盘红灯明灭',
  'PANEL 04　近景　雨水顺着下颌线滑落',
  '…按叙事节奏拆解为 9 / 25 宫格分镜提示词',
];
const CINEMATIC_LINES = [
  'FRAME 首帧　起手抬臂，蓄力',
  'MID 02　　　重心前移，衣摆扬起',
  'MID 03　　　手臂挥出，雨珠飞溅',
  'FRAME 尾帧　收势定格，余韵',
  '…分析首尾帧，补全中间帧提示词',
];

const STEP4_IMAGES = ['/step4-1.webp', '/step4-2.webp', '/step4-3.webp'];

export function ShotboardDemo() {
  const [mode, setMode] = useState<'story' | 'cinematic'>('story');
  const [shot, setShot] = useState(0);   // step4 当前展示第几张
  const shotTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const lines = mode === 'story' ? STORY_LINES : CINEMATIC_LINES;

  // 模式自动切换
  useEffect(() => {
    const t = setInterval(() => setMode((m) => (m === 'story' ? 'cinematic' : 'story')), 6000);
    return () => clearInterval(t);
  }, []);

  // Step4 成果图轮播
  useEffect(() => {
    shotTimer.current = setInterval(() => setShot((s) => (s + 1) % STEP4_IMAGES.length), 2800);
    return () => { if (shotTimer.current) clearInterval(shotTimer.current); };
  }, []);

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
      {/* 左:文案 + 模式说明 */}
      <div className="reveal">
        <p className="text-sm tracking-[0.3em] text-zinc-500 uppercase mb-4">Feature · 分镜设计</p>
        <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">分镜提示词，到导演级分镜表</h3>
        <p className="text-zinc-300 leading-relaxed mb-8 text-[15px]">
          分镜设计分两步：先用 Step2 把画面拆解成多宫格分镜<strong className="text-white font-medium">提示词</strong>，
          连接图片卡生成分镜画面；再用 Step4 把分镜整理成<strong className="text-white font-medium">导演级分镜表格</strong>——
          时间码、景别、运镜、画面、音效一应俱全。
        </p>

        <div className="space-y-5 mb-9">
          <div
            className="rounded-xl border p-4 transition-all duration-300 cursor-pointer"
            onClick={() => setMode('story')}
            style={{ borderColor: mode === 'story' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', background: mode === 'story' ? 'rgba(255,255,255,0.06)' : 'transparent' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white font-semibold text-[15px]">Step2 · 故事模式</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">9 / 25 多宫格</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">根据画面按叙事节奏，自动拆解为多宫格连续分镜提示词，连接图片卡生成整组分镜。</p>
          </div>

          <div
            className="rounded-xl border p-4 transition-all duration-300 cursor-pointer"
            onClick={() => setMode('cinematic')}
            style={{ borderColor: mode === 'cinematic' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)', background: mode === 'cinematic' ? 'rgba(255,255,255,0.06)' : 'transparent' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white font-semibold text-[15px]">Step2 · 时空模式</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">首帧 + 尾帧</span>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">根据首尾帧推演中间帧提示词，连接图片卡补全过渡镜头序列，适合动作细节拆解。</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {['多宫格分镜', '动作补帧', '导演级分镜表', '时间码/景别/运镜'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-white/10 text-zinc-300">{tag}</span>
          ))}
        </div>
      </div>

      {/* 右:Step2 文本 + Step4 成果图 */}
      <div className="reveal">
        {/* Step2 提示词 */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-black/40 overflow-hidden mb-5">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/8 bg-white/[0.02]">
            <span className="text-xs font-mono text-zinc-500">STEP 2</span>
            <span className="text-sm text-zinc-300">分镜提示词 · {mode === 'story' ? '故事模式' : '时空模式'}</span>
          </div>
          <div className="p-4" style={{ height: 184 }}>
            <pre className="text-[12.5px] leading-[1.8] font-mono text-zinc-200 whitespace-pre-wrap break-words m-0">
              {lines.join('\n')}
            </pre>
          </div>
        </div>

        {/* 连接提示 */}
        <div className="flex items-center justify-center gap-2 mb-5 text-xs text-zinc-500">
          连接图片卡生成 · 整理为导演级分镜表 <span className="text-zinc-600">↓</span>
        </div>

        {/* Step4 成果图轮播 */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-black/40 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-white/[0.02]">
            <span className="text-sm text-zinc-300"><span className="font-mono text-zinc-500 mr-2">STEP 4</span>导演级分镜表格</span>
            <div className="flex gap-1.5">
              {STEP4_IMAGES.map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: i === shot ? '#fff' : 'rgba(255,255,255,0.25)' }} />
              ))}
            </div>
          </div>
          <div className="relative bg-black/30" style={{ minHeight: 220 }}>
            {STEP4_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`导演级分镜表格 ${i + 1}`}
                className="absolute inset-0 w-full h-full max-h-[300px] object-contain transition-opacity duration-700"
                style={{ opacity: i === shot ? 1 : 0 }}
                draggable={false}
              />
            ))}
            {/* 占位撑高 */}
            <img src={STEP4_IMAGES[0]} alt="" aria-hidden className="w-full max-h-[300px] object-contain invisible" draggable={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
