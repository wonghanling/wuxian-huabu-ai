'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
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
    <section className="py-20 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block mb-3 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10">
            <span className="text-xs text-purple-300 font-medium">WORKFLOW TEMPLATES</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            创意工作流模板
          </h2>
          <p className="text-zinc-400 text-base">一键复用完整工作流，立即开始创作</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hovered) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [hovered]);

  return (
    <div
      className="glass-card overflow-hidden group hover:border-purple-500/40 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[16/9] bg-zinc-900 overflow-hidden">
        {template.cover_url && (
          <Image
            src={template.cover_url}
            alt={template.title}
            fill
            className={`object-cover transition-opacity duration-300 ${hovered && template.preview_video_url ? 'opacity-0' : 'opacity-100'}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        )}
        {template.preview_video_url && (
          <video
            ref={videoRef}
            src={template.preview_video_url}
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {template.is_featured && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-bold shadow-lg">
            精选
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold mb-2 text-white">{template.title}</h3>
        {template.description && (
          <p className="text-sm text-zinc-400 mb-3 line-clamp-2 leading-relaxed">{template.description}</p>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {template.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-[10px] rounded bg-white/5 text-zinc-300 border border-white/5">
                {tag}
              </span>
            ))}
          </div>
        )}
        <Link
          href={`/canvas?templateId=${template.id}`}
          className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 transition-all text-sm font-medium text-white"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          使用模板
        </Link>
      </div>
    </div>
  );
}
