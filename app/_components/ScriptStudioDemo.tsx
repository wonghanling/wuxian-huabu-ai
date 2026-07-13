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
  kind: 'text' | 'image' | 'asset' | 'gallery';
  image?: string;
  caption?: string;
  lines?: string[];           // 文字阶段:逐行打字
  images?: string[];          // 画廊阶段:大图自动从右往左滑动展示
  assets?: { label: string; images: string[]; caption: string }[]; // 二级钻取(每个标签可含多张图)
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
    key: 'character', no: '03', title: '人物设计', en: 'Character Bible', kind: 'gallery',
    desc: '角色三视图定妆 + 服装、道具资产，锁定跨镜头一致性',
    images: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783795675255.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783796234874.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783796419207.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783796570329.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783796677572.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783814136154.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783823322385.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783823650889.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783823869401.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783824147146.jpg',
    ],
  },
  {
    key: 'scene', no: '04', title: '场景设计', en: 'Environment Bible', kind: 'gallery',
    desc: '场景世界观 + 多视角概念图，定义每一处空间的光影与质感',
    images: [
      '/changjingsheji.webp',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783866982616.jpg',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783867221698.jpg',
    ],
  },
  {
    key: 'asset', no: '05', title: '正式剧本', en: 'Screenplay', kind: 'text',
    desc: '标准剧本格式：场景标题、动作描述、对白与镜头提示，一键成稿',
    lines: [
      'SC.024　内 · 档案室 · 夜',
      '林深推开锈蚀的铁门，手电光束刺入尘埃。',
      '　　　　林深（低声）',
      '　　十二年了，你还在等我。',
      '他抽出泛黄的卷宗，指尖停在那行被划掉的名字上……',
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
  const [auto, setAuto] = useState(true);   // 自动轮播,用户点击后暂停

  // 自动播放:文字/单图阶段停一会切下个阶段;多图(asset)阶段先逐张播完再切下个阶段
  useEffect(() => {
    if (!auto) return;
    const cur = STAGES.find((s) => s.key === active)!;
    const isAsset = cur.kind === 'asset' && !!cur.assets;
    const dwell = cur.kind === 'text' ? 4200 : cur.kind === 'gallery' ? 6000 : isAsset ? 2600 : 3200;
    const t = setTimeout(() => {
      if (isAsset && assetIdx < cur.assets!.length - 1) {
        setAssetIdx((i) => i + 1);                 // 还有下一张图,先切图
      } else {
        const idx = STAGES.findIndex((s) => s.key === active);
        setActive(STAGES[(idx + 1) % STAGES.length].key);  // 切下个阶段
        setAssetIdx(0);
      }
    }, dwell);
    return () => clearTimeout(t);
  }, [active, assetIdx, auto]);

  const pick = (k: StageKey) => { setAuto(false); setActive(k); setAssetIdx(0); };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-6 lg:gap-8">
      {/* 左:阶段标签 */}
      <div className="flex flex-col gap-2">
        {STAGES.map((s) => {
          const on = s.key === active;
          return (
            <button
              key={s.key}
              onClick={() => pick(s.key)}
              className={`text-left px-4 py-3.5 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                on
                  ? 'bg-white/10 border-white/25 shadow-lg shadow-black/30'
                  : 'bg-white/[0.02] border-white/8 hover:bg-white/5 hover:border-white/15'
              }`}
            >
              {/* 自动播放进度条(当前项底部,每次停留重新计时) */}
              {on && auto && (
                <span
                  key={`${active}-${assetIdx}`}
                  className="absolute left-0 bottom-0 h-[2px] bg-white/50"
                  style={{ animation: `ssd-progress ${stage.kind === 'text' ? 4.2 : stage.kind === 'asset' ? 2.6 : 3.2}s linear forwards` }}
                />
              )}
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

      {/* 右:屏幕 — 固定高度,内容切换不改变外框高度(防页面浮动) */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/60 to-black/40 overflow-hidden h-[520px] flex flex-col">
        {/* 顶栏:窗口点 + 标题 */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/8 bg-white/[0.02] shrink-0">
          <span className="w-3 h-3 rounded-full bg-white/15" />
          <span className="w-3 h-3 rounded-full bg-white/10" />
          <span className="w-3 h-3 rounded-full bg-white/8" />
          <span className="ml-3 text-sm text-zinc-400">{stage.title} · {stage.en}</span>
        </div>

        {/* 屏幕内容 — 溢出内部滚动,不撑高外框 */}
        <div className="flex-1 min-h-0 overflow-auto p-6 lg:p-8 cv2-scroll">
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
  if (stage.kind === 'gallery' && stage.images) {
    return <Gallery key={stage.key} images={stage.images} />;
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
        <AssetImages key={a.label} images={a.images} caption={a.caption} />
      </div>
    );
  }
  return null;
}

// 单个标签下的图片展示：一张则直接显示，多张则自动轮播(带小圆点)
function AssetImages({ images, caption }: { images: string[]; caption?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setI((n) => (n + 1) % images.length), 2200);
    return () => clearInterval(t);
  }, [images]);
  return (
    <div>
      <DemoImage key={images[Math.min(i, images.length - 1)]} src={images[Math.min(i, images.length - 1)]} caption={caption} />
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-3">
          {images.map((_, k) => (
            <span key={k} className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: k === i ? '#fff' : 'rgba(255,255,255,0.25)' }} />
          ))}
        </div>
      )}
    </div>
  );
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
    <div className="font-mono text-[15px] leading-[2] text-zinc-200 h-[300px] overflow-hidden">
      {lines.map((ln, i) => (
        <div
          key={i}
          className="transition-opacity duration-500"
          style={{ opacity: i < shown ? 1 : 0 }}
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

// 画廊:大图横向自动从右往左滚动展示(跑马灯),无缝循环,图片完整显示不裁切
function Gallery({ images }: { images: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (el) {
        el.scrollLeft += 2.2;   // 自动滚动速度
        // 滚到第一份图末尾时无缝回到开头(下方图片复制一份实现循环)
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft -= el.scrollWidth / 2;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [images]);

  // 复制一份图片首尾相接,实现无缝循环
  const loop = [...images, ...images];

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto no-scrollbar h-full items-center"
      style={{ scrollbarWidth: 'none' }}
    >
      {loop.map((src, i) => (
        <div
          key={i}
          className="flex-shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/30 h-full flex items-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-auto object-contain" draggable={false} loading="lazy" />
        </div>
      ))}
    </div>
  );
}
