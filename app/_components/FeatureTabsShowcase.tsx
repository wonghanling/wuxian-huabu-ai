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
      <div className="text-center mb-14">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>
          Workflow · 核心业务
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'rgb(238,238,238)' }}>
          一个画布，覆盖创作全流程
        </h2>
      </div>

      {/* 静态网格：2 列 x 2 行，每张卡片独立展示，无点击切换 */}
      <div className="grid md:grid-cols-2 gap-6">
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

              {/* 作者行占位：头像 + 名字 + 机构 */}
              <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid #ffffff0d' }}>
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{ background: 'rgb(63,63,63)' }}
                />
                <span className="text-xs" style={{ color: 'rgb(150,150,150)' }}>作者名占位</span>
                <span className="text-xs" style={{ color: 'rgb(96,96,96)' }}>· 机构占位</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
