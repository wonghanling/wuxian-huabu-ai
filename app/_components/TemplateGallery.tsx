'use client';
import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';

type Template = {
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

export function TemplateGallery() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/templates/list?limit=30')
      .then(r => r.json())
      .then(data => {
        setTemplates(data.templates || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || templates.length === 0) return null;

  return (
    <section className="py-24 px-6 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
      <div className="max-w-[1600px] mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: 'rgb(96,96,96)' }}>Templates · 工作流模板</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
            创意工作流模板
          </h2>
          <p className="text-lg" style={{ color: 'rgb(180,180,180)' }}>一键复用完整工作流，立即开始创作</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // 进入视口就预加载视频(preload metadata),保证悬停时已就绪,避免黑屏
  useEffect(() => {
    if (!template.preview_video_url) return;
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVideoSrc(template.preview_video_url);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [template.preview_video_url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (hovered) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
      setPlaying(false); // 移开后复位,下次悬停重新等首帧
    }
  }, [hovered, videoSrc]);

  return (
    <div
      ref={cardRef}
      className="rounded-2xl overflow-hidden group transition-all duration-300"
      style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
        {template.cover_url && (
          <Image
            src={template.cover_url}
            alt={template.title}
            fill
            // 封面只在视频真正出画(onPlaying)后才淡出,杜绝黑屏缝隙
            className={`object-cover transition-opacity duration-500 ${playing ? 'opacity-0' : 'opacity-100'}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        )}
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={template.cover_url || undefined}
            muted
            loop
            playsInline
            preload="metadata"
            onPlaying={() => setPlaying(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${playing ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {template.preview_video_url && !hovered && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
        {template.is_featured && (
          <div
            className="absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold z-10"
            style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
          >
            精选
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'rgb(238,238,238)' }}>{template.title}</h3>
        {template.description && (
          <p className="text-sm mb-1 line-clamp-2 leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>{template.description}</p>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {template.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] rounded-full font-medium"
                style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c', color: 'rgb(180,180,180)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
