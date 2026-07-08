'use client';

import { useEffect, useRef } from 'react';

// ============================================================
// 滚动缩放展示区（占位版，验证交互）
// 5 栗布局：最外侧各1张竖版卡片，内侧各2张堆叠卡片，中间1张16:10大卡片
// 核心逻辑：按中心卡片"当前实际膨胀宽度"实时计算两侧应让开的距离，
// 保证任意一帧中心卡片边缘都不会超出两侧卡片已让开的位置 —— 是"推开"不是"覆盖"
// 纯 transform/opacity，rAF 节流，不触发重排
// ============================================================

const GAP_BUFFER = 24; // 中心卡片边缘与两侧卡片之间始终保留的最小间隙(px)

export function ScrollZoomShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const sideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);

  // 初始状态测量值（不随 transform 变化，只在 mount / resize 时重新测）
  const baseHalfWidthRef = useRef(0); // 中心卡片初始半宽
  const initialOffsetsRef = useRef<number[]>([0, 0, 0, 0]); // 每栗侧卡片初始"近边到视口中心"的距离
  const maxScaleRef = useRef(4.6);

  useEffect(() => {
    const measure = () => {
      const center = centerRef.current;
      if (!center) return;
      const viewportCenterX = window.innerWidth / 2;
      const centerRect = center.getBoundingClientRect();
      baseHalfWidthRef.current = centerRect.width / 2;

      sideRefs.current.forEach((col, i) => {
        if (!col) return;
        const rect = col.getBoundingClientRect();
        const isLeft = i < 2;
        // 近边：左侧栗取右边缘，右侧栗取左边缘
        const nearEdge = isLeft ? rect.right : rect.left;
        initialOffsetsRef.current[i] = Math.abs(nearEdge - viewportCenterX);
      });

      // 目标：中心卡片放大到能覆盖整个视口宽度(略超出防止露边)
      maxScaleRef.current = (window.innerWidth * 1.05) / (centerRect.width || 1);
    };

    measure();
    window.addEventListener('resize', measure);

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = el.offsetHeight - window.innerHeight;
        const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;

        const scale = 1 + (maxScaleRef.current - 1) * progress;
        const centerHalfWidthNow = baseHalfWidthRef.current * scale;
        const requiredOffset = centerHalfWidthNow + GAP_BUFFER;

        // 中心卡片：放大铺满视口
        if (centerRef.current) {
          centerRef.current.style.transform = `scale(${scale})`;
          centerRef.current.style.borderRadius = `${24 - progress * 24}px`;
        }

        // 两侧卡片：按中心卡片实际膨胀宽度，实时计算需要让开的距离，确保不被覆盖
        sideRefs.current.forEach((col, i) => {
          if (!col) return;
          const isLeft = i < 2;
          const dir = isLeft ? -1 : 1;
          const extraPush = Math.max(0, requiredOffset - initialOffsetsRef.current[i]);
          col.style.transform = `translateX(${extraPush * dir}px)`;
          col.style.opacity = String(Math.max(0, 1 - progress * 1.3));
        });

        if (labelRef.current) {
          labelRef.current.style.opacity = String(Math.max(0, 1 - progress * 3));
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('resize', measure);
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
