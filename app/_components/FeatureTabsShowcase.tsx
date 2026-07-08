'use client';

const FEATURES = [
  {
    key: 'script',
    title: '剧本工作室',
    desc: '从一个想法到一部可拍摄的电影，完整覆盖角色设定、场景多视角、镜头级提示词生成。',
  },
  {
    key: 'doodle',
    title: '涂鸦标注',
    desc: '在图片上直接涂抹标注修改意图，一键发送到画布生成新版本，所见即所得。',
  },
  {
    key: 'json',
    title: 'JSON 锁定风格',
    desc: '把角色、场景的视觉参数固化为 JSON 配置，跨镜头、跨场次保持风格一致。',
  },
  {
    key: 'shotboard',
    title: '导演级分镜',
    desc: '按镜头拆解剧本，自动生成分镜图与运镜说明，产出可直接执行的分镜表。',
  },
] as const;

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

      {/* 2列×2行卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.key}
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'rgb(18,18,18)' }}
          >
            {/* 图片占位区，约 16:9 比例 */}
            <div
              className="w-full flex items-center justify-center"
              style={{
                aspectRatio: '16/9',
                background: 'rgb(38,38,38)',
              }}
            >
              <span className="text-sm" style={{ color: 'rgb(80,80,80)' }}>占位图片</span>
            </div>

            {/* 文字区 */}
            <div className="px-5 pt-4 pb-5 flex flex-col gap-1.5">
              <h3 className="text-lg font-bold leading-snug" style={{ color: 'rgb(238,238,238)' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'rgb(150,150,150)' }}>
                {f.desc}
              </p>

              {/* 作者行 */}
              <div className="flex items-center gap-2.5 mt-3">
                {/* 圆形头像占位 */}
                <span
                  className="w-8 h-8 rounded-full flex-shrink-0 block"
                  style={{ background: 'rgb(60,60,60)' }}
                />
                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium" style={{ color: 'rgb(220,220,220)' }}>作者名占位</span>
                    {/* 绿色认证勾 */}
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="7" fill="rgb(113,208,131)" />
                      <path d="M4 7l2 2 4-4" stroke="#04170a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-xs" style={{ color: 'rgb(100,100,100)' }}>机构占位</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

