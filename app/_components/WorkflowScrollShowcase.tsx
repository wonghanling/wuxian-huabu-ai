'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ============================================================
// 功能演示区 · Sticky Scroll Showcase
// 左侧4项文案纵向排列，正常页面滚动；右侧预览区 sticky 固定。
// IntersectionObserver 监听左侧每个文案块是否进入视口中心区域，
// 命中即切换 activeIndex，右侧 4 层预览用 opacity 淡入淡出联动切换（不重新排版，不闪烁）。
// 纯前端展示逻辑，不涉及任何数据请求/业务状态。
// 阶段1(本次)：先搭好骨架+联动机制，预览层用简单占位内容验证效果，
// 后续再把剧本工作室/涂鸦/JSON/分镜的真实动画逐个迁移进来。
// ============================================================

const ITEMS = [
  { key: 'script', title: '剧本工作室', desc: '从一个想法到一部可拍摄的电影，完整覆盖角色设定、场景多视角、镜头级提示词生成。' },
  { key: 'doodle', title: '涂鸦标注', desc: '在图片上直接涂抹标注修改意图，一键发送到画布生成新版本，所见即所得。' },
  { key: 'json', title: 'JSON 配置', desc: '用一段 JSON 锁定生成风格，一键注入专业模板，每次生成都按此执行。' },
  { key: 'shotboard', title: '分镜设计', desc: '分镜提示词到导演级分镜表格，时间码、景别、运镜、画面一应俱全。' },
] as const;

// ============================================================
// 剧本工作室 · 6子流程数据（迁移自 ScriptStudioDemo.tsx，内容不变）
// 仅当这一层作为 activeIndex===0 可见时才自动轮播，切走时清空定时器
// ============================================================
type StageKind = 'text' | 'image' | 'asset';
interface ScriptStage {
  key: string;
  no: string;
  title: string;
  kind: StageKind;
  image?: string;
  caption?: string;
  lines?: string[];
  assets?: { label: string; image: string; caption: string }[];
}

const SCRIPT_STAGES: ScriptStage[] = [
  {
    key: 'novel', no: '01', title: '生成小说', kind: 'text',
    lines: [
      '雨在霓虹里碎成针。林深站在天台边缘，',
      '城市像一块正在熄灭的电路板，在他脚下闪烁。',
      '十二年前那场火，烧掉的不只是档案室——',
      '还有他相信"真相终会浮出水面"的最后一点天真。',
      '口袋里的硬盘还在发烫，里面是足以掀翻半座城的秘密……',
    ],
  },
  {
    key: 'beat', no: '02', title: '节拍表', kind: 'text',
    lines: [
      '① 开场画面　—　暴雨天台，硬盘发烫',
      '② 主题陈述　—　"真相会浮出水面吗？"',
      '③ 推动事件　—　神秘来电，限时十二小时',
      '⑦ 中点　　　—　发现内鬼竟是当年的恩人',
      '⑮ 终场画面　—　黎明，城市第一次安静下来……',
    ],
  },
  {
    key: 'character', no: '03', title: '人物设计', kind: 'asset',
    assets: [
      { label: '主角设计', image: '/renwusheji1.webp', caption: '主角 · 三视角定妆设计稿' },
      { label: '机甲设计', image: '/renwusheji2.webp', caption: '机甲角色 · 三视图 + 头部细节' },
      { label: '配角设计', image: '/renwusheji3.webp', caption: '配角 · 角色设定稿' },
    ],
  },
  {
    key: 'scene', no: '04', title: '场景设计', kind: 'image',
    image: '/changjingsheji.webp',
    caption: '核心场景 · 概念设计图',
  },
  {
    key: 'asset', no: '05', title: '资产分解', kind: 'asset',
    assets: [
      { label: '装备分解', image: '/zhuangbeifenjie.webp', caption: '装备系统 · 技术分解板' },
      { label: '近塔分解 ①', image: '/jintafenjie1.webp', caption: '场景资产 · 近塔结构分解' },
      { label: '近塔分解 ②', image: '/jintafenjie2.webp', caption: '场景资产 · 近塔细节分解' },
    ],
  },
  {
    key: 'shooting', no: '06', title: '拍摄剧本', kind: 'text',
    lines: [
      'SC.024 / 天台 · 夜 · 暴雨',
      'SHOT 01　极广角　俯拍　城市灯海，雨幕倾泻',
      'SHOT 02　中景　　手持　林深逆光，硬盘红灯明灭',
      'SHOT 03　特写　　轨道　雨水顺着下颌线滑落',
      '镜头提示：冷蓝主调，霓虹反射，浅景深……',
    ],
  },
];

// 打字机：逐行浮现（迁移自 ScriptStudioDemo.tsx，去掉交互按钮，纯展示）
function StageTypewriter({ lines }: { lines: string[] }) {
  // 调用处始终传 key={stage.key}，切换阶段会整体重新挂载，shown 天然从 0 开始，无需在 effect 里手动重置
  const [shown, setShown] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    lines.forEach((_, i) => {
      timers.current.push(setTimeout(() => setShown((n) => Math.max(n, i + 1)), 320 * (i + 1)));
    });
    return () => { timers.current.forEach(clearTimeout); };
  }, [lines]);

  return (
    <div className="font-mono text-sm leading-[1.9]" style={{ color: 'rgb(200,200,200)' }}>
      {lines.map((ln, i) => (
        <div key={i} className="transition-opacity duration-500" style={{ opacity: i < shown ? 1 : 0 }}>
          {ln}
        </div>
      ))}
    </div>
  );
}

// 图片展示（迁移自 ScriptStudioDemo.tsx 的 DemoImage，去掉交互按钮）
// 调用处始终传 key={...}，切图会整体重新挂载，loaded 天然从 false 开始，无需额外 effect 重置
function StageImage({ src, caption }: { src: string; caption?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div>
      <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid #ffffff1c', background: 'rgba(0,0,0,0.3)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || ''}
          onLoad={() => setLoaded(true)}
          className="w-full h-auto max-h-[280px] object-contain transition-all duration-700"
          style={{ opacity: loaded ? 1 : 0, transform: loaded ? 'scale(1)' : 'scale(1.03)' }}
        />
      </div>
      {caption && <p className="text-xs mt-2" style={{ color: 'rgb(96,96,96)' }}>{caption}</p>}
    </div>
  );
}

// 剧本工作室预览层：内部6子流程自动轮播，仅当 isActive(即 activeIndex===0 且可见) 时运行
function ScriptStudioPreview({ isActive }: { isActive: boolean }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [assetIdx, setAssetIdx] = useState(0);
  const stage = SCRIPT_STAGES[stageIdx];

  useEffect(() => {
    if (!isActive) return;
    const isAsset = stage.kind === 'asset' && !!stage.assets;
    const dwell = stage.kind === 'text' ? 4200 : isAsset ? 2600 : 3200;
    const t = setTimeout(() => {
      if (isAsset && assetIdx < stage.assets!.length - 1) {
        setAssetIdx((i) => i + 1);
      } else {
        setStageIdx((i) => (i + 1) % SCRIPT_STAGES.length);
        setAssetIdx(0);
      }
    }, dwell);
    return () => clearTimeout(t);
  }, [isActive, stageIdx, assetIdx, stage]);

  return (
    <div className="w-full h-full flex flex-col p-6 md:p-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs font-bold tracking-wider" style={{ color: 'rgb(113,208,131)' }}>{stage.no}</span>
        <span className="text-sm font-medium" style={{ color: 'rgb(238,238,238)' }}>{stage.title}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {stage.kind === 'text' && stage.lines && <StageTypewriter key={stage.key} lines={stage.lines} />}
        {stage.kind === 'image' && stage.image && <StageImage key={stage.key} src={stage.image} caption={stage.caption} />}
        {stage.kind === 'asset' && stage.assets && (
          <StageImage
            key={`${stage.key}-${assetIdx}`}
            src={stage.assets[Math.min(assetIdx, stage.assets.length - 1)].image}
            caption={stage.assets[Math.min(assetIdx, stage.assets.length - 1)].caption}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 涂鸦标注 · 动画预览（迁移自 DoodleDemo.tsx，内容/时序不变）
// phase: 0 空 / 1 标注图淡入 / 2 显示发送按钮 / 3 飞向角落 / 4 落定为卡片
// 仅当 isActive 时跑循环，切走时清空定时器
// ============================================================
const DOODLE_STEPS = ['上传图片', '涂抹标注', '发送到画布', '生成新卡片'];

function DoodlePreview({ isActive }: { isActive: boolean }) {
  const [phase, setPhase] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isActive) return;
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
    run();
    return () => timers.current.forEach(clearTimeout);
  }, [isActive]);

  const flying = phase >= 3;
  const landed = phase >= 4;

  return (
    <div className="w-full h-full flex flex-col p-6 md:p-8">
      <div
        className="relative rounded-xl overflow-hidden flex-1 min-h-0 select-none"
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

        {/* 图片:绝对定位居中，用 transform scale/translate 做飞入(不影响布局高度) */}
        <div
          className="absolute"
          style={{
            left: '50%', top: '50%',
            transformOrigin: 'center center',
            transform: flying
              ? 'translate(-50%,-50%) scale(0.4) translate(70%, 0)'
              : 'translate(-50%,-50%) scale(1)',
            opacity: phase >= 1 ? 1 : 0,
            filter: phase >= 1 ? 'none' : 'blur(8px)',
            transition: 'transform 0.9s cubic-bezier(.45,.05,.2,1), opacity 0.7s ease, filter 0.7s ease',
            width: '60%',
          }}
        >
          <div
            className="relative rounded-xl overflow-hidden border shadow-2xl"
            style={{ borderColor: landed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)', transition: 'border-color 0.4s ease' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tuyabiaozhu.webp" alt="涂鸦标注演示" className="w-full h-auto block" draggable={false} />
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
        </div>

        {/* "发送到画布"提示(蓄势出现,飞行时隐藏) */}
        <div
          className="absolute inset-x-0 bottom-0 flex justify-center pb-3 pt-10"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)',
            opacity: phase === 2 ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          <div className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold shadow-2xl flex items-center gap-1.5">
            发送到画布 <span className="text-sm leading-none">→</span>
          </div>
        </div>

        {/* 落定提示 */}
        <div
          className="absolute inset-x-0 top-0 flex justify-center pt-3 pb-10"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
            opacity: landed ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          <div className="px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-white text-[11px] font-medium backdrop-blur-md">
            已添加到画布 · 可连线生成
          </div>
        </div>
      </div>

      {/* 步骤指示 */}
      <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
        {DOODLE_STEPS.map((s, i) => {
          const on = phase >= i + 1;
          return (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="text-[11px] px-2 py-1 rounded-full border transition-all duration-300"
                style={{
                  borderColor: on ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
                  background: on ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: on ? '#fff' : '#71717a',
                }}
              >
                {s}
              </span>
              {i < DOODLE_STEPS.length - 1 && <span className="text-zinc-700 text-[11px]">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 按 item.key 分发到对应预览组件；尚未迁移的项先用占位文字兜底
function PreviewByKey({ itemKey, title, isActive }: { itemKey: string; title: string; isActive: boolean }) {
  if (itemKey === 'script') return <ScriptStudioPreview isActive={isActive} />;
  if (itemKey === 'doodle') return <DoodlePreview isActive={isActive} />;
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-sm" style={{ color: 'rgb(96,96,96)' }}>{title} 预览（占位，待迁移）</span>
    </div>
  );
}

export function WorkflowScrollShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = itemRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0.45 }
    );
    itemRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Feature · 核心功能</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
          一个画布，覆盖创作全流程
        </h2>
      </div>

      {/* 桌面端：左右联动布局 */}
      <div className="hidden md:grid md:grid-cols-[380px_1fr] gap-16">
        {/* 左：4项文案，正常滚动 */}
        <div className="flex flex-col">
          {ITEMS.map((item, i) => (
            <div
              key={item.key}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="flex flex-col justify-center transition-opacity duration-500"
              style={{ minHeight: 320, opacity: activeIndex === i ? 1 : 0.3 }}
            >
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
                {item.title}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 右：sticky 预览区 */}
        <div className="sticky self-start" style={{ top: 120 }}>
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{ height: 560, background: 'rgb(20,20,20)', border: '1px solid #ffffff1c' }}
          >
            {ITEMS.map((item, i) => (
              <div
                key={item.key}
                className="absolute inset-0"
                style={{ opacity: activeIndex === i ? 1 : 0, transition: 'opacity 0.45s ease' }}
              >
                <PreviewByKey itemKey={item.key} title={item.title} isActive={activeIndex === i} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 移动端：上下堆叠，不使用 sticky */}
      <div className="flex md:hidden flex-col gap-10">
        {ITEMS.map((item) => (
          <div key={item.key}>
            <h3 className="text-2xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
              {item.title}
            </h3>
            <p className="text-base leading-relaxed mb-5" style={{ color: 'rgb(180,180,180)' }}>
              {item.desc}
            </p>
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ aspectRatio: '4/3', background: 'rgb(20,20,20)', border: '1px solid #ffffff1c' }}
            >
              <PreviewByKey itemKey={item.key} title={item.title} isActive />
            </div>
          </div>
        ))}
      </div>

      {/* 底部 CTA：保留原「进入剧本工作室」入口 */}
      <div className="flex justify-center mt-16">
        <Link href="/canvas?studio=true">
          <button
            className="px-8 py-3.5 rounded-full font-semibold text-sm transition-transform hover:scale-[1.03]"
            style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
          >
            进入剧本工作室 →
          </button>
        </Link>
      </div>
    </div>
  );
}
