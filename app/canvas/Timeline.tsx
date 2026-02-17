'use client';

import { useState, useRef, useEffect } from 'react';

interface TimelineProps {
  defaultDuration?: number; // 默认时长（秒）
}

export function Timeline({ defaultDuration = 60 }: TimelineProps) {
  const [totalDuration, setTotalDuration] = useState(defaultDuration); // 总时长
  const [zoom, setZoom] = useState(1); // 缩放级别
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true); // 展开/收起状态

  // 每秒的像素宽度（基础值）
  const pixelsPerSecond = 20 * zoom;

  // 计算时间轴总宽度
  const timelineWidth = totalDuration * pixelsPerSecond;

  // 生成锯齿刻度
  const generateTicks = () => {
    const ticks = [];
    for (let i = 0; i <= totalDuration; i++) {
      const position = i * pixelsPerSecond;
      // 每5秒一个大刻度，其他是小刻度
      const isLarge = i % 5 === 0;
      ticks.push({
        position,
        height: isLarge ? 12 : 6,
      });
    }
    return ticks;
  };

  // 增加30秒
  const addThirtySeconds = () => {
    setTotalDuration(totalDuration + 30);
    // 滚动到新增加的部分
    setTimeout(() => {
      if (timelineRef.current) {
        timelineRef.current.scrollLeft = timelineRef.current.scrollWidth;
      }
    }, 100);
  };

  // 缩放控制
  const handleZoomIn = () => {
    setZoom(Math.min(zoom * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom / 1.5, 0.2));
  };

  // 鼠标拖动处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - timelineRef.current.offsetLeft);
    setScrollLeft(timelineRef.current.scrollLeft);
    timelineRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;
    e.preventDefault();
    const x = e.pageX - timelineRef.current.offsetLeft;
    const walk = (x - startX) * 2; // 拖动速度
    timelineRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (timelineRef.current) {
      timelineRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (timelineRef.current) {
        timelineRef.current.style.cursor = 'grab';
      }
    }
  };

  const ticks = generateTicks();

  return (
    <div
      className="fixed left-[200px] bottom-[80px] right-6 flex items-start gap-2"
      style={{ zIndex: 9997 }}
    >
      {/* 抽屉按钮 - 左侧 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-10 h-10 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-zinc-800/90 transition-all shadow-xl flex-shrink-0"
        title={isExpanded ? '收起时间轴' : '展开时间轴'}
        style={{ zIndex: 9999 }}
      >
        <svg
          className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* 时间轴容器 - 可折叠 */}
      <div
        className={`flex-1 transition-all duration-300 origin-left ${
          isExpanded ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0 w-0'
        }`}
      >
        {/* 时间轴容器 */}
        <div className="relative h-8 overflow-hidden">
          {/* 滚动容器 */}
          <div
            ref={timelineRef}
            className="w-full h-full overflow-x-auto overflow-y-hidden"
            style={{ scrollbarWidth: 'thin', cursor: 'grab', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {/* 时间轴内容 */}
            <div className="relative h-full flex items-center" style={{ width: `${timelineWidth + 80}px` }}>
              {/* 时间轴线条和刻度 */}
              <div className="relative" style={{ width: `${timelineWidth}px`, height: '100%' }}>
                {/* 横线 */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-400" />

                {/* 锯齿刻度 */}
                {ticks.map((tick, index) => (
                  <div
                    key={index}
                    className="absolute top-1/2 w-0.5 bg-gray-400"
                    style={{
                      left: `${tick.position}px`,
                      height: `${tick.height}px`,
                      transform: 'translateY(-100%)',
                    }}
                  />
                ))}
              </div>

              {/* +30s 按钮 */}
              <button
                onClick={addThirtySeconds}
                className="ml-4 px-3 py-1 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded-lg text-white text-xs font-semibold transition-all flex-shrink-0"
                title="增加30秒"
              >
                +30s
              </button>
            </div>
          </div>
        </div>

        {/* 缩放控制按钮 - 时间轴下方 */}
        <div className="mt-2 flex items-center gap-2" style={{ zIndex: 9998 }}>
          <button
            onClick={handleZoomOut}
            className="w-6 h-6 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-sm transition-all"
            title="缩小"
          >
            −
          </button>
          <span className="text-xs text-gray-400 font-mono min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-6 h-6 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-sm transition-all"
            title="放大"
          >
            +
          </button>
        </div>
      </div>

      {/* 自定义滚动条样式 */}
      <style jsx>{`
        div::-webkit-scrollbar {
          height: 4px;
        }

        div::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }

        div::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
