'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ============================================================
// BOLUOTV · 作品广场(React Flow 新引擎作品)
// 卡片悬停播放视频 + 「使用模板」→ /canvas?templateId=xxx 进画布加载创作过程
// 只展示新引擎作品(list?engine=react-flow),旧 tldraw 作品不显示(格式不兼容)
// ============================================================

type Work = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  preview_video_url: string | null;
  category: string | null;
  tags: string[] | null;
  is_featured: boolean;
  use_count: number;
};

export default function BoluoTVPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/templates/list?engine=react-flow&limit=60')
      .then((r) => r.json())
      .then((data) => { setWorks(data.templates || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/8">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">BOLUO<span className="text-emerald-500">TV</span></span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">首页</Link>
            <Link href="/canvas" className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors">进入画布</Link>
          </div>
        </div>
      </nav>

      {/* 标题区 */}
      <section className="px-6 pt-16 pb-10 text-center">
        <p className="text-sm tracking-[0.3em] text-emerald-500/80 uppercase mb-4">BOLUOTV · 作品广场</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">看见别人怎么创作</h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          每个作品都可一键载入画布，完整复刻它的创作流程，在此基础上继续创作
        </p>
      </section>

      {/* 作品网格 */}
      <section className="px-6 pb-24">
        <div className="max-w-[1600px] mx-auto">
          {loading ? (
            <div className="text-center text-zinc-500 py-20">加载中…</div>
          ) : works.length === 0 ? (
            <div className="text-center text-zinc-500 py-20">
              暂无作品。用画布创作后，管理员可在画布内「保存为模板」发布到这里。
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {works.map((w) => <WorkCard key={w.id} work={w} />)}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function WorkCard({ work }: { work: Work }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 进视口预加载视频
  useEffect(() => {
    if (!work.preview_video_url) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVideoSrc(work.preview_video_url); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [work.preview_video_url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (hovered) { video.play().catch(() => {}); }
    else { video.pause(); video.currentTime = 0; setPlaying(false); }
  }, [hovered, videoSrc]);

  const useTemplate = () => router.push(`/canvas?templateId=${work.id}`);

  return (
    <div
      ref={cardRef}
      className="glass-card overflow-hidden group hover:border-emerald-500/40 transition-all duration-300 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={useTemplate}
    >
      <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
        {work.cover_url && (
          <Image
            src={work.cover_url}
            alt={work.title}
            fill
            className={`object-cover transition-opacity duration-500 ${playing ? 'opacity-0' : 'opacity-100'}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
          />
        )}
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={work.cover_url || undefined}
            muted loop playsInline preload="metadata"
            onPlaying={() => setPlaying(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${playing ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {/* 播放图标(未悬停) */}
        {work.preview_video_url && !hovered && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}
        {work.is_featured && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-bold shadow-lg z-10">精选</div>
        )}
        {/* 悬停浮现「使用模板」 */}
        <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); useTemplate(); }}
            className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-lg"
          >
            使用模板 →
          </button>
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold mb-2 text-white">{work.title}</h3>
        {work.description && <p className="text-sm text-zinc-400 mb-1 line-clamp-2 leading-relaxed">{work.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1">
            {work.tags?.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-zinc-300 border border-white/5">{tag}</span>
            ))}
          </div>
          {work.use_count > 0 && <span className="text-[11px] text-zinc-500 shrink-0">{work.use_count} 次使用</span>}
        </div>
      </div>
    </div>
  );
}
