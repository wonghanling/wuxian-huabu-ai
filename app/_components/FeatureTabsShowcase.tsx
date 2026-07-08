'use client';

// ============================================================
// Featured Techniques 风格静态卡片网格（参考 flora.ai）
// 4 个业务：剧本工作室 / 涂鸦标注 / JSON 锁定风格 / 导演级分镜
// 每张卡片独立展示：图片占位 + 标题 + 描述 + 作者行占位，互不联动
// 无状态、无交互，纯展示
// ============================================================

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
      {/* 标题区：左侧大标题+副标题，右侧对齐一个链接 */}
      <div className="flex items-end justify-between mb-10 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
            核心业务
          </h2>
          <p className="text-sm md:text-base" style={{ color: 'rgb(150,150,150)' }}>
            一个画布，覆盖创作全流程
          </p>
        </div>
        <a
          href="/canvas"
          className="text-sm font-medium whitespace-nowrap hover:opacity-80 transition-opacity"
          style={{ color: 'rgb(238,238,238)' }}
        >
          进入画布 →
        </a>
      </div>

      {/* 静态网格：4 列 x 1 行，每张卡片独立展示，无点击切换 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {FEATURES.map((f) => (
          <div
            key={f.key}
            className="relative rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff1c' }}
          >
            {/* 图片占位区 */}
            <div
              className="relative w-full flex items-center justify-center"
              style={{ aspectRatio: '4/3', background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))' }}
            >
              <span className="text-sm font-medium" style={{ color: 'rgb(96,96,96)' }}>
                占位图片
              </span>
            </div>

            {/* 文字区：标题 + 描述 */}
            <div className="p-5">
              <h3 className="text-base font-semibold mb-1.5" style={{ color: 'rgb(238,238,238)' }}>
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgb(150,150,150)' }}>
                {f.desc}
              </p>

              {/* 作者行占位：头像 + 姓名(带认证勾) + 机构 */}
              <div className="flex items-center gap-2.5 pt-3" style={{ borderTop: '1px solid #ffffff0d' }}>
                <span
                  className="w-7 h-7 rounded-full flex-shrink-0"
                  style={{ background: 'rgb(63,63,63)' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'rgb(200,200,200)' }}>作者名占位</span>
                    <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="rgb(113,208,131)">
                      <path fillRule="evenodd" d="M10 1l2.39 1.94 3.03-.4.7 3-2.12 2.46 2.12 2.46-.7 3-3.03-.4L10 16l-2.39-1.94-3.03.4-.7-3 2.12-2.46-2.12-2.46.7-3 3.03.4L10 1zm-1.03 10.4l4.34-4.34-1.06-1.06-3.28 3.28-1.6-1.6-1.06 1.06 2.66 2.66z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-[11px] truncate block" style={{ color: 'rgb(96,96,96)' }}>机构占位</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
