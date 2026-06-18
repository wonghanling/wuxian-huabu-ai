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
  { name: '即梦 3.0',    label: '中文理解最佳',   sub: '字节跳动 · 运镜控制' },
  { name: 'Wan 2.7',    label: '四模式全覆盖',   sub: '阿里云 · 参考内容/编辑' },
  { name: 'Seedance',   label: '原生音频输出',   sub: '字节跳动 · 多模态' },
  { name: 'Pixverse v6', label: '动感冲击最强',  sub: '自带音效 · 社交内容' },
  { name: '快乐马',      label: '写实度最高',    sub: '物理仿真 · 1080P' },
];

function VideoCell({ src, inView }: { src: string; inView: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !inView) return;
    if (hovered) { v.play().catch(() => {}); }
    else { v.pause(); v.currentTime = 0; }
  }, [hovered, inView]);

  return (
    // aspect-ratio 固定 16/9，视频 object-cover 填满，无空白无变形
    <div
      className="relative rounded-xl overflow-hidden bg-zinc-900 cursor-pointer group"
      style={{ aspectRatio: '16/9' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {inView && (
        <video
          ref={ref}
          src={src}
          muted loop playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* 静止时半透明遮罩，hover 时消失 */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-300"
        style={{ opacity: hovered ? 0 : 0.25 }}
      />
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
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: '#2d6a4f' }}>
          Video · 生成案例
        </p>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight">
          顶尖视频模型<br />
          <span className="text-zinc-400 font-normal text-2xl md:text-3xl">全部接入，随时切换</span>
        </h2>
        <p className="text-base text-zinc-500 max-w-xl mx-auto">
          悬停预览 · 均为平台实际生成
        </p>
      </div>

      {/* 视频网格 3列，aspect-ratio 16/9 固定比例 */}
      <div className="px-4 md:px-10 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {VIDEOS.map((src) => (
          <VideoCell key={src} src={src} inView={inView} />
        ))}
      </div>

      {/* 模型 pill 列表 */}
      <div className="mt-12 px-4 md:px-10 flex flex-wrap gap-3">
        {MODELS.map((m) => (
          <div
            key={m.name}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors duration-200"
          >
            {/* 竖线色块 */}
            <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ background: 'rgba(45,106,79,0.7)' }} />
            <div>
              <div className="text-white text-sm font-semibold leading-tight">{m.name}</div>
              <div className="text-zinc-500 text-xs mt-0.5">{m.sub}</div>
            </div>
            <span
              className="ml-2 text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(45,106,79,0.15)', border: '1px solid rgba(45,106,79,0.3)', color: '#5a9e76' }}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 flex justify-center">
        <Link href="/canvas">
          <button className="px-8 py-3.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all hover:-translate-y-0.5">
            开始生成 →
          </button>
        </Link>
      </div>

    </div>
  );
}
