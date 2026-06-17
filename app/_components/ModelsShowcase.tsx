'use client';

import { useState } from 'react';

// ============================================================
// 顶尖模型展示(主页)· 大图完整展示,点击看全屏大图(图内自带文案)
// 去掉无效的悬停放大,改点击 lightbox 全屏看清
// 暗绿色元素,真实示例图
// ============================================================

const IMAGES = ['/model-flux.webp', '/model-nanobanana.webp', '/model-gptimage.webp', '/model-midjourney.webp'];

export function ModelsShowcase() {
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div>
      {/* 标题 */}
      <div className="text-center mb-14 reveal max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">
          一个画布，<span style={{ color: '#34d399' }}>全球顶尖</span>图像模型
        </h2>
        <p className="text-lg text-zinc-400 leading-relaxed">
          FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等业界领先模型即开即用，
          在同一画布里按需切换、自由组合，每个模型的看家本领都能为你所用。
        </p>
      </div>

      {/* 大图完整展示:object-contain 不裁;点击看全屏大图 */}
      <div className="reveal grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {IMAGES.map((src) => (
          <div key={src}
            onClick={() => setZoom(src)}
            className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/40 flex items-center justify-center cursor-zoom-in transition-all duration-300 hover:border-emerald-500/50"
            style={{ minHeight: 320 }}>
            <img src={src} alt="" className="w-full h-auto max-h-[600px] object-contain" draggable={false} />
            <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(16,128,90,0.85)' }}>点击看大图</span>
          </div>
        ))}
      </div>

      {/* 全屏 lightbox */}
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
