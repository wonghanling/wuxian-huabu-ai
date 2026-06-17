'use client';

// ============================================================
// 顶尖模型展示(主页)· 左文案 + 右侧多图拼成矩形
// 竖图(9:16)竖放占整列高,横图(16:9)上下叠放,方图嵌入 → 拼成整齐矩形
// 暗绿色元素,真实示例图
// ============================================================

export function ModelsShowcase() {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
      {/* 左:文案 */}
      <div className="reveal">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: '#10805a' }}>Models · 顶尖模型</p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
          一个画布<br/><span style={{ color: '#34d399' }}>全球顶尖</span>图像模型
        </h2>
        <p className="text-zinc-300 leading-relaxed mb-8 text-[15px]">
          FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等业界领先模型即开即用，
          在同一画布里按需切换、自由组合，每个模型的看家本领都能为你所用。
        </p>

        <div className="space-y-3.5 mb-9">
          {[
            { t: 'FLUX', d: '产品级写实，光影质感细腻' },
            { t: 'Nano Banana Pro', d: '广告大片质感，创意合成' },
            { t: 'ChatGPT Image 2', d: '人像写实，细节与氛围兼顾' },
            { t: 'Midjourney', d: '艺术想象力，风格化表现力强' },
          ].map((s) => (
            <div key={s.t} className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#34d399' }} />
              <div>
                <span className="text-white font-medium text-[15px]">{s.t}</span>
                <span className="text-zinc-500 text-sm ml-2">{s.d}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {['即开即用', '按需切换', '同画布协作', '持续接入新模型'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 text-xs rounded-full border text-zinc-300"
              style={{ background: 'rgba(16,128,90,0.08)', borderColor: 'rgba(16,128,90,0.3)' }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* 右:多图拼成矩形(竖图占左列满高,右侧横图叠放 + 方图) */}
      <div className="reveal grid grid-cols-3 grid-rows-2 gap-3" style={{ aspectRatio: '4 / 3' }}>
        {/* Nano Banana Pro 竖图:左列跨2行 */}
        <Tile img="/model-nanobanana.webp" name="Nano Banana Pro" className="col-start-1 row-span-2" />
        {/* ChatGPT Image 2 横图:右上跨2列 */}
        <Tile img="/model-gptimage.webp" name="ChatGPT Image 2" className="col-start-2 col-span-2 row-start-1" />
        {/* FLUX 方图:右下左格 */}
        <Tile img="/model-flux.webp" name="FLUX" className="col-start-2 row-start-2" />
        {/* Midjourney:右下右格 */}
        <Tile img="/model-midjourney.webp" name="Midjourney" className="col-start-3 row-start-2" />
      </div>
    </div>
  );
}

function Tile({ img, name, className }: { img: string; name: string; className: string }) {
  return (
    <div className={`group relative rounded-xl overflow-hidden border border-white/10 bg-zinc-900/40 hover:border-emerald-500/40 transition-all duration-300 ${className}`}>
      <img src={img} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" draggable={false} />
      <div className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-center gap-1.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#34d399' }} />
        <span className="text-white text-xs font-medium truncate">{name}</span>
      </div>
    </div>
  );
}
