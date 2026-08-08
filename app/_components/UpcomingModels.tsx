'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// 首页活动区：新模型上线（自动轮播）
// ============================================================
// 卡片整体就是 16:9，文案直接压在画面上，不额外占高度、不留空白。
// 三张卡横排常驻：激活的那张更亮并播放视频，其余压暗并暂停。
// 每 5 秒自动切换，移入暂停，底部小圆点可点击跳转。
// 点击卡片直接进画布。
//
// 改文案只需改下面的 SLIDES 数组。
// ============================================================

interface Slide {
  id: string;
  /** 主标题（广告词） */
  title: string;
  /** 副标题（卖点） */
  subtitle: string;
  /** 右上角徽标文案 */
  badge: string;
  video: string;
}

const SLIDES: Slide[] = [
  {
    id: 'seedance-2-5',
    title: '时长更长，运动更稳',
    subtitle: 'Seedance 2.5 · 多模态参考 + 原生音画同步，最高 4K',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/seedance2.5.mp4',
  },
  {
    id: 'minimax-h3',
    title: '影视级镜头语言',
    subtitle: 'MiniMax H3 · 复杂长镜头稳定输出，一次成片',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/minnmax%20h3.mp4',
  },
  {
    id: 'flux-3',
    title: '指令即所得',
    subtitle: 'FLUX 3 · 文字渲染与细节控制全面升级',
    badge: '已上线',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/flux3.mp4',
  },
];

const INTERVAL_MS = 5000;

function Card({ s, active, onActivate }: { s: Slide; active: boolean; onActivate: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 只让激活的那张播放 —— 三个视频同时播会明显吃性能
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active]);

  return (
    <a
      href="/canvas"
      onMouseEnter={onActivate}
      className="group relative block w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: '16/9',
        background: 'rgb(12,12,12)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.2)' : '#ffffff14'}`,
        opacity: active ? 1 : 0.5,
        transform: active ? 'translateY(-2px)' : 'none',
        boxShadow: active ? '0 26px 55px -32px rgba(0,0,0,0.95)' : 'none',
        transition: 'opacity .45s ease, transform .45s ease, border-color .45s ease, box-shadow .45s ease',
      }}
    >
      <video
        ref={videoRef}
        src={s.video}
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover', display: 'block' }}
      />

      {/* 底部渐变遮罩：保证压在画面上的文字可读 */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '62%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)' }}
      />

      {/* 右上角徽标 */}
      <div className="absolute top-3 right-3">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-md"
          style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(113,208,131,0.45)', color: 'rgb(113,208,131)' }}
        >
          <span
            className="inline-block rounded-full"
            style={{ width: 5, height: 5, background: 'rgb(113,208,131)', boxShadow: '0 0 6px rgb(113,208,131)' }}
          />
          {s.badge}
        </span>
      </div>

      {/* 文案：直接压在画面上 */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
        <h3
          className="font-bold tracking-tight mb-1"
          style={{ fontSize: 19, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.65)' }}
        >
          {s.title}
        </h3>
        <p
          style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 8px rgba(0,0,0,0.65)' }}
        >
          {s.subtitle}
        </p>
      </div>
    </a>
  );
}

export function UpcomingModels() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div
      className="max-w-7xl mx-auto px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid md:grid-cols-3 gap-4">
        {SLIDES.map((s, i) => (
          <Card key={s.id} s={s} active={i === idx} onActivate={() => setIdx(i)} />
        ))}
      </div>

      {/* 底部指示器 */}
      <div className="flex items-center justify-center gap-2 mt-5">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIdx(i)}
            aria-label={`切换到 ${s.title}`}
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
    </div>
  );
}
