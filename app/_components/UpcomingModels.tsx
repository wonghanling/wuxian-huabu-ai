'use client';

import { useEffect, useState } from 'react';

// ============================================================
// 首页活动区：新模型上线倒计时
// ============================================================
// 三张卡片统一 16:9，视频用 object-cover 裁切，保证不同源比例视觉一致。
// 倒计时在客户端算（服务端渲染时不算，避免 hydration 不一致）。
//
// 改上线时间/文案：直接改下面的 MODELS 数组。
// releaseAt 为 null = 显示「即将上线」，不跑倒计时。
// ============================================================

interface UpcomingModel {
  id: string;
  name: string;
  tag: string;
  desc: string;
  video: string;
  /** ISO 时间字符串；null = 待定，只显示「即将上线」 */
  releaseAt: string | null;
  accent: string;
}

const MODELS: UpcomingModel[] = [
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    tag: '视频生成',
    desc: '更强的运动连贯性与物理表现，原生音画同步',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/seedance2.5.mp4',
    releaseAt: '2026-08-22T12:00:00+08:00',
    accent: 'rgb(113,208,131)',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    tag: '视频生成',
    desc: '影视级镜头语言，复杂长镜头稳定输出',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/minnmax%20h3.mp4',
    releaseAt: '2026-08-29T12:00:00+08:00',
    accent: 'rgb(120,170,255)',
  },
  {
    id: 'flux-3',
    name: 'FLUX 3',
    tag: '图像生成',
    desc: '更精准的指令理解与文字渲染，细节表现全面提升',
    video: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/flux3.mp4',
    releaseAt: null,
    accent: 'rgb(196,150,255)',
  },
];

type Remain = { d: number; h: number; m: number; s: number } | null;

function diff(target: string): Remain {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
  };
}

function Countdown({ releaseAt, accent }: { releaseAt: string; accent: string }) {
  // 首帧渲染 null，挂载后再算 —— 避免服务端/客户端时间不一致导致 hydration 报错
  const [remain, setRemain] = useState<Remain>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRemain(diff(releaseAt));
    const t = setInterval(() => setRemain(diff(releaseAt)), 1000);
    return () => clearInterval(t);
  }, [releaseAt]);

  if (!mounted) {
    return <div style={{ height: 46 }} />;   // 占位，防止挂载后跳动
  }
  if (!remain) {
    return (
      <div className="text-sm font-semibold" style={{ color: accent }}>
        已上线，前往画布体验
      </div>
    );
  }

  const cells: { v: number; label: string }[] = [
    { v: remain.d, label: '天' },
    { v: remain.h, label: '时' },
    { v: remain.m, label: '分' },
    { v: remain.s, label: '秒' },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {cells.map((c, i) => (
        <div key={c.label} className="flex items-center gap-1.5">
          <div
            className="flex flex-col items-center justify-center rounded-lg"
            style={{
              minWidth: 40, padding: '5px 6px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <span className="text-[15px] font-bold leading-none tabular-nums" style={{ color: 'rgb(245,245,245)' }}>
              {String(c.v).padStart(2, '0')}
            </span>
            <span className="text-[9px] mt-0.5 leading-none" style={{ color: 'rgb(130,130,130)' }}>
              {c.label}
            </span>
          </div>
          {i < cells.length - 1 && (
            <span className="text-[13px] font-bold" style={{ color: 'rgb(80,80,80)' }}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ModelCard({ m }: { m: UpcomingModel }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgb(20,20,20)',
        border: `1px solid ${hover ? 'rgba(255,255,255,0.22)' : '#ffffff1c'}`,
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 24px 50px -30px rgba(0,0,0,0.95)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* 视频预览：统一 16:9 + object-cover，不同源比例也能对齐 */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', background: 'rgb(12,12,12)' }}>
        <video
          src={m.video}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          className="w-full h-full"
          style={{
            objectFit: 'cover',
            display: 'block',
            transform: hover ? 'scale(1.04)' : 'scale(1)',
            transition: 'transform .5s ease',
          }}
        />
        {/* 底部渐变，压住视频保证文字可读 */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{ height: '55%', background: 'linear-gradient(to top, rgba(20,20,20,0.95), transparent)' }}
        />
        {/* 左上角标签 */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.18)', color: 'rgb(225,225,225)' }}
          >
            {m.tag}
          </span>
        </div>
        {/* 右上角状态 */}
        <div className="absolute top-3 right-3">
          <span
            className="text-[10px] font-semibold px-2 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${m.accent}55`, color: m.accent }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 5, height: 5, background: m.accent, boxShadow: `0 0 6px ${m.accent}` }}
            />
            {m.releaseAt ? '即将上线' : '敬请期待'}
          </span>
        </div>
      </div>

      {/* 文字区 */}
      <div className="px-5 pt-4 pb-5">
        <h3 className="text-lg font-bold tracking-tight mb-1.5" style={{ color: 'rgb(240,240,240)' }}>
          {m.name}
        </h3>
        <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'rgb(150,150,150)', minHeight: 38 }}>
          {m.desc}
        </p>
        {m.releaseAt ? (
          <Countdown releaseAt={m.releaseAt} accent={m.accent} />
        ) : (
          <div className="flex items-center" style={{ height: 46 }}>
            <span className="text-sm font-medium" style={{ color: 'rgb(170,170,170)' }}>
              上线时间待公布
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function UpcomingModels() {
  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>
          Coming Soon · 新模型
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
          新模型陆续接入
        </h2>
        <p className="text-base max-w-2xl mx-auto" style={{ color: 'rgb(150,150,150)' }}>
          上线即可在画布中直接调用，无需等待适配
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {MODELS.map((m) => (
          <ModelCard key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
