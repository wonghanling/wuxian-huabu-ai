'use client';

// 13 个模型占位卡，Bento Grid（参照 flora.ai 模型展示区规格）
// 12列 grid + dense 排列，6 种卡片尺寸混排：超宽横卡/中等横卡/大横卡/大图横卡/普通小横卡/竖向大卡
// 每张卡先占位，后续替换为真实视频/图片封面，模型名称保留展示
const MODELS = [
  { key: 'flux', name: 'FLUX', size: 'superwide' },       // 超宽横卡 3.4:1，主推位
  { key: 'nanobanana', name: 'Nano Banana Pro', size: 'tall' }, // 竖向大卡 0.63:1
  { key: 'gptimage', name: 'ChatGPT Image 2', size: 'small' },
  { key: 'midjourney', name: 'Midjourney', size: 'medium' },
  { key: 'jimeng', name: 'Jimeng 3.0', size: 'imageLarge' },
  { key: 'wan', name: 'Wan 2.7', size: 'large' },
  { key: 'seedance', name: 'Seedance 2.0', size: 'small' },
  { key: 'pixverse', name: 'Pixverse v6', size: 'medium' },
  { key: 'happyhorse', name: 'HappyHorse 1.0', size: 'small' },
  { key: 'seedream', name: 'Seedream', size: 'large' },
  { key: 'niji', name: 'Niji 7 动漫', size: 'small' },
  { key: 'marey', name: 'marey', size: 'imageLarge' },
  { key: 'pika', name: 'pika', size: 'small' },
] as const;

// size -> grid span 类名映射（12列 grid，行高单位见 auto-rows）
const SIZE_CLASS: Record<string, string> = {
  superwide: 'col-span-12 md:col-span-8 row-span-2',   // 928x272 比例约 3.4:1
  small: 'col-span-6 md:col-span-4 row-span-2',        // 362x276 比例约 1.3:1
  medium: 'col-span-6 md:col-span-5 row-span-2',       // 551x276 比例约 2:1
  tall: 'col-span-6 md:col-span-4 row-span-4',         // 362x572 比例约 0.63:1
  large: 'col-span-12 md:col-span-7 row-span-2',       // 740x277 比例约 2.6:1
  imageLarge: 'col-span-12 md:col-span-5 row-span-3',  // 551x345 比例约 1.6:1
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

      {/* Bento Grid：13 张占位卡，12列 grid + dense 排列，固定 gap/圆角，靠横卡竖卡混排制造专业感 */}
      <div
        className="relative grid grid-cols-12 gap-4 px-4 md:px-10 auto-rows-[64px] md:auto-rows-[64px]"
        style={{ gridAutoFlow: 'dense', maxWidth: 1320, margin: '0 auto' }}
      >
        {MODELS.map((m) => (
          <div
            key={m.key}
            className={`group relative overflow-hidden ring-1 ring-white/10 hover:ring-emerald-500/60 transition-all duration-500 ${SIZE_CLASS[m.size]}`}
            style={{
              borderRadius: 20,
              background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
            }}
          >
            {/* 占位标记（后续替换为背景图/视频） */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs" style={{ color: 'rgb(90,90,90)' }}>占位视频/图片</span>
            </div>

            {/* 黑色渐变遮罩，加深底部保证文字可读 */}
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }}
            />

            {/* 模型名，左下角白字常显 */}
            <div className="absolute bottom-0 left-0 p-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
              <span className="text-white text-sm font-semibold">{m.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
