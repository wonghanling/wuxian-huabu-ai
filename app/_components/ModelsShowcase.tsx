'use client';

// 13 个模型占位卡，bento 拼贴网格
// 大小节奏参照截图："宽卡+竖长卡" 起头，穿插小卡填缝，再接宽卡收尾，制造不规则韵律
// 每张卡先占位，后续替换为真实视频/图片封面，模型名称保留展示
const MODELS = [
  { key: 'flux', name: 'FLUX', size: 'wide' },
  { key: 'nanobanana', name: 'Nano Banana Pro', size: 'tall' },
  { key: 'gptimage', name: 'ChatGPT Image 2', size: 'sm' },
  { key: 'midjourney', name: 'Midjourney', size: 'wide' },
  { key: 'jimeng', name: 'Jimeng 3.0', size: 'sm' },
  { key: 'wan', name: 'Wan 2.7', size: 'wide' },
  { key: 'seedance', name: 'Seedance 2.0', size: 'wide' },
  { key: 'pixverse', name: 'Pixverse v6', size: 'tall' },
  { key: 'happyhorse', name: 'HappyHorse 1.0', size: 'sm' },
  { key: 'seedream', name: 'Seedream', size: 'sm' },
  { key: 'niji', name: 'Niji 7 动漫', size: 'wide' },
  { key: 'marey', name: 'marey', size: 'sm' },
  { key: 'pika', name: 'pika', size: 'sm' },
] as const;

// size -> grid span 类名映射
const SIZE_CLASS: Record<string, string> = {
  wide: 'col-span-2 row-span-1',
  tall: 'col-span-1 row-span-2',
  sm: 'col-span-1 row-span-1',
};

export function ModelsShowcase() {
  return (
    <div className="relative w-full overflow-hidden">
      {/* 背景光晕：低饱和度，贴近极简风 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/3 w-[700px] h-[700px] rounded-full blur-[160px] opacity-[0.06]"
          style={{ background: 'radial-gradient(circle,#10805a,transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.05]"
          style={{ background: 'radial-gradient(circle,#34d399,transparent 70%)' }} />
      </div>

      {/* 标题区：左侧大标题+副标题，右侧链接（参照截图左右布局） */}
      <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16 px-6 md:px-10">
        <div>
          <p className="text-sm tracking-[0.4em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Models · 顶尖模型矩阵</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.1]" style={{ color: 'rgb(238,238,238)' }}>
            一个画布，<span style={{ color: 'rgb(113,208,131)' }}>全球顶尖图像模型</span>
          </h2>
          <p className="text-base md:text-lg max-w-xl leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
            FLUX、Nano Banana Pro、ChatGPT Image 2、Midjourney 等业界领先模型即开即用，在同一画布里按需切换、自由组合
          </p>
        </div>
        <a
          href="/canvas"
          className="flex items-center gap-1 text-sm font-medium whitespace-nowrap hover:opacity-70 transition-opacity"
          style={{ color: 'rgb(238,238,238)' }}
        >
          进入画布 <span style={{ fontSize: 16 }}>↗</span>
        </a>
      </div>

      {/* bento 拼贴网格：13 张占位卡，大小不一，参照截图风格 */}
      <div
        className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 px-4 md:px-10 auto-rows-[160px] md:auto-rows-[200px]"
      >
        {MODELS.map((m) => (
          <div
            key={m.key}
            className={`group relative rounded-2xl overflow-hidden ring-1 ring-white/10 hover:ring-emerald-500/60 transition-all duration-500 ${SIZE_CLASS[m.size]}`}
            style={{
              background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            {/* 占位标记 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs" style={{ color: 'rgb(90,90,90)' }}>占位视频/图片</span>
            </div>

            {/* 底部遮罩 + 模型名（常显，占位阶段不用 hover 才显示） */}
            <div
              className="absolute inset-0 flex items-end"
              style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.7),transparent 55%)' }}
            >
              <div className="p-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
                <span className="text-white text-sm font-semibold">{m.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
