'use client';

// ============ Seedance 2.0 卡片配置 ============
// 来源:app/canvas/SeedanceCard.tsx(照搬原网真实参数)
// 价格:lib/pricing.ts 的 doubao-seedance-2-0 系列(有音频但 Seedance 自带音频,无价格区别)

export type SeedanceMode = 't2v' | 'i2v' | 'first-last' | 'multimodal';

export interface SeedanceModel {
  id: string;
  label: string;
  resolutions: string[];   // 标准版有 1080p,Fast 只到 720p
}

export const SEEDANCE_MODELS: SeedanceModel[] = [
  { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0', resolutions: ['480p', '720p', '1080p'] },
  { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast', resolutions: ['480p', '720p'] },
];

export const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-2-0-260128';

// 四模式(照搬原网 MODES)
export const SEEDANCE_MODES: { key: SeedanceMode; label: string }[] = [
  { key: 't2v', label: '文生视频' },
  { key: 'i2v', label: '图生-首帧' },
  { key: 'first-last', label: '首尾帧' },
  { key: 'multimodal', label: '多模态' },
];

// 比例(照搬:含 adaptive 自适应)
export const SEEDANCE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'];

// 时长(照搬:-1 = 智能)
export const SEEDANCE_DURATIONS = ['4', '5', '6', '8', '10', '12', '15', '-1'];

// 多模态参考内容上限
export const MULTIMODAL_MAX_IMAGES = 9;   // 图片最多 9 张
export const MULTIMODAL_MAX_VIDEOS = 3;   // 视频最多 3 个
export const MULTIMODAL_MAX_TOTAL = 12;   // 图片+视频+音频 总共最多 12 个

// 统计当前已用素材数 + 是否还能加某类
export function multimodalCount(images: number, videos: number, audios: number): {
  total: number;
  canAddImage: boolean;
  canAddVideo: boolean;
  canAddAudio: boolean;
} {
  const total = images + videos + audios;
  return {
    total,
    canAddImage: images < MULTIMODAL_MAX_IMAGES && total < MULTIMODAL_MAX_TOTAL,
    canAddVideo: videos < MULTIMODAL_MAX_VIDEOS && total < MULTIMODAL_MAX_TOTAL,
    canAddAudio: total < MULTIMODAL_MAX_TOTAL,
  };
}

// 4宫格/9宫格预设 prompt(照搬原网)
export const GRID4_PROMPT = '根据这张4宫格分解表和一张人物设计图生成一段视频。没有网格，没有面板，没有边框，没有拼贴布局，保持场景连续性，遵循可见的连续性，如果场景变化存在，遵循它，如果没有场景变化，不要添加一个，不要描述帧号。\n避免没有中间运动的突然状态变化。总是描述状态之间的过渡性移动。';
export const GRID9_PROMPT = '根据这张9宫格分解表和一张人物设计图生成一段视频。没有网格，没有面板，没有边框，没有拼贴布局，保持场景连续性，遵循可见的连续性，如果场景变化存在，遵循它，如果没有场景变化，不要添加一个，不要描述帧号。\n避免没有中间运动的突然状态变化。总是描述状态之间的过渡性移动。';

// 模式 → 帧需求(首帧/尾帧)
export function seedanceFrameNeed(mode: SeedanceMode): { first: boolean; last: boolean } {
  if (mode === 'i2v') return { first: true, last: false };
  if (mode === 'first-last') return { first: true, last: true };
  return { first: false, last: false };
}
