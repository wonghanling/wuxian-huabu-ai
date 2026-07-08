'use client';

import { useState } from 'react';

// ============================================================
// 左侧点击切换 · 右侧预览联动模块
// 4 个业务入口：剧本工作室 / 涂鸦标注 / JSON 锁定风格 / 导演级分镜
// 点击左侧列表项，右侧预览区切换到对应业务的占位内容（后续替换真实截图/视频）
// 纯客户端状态切换，无数据请求，无副作用
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
  const [active, setActive] = useState<typeof FEATURES[number]['key']>('script');
  const activeFeature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

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

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* 左侧：4 项业务列表，点击切换 */}
        <div className="flex flex-col gap-3">
          {FEATURES.map((f) => {
            const isActive = f.key === active;
            return (
              <button
                key={f.key}
                onClick={() => setActive(f.key)}
                className="text-left rounded-2xl px-6 py-5 transition-all"
                style={{
                  background: isActive ? 'rgb(26,26,26)' : 'transparent',
                  border: `1px solid ${isActive ? '#ffffff2e' : '#ffffff0d'}`,
                }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: isActive ? 'rgb(113,208,131)' : 'rgb(63,63,63)' }}
                  />
                  <span
                    className="text-lg font-semibold"
                    style={{ color: isActive ? 'rgb(238,238,238)' : 'rgb(150,150,150)' }}
                  >
                    {f.title}
                  </span>
                </div>
                {isActive && (
                  <p className="text-sm leading-relaxed pl-4.5 mt-2" style={{ color: 'rgb(150,150,150)' }}>
                    {f.desc}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* 右侧：预览卡片，随左侧选中项切换（Featured Techniques 卡片样式：图 + 标题 + 描述 + 作者行）
            占位版：图片区留空、文案后续替换，作者行先占位 */}
        <div
          key={activeFeature.key}
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
              {activeFeature.title}
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgb(150,150,150)' }}>
              {activeFeature.desc}
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
      </div>
    </div>
  );
}
