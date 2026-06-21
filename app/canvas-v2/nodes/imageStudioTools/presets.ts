'use client';

// ============================================================
// Image Studio 预设（Presets）— 单一数据源
// 用户视角：选"我要完成什么任务"，不直接面对模型
// 内部映射 provider + model；加新能力 = 加一条，不改工具代码
// supportsMask: 是否支持涂抹区域重绘（Region Edit 工具只列 true 的）
// ============================================================

export interface ImagePreset {
  id: string;
  label: string;          // 任务名（用户看到的）
  desc: string;           // 一句话说明
  provider: string;       // fal / openrouter / ...
  model: string;          // 实际模型 key
  supportsMask: boolean;  // 是否支持 mask 涂抹重绘
  promptPrefix?: string;  // 注入 prompt 的能力增强前缀（可选）
}

// 全部预设（任务导向）。Region Edit 工具按 supportsMask 过滤
export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'commercial',
    label: '商业设计',
    desc: '海报、广告、文字排版，文字渲染最强',
    provider: 'fal',
    model: 'ideogram-v2-edit',
    supportsMask: true,
  },
  {
    id: 'fast-edit',
    label: '快速编辑',
    desc: '通用局部重绘，速度快，适合人像/场景',
    provider: 'fal',
    model: 'flux-inpainting',
    supportsMask: true,
  },
  {
    id: 'flux-fill',
    label: 'Flux Fill 专业',
    desc: '高质量局部填充，细节保留好，适合产品图',
    provider: 'fal',
    model: 'flux-fill',
    supportsMask: true,
  },
  {
    id: 'gpt-image-edit',
    label: 'GPT Image 编辑',
    desc: 'OpenAI 出品，理解力强，适合复杂指令编辑',
    provider: 'fal',
    model: 'gpt-image-edit',
    supportsMask: true,
  },
];

// 取支持 mask 的预设（Region Edit 用）
export const MASK_PRESETS = IMAGE_PRESETS.filter((p) => p.supportsMask);

export function getPreset(id: string): ImagePreset | undefined {
  return IMAGE_PRESETS.find((p) => p.id === id);
}
