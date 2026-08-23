'use client';

// ============ Seedance 2.0 卡片配置 ============
// 来源:app/canvas/SeedanceCard.tsx(照搬原网真实参数)
// 价格:lib/pricing.ts 的 doubao-seedance-2-0 系列(有音频但 Seedance 自带音频,无价格区别)

export type SeedanceMode = 't2v' | 'i2v' | 'first-last' | 'multimodal';

export interface SeedanceModel {
  id: string;
  label: string;
  resolutions: string[];   // 标准版有 1080p/4K,Fast/Mini/2.5 只到 720p
  durations?: string[];    // 不设则用 SEEDANCE_DURATIONS(2.0 系列:最长 15s)
  /** 多模态素材上限;不设则用 2.0 的 9/3/12 */
  limits?: { images: number; videos: number; audios: number; total: number };
}

// 模型 ID 保持 doubao-* 前缀不变(兼容已存的老画布卡片),后端映射到对应上游模型。
//
// 各档差异(上限按模型区分,2.0 传超量会被上游拒):
//   2.0 系列 — 最长 15s,素材 9图/3视频/共12
//   2.5      — 最长 30s,素材 30图/10视频/10音频/共50;有 1080p，仍无 4K
export const SEEDANCE_MODELS: SeedanceModel[] = [
  {
    id: 'doubao-seedance-2-5-260128',
    label: 'Seedance 2.5',
    resolutions: ['480p', '720p', '1080p'],
    durations: ['4', '5', '6', '8', '10', '12', '15', '20', '25', '30', '-1'],
    limits: { images: 30, videos: 10, audios: 10, total: 50 },
  },
  { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0', resolutions: ['480p', '720p', '1080p', '4k'] },
  { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast', resolutions: ['480p', '720p'] },
  { id: 'doubao-seedance-2-0-mini-260128', label: 'Seedance 2.0 Mini', resolutions: ['480p', '720p'] },
];

export const DEFAULT_SEEDANCE_MODEL = 'doubao-seedance-2-5-260128';

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

// 多模态参考内容上限(2.0 系列默认值;2.5 在 SEEDANCE_MODELS.limits 里覆盖)
export const MULTIMODAL_MAX_IMAGES = 9;   // 图片最多 9 张
export const MULTIMODAL_MAX_VIDEOS = 3;   // 视频最多 3 个
export const MULTIMODAL_MAX_TOTAL = 12;   // 图片+视频+音频 总共最多 12 个

export interface MultimodalLimits {
  images: number;
  videos: number;
  audios: number;
  total: number;
}

/** 取某模型的素材上限;模型没声明就用 2.0 的默认值 */
export function seedanceLimits(modelId?: string): MultimodalLimits {
  const m = SEEDANCE_MODELS.find((x) => x.id === modelId);
  return m?.limits ?? {
    images: MULTIMODAL_MAX_IMAGES,
    videos: MULTIMODAL_MAX_VIDEOS,
    audios: MULTIMODAL_MAX_TOTAL,   // 2.0 未单独限制音频，仅受总数约束
    total: MULTIMODAL_MAX_TOTAL,
  };
}

/** 取某模型的可选时长;模型没声明就用默认(最长 15s) */
export function seedanceDurations(modelId?: string): string[] {
  const m = SEEDANCE_MODELS.find((x) => x.id === modelId);
  return m?.durations ?? SEEDANCE_DURATIONS;
}

// 统计当前已用素材数 + 是否还能加某类
// limits 不传时用 2.0 的 9/3/12，保证旧调用点行为不变
export function multimodalCount(
  images: number,
  videos: number,
  audios: number,
  limits?: MultimodalLimits,
): {
  total: number;
  canAddImage: boolean;
  canAddVideo: boolean;
  canAddAudio: boolean;
} {
  const L = limits ?? {
    images: MULTIMODAL_MAX_IMAGES,
    videos: MULTIMODAL_MAX_VIDEOS,
    audios: MULTIMODAL_MAX_TOTAL,
    total: MULTIMODAL_MAX_TOTAL,
  };
  const total = images + videos + audios;
  return {
    total,
    canAddImage: images < L.images && total < L.total,
    canAddVideo: videos < L.videos && total < L.total,
    canAddAudio: audios < L.audios && total < L.total,
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
