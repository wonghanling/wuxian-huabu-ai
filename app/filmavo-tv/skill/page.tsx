'use client';

import { TvNav } from '../TvNav';

// ============================================================
// Filmavo TV · Skill
// ============================================================
// 视频 Skill 库。内容手动配置在 SKILLS 数组里，
// 空数组时显示占位（等素材/教程视频到位后往这里加条目）。
// ============================================================

interface SkillItem {
  id: string;
  title: string;
  desc: string;
  /** 演示视频 */
  video?: string;
  /** 封面图（无视频时用） */
  image?: string;
  /** 点击去哪，通常是带模板参数的画布链接 */
  href?: string;
}

const SKILLS: SkillItem[] = [];

export default function TvSkillPage() {
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
          {SKILLS.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center gap-2"
              style={{ minHeight: 300, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.14)' }}
            >
              <span className="text-sm" style={{ color: 'rgb(140,140,140)' }}>Skill 整理中</span>
              <span className="text-[11px]" style={{ color: 'rgb(95,95,95)' }}>视频创作技巧与工作流即将上线</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SKILLS.map((s) => {
                const inner = (
                  <>
                    <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'rgb(12,12,12)' }}>
                      {s.video ? (
                        <video
                          src={s.video}
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
                      ) : s.image ? (
                        <img src={s.image} alt={s.title} className="w-full h-full" style={{ objectFit: 'cover' }} draggable={false} />
                      ) : null}
                    </div>
                    <div className="px-4 py-3.5">
                      <div className="text-[13.5px] font-semibold" style={{ color: 'rgb(232,232,232)' }}>{s.title}</div>
                      <div className="text-[11.5px] leading-relaxed mt-1" style={{ color: 'rgb(140,140,140)' }}>{s.desc}</div>
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
