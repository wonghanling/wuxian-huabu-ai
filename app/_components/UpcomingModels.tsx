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
  /** 模型名（大字，居中显示） */
  name: string;
  /** 广告词 */
  title: string;
  /** 卖点 */
  subtitle: string;
  /** 右上角徽标文案 */
  badge: string;
  /** 封面图(优先);留空则用 video */
  image?: string;
  /** 背景视频,image 为空时才用 */
  video?: string;
}

const SLIDES: Slide[] = [
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    title: '时长更长，运动更稳',
    subtitle: '多模态参考 + 原生音画同步，最高 4K',
    badge: '已上线',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/huodongchuangkouxuanchaun/seedance2.5.jpg',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    title: '影视级镜头语言',
    subtitle: '复杂长镜头稳定输出，一次成片',
    badge: '已上线',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/huodongchuangkouxuanchaun/minimaxh3.jpg',
  },
  {
    id: 'flux-3',
    name: 'FLUX 3',
    title: '指令即所得',
    subtitle: '文字渲染与细节控制全面升级',
    badge: '已上线',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/huodongchuangkouxuanchaun/flux3.jpg',
  },
  {
    id: 'wan-3-0',
    name: 'Wan 3.0',
    title: '标准与高速双版本',
    subtitle: '最长 30 秒，多素材参考，音画一次成片',
    badge: '已上线',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/wan3.00jpeg.jpeg',
  },
];

/** 一屏显示的卡槽数 —— 卡片多于此数时轮播滑动，而不是挤成更多列 */
const VISIBLE = 3;

const INTERVAL_MS = 5000;

function Card({ s, active, onActivate }: { s: Slide; active: boolean; onActivate: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 只让激活的那张播放 —— 三个视频同时播会明显吃性能
  // (用图片时 videoRef 为空,这段自动跳过)
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
      {/* 有 image 用图片,否则回退到 video —— 卡槽比例(16:9)与裁切方式不变 */}
      {s.image ? (
        <img
          src={s.image}
          alt={s.name}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', display: 'block' }}
          draggable={false}
        />
      ) : s.video ? (
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
      ) : null}

      {/* 底部渐变遮罩：文案在下方，只压底部即可，上方留出画面 */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{ height: '58%', background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 40%, transparent 100%)' }}
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

      {/* 文案：水平居中、垂直靠下(不占正中,给画面留出主体空间) */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-5 pb-5">
        <div
          className="font-bold tracking-tight"
          style={{
            fontSize: 'clamp(18px, 2.1vw, 27px)',
            lineHeight: 1.15,
            color: '#fff',
            textShadow: '0 3px 22px rgba(0,0,0,0.7)',
            letterSpacing: '-0.02em',
          }}
        >
          {s.name}
        </div>
        <div
          className="font-semibold mt-2"
          style={{ fontSize: 'clamp(12px, 1.15vw, 15px)', color: 'rgba(255,255,255,0.95)', textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}
        >
          {s.title}
        </div>
        <div
          className="mt-1"
          style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', color: 'rgba(255,255,255,0.72)', textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}
        >
          {s.subtitle}
        </div>
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
    /* 不用 max-w-7xl(1280):那样在宽屏上会比 /filmavo-tv 的卡槽小一圈。
       放宽到 1600px 让卡片等比放大,视觉尺寸与 TV 页对齐。 */
    <div
      className="mx-auto px-6"
      style={{ maxWidth: 1600 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* 卡片多于卡槽数时滑动，而不是挤成更多列 ——
          仍是 3 个卡槽，靠整条轨道左移把后面的卡片滑进来。
          轨道宽度 = 卡片数 / 卡槽数，每张卡各占 1/卡片数，于是一张卡
          正好等于一个卡槽宽;加第 5、6 张也不用再改这里。 */}
      {/* --visible 由媒体查询决定:窄屏 1 个卡槽、中屏 2 个、宽屏 3 个。
          原本是 grid md:grid-cols-3(窄屏单列堆叠)，改成滑动后用它还原同样的响应式。 */}
      <style>{`
        .um-track { --gap: 16px; --visible: 1; }
        @media (min-width: 640px) { .um-track { --visible: 2; } }
        @media (min-width: 768px) { .um-track { --visible: ${VISIBLE}; } }
      `}</style>
      <div style={{ overflow: 'hidden' }}>
        <div
          className="um-track flex"
          style={{
            // 一张卡 = 一个卡槽:容器宽扣掉间距后按卡槽数均分
            ['--slot' as string]: 'calc((100% - (var(--visible) - 1) * var(--gap)) / var(--visible))',
            // 滑到第 n 张:左移 n 个"卡槽 + 间距"。
            // clamp 到最后一屏，右侧不露空(窄屏 visible=1 时能一直滑到最后一张)。
            ['--shift' as string]: `min(${idx}, calc(${SLIDES.length} - var(--visible)))`,
            gap: 'var(--gap)',
            transform: 'translateX(calc(-1 * var(--shift) * (var(--slot) + var(--gap))))',
            transition: 'transform .55s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          {SLIDES.map((s, i) => (
            <div key={s.id} style={{ width: 'var(--slot)', flexShrink: 0 }}>
              <Card s={s} active={i === idx} onActivate={() => setIdx(i)} />
            </div>
          ))}
        </div>
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
