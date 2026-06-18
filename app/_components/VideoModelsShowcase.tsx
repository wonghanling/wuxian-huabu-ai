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

// 网格布局：第一格占 2×2，其余 8 格各占 1×1，形成 4 列
// 实际渲染：CSS grid，首项 row-span-2 col-span-2
const GRID_SPANS = [
  'col-span-2 row-span-2', // 大格
  '', '', '', '',
  '', '', '', '',
];

const MODELS = [
  { name: '即梦 3.0', tags: ['国产', '720P', '1080P'], desc: '字节跳动出品，中文理解强，运动自然流畅' },
  { name: 'Wan 2.7', tags: ['阿里', '多模态', '参考内容'], desc: '首尾帧 / 参考内容 / 视频编辑，全模式覆盖' },
  { name: 'Seedance 2.0', tags: ['多模态', '原生音频'], desc: '多输入融合，原生带音频，适合叙事短片' },
  { name: 'Pixverse v6', tags: ['动感', '音效'], desc: '动态强劲，自带音效，适合社交内容创作' },
  { name: '快乐马', tags: ['写实', '高清'], desc: '物理真实，运动流畅，1080P 高清输出' },
];

function VideoCell({ src, span, inView }: { src: string; span: string; inView: boolean }) {
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
      className={`relative overflow-hidden rounded-2xl ring-1 ring-white/10 bg-zinc-900 cursor-pointer group ${span}`}
      style={{ aspectRatio: span.includes('2') ? undefined : '9/16', minHeight: span.includes('2') ? 340 : 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {inView && (
        <video
          ref={ref}
          src={src}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      {/* 渐变遮罩：hover 时淡出，静止时稍暗 */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)',
          opacity: hovered ? 0.3 : 0.7,
        }}
      />
      {/* 播放提示 */}
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <polygon points="3,1 13,7 3,13" />
            </svg>
          </div>
        </div>
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
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full overflow-hidden">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[180px] opacity-10"
          style={{ background: 'radial-gradient(circle,#10805a,transparent 70%)' }} />
      </div>

      {/* 标题 */}
      <div className="relative text-center mb-14 px-6">
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: '#10b07a' }}>Video Models · 顶尖视频模型</p>
        <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
          一个画布<br />
          <span style={{ background: 'linear-gradient(90deg,#6ee7b7,#10805a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            全球顶尖视频模型
          </span>
        </h2>
        <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          即梦、Wan 2.7、Seedance、Pixverse、快乐马——在同一画布里按需切换，一键生成电影级视频
        </p>
      </div>

      {/* 视频网格：4 列，首格占 2×2 */}
      <div
        className="relative px-4 md:px-10 grid gap-3 md:gap-4"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '200px' }}
      >
        {VIDEOS.map((src, i) => (
          <VideoCell key={src} src={src} span={GRID_SPANS[i]} inView={inView} />
        ))}
      </div>

      {/* 模型标签卡片横排 */}
      <div className="relative mt-10 px-4 md:px-10">
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-none">
          {MODELS.map((m) => (
            <div
              key={m.name}
              className="flex-shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40 transition-all duration-300 p-5"
              style={{ minWidth: 220 }}
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.tags.map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{t}</span>
                ))}
              </div>
              <div className="text-white font-semibold text-base mb-1.5">{m.name}</div>
              <div className="text-zinc-400 text-xs leading-relaxed mb-4">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="relative mt-10 flex justify-center">
        <Link href="/canvas">
          <button className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all hover:-translate-y-0.5 shadow-lg shadow-white/10">
            立即创作视频 →
          </button>
        </Link>
      </div>
    </div>
  );
}
