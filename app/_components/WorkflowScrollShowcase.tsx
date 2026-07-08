'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ============================================================
// 功能演示区 · Sticky Scroll Showcase
// 左侧4项文案纵向排列，正常页面滚动；右侧预览区 sticky 固定。
// IntersectionObserver 监听左侧每个文案块是否进入视口中心区域，
// 命中即切换 activeIndex，右侧 4 层预览用 opacity 淡入淡出联动切换（不重新排版，不闪烁）。
// 纯前端展示逻辑，不涉及任何数据请求/业务状态。
// 阶段1(本次)：先搭好骨架+联动机制，预览层用简单占位内容验证效果，
// 后续再把剧本工作室/涂鸦/JSON/分镜的真实动画逐个迁移进来。
// ============================================================

const ITEMS = [
  { key: 'script', title: '剧本工作室', desc: '从一个想法到一部可拍摄的电影，完整覆盖角色设定、场景多视角、镜头级提示词生成。' },
  { key: 'doodle', title: '涂鸦标注', desc: '在图片上直接涂抹标注修改意图，一键发送到画布生成新版本，所见即所得。' },
  { key: 'json', title: 'JSON 配置', desc: '用一段 JSON 锁定生成风格，一键注入专业模板，每次生成都按此执行。' },
  { key: 'shotboard', title: '分镜设计', desc: '分镜提示词到导演级分镜表格，时间码、景别、运镜、画面一应俱全。' },
] as const;

export function WorkflowScrollShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = itemRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0.45 }
    );
    itemRefs.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Feature · 核心功能</p>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
          一个画布，覆盖创作全流程
        </h2>
      </div>

      {/* 桌面端：左右联动布局 */}
      <div className="hidden md:grid md:grid-cols-[380px_1fr] gap-16">
        {/* 左：4项文案，正常滚动 */}
        <div className="flex flex-col">
          {ITEMS.map((item, i) => (
            <div
              key={item.key}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="flex flex-col justify-center transition-opacity duration-500"
              style={{ minHeight: 320, opacity: activeIndex === i ? 1 : 0.3 }}
            >
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
                {item.title}
              </h3>
              <p className="text-base leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 右：sticky 预览区 */}
        <div className="sticky self-start" style={{ top: 120 }}>
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{ height: 560, background: 'rgb(20,20,20)', border: '1px solid #ffffff1c' }}
          >
            {ITEMS.map((item, i) => (
              <div
                key={item.key}
                className="absolute inset-0 flex items-center justify-center"
                style={{ opacity: activeIndex === i ? 1 : 0, transition: 'opacity 0.45s ease' }}
              >
                <span className="text-sm" style={{ color: 'rgb(96,96,96)' }}>
                  {item.title} 预览（占位，骨架验证阶段）
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 移动端：上下堆叠，不使用 sticky */}
      <div className="flex md:hidden flex-col gap-10">
        {ITEMS.map((item) => (
          <div key={item.key}>
            <h3 className="text-2xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
              {item.title}
            </h3>
            <p className="text-base leading-relaxed mb-5" style={{ color: 'rgb(180,180,180)' }}>
              {item.desc}
            </p>
            <div
              className="relative rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: '4/3', background: 'rgb(20,20,20)', border: '1px solid #ffffff1c' }}
            >
              <span className="text-sm" style={{ color: 'rgb(96,96,96)' }}>{item.title} 预览（占位）</span>
            </div>
          </div>
        ))}
      </div>

      {/* 底部 CTA：保留原「进入剧本工作室」入口 */}
      <div className="flex justify-center mt-16">
        <Link href="/canvas?studio=true">
          <button
            className="px-8 py-3.5 rounded-full font-semibold text-sm transition-transform hover:scale-[1.03]"
            style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
          >
            进入剧本工作室 →
          </button>
        </Link>
      </div>
    </div>
  );
}
