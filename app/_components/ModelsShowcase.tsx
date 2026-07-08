'use client';

// 13 个模型占位卡，Bento Grid（参照 flora.ai 模型展示区）
// 关键修复：不再用 grid-auto-flow:dense 让浏览器自动摆放（那样同一行的 span 加总凑不齐12列，
// 会留下缺口）。改为手工精确坐标(colStart/colEnd/rowStart/rowEnd)，分成5个矩形区块，
// 每个区块内每一"行带"的列宽加总都严格验算等于12，保证严丝合缝拼成矩形，零缺口零重叠。
//
// 区块A(仿Google结构，4张卡，占4行高): FLUX(宽8)+NanoBananaPro(竖4×4行) 上半8+4=12；
//   ChatGPT(4)+Midjourney(4)+NanoBananaPro续(4) 下半4+4+4=12
// 区块B(2张卡，占2行高): Wan(7)+Jimeng(5) = 12
// 区块C(3张卡，占2行高): Seedance(4)+Pixverse(4)+HappyHorse(4) = 12
// 区块D(2张卡，占2行高): Seedream(7)+marey(5) = 12
// 区块E(2张卡，占2行高): Niji(6)+pika(6) = 12
const MODELS = [
  { key: 'flux', name: 'FLUX', col: [1, 9], row: [1, 3] },
  { key: 'nanobanana', name: 'Nano Banana Pro', col: [9, 13], row: [1, 5] },
  { key: 'gptimage', name: 'ChatGPT Image 2', col: [1, 5], row: [3, 5] },
  { key: 'midjourney', name: 'Midjourney', col: [5, 9], row: [3, 5] },

  { key: 'wan', name: 'Wan 2.7', col: [1, 8], row: [5, 7] },
  { key: 'jimeng', name: 'Jimeng 3.0', col: [8, 13], row: [5, 7] },

  { key: 'seedance', name: 'Seedance 2.0', col: [1, 5], row: [7, 9] },
  { key: 'pixverse', name: 'Pixverse v6', col: [5, 9], row: [7, 9] },
  { key: 'happyhorse', name: 'HappyHorse 1.0', col: [9, 13], row: [7, 9] },

  { key: 'seedream', name: 'Seedream', col: [1, 8], row: [9, 11] },
  { key: 'marey', name: 'marey', col: [8, 13], row: [9, 11] },

  { key: 'niji', name: 'Niji 7 动漫', col: [1, 7], row: [11, 13] },
  { key: 'pika', name: 'pika', col: [7, 13], row: [11, 13] },
] as const;

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

      {/* Bento Grid：13 张占位卡。手机端单列堆叠；md以上用手工精确坐标拼出严丝合缝的矩形区块（不用 dense 自动排列，避免行内 span 加总凑不齐12列留缺口） */}
      <div
        className="relative grid grid-cols-1 md:grid-cols-12 gap-4 px-4 md:px-10 md:auto-rows-[64px]"
        style={{ maxWidth: 1320, margin: '0 auto' }}
      >
        {MODELS.map((m) => (
          <div
            key={m.key}
            className="group relative overflow-hidden ring-1 ring-white/10 hover:ring-emerald-500/60 transition-all duration-500 h-[220px] md:h-auto md:[grid-column:var(--gcs)/var(--gce)] md:[grid-row:var(--grs)/var(--gre)]"
            style={{
              // CSS 自定义属性传入具体坐标数字，class 本身是静态字符串，Tailwind 编译时能正确扫描到
              '--gcs': m.col[0],
              '--gce': m.col[1],
              '--grs': m.row[0],
              '--gre': m.row[1],
              borderRadius: 20,
              background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
            } as React.CSSProperties}
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
