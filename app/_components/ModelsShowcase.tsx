'use client';

import { useState } from 'react';

// ============================================================
// 顶尖模型展示(主页)· 左文案 + 右侧矩形拼图(图片区域放大)
// 竖图(9:16)占左列满高,横图(16:9)右上跨列,方图+横图右下 → 拼整齐矩形
// 图片区域整体加大;点击全屏看大图
// ============================================================

export function ModelsShowcase() {
  const [zoom, setZoom] = useState<string | null>(null);
  const tile = (img: string, cls: string) => (
    <div
      onClick={() => setZoom(img)}
      className={`group relative rounded-xl overflow-hidden border border-white/10 cursor-zoom-in hover:border-emerald-500/50 transition-colors ${cls}`}
    >
      <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-14 items-center">
      {/* 左:文案 */}
      <div className="reveal">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: '#10805a' }}>Models · 顶尖模型</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
          一个画布<br /><span style={{ color: '#34d399' }}>全球顶尖</span>图像模型
        </h2>
        <p className="text-lg text-zinc-400 leading-relaxed">
          FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等业界领先模型即开即用，
          在同一画布里按需切换、自由组合，每个模型的看家本领都能为你所用。
        </p>
      </div>

      {/* 右:矩形拼图(放大,4:3 高度) */}
      <div className="reveal grid grid-cols-3 grid-rows-2 gap-3" style={{ aspectRatio: '4 / 3', minHeight: 460 }}>
        {tile('/model-nanobanana.webp', 'col-start-1 row-span-2')}
        {tile('/model-gptimage.webp', 'col-start-2 col-span-2 row-start-1')}
        {tile('/model-flux.webp', 'col-start-2 row-start-2')}
        {tile('/model-midjourney.webp', 'col-start-3 row-start-2')}
      </div>

      {/* 全屏 lightbox(看完整不裁) */}
      {zoom && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)' }}
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="" className="max-w-[96vw] max-h-[94vh] object-contain rounded-lg shadow-2xl" draggable={false} />
          <button onClick={() => setZoom(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white text-lg hover:bg-white/20 transition-all">✕</button>
        </div>
      )}
    </div>
  );
}
