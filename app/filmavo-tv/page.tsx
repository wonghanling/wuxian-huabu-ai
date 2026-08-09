'use client';

import { useEffect, useRef, useState } from 'react';
import { TvNav } from './TvNav';
import { listTvAssets, type TvAsset } from '@/lib/tv-assets';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';

// ============================================================
// Filmavo TV 首页
// ============================================================
// 内容全部手动配置在本文件顶部的常量里，改内容不用动数据库：
//   BANNERS  顶部活动轮播(新模型上线、优惠活动等)
//   SHOWCASE 素材区(视频/图片)，先留空数组 → 页面显示"即将上线"占位
// 后续要改成用户投稿再换成数据库读取。
// ============================================================

interface Banner {
  id: string;
  /** 大字标题 */
  title: string;
  /** 一句话卖点 */
  subtitle: string;
  /** 右上角徽标，如"已上线""限时" */
  badge?: string;
  /** 背景视频(优先)或图片 */
  video?: string;
  image?: string;
  /** 点击跳转，留空则不可点 */
  href?: string;
}

const BANNERS: Banner[] = [
  {
    id: 'seedance-2-5',
    title: 'Seedance 2.5 已上线',
    subtitle: '最长 30 秒 · 50 个参考素材 · 运动连贯性大幅提升',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/seedance2.5.mp4',
    href: '/canvas',
  },
  {
    id: 'minimax-h3',
    title: 'MiniMax H3 已上线',
    subtitle: '影视级镜头语言 · 复杂长镜头稳定输出',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/minnmax%20h3.mp4',
    href: '/canvas',
  },
  {
    id: 'flux-3',
    title: 'FLUX 3 已上线',
    subtitle: '文生 / 首帧 / 首尾帧 / 扩展视频，四种模式全支持',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/flux3.mp4',
    href: '/canvas',
  },
];

const BANNER_INTERVAL = 5000;

function BannerCard({ b, active, onHover }: { b: Banner; active: boolean; onHover: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 只播放当前激活的那张，避免多个视频同时解码
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active]);

  const inner = (
    <>
      {b.video ? (
        <video
          ref={videoRef}
          src={b.video}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', display: 'block' }}
        />
      ) : b.image ? (
        <img src={b.image} alt={b.title} className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
      ) : null}

      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '62%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)' }}
      />

      {b.badge && (
        <div className="absolute top-3 right-3">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(113,208,131,0.45)', color: 'rgb(113,208,131)' }}
          >
            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: 'rgb(113,208,131)', boxShadow: '0 0 6px rgb(113,208,131)' }} />
            {b.badge}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-5 pb-5">
        <div
          className="font-bold tracking-tight"
          style={{ fontSize: 'clamp(18px, 2.1vw, 27px)', lineHeight: 1.15, color: '#fff', textShadow: '0 3px 22px rgba(0,0,0,0.7)' }}
        >
          {b.title}
        </div>
        <div
          className="mt-1.5"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12.5px)', color: 'rgba(255,255,255,0.78)', textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
        >
          {b.subtitle}
        </div>
      </div>
    </>
  );

  const style: React.CSSProperties = {
    aspectRatio: '16/9',
    background: 'rgb(12,12,12)',
    border: `1px solid ${active ? 'rgba(255,255,255,0.2)' : '#ffffff14'}`,
    opacity: active ? 1 : 0.5,
    transform: active ? 'translateY(-2px)' : 'none',
    boxShadow: active ? '0 26px 55px -32px rgba(0,0,0,0.95)' : 'none',
    transition: 'opacity .45s ease, transform .45s ease, border-color .45s ease, box-shadow .45s ease',
  };

  return b.href ? (
    <a href={b.href} onMouseEnter={onHover} className="relative block rounded-2xl overflow-hidden" style={style}>
      {inner}
    </a>
  ) : (
    <div onMouseEnter={onHover} className="relative rounded-2xl overflow-hidden" style={style}>
      {inner}
    </div>
  );
}

export default function FilmavoTvPage() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // 素材从数据库读（后台 /admin/tv-assets 管理），空则显示占位
  const [showcase, setShowcase] = useState<TvAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  // 管理员才显示"管理素材"入口
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    listTvAssets('showcase')
      .then(setShowcase)
      .finally(() => setLoadingAssets(false));

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setCanManage(isAdmin(user?.email));
      } catch {
        setCanManage(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (paused || BANNERS.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % BANNERS.length), BANNER_INTERVAL);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(10,10,10)' }}>
      <TvNav active="tv" />

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(10,10,10,0.82)', borderBottom: '1px solid #ffffff12' }}>
          <div className="px-6 py-4 flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight" style={{ color: 'rgb(240,240,240)' }}>Filmavo TV</h1>
            <span className="text-xs" style={{ color: 'rgb(110,110,110)' }}>活动与素材</span>
            <div className="flex-1" />
            <a
              href="/filmavo-tv/projects"
              className="px-4 py-2 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid #ffffff1c', color: 'rgb(230,230,230)' }}
            >
              我的项目
            </a>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* 活动轮播 */}
          <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BANNERS.map((b, i) => (
                <BannerCard key={b.id} b={b} active={i === idx} onHover={() => setIdx(i)} />
              ))}
            </div>
            {BANNERS.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                {BANNERS.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setIdx(i)}
                    aria-label={`切换到 ${b.title}`}
                    style={{
                      width: i === idx ? 22 : 8,
                      height: 5,
                      borderRadius: 99,
                      background: i === idx ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)',
                      transition: 'width .35s ease, background .35s ease',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 素材区 */}
          <div className="mt-14">
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-base font-bold tracking-tight" style={{ color: 'rgb(232,232,232)' }}>精选素材</h2>
              <span className="text-[11px]" style={{ color: 'rgb(110,110,110)' }}>可直接参考的视频与图片</span>
              <div className="flex-1" />
              {canManage && (
                <a href="/admin/tv-assets" className="text-[11px] hover:opacity-70" style={{ color: 'rgb(113,208,131)' }}>
                  管理素材 ↗
                </a>
              )}
            </div>

            {loadingAssets ? (
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{ minHeight: 220, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}
              >
                <span className="text-sm" style={{ color: 'rgb(120,120,120)' }}>加载中…</span>
              </div>
            ) : showcase.length === 0 ? (
              <div
                className="rounded-2xl flex flex-col items-center justify-center gap-2"
                style={{ minHeight: 220, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.14)' }}
              >
                <span className="text-sm" style={{ color: 'rgb(140,140,140)' }}>素材整理中</span>
                <span className="text-[11px]" style={{ color: 'rgb(95,95,95)' }}>陆续上线，敬请期待</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {showcase.map((s) => (
                  <div
                    key={s.id}
                    className="group rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
                    style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff14' }}
                  >
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
                    <div className="px-3.5 py-3">
                      <div className="text-[12.5px] font-semibold truncate" style={{ color: 'rgb(228,228,228)' }}>{s.title}</div>
                      {s.model && (
                        <div className="text-[10.5px] mt-1" style={{ color: 'rgb(105,105,105)' }}>{s.model}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
