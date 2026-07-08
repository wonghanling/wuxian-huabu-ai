'use client';

import { useEffect, useRef } from 'react';

// ============================================================
// 滚动缩放展示区（占位版，验证交互）
// 5 栗布局：最外侧各1张竖版卡片，内侧各2张堆叠卡片，中间1张16:10大卡片
// 关键修复：把每一侧的"外侧竖版卡片 + 内侧堆叠卡片"包成一个刚性整体(sideWrapper)，
// 整体只应用一次 transform —— 内部相对间距永远不变，不会互相追上导致重叠，
// 外侧卡片天然跟着内侧一起移动，不再是分开算导致外侧不动
// 推开距离按中心卡片"当前实际膨胀宽度"实时计算，保证不被覆盖
// 纯 transform/opacity，rAF 节流，不触发重排
// ============================================================

const GAP_BUFFER = 24; // 中心卡片边缘与两侧卡片组之间始终保留的最小间隙(px)

export function ScrollZoomShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const leftWrapRef = useRef<HTMLDivElement>(null);
  const rightWrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  // 初始状态测量值（不随 transform 变化，只在 mount / resize 时重新测）
  const baseHalfWidthRef = useRef(0); // 中心卡片初始半宽
  const leftInitialOffsetRef = useRef(0); // 左侧组"近边(右边缘)"到视口中心的初始距离
  const rightInitialOffsetRef = useRef(0); // 右侧组"近边(左边缘)"到视口中心的初始距离
  const maxScaleRef = useRef(4.6);

  useEffect(() => {
    const measure = () => {
      const center = centerRef.current;
      const leftWrap = leftWrapRef.current;
      const rightWrap = rightWrapRef.current;
      if (!center || !leftWrap || !rightWrap) return;

      const viewportCenterX = window.innerWidth / 2;
      const centerRect = center.getBoundingClientRect();
      baseHalfWidthRef.current = centerRect.width / 2;

      // 左侧组的近边 = 组的右边缘（内侧栗紧贴中间，是左侧组最后一个子元素）
      leftInitialOffsetRef.current = Math.abs(leftWrap.getBoundingClientRect().right - viewportCenterX);
      // 右侧组的近边 = 组的左边缘（内侧栗紧贴中间，是右侧组第一个子元素）
      rightInitialOffsetRef.current = Math.abs(rightWrap.getBoundingClientRect().left - viewportCenterX);

      // 目标：中心卡片放大到能同时覆盖视口宽和高(取较大倍数，类似 CSS cover)，避免只按宽度算导致上下留白
      const scaleForWidth = (window.innerWidth * 1.05) / (centerRect.width || 1);
      const scaleForHeight = (window.innerHeight * 1.05) / (centerRect.height || 1);
      maxScaleRef.current = Math.max(scaleForWidth, scaleForHeight);
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
        const opacity = String(Math.max(0, 1 - progress * 1.3));

        // 中心卡片：放大铺满视口
        if (centerRef.current) {
          centerRef.current.style.transform = `scale(${scale})`;
          centerRef.current.style.borderRadius = `${24 - progress * 24}px`;
        }

        // 左侧组（外侧竖版 + 内侧堆叠）整体一起推开，内部间距不变
        if (leftWrapRef.current) {
          const extraPush = Math.max(0, requiredOffset - leftInitialOffsetRef.current);
          leftWrapRef.current.style.transform = `translateX(${-extraPush}px)`;
          leftWrapRef.current.style.opacity = opacity;
        }

        // 右侧组同理
        if (rightWrapRef.current) {
          const extraPush = Math.max(0, requiredOffset - rightInitialOffsetRef.current);
          rightWrapRef.current.style.transform = `translateX(${extraPush}px)`;
          rightWrapRef.current.style.opacity = opacity;
        }

        if (labelRef.current) {
          labelRef.current.style.opacity = String(Math.max(0, 1 - progress * 1.1));
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
    <div ref={containerRef} className="relative" style={{ height: '145vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
        {/* 顶部小标签 */}
        <div className="absolute top-16 left-0 w-full text-center px-6 z-0">
          <p className="text-sm tracking-[0.3em] uppercase" style={{ color: 'rgb(96,96,96)' }}>
            Showcase · 生成案例
          </p>
        </div>

        {/* 5 栗卡片布局（整体放大，推开距离随尺寸自动重新计算，交互逻辑不变） */}
        <div className="relative flex items-center justify-center gap-4 md:gap-6 px-4">
          {/* 左侧组：外侧竖版卡片 + 内侧堆叠卡片，作为一个刚性整体移动 */}
          <div ref={leftWrapRef} className="flex items-center gap-4 md:gap-6" style={{ willChange: 'transform, opacity' }}>
            <PlaceholderCard label="案例 01" aspect="3/4" width={200} color="#262626" />
            <div className="flex flex-col gap-4">
              <PlaceholderCard label="案例 02" aspect="4/3" width={250} color="#2a2a2a" />
              <PlaceholderCard label="案例 03" aspect="4/3" width={250} color="#242424" />
            </div>
          </div>

          {/* 中间：1 张 16:10 大卡片 */}
          <div
            ref={centerRef}
            className="relative rounded-3xl overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{
              width: 620,
              aspectRatio: '16/10',
              background: 'rgb(38,38,38)',
              border: '1px solid #ffffff2e',
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

          {/* 右侧组：内侧堆叠卡片 + 外侧竖版卡片，作为一个刚性整体移动 */}
          <div ref={rightWrapRef} className="flex items-center gap-4 md:gap-6" style={{ willChange: 'transform, opacity' }}>
            <div className="flex flex-col gap-4">
              <PlaceholderCard label="案例 05" aspect="4/3" width={250} color="#2a2a2a" />
              <PlaceholderCard label="案例 06" aspect="4/3" width={250} color="#242424" />
            </div>
            <PlaceholderCard label="案例 07" aspect="3/4" width={200} color="#262626" />
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
