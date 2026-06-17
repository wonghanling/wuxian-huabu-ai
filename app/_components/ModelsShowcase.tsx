'use client';

import { useState } from 'react';

const COLS = [
  [{ src: '/model-nanobanana.webp', name: 'Nano Banana Pro' }],
  [{ src: '/model-gptimage.webp', name: 'ChatGPT Image 2' }, { src: '/model-flux.webp', name: 'FLUX' }, { src: '/model-interior.webp', name: 'FLUX · 室内设计' }],
  [{ src: '/model-midjourney.webp', name: 'Midjourney' }],
];

export function ModelsShowcase() {
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="relative w-full overflow-hidden">
      {/* 背景暗绿光晕 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/3 w-[700px] h-[700px] rounded-full blur-[160px] opacity-15"
          style={{ background: 'radial-gradient(circle,#10805a,transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] opacity-10"
          style={{ background: 'radial-gradient(circle,#34d399,transparent 70%)' }} />
      </div>

      {/* 标题区 */}
      <div className="relative text-center mb-16 px-6">
        <p className="text-sm tracking-[0.4em] uppercase mb-5" style={{ color: '#10b07a' }}>Models · 顶尖模型矩阵</p>
        <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
          一个画布<br />
          <span style={{ background: 'linear-gradient(90deg,#6ee7b7,#10805a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            全球顶尖图像模型
          </span>
        </h2>
        <p className="text-lg md:text-xl text-zinc-400 max-w-3xl mx-auto leading-relaxed">
          FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等业界领先模型即开即用，在同一画布里按需切换、自由组合
        </p>
      </div>

      {/* 三列瀑布流：每列自己高度，图片按原始比例完整显示，不裁切 */}
      <div className="relative flex gap-4 md:gap-5 px-4 md:px-10 items-start">
        {COLS.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-4 md:gap-5 flex-1">
            {col.map((m) => (
              <div
                key={m.src}
                onClick={() => setZoom(m.src)}
                className="group relative rounded-2xl overflow-hidden cursor-zoom-in ring-1 ring-white/10 hover:ring-emerald-500/60 transition-all duration-500"
                style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
              >
                {/* w-full h-auto：完整按原始比例显示，绝不裁切 */}
                <img
                  src={m.src}
                  alt={m.name}
                  className="w-full h-auto block"
                  draggable={false}
                />
                {/* hover 遮罩 + 名字 */}
                <div
                  className="absolute inset-0 flex items-end opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.75),transparent 55%)' }}
                >
                  <div className="p-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
                    <span className="text-white text-sm font-semibold">{m.name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 全屏 lightbox */}
      {zoom && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="" className="max-w-[96vw] max-h-[94vh] object-contain rounded-lg shadow-2xl" draggable={false} />
          <button
            onClick={() => setZoom(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white text-lg hover:bg-white/20 transition-all"
          >✕</button>
        </div>
      )}
    </div>
  );
}
