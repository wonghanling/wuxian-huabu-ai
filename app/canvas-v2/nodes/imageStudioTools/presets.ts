'use client';

// ============================================================
// Image Studio 预设（Presets）— 单一数据源
// 用户视角：选"我要完成什么任务"，不直接面对模型
// 内部映射 provider + model + 额外参数；加新能力 = 加一条，不改工具代码
// supportsMask: 是否支持涂抹区域重绘（Region Edit 工具只列 true 的）
// ============================================================

export interface ImagePreset {
  id: string;
  label: string;          // 任务名（用户看到的）
  desc: string;           // 一句话说明
  provider: string;       // fal / openrouter / ...
  model: string;          // 实际模型 key（后端 adapter 匹配用）
  supportsMask: boolean;  // 是否支持 mask 涂抹重绘
  pricingKey: string;     // pricing.ts 里的 key（后端扣费用）
  price: number;          // 前端显示价格（元/次）
  promptPrefix?: string;  // 注入 prompt 的能力增强前缀（可选）
}

// 全部预设（任务导向）。Region Edit 工具按 supportsMask 过滤
export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'ideogram-v3-turbo',
    label: '快速编辑',
    desc: '速度优先，适合快速迭代预览',
    provider: 'fal',
    model: 'ideogram-v3-turbo',
    supportsMask: true,
    pricingKey: 'ideogram-v3-turbo',
    price: 0.3,
  },
  {
    id: 'ideogram-v3-balanced',
    label: '标准编辑',
    desc: '速度与质量平衡，日常局部重绘首选',
    provider: 'fal',
    model: 'ideogram-v3-balanced',
    supportsMask: true,
    pricingKey: 'ideogram-v3-balanced',
    price: 0.5,
  },
  {
    id: 'ideogram-v3-quality',
    label: '高质量编辑',
    desc: '最高质量，适合最终成品精修',
    provider: 'fal',
    model: 'ideogram-v3-quality',
    supportsMask: true,
    pricingKey: 'ideogram-v3-quality',
    price: 0.7,
  },
  {
    id: 'flux-fill',
    label: 'Flux Fill 专业',
    desc: '高质量局部填充，细节保留好，适合产品图',
    provider: 'fal',
    model: 'flux-fill',
    supportsMask: true,
    pricingKey: 'flux-fill',
    price: 1.7,
  },
];

// 取支持 mask 的预设（Region Edit 用）
export const MASK_PRESETS = IMAGE_PRESETS.filter((p) => p.supportsMask);

export function getPreset(id: string): ImagePreset | undefined {
  return IMAGE_PRESETS.find((p) => p.id === id);
}
