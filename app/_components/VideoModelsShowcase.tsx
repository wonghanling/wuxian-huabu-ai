'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

const VIDEOS = [
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781754350731-o1odfopyfe.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781745994405-htsdggzqdqn.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781745570668-azl0o8b4m25.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781697001294-5whdlofpr88.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781696645272-tkp79buqtmb.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/20ce33c8-6a71-41a1-804e-4997b4d95476/1777359234943-boa7rpvca39.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/20ce33c8-6a71-41a1-804e-4997b4d95476/1781061618463-5o5zmecrr7x.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/20ce33c8-6a71-41a1-804e-4997b4d95476/1781698964217-wmzgsxkp1ki.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/1773218894859-q2m2x3mfhfc.mp4',
  // Seedance
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1775944856863-qs8oz4jd72.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1775985214215-s1v2mstoaks.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1777614109362-gzq4dlfmrk6.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1776672667524-epths4fwdv.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1776390740271-2yivvu3r09.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1776390143680-695vp6vfoxw.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/20ce33c8-6a71-41a1-804e-4997b4d95476/1781695664266-5k6kcgp4zbt.mp4',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/seedance/1781176221581-r7enzj89qc.mp4',
];

const MODELS = [
  {
    name: 'Jimeng 3.0',
    nameZh: '即梦',
    type: 'Video',
    desc: 'Best Chinese scene understanding, smooth motion with camera control',
  },
  {
    name: 'Wan 2.7',
    nameZh: '万象',
    type: 'Video',
    desc: 'Four modes in one: i2v, first/last frame, reference, video editing',
  },
  {
    name: 'Seedance 2.0',
    nameZh: 'Seedance',
    type: 'Video',
    desc: 'Multimodal input, native audio output, top-tier professional production',
  },
  {
    name: 'Pixverse v6',
    nameZh: 'Pixverse',
    type: 'Video',
    desc: 'Maximum motion intensity, built-in sound effects, social-first content',
  },
  {
    name: 'HappyHorse 1.0',
    nameZh: '快乐马',
    type: 'Video',
    desc: 'Physics-accurate simulation, natural human motion, 1080P output',
  },
];

// 瀑布流：4列，15个视频均匀分配
function VideoWall({ inView }: { inView: boolean }) {
  // 手动分列，index 16 放第2列，避免单独成行
  const cols = [
    [0, 4, 8,  12],
    [1, 5, 9,  13],
    [2, 6, 10, 14, 16],
    [3, 7, 11, 15],
  ];

  return (
    <div className="px-4 md:px-10 flex gap-3 md:gap-4 items-start">
      {cols.map((colIndices, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-3 md:gap-4">
          {colIndices.map((idx) => (
            <VideoItem key={idx} src={VIDEOS[idx]} inView={inView} />
          ))}
        </div>
      ))}
    </div>
  );
}

function VideoItem({ src, inView }: { src: string; inView: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !inView) return;
    if (hovered) { v.play().catch(() => {}); }
    else { v.pause(); v.currentTime = 0; }
  }, [hovered, inView]);

  return (
    <div
      className="rounded-xl overflow-hidden bg-zinc-900 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/*
        width: 100% — 填满列宽
        height: auto — 由视频原始比例决定高度，完全不裁剪
        display: block — 去掉 inline 底部间隙
        用 <video> 自身的 intrinsic size 撑开容器，无需设 aspect-ratio
        preload="metadata" 让浏览器拿到尺寸，h-auto 才能正确撑高
      */}
      {inView ? (
        <video
          ref={ref}
          src={src}
          muted loop playsInline
          preload="metadata"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      ) : (
        // 占位块，等比例撑高避免布局跳动
        <div style={{ width: '100%', aspectRatio: '16/9', background: '#18181b' }} />
      )}
    </div>
  );
}

export function VideoModelsShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full">

      {/* 标题 */}
      <div className="text-center mb-14 px-6">
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: 'rgb(96,96,96)' }}>
          Video · 生成案例
        </p>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight" style={{ color: 'rgb(238,238,238)' }}>
          顶尖视频模型<br />
          <span className="font-normal text-2xl md:text-3xl" style={{ color: 'rgb(180,180,180)' }}>全部接入，随时切换</span>
        </h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: 'rgb(96,96,96)' }}>
          悬停预览 · 均为平台实际生成
        </p>
      </div>

      {/* 视频瀑布流 */}
      <VideoWall inView={inView} />

      {/* 模型卡片：照截图风格 */}
      <div className="mt-14 px-4 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODELS.slice(0, 3).map((m) => (
            <ModelCard key={m.name} model={m} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 md:max-w-[66.66%]">
          {MODELS.slice(3).map((m) => (
            <ModelCard key={m.name} model={m} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 flex justify-center">
        <Link href="/canvas">
          <button
            className="px-8 py-3.5 rounded-full font-semibold text-sm transition-transform hover:scale-[1.03]"
            style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
          >
            开始生成 →
          </button>
        </Link>
      </div>

    </div>
  );
}

function ModelCard({ model }: { model: typeof MODELS[0] }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col justify-between"
      style={{
        background: '#111113',
        border: '1px solid rgba(255,255,255,0.07)',
        minHeight: 160,
      }}
    >
      {/* 顶部：立即创作 + 类型标签 */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/canvas">
          <span className="text-xs font-medium hover:underline" style={{ color: 'rgb(113,208,131)' }}>立即创作</span>
        </Link>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgb(96,96,96)' }}
        >
          {model.type}
        </span>
      </div>
      {/* 底部：模型名 + 描述 */}
      <div>
        <div className="text-base font-semibold mb-1.5" style={{ color: 'rgb(238,238,238)' }}>
          {model.name}
        </div>
        <div className="text-xs leading-relaxed" style={{ color: 'rgb(96,96,96)' }}>
          {model.desc}
        </div>
      </div>
    </div>
  );
}
