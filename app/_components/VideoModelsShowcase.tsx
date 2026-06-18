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
];

const MODELS = [
  {
    name: '即梦 3.0',
    tags: ['国产首选', '720P', '1080P'],
    desc: '字节跳动出品，中文场景理解最强，运动自然，支持运镜控制',
    highlight: '中文理解最佳',
  },
  {
    name: 'Wan 2.7',
    tags: ['全模式', '参考内容', '视频编辑'],
    desc: '阿里云出品，首帧/首尾帧/参考人物/视频续写四合一，最全能',
    highlight: '模式最全面',
  },
  {
    name: 'Seedance 2.0',
    tags: ['原生音频', '多模态'],
    desc: '字节出品，生成视频自带背景音乐与音效，无需额外配音',
    highlight: '自带原生音频',
  },
  {
    name: 'Pixverse v6',
    tags: ['动感强', '音效'],
    desc: '动态效果最强烈，画面冲击力大，适合短视频与社交内容',
    highlight: '动感冲击最强',
  },
  {
    name: '快乐马',
    tags: ['物理写实', '高清'],
    desc: '物理仿真精准，人物动作自然逼真，1080P 高清输出',
    highlight: '写实度最高',
  },
];

function VideoCell({ src, inView }: { src: string; inView: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !inView) return;
    if (hovered) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hovered, inView]);

  return (
    <div
      className="rounded-xl overflow-hidden bg-zinc-900 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* video 自然撑开宽度，高度随视频原始比例自动决定，不裁剪不变形 */}
      {inView ? (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="none"
          className="w-full h-auto block"
        />
      ) : (
        // 占位：16:9 灰色块，避免 inView=false 时格子塌陷
        <div className="w-full bg-zinc-900" style={{ aspectRatio: '16/9' }} />
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
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full">

      {/* 标题 */}
      <div className="text-center mb-14 px-6">
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: '#2d6a4f' }}>
          Generated · 生成案例
        </p>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight">
          顶尖视频模型<br />
          <span className="text-zinc-400 font-normal text-3xl md:text-4xl">全部接入，随时切换</span>
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          悬停预览——以下均为平台实际生成效果
        </p>
      </div>

      {/* 视频网格：3列，视频原始比例自然撑开 */}
      <div className="px-4 md:px-10 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {VIDEOS.map((src) => (
          <VideoCell key={src} src={src} inView={inView} />
        ))}
      </div>

      {/* 分隔 */}
      <div className="mt-16 mb-12 mx-4 md:mx-10 border-t border-white/5" />

      {/* 模型卡片 */}
      <div className="px-4 md:px-10">
        <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-6">接入模型</p>
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {MODELS.map((m, i) => (
            <div
              key={m.name}
              className="flex-shrink-0 rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-300 p-5"
              style={{ minWidth: 220 }}
            >
              {/* highlight 标签：每张不同底色深度 */}
              <div
                className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full mb-3"
                style={{
                  background: `rgba(45,106,79,${0.12 + i * 0.04})`,
                  border: '1px solid rgba(45,106,79,0.35)',
                  color: '#6db891',
                }}
              >
                {m.highlight}
              </div>
              <div className="text-white font-semibold text-sm mb-2">{m.name}</div>
              <div className="text-zinc-500 text-xs leading-relaxed mb-3">{m.desc}</div>
              <div className="flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-500">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-12 flex justify-center">
        <Link href="/canvas">
          <button className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all hover:-translate-y-0.5">
            开始生成 →
          </button>
        </Link>
      </div>

    </div>
  );
}
