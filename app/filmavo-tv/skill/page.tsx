'use client';

import { useEffect, useState } from 'react';
import { TvNav } from '../TvNav';
import { listTvAssets, type TvAsset } from '@/lib/tv-assets';

// ============================================================
// Filmavo TV · Skill
// ============================================================
// 内容从数据库读，在 /admin/tv-assets 后台（Skill 分区）上传管理，
// 不用改代码发版。空时显示占位。
// ============================================================

export default function TvSkillPage() {
  const [skills, setSkills] = useState<TvAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTvAssets('skill')
      .then(setSkills)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(10,10,10)' }}>
      <TvNav active="skill" />

      <main className="flex-1 min-w-0">
        <div
          className="sticky top-0 z-20 backdrop-blur-xl"
          style={{ background: 'rgba(10,10,10,0.82)', borderBottom: '1px solid #ffffff12' }}
        >
          <div className="px-6 py-4 flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight" style={{ color: 'rgb(240,240,240)' }}>Skill</h1>
            <span className="text-xs" style={{ color: 'rgb(110,110,110)' }}>视频创作技巧与工作流</span>
            <div className="flex-1" />
            <a
              href="/canvas"
              className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid #ffffff1c', color: 'rgb(230,230,230)' }}
            >
              进入画布
            </a>
          </div>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div
              className="rounded-2xl flex items-center justify-center"
              style={{ minHeight: 300, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}
            >
              <span className="text-sm" style={{ color: 'rgb(120,120,120)' }}>加载中…</span>
            </div>
          ) : skills.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center gap-2"
              style={{ minHeight: 300, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.14)' }}
            >
              <span className="text-sm" style={{ color: 'rgb(140,140,140)' }}>Skill 整理中</span>
              <span className="text-[11px]" style={{ color: 'rgb(95,95,95)' }}>视频创作技巧与工作流即将上线</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {skills.map((s) => {
                const inner = (
                  <>
                    <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'rgb(12,12,12)' }}>
                      {s.kind === 'video' ? (
                        <video
                          src={s.src}
                          poster={s.poster || undefined}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          className="w-full h-full"
                          style={{ objectFit: 'cover' }}
                          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                          onMouseLeave={(e) => {
                            const v = e.currentTarget as HTMLVideoElement;
                            v.pause();
                            v.currentTime = 0;
                          }}
                        />
                      ) : (
                        <img src={s.src} alt={s.title} className="w-full h-full" style={{ objectFit: 'cover' }} draggable={false} />
                      )}
                    </div>
                    <div className="px-4 py-3.5">
                      <div className="text-[13.5px] font-semibold" style={{ color: 'rgb(232,232,232)' }}>{s.title}</div>
                      {s.description && (
                        <div className="text-[11.5px] leading-relaxed mt-1" style={{ color: 'rgb(140,140,140)' }}>{s.description}</div>
                      )}
                    </div>
                  </>
                );
                const style: React.CSSProperties = {
                  background: 'rgb(20,20,20)',
                  border: '1px solid #ffffff14',
                };
                return s.href ? (
                  <a
                    key={s.id}
                    href={s.href}
                    className="block rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
                    style={style}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={s.id} className="rounded-2xl overflow-hidden" style={style}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
