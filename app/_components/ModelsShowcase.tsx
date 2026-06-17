'use client';

// ============================================================
// 顶尖模型展示(主页)· 图卡网格 + 暗绿色元素
// 4 个主力图像模型:FLUX / Nano Banana Pro / ChatGPT Image 2 / Midjourney
// 真实示例图,悬停微放大,纯展示
// ============================================================

const MODELS = [
  { name: 'FLUX', desc: '产品级写实，光影质感细腻', img: '/model-flux.webp' },
  { name: 'Nano Banana Pro', desc: '广告大片质感，创意合成', img: '/model-nanobanana.webp' },
  { name: 'ChatGPT Image 2', desc: '人像写实，细节与氛围兼顾', img: '/model-gptimage.webp' },
  { name: 'Midjourney', desc: '艺术想象力，风格化表现力强', img: '/model-midjourney.webp' },
];

export function ModelsShowcase() {
  return (
    <div>
      {/* 标题 */}
      <div className="text-center mb-14 reveal">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: '#10805a' }}>Models · 顶尖模型</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          一个画布，<span style={{ color: '#34d399' }}>全球顶尖</span>图像模型
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等模型即开即用，按需切换
        </p>
      </div>

      {/* 模型图卡网格 */}
      <div className="reveal grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1500px] mx-auto">
        {MODELS.map((m) => (
          <div
            key={m.name}
            className="group relative rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/40 transition-all duration-300 hover:border-emerald-500/40"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={m.img}
                alt={m.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                draggable={false}
              />
              {/* 底部渐变遮罩 + 文字 */}
              <div className="absolute inset-x-0 bottom-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399' }} />
                  <h3 className="text-white font-semibold text-[15px]">{m.name}</h3>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">{m.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部小标签 */}
      <div className="flex flex-wrap justify-center gap-3 mt-10 reveal">
        {['即开即用', '按需切换', '同画布协作', '持续接入新模型'].map((tag) => (
          <span key={tag} className="px-3 py-1.5 text-xs rounded-full border text-zinc-300"
            style={{ background: 'rgba(16,128,90,0.08)', borderColor: 'rgba(16,128,90,0.3)' }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
