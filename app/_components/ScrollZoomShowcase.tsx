'use client';

import { useEffect, useRef } from 'react';

// ============================================================
// 滚动缩放展示区（占位版，验证交互）
// 5 栗布局：最外侧各1张竖版卡片，内侧各2张堆叠卡片，中间1张16:10大卡片
// 滚动时中间卡片放大铺满视口，两侧4栗卡片被推出屏幕外(非覆盖，是清空让位)
// 纯 transform/opacity，rAF 节流，不触发重排
// ============================================================

export function ScrollZoomShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const sideRefs = useRef<(HTMLDivElement | null)[]>([]);
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

        // 中心卡片：随进度放大铺满视口
        if (centerRef.current) {
          const scale = 1 + progress * 3.6;
          centerRef.current.style.transform = `scale(${scale})`;
          centerRef.current.style.borderRadius = `${24 - progress * 24}px`;
        }

        // 两侧 4 栗卡片：整体推出屏幕外(左侧往左推、右侧往右推)，逐渐清空让中心卡片独占视口
        sideRefs.current.forEach((col, i) => {
          if (!col) return;
          const isLeft = i < 2; // 前两栗在左侧，后两栗在右侧
          const dir = isLeft ? -1 : 1;
          // 内侧栗(i=1,2)推出距离小一点，外侧栗(i=0,3)推出距离大一点，制造层次
          const isOuter = i === 0 || i === 3;
          const distance = (isOuter ? 900 : 600) * progress * dir;
          col.style.transform = `translateX(${distance}px)`;
          col.style.opacity = String(Math.max(0, 1 - progress * 1.6));
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
        {/* 顶部小标签 */}
        <div className="absolute top-16 left-0 w-full text-center px-6 z-0">
          <p className="text-sm tracking-[0.3em] uppercase" style={{ color: 'rgb(96,96,96)' }}>
            Showcase · 生成案例
          </p>
        </div>

        {/* 5 栗卡片布局 */}
        <div className="relative flex items-center justify-center gap-3 md:gap-4 px-4">
          {/* 最外左：1 张竖版卡片 */}
          <div ref={(node) => { sideRefs.current[0] = node; }} style={{ willChange: 'transform, opacity' }}>
            <PlaceholderCard label="案例 01" aspect="3/4" width={150} color="#262626" />
          </div>

          {/* 内左：2 张堆叠卡片 */}
          <div
            ref={(node) => { sideRefs.current[1] = node; }}
            className="flex flex-col gap-3"
            style={{ willChange: 'transform, opacity' }}
          >
            <PlaceholderCard label="案例 02" aspect="4/3" width={190} color="#2a2a2a" />
            <PlaceholderCard label="案例 03" aspect="4/3" width={190} color="#242424" />
          </div>

          {/* 中间：1 张 16:10 大卡片 */}
          <div
            ref={centerRef}
            className="relative rounded-3xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              width: 460,
              aspectRatio: '16/10',
              background: '#1a1a1a',
              border: '1px solid #ffffff1c',
              willChange: 'transform',
              transformOrigin: 'center center',
              zIndex: 10,
            }}
          >
            <div ref={labelRef} className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium" style={{ color: 'rgb(180,180,180)' }}>
                中心视频（占位，后续替换真实素材）
              </span>
            </div>
          </div>

          {/* 内右：2 张堆叠卡片 */}
          <div
            ref={(node) => { sideRefs.current[2] = node; }}
            className="flex flex-col gap-3"
            style={{ willChange: 'transform, opacity' }}
          >
            <PlaceholderCard label="案例 05" aspect="4/3" width={190} color="#2a2a2a" />
            <PlaceholderCard label="案例 06" aspect="4/3" width={190} color="#242424" />
          </div>

          {/* 最外右：1 张竖版卡片 */}
          <div ref={(node) => { sideRefs.current[3] = node; }} style={{ willChange: 'transform, opacity' }}>
            <PlaceholderCard label="案例 07" aspect="3/4" width={150} color="#262626" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({
  label,
  aspect,
  width,
  color,
}: {
  label: string;
  aspect: string;
  width: number;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width, aspectRatio: aspect, background: color, border: '1px solid #ffffff1c' }}
    >
      <span className="text-xs font-medium" style={{ color: 'rgb(96,96,96)' }}>{label}</span>
    </div>
  );
}
