'use client';

// 8 张卡片，4列x2行，结构对齐 flora.ai Featured Techniques
// 每张卡可单独配 image(卡槽顶部铺满)；未配图的仍显示占位块，等后续替换
const CARDS: { key: string; title: string; desc: string; image?: string }[] = [
  {
    key: 'card-1',
    title: '占位标题 1',
    desc: '占位描述文字，后续替换为真实功能说明。',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/20ce33c8-6a71-41a1-804e-4997b4d95476/1783646629738.jpg',
  },
  ...Array.from({ length: 7 }, (_, i) => ({
    key: `card-${i + 2}`,
    title: `占位标题 ${i + 2}`,
    desc: '占位描述文字，后续替换为真实功能说明。',
  })),
];

export function FeatureTabsShowcase() {
  return (
    <div className="max-w-7xl mx-auto px-6">

      {/* 顶部：左侧标题+副标题，右侧链接 */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: 'rgb(238,238,238)' }}>
            核心功能
          </h2>
          <p className="text-base" style={{ color: 'rgb(150,150,150)' }}>
            一个画布，覆盖创作全流程
          </p>
        </div>
        <a
          href="/canvas"
          className="flex items-center gap-1 text-sm font-medium mt-1 hover:opacity-70 transition-opacity"
          style={{ color: 'rgb(238,238,238)' }}
        >
          进入画布 <span style={{ fontSize: 16 }}>↗</span>
        </a>
      </div>

      {/* 4列×2行卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((f) => (
          <div
            key={f.key}
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'linear-gradient(160deg, rgb(30,30,30), rgb(14,14,14))' }}
          >
            {/* 图片区：铺满卡槽顶部 */}
            <div
              className="w-full flex items-center justify-center overflow-hidden"
              style={{
                aspectRatio: '4/3',
                background: f.image ? 'transparent' : 'linear-gradient(160deg, rgb(70,70,70), rgb(32,32,32))',
              }}
            >
              {f.image ? (
                <img src={f.image} alt={f.title} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <span className="text-sm" style={{ color: 'rgb(120,120,120)' }}>占位图片</span>
              )}
            </div>

            {/* 文字区 */}
            <div className="px-4 pt-3 pb-3 flex flex-col gap-1">
              <h3 className="text-base font-bold leading-snug" style={{ color: 'rgb(238,238,238)' }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgb(150,150,150)' }}>
                {f.desc}
              </p>

              {/* 作者行 */}
              <div className="flex items-center gap-2 mt-2.5">
                {/* 圆形头像占位 */}
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0 block"
                  style={{ background: 'rgb(60,60,60)' }}
                />
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium" style={{ color: 'rgb(220,220,220)' }}>作者名占位</span>
                    {/* 绿色认证勾 */}
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="7" fill="rgb(113,208,131)" />
                      <path d="M4 7l2 2 4-4" stroke="#04170a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[11px]" style={{ color: 'rgb(100,100,100)' }}>机构占位</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

