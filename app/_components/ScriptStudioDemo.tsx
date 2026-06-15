'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================
// 剧本工作室 · 交互式功能演示(主页)
// 左侧阶段标签,点击 → 右侧"屏幕"切换展示:文字打字机 / 图片淡入 / 二级资产钻取
// 纯展示,无任何后端调用;图片为预置演示素材
// ============================================================

type StageKey = 'novel' | 'beat' | 'character' | 'scene' | 'asset' | 'shooting';

interface Stage {
  key: StageKey;
  no: string;
  title: string;
  en: string;
  desc: string;
  kind: 'text' | 'image' | 'asset';
  image?: string;
  caption?: string;
  lines?: string[];           // 文字阶段:逐行打字
  assets?: { label: string; image: string; caption: string }[]; // 二级钻取(场景资产)
}

const STAGES: Stage[] = [
  {
    key: 'novel', no: '01', title: '生成小说', en: 'Novel Bible', kind: 'text',
    desc: '把一句想法扩写成有主题、人物弧光、冲突升级的完整故事',
    lines: [
      '雨在霓虹里碎成针。林深站在天台边缘，',
      '城市像一块正在熄灭的电路板，在他脚下闪烁。',
      '十二年前那场火，烧掉的不只是档案室——',
      '还有他相信"真相终会浮出水面"的最后一点天真。',
      '口袋里的硬盘还在发烫，里面是足以掀翻半座城的秘密……',
    ],
  },
  {
    key: 'beat', no: '02', title: '节拍表', en: 'Beat Sheet', kind: 'text',
    desc: 'Save the Cat 十五拍结构，精准控制情绪与节奏',
    lines: [
      '① 开场画面　—　暴雨天台，硬盘发烫',
      '② 主题陈述　—　"真相会浮出水面吗？"',
      '③ 推动事件　—　神秘来电，限时十二小时',
      '⑦ 中点　　　—　发现内鬼竟是当年的恩人',
      '⑮ 终场画面　—　黎明，城市第一次安静下来……',
    ],
  },
  {
    key: 'character', no: '03', title: '人物设计', en: 'Character Bible', kind: 'asset',
    desc: '角色三视图定妆 + 服装装备连续性表，锁定跨镜头一致性',
    assets: [
      { label: '主角设计', image: '/renwusheji1.webp', caption: '主角 · 三视角定妆设计稿' },
      { label: '配角设计', image: '/renwusheji3.webp', caption: '配角 · 角色设定稿' },
    ],
  },
  {
    key: 'scene', no: '04', title: '场景设计', en: 'Environment Bible', kind: 'image',
    desc: '场景世界观 + 多视角概念图，定义每一处空间的光影与质感',
    image: '/changjingsheji.webp',
    caption: '核心场景 · 概念设计图',
  },
  {
    key: 'asset', no: '05', title: '资产分解', en: 'Asset Bible', kind: 'asset',
    desc: '场景与人物里的每件资产，都能钻取出独立的技术分解图',
    assets: [
      { label: '装备分解', image: '/zhuangbeifenjie.webp', caption: '装备系统 · 技术分解板' },
      { label: '近塔分解 ①', image: '/jintafenjie1.webp', caption: '场景资产 · 近塔结构分解' },
      { label: '近塔分解 ②', image: '/jintafenjie2.webp', caption: '场景资产 · 近塔细节分解' },
    ],
  },
  {
    key: 'shooting', no: '06', title: '拍摄剧本', en: 'Shooting Script', kind: 'text',
    desc: '分镜 + 关键帧 + 图像/视频提示词，直接可拍可出片',
    lines: [
      'SC.024 / 天台 · 夜 · 暴雨',
      'SHOT 01　极广角　俯拍　城市灯海，雨幕倾泻',
      'SHOT 02　中景　　手持　林深逆光，硬盘红灯明灭',
      'SHOT 03　特写　　轨道　雨水顺着下颌线滑落',
      '镜头提示：冷蓝主调，霓虹反射，浅景深……',
    ],
  },
];

export function ScriptStudioDemo() {
  const [active, setActive] = useState<StageKey>('novel');
  const stage = STAGES.find((s) => s.key === active)!;
  const [assetIdx, setAssetIdx] = useState(0);

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-8">
      {/* 左:阶段标签 */}
      <div className="flex flex-col gap-2">
        {STAGES.map((s) => {
          const on = s.key === active;
          return (
            <button
              key={s.key}
              onClick={() => { setActive(s.key); setAssetIdx(0); }}
              className={`text-left px-4 py-3.5 rounded-xl border transition-all duration-300 group ${
                on
                  ? 'bg-white/10 border-white/25 shadow-lg shadow-black/30'
                  : 'bg-white/[0.02] border-white/8 hover:bg-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold tracking-wider transition-colors ${on ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>{s.no}</span>
                <div className="min-w-0">
                  <div className={`text-[15px] font-medium transition-colors ${on ? 'text-white' : 'text-zinc-300'}`}>{s.title}</div>
                  <div className="text-[11px] text-zinc-600 tracking-wide">{s.en}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 右:屏幕 */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-black/40 overflow-hidden min-h-[440px] flex flex-col">
        {/* 顶栏:窗口点 + 标题 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8 bg-white/[0.02]">
          <span className="w-3 h-3 rounded-full bg-white/15" />
          <span className="w-3 h-3 rounded-full bg-white/10" />
          <span className="w-3 h-3 rounded-full bg-white/8" />
          <span className="ml-3 text-sm text-zinc-400">{stage.title} · {stage.en}</span>
        </div>

        {/* 屏幕内容 */}
        <div className="flex-1 p-6 lg:p-8">
          <p className="text-sm text-zinc-500 mb-5">{stage.desc}</p>
          <StageScreen stage={stage} assetIdx={assetIdx} setAssetIdx={setAssetIdx} />
        </div>
      </div>
    </div>
  );
}

// 单个阶段的屏幕展示
function StageScreen({ stage, assetIdx, setAssetIdx }: { stage: Stage; assetIdx: number; setAssetIdx: (i: number) => void }) {
  if (stage.kind === 'text' && stage.lines) {
    return <Typewriter key={stage.key} lines={stage.lines} />;
  }
  if (stage.kind === 'image' && stage.image) {
    return <DemoImage key={stage.key} src={stage.image} caption={stage.caption} />;
  }
  if (stage.assets) {
    const a = stage.assets[Math.min(assetIdx, stage.assets.length - 1)];
    return (
      <div>
        <div className="flex flex-wrap gap-2.5 mb-5">
          {stage.assets.map((as, i) => (
            <button
              key={as.label}
              onClick={() => setAssetIdx(i)}
              className={`px-4 py-2 rounded-full text-sm border transition-all ${
                i === assetIdx
                  ? 'bg-white text-black border-white font-medium'
                  : 'bg-white/5 text-zinc-300 border-white/12 hover:bg-white/10'
              }`}
            >
              {as.label}
            </button>
          ))}
        </div>
        <DemoImage key={a.label} src={a.image} caption={a.caption} />
      </div>
    );
  }
  return null;
}

// 打字机:逐行浮现,最后省略号 + 发送到画布
function Typewriter({ lines }: { lines: string[] }) {
  const [shown, setShown] = useState(0);
  const [sent, setSent] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setShown(0); setSent(false);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    lines.forEach((_, i) => {
      timers.current.push(setTimeout(() => setShown((n) => Math.max(n, i + 1)), 320 * (i + 1)));
    });
    return () => { timers.current.forEach(clearTimeout); };
  }, [lines]);

  const done = shown >= lines.length;

  return (
    <div className="font-mono text-[15px] leading-[2] text-zinc-200 min-h-[240px]">
      {lines.map((ln, i) => (
        <div
          key={i}
          className="transition-all duration-500"
          style={{ opacity: i < shown ? 1 : 0, transform: i < shown ? 'translateY(0)' : 'translateY(8px)' }}
        >
          {ln}
        </div>
      ))}
      <span className="inline-block text-zinc-500 transition-opacity duration-500" style={{ opacity: done ? 1 : 0 }}>
        ……<span className="cursor-blink">▋</span>
      </span>

      {/* 发送到画布(文字卡) */}
      <div className="mt-6 flex items-center gap-3" style={{ opacity: done ? 1 : 0, transition: 'opacity 0.5s ease' }}>
        <button
          onClick={() => { setSent(true); setTimeout(() => setSent(false), 1600); }}
          className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-zinc-200 text-xs font-medium hover:bg-white/15 transition-all font-sans"
        >
          ➤ 发送到画布
        </button>
        <span
          className="text-xs text-zinc-400 font-sans"
          style={{ opacity: sent ? 1 : 0, transform: sent ? 'translateX(0)' : 'translateX(-6px)', transition: 'all 0.4s cubic-bezier(.2,.8,.2,1)' }}
        >
          ✓ 已发送到画布(文本卡)
        </span>
      </div>
    </div>
  );
}

// 图片淡入展示 + 发送到画布交互
function DemoImage({ src, caption }: { src: string; caption?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => { setSent(false); }, [src]);
  return (
    <figure className="m-0">
      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30 max-w-2xl">
        <img
          src={src}
          alt={caption || ''}
          onLoad={() => setLoaded(true)}
          className="w-full h-auto max-h-[420px] object-contain transition-all duration-700"
          style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'scale(1)' : 'scale(1.03)' }}
        />
        {/* 发送成功飞入提示 */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold shadow-xl pointer-events-none"
          style={{ opacity: sent ? 1 : 0, transform: `translateX(-50%) translateY(${sent ? '0' : '-8px'})`, transition: 'all 0.4s cubic-bezier(.2,.8,.2,1)' }}
        >
          ✓ 已发送到画布
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {caption && <figcaption className="text-sm text-zinc-500 flex-1">{caption}</figcaption>}
        <button
          onClick={() => { setSent(true); setTimeout(() => setSent(false), 1600); }}
          className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-zinc-200 text-xs font-medium hover:bg-white/15 transition-all whitespace-nowrap"
        >
          ➤ 发送到画布
        </button>
      </div>
    </figure>
  );
}
