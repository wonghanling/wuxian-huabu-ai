'use client';

// 首页模型矩阵区：Bento Grid，几何结构完全对齐 /bento-draft 验证过的三组布局
// 三组按验证过的精确比例(基准1600x696)用 fr 单位响应式还原，任意视口宽度下比例不变
// 13个模型分配到三组的13个卡位(4+4+5=13)，标题区与网格容器统一 max-width，
// 保证"一个画布，全球顶尖图像模型"等文案区宽度不超出三组矩形

const GROUP_1 = [
  { key: 'flux', name: 'FLUX', col: '1 / 3', row: '1 / 2', img: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783689094758.jpg' },                  // 1137x338，约3.36:1，主推位
  { key: 'gptimage', name: 'ChatGPT Image 2', col: '1 / 2', row: '2 / 3', img: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783691611247.jpg' },   // 443x338，约1.31:1
  { key: 'midjourney', name: 'Midjourney', col: '2 / 3', row: '2 / 3', img: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783692353492.jpg' },      // 674x338，约2:1
  { key: 'nanobanana', name: 'Nano Banana Pro', col: '3 / 4', row: '1 / 3', img: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783690729986.jpg' }, // 443x695，约1:1.57
];

const GROUP_2 = [
  { key: 'wan', name: 'Wan 2.7', col: '1 / 2', row: '1 / 3' },           // 674x696，约0.97:1
  { key: 'jimeng', name: 'Jimeng 3.0', col: '2 / 4', row: '1 / 2' },     // 906x338，约2.68:1
  { key: 'seedance', name: 'Seedance 2.0', col: '2 / 3', row: '2 / 3' }, // 443x338，约1.31:1
  { key: 'pixverse', name: 'Pixverse v6', col: '3 / 4', row: '2 / 3' },  // 443x338，约1.31:1
];

// 第三组无跨行卡片，两行各自独立列宽比例，用 flex + flexGrow 还原
const GROUP_3_ROW1 = [
  { key: 'happyhorse', name: 'HappyHorse 1.0', w: 443 }, // 约1.31:1
  { key: 'seedream', name: 'Seedream', w: 674 },         // 约1.99:1
  { key: 'niji', name: 'stable-diffusion', w: 443 },      // 约1.31:1
];
const GROUP_3_ROW2 = [
  { key: 'marey', name: 'marey', w: 674 }, // 约1.99:1
  { key: 'pika', name: 'pika', w: 906 },   // 约2.68:1
];

// 小屏兜底：单列堆叠展示全部13个模型（携带 img，有图则显示）
const ALL_MODELS_MOBILE: { key: string; name: string; img?: string }[] = [
  ...GROUP_1.map((m) => ({ key: m.key, name: m.name, img: (m as { img?: string }).img })),
  ...GROUP_2.map((m) => ({ key: m.key, name: m.name, img: (m as { img?: string }).img })),
  ...GROUP_3_ROW1.map((m) => ({ key: m.key, name: m.name, img: (m as { img?: string }).img })),
  ...GROUP_3_ROW2.map((m) => ({ key: m.key, name: m.name, img: (m as { img?: string }).img })),
];

function CardInner({ name, img }: { name: string; img?: string }) {
  return (
    <>
      {img ? (
        <img src={img} alt={name} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs" style={{ color: 'rgb(90,90,90)' }}>占位视频/图片</span>
        </div>
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }}
      />
      <div className="relative p-4 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
        <span className="text-white text-sm font-semibold">{name}</span>
      </div>
    </>
  );
}

const CARD_CLASS =
  'group relative overflow-hidden ring-1 ring-white/10 hover:ring-emerald-500/60 transition-all duration-500 flex items-end';
const CARD_STYLE = {
  borderRadius: 24,
  background: 'linear-gradient(160deg, rgb(40,40,40), rgb(16,16,16))',
} as const;

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

      {/* 统一容器：标题区与下方网格共用同一 max-width，文案不会超出三组矩形的宽度 */}
      <div className="relative mx-auto px-6 md:px-10" style={{ maxWidth: 1600 }}>
        {/* 标题区：左侧大标题+副标题，右侧链接 */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
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

        {/* md以上：三组 Bento Grid，几何比例对齐 /bento-draft 验证结果 */}
        <div className="hidden md:flex md:flex-col gap-5">
          {/* 第一组：FLUX主推宽卡 + ChatGPT/Midjourney两小卡 + Nano Banana Pro竖卡 */}
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: '443fr 674fr 443fr', gridTemplateRows: '1fr 1fr', aspectRatio: '1600 / 696' }}
          >
            {GROUP_1.map((c) => (
              <div key={c.key} className={CARD_CLASS} style={{ gridColumn: c.col, gridRow: c.row, ...CARD_STYLE }}>
                <CardInner name={c.name} img={c.img} />
              </div>
            ))}
          </div>

          {/* 第二组：Wan竖向大卡 + Jimeng大横卡 + Seedance/Pixverse两小卡 */}
          <div
            className="grid gap-5"
            style={{ gridTemplateColumns: '674fr 443fr 443fr', gridTemplateRows: '1fr 1fr', aspectRatio: '1600 / 696' }}
          >
            {GROUP_2.map((c) => (
              <div key={c.key} className={CARD_CLASS} style={{ gridColumn: c.col, gridRow: c.row, ...CARD_STYLE }}>
                <CardInner name={c.name} />
              </div>
            ))}
          </div>

          {/* 第三组：无跨行卡片，两行各自独立比例分布(HappyHorse/Seedream/Niji + marey/pika) */}
          <div className="flex flex-col gap-5" style={{ aspectRatio: '1600 / 696' }}>
            <div className="flex gap-5" style={{ flex: 1 }}>
              {GROUP_3_ROW1.map((c) => (
                <div key={c.key} className={CARD_CLASS} style={{ flexGrow: c.w, flexBasis: 0, ...CARD_STYLE }}>
                  <CardInner name={c.name} />
                </div>
              ))}
            </div>
            <div className="flex gap-5" style={{ flex: 1 }}>
              {GROUP_3_ROW2.map((c) => (
                <div key={c.key} className={CARD_CLASS} style={{ flexGrow: c.w, flexBasis: 0, ...CARD_STYLE }}>
                  <CardInner name={c.name} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* md以下：单列堆叠，避免 Bento 在窄屏挤压变形 */}
        <div className="flex md:hidden flex-col gap-4">
          {ALL_MODELS_MOBILE.map((m) => (
            <div key={m.key} className={CARD_CLASS} style={{ aspectRatio: '16 / 9', ...CARD_STYLE }}>
              <CardInner name={m.name} img={m.img} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
