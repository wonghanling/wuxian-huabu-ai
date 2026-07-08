'use client';

import { useEffect, useRef } from 'react';

// ============================================================
// 滚动缩放展示区（占位版，先验证交互）
// 7 张卡片横排(16:9)，滚动时中间卡片放大铺满视口，两侧卡片推向外侧+淡出
// 纯 transform/opacity，rAF 节流，不触发重排
// ============================================================

const PLACEHOLDER_CARDS = [
  { label: '案例 01', color: '#2a2a2a' },
  { label: '案例 02', color: '#262626' },
  { label: '案例 03', color: '#2a2a2a' },
  { label: '中心视频', color: '#1a1a1a' },
  { label: '案例 05', color: '#2a2a2a' },
  { label: '案例 06', color: '#262626' },
  { label: '案例 07', color: '#2a2a2a' },
];

const CENTER_INDEX = 3;

export function ScrollZoomShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

        cardRefs.current.forEach((card, i) => {
          if (!card) return;
          const offset = i - CENTER_INDEX;

          if (offset === 0) {
            // 中心卡片：随进度放大铺满视口(16:9 保持比例放大)
            const scale = 1 + progress * 5.2;
            card.style.transform = `scale(${scale})`;
            card.style.zIndex = '10';
            card.style.borderRadius = `${24 - progress * 24}px`;
          } else {
            // 两侧卡片：推向外侧 + 淡出
            const dir = offset > 0 ? 1 : -1;
            const dist = Math.abs(offset);
            const translate = progress * dist * 260 * dir;
            card.style.transform = `translateX(${translate}px)`;
            card.style.opacity = String(Math.max(0, 1 - progress * 1.4));
          }
        });

        // 中心标签随进度淡出（放大后不需要标签遮挡视频）
        if (labelRef.current) {
          labelRef.current.style.opacity = String(Math.max(0, 1 - progress * 3));
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative" style={{ height: '260vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        {/* 标题（缩放开始前可见） */}
        <div className="absolute top-20 left-0 w-full text-center px-6 z-0">
          <p className="text-sm tracking-[0.3em] uppercase mb-3" style={{ color: 'rgb(96,96,96)' }}>
            Showcase · 生成案例
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: 'rgb(238,238,238)' }}>
            向下滚动，放大看细节
          </h2>
        </div>

        {/* 卡片行：统一 16:9，中心卡片更宽 */}
        <div className="relative flex items-center justify-center gap-3 md:gap-4">
          {PLACEHOLDER_CARDS.map((c, i) => {
            const isCenter = i === CENTER_INDEX;
            const width = isCenter ? 480 : 200;
            return (
              <div
                key={i}
                ref={(node) => { cardRefs.current[i] = node; }}
                className="relative rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{
                  width,
                  aspectRatio: '16/9',
                  background: c.color,
                  border: '1px solid #ffffff1c',
                  willChange: 'transform, opacity',
                  transformOrigin: 'center center',
                }}
              >
                {isCenter ? (
                  <div ref={labelRef} className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-medium" style={{ color: 'rgb(180,180,180)' }}>
                      {c.label}（占位，后续替换真实视频）
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium" style={{ color: 'rgb(96,96,96)' }}>{c.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
