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
  { name: '即梦 3.0', tags: ['国产', '720P', '1080P'], desc: '字节跳动出品，中文理解强，运动自然流畅' },
  { name: 'Wan 2.7', tags: ['阿里', '多模态', '参考内容'], desc: '首尾帧 / 参考内容 / 视频编辑，全模式覆盖' },
  { name: 'Seedance 2.0', tags: ['多模态', '原生音频'], desc: '多输入融合，原生带音频，适合叙事短片' },
  { name: 'Pixverse v6', tags: ['动感', '音效'], desc: '动态强劲，自带音效，适合社交内容创作' },
  { name: '快乐马', tags: ['写实', '高清'], desc: '物理真实，运动流畅，1080P 高清输出' },
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
      className="relative rounded-xl ring-1 ring-white/10 bg-black cursor-pointer group overflow-hidden"
      style={{ aspectRatio: '9/16' }}
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
          // object-contain 保留原始比例，黑底填充空白，不裁剪
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
      {/* hover 遮罩：播放时微亮 */}
      <div
        className="absolute inset-0 transition-opacity duration-400 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.35)', opacity: hovered ? 0 : 1 }}
      />
      {/* 静止时播放图标 */}
      {!hovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
              <polygon points="2,1 11,6 2,11" />
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
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="relative w-full overflow-hidden">
      {/* 背景光晕 */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[160px] opacity-10"
          style={{ background: 'radial-gradient(circle,#10805a,transparent 70%)' }}
        />
      </div>

      {/* 标题 */}
      <div className="relative text-center mb-14 px-6">
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: '#10b07a' }}>
          Generated · 生成案例
        </p>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight">
          真实生成，不是演示
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          以下视频均由 Aura Canvas 调用各模型实际生成，悬停预览
        </p>
      </div>

      {/* 视频网格：5列等宽，9:16 比例，原始比例不裁剪 */}
      <div className="relative px-4 md:px-10 grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {VIDEOS.map((src) => (
          <VideoCell key={src} src={src} inView={inView} />
        ))}
      </div>

      {/* 分隔线 */}
      <div className="mt-16 mb-12 mx-4 md:mx-10 border-t border-white/5" />

      {/* 模型卡片：独立区域，与网格完全分开 */}
      <div className="relative px-4 md:px-10">
        <p className="text-xs tracking-[0.3em] uppercase text-zinc-500 mb-6">接入模型</p>
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {MODELS.map((m) => (
            <div
              key={m.name}
              className="flex-shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/30 transition-all duration-300 p-5"
              style={{ minWidth: 210 }}
            >
              <div className="flex flex-wrap gap-1.5 mb-3">
                {m.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  >{t}</span>
                ))}
              </div>
              <div className="text-white font-semibold text-sm mb-1.5">{m.name}</div>
              <div className="text-zinc-500 text-xs leading-relaxed">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="relative mt-12 flex justify-center">
        <Link href="/canvas">
          <button className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all hover:-translate-y-0.5 shadow-lg shadow-white/10">
            开始生成 →
          </button>
        </Link>
      </div>
    </div>
  );
}
