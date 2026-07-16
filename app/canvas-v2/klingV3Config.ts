'use client';

// ============ Kling v3 视频卡配置(独立，不与 Seedance 共享)============
// 6 个变体:4K / Pro / Standard × (图生 image-to-video / 文生 text-to-video)
// fal endpoint: fal-ai/kling-video/v3/{tier}/{i2v|t2v}
// 计费按秒(会员价，普通用户各 +0.2/秒):
//   4K:      2.9/秒(有无音频同价)
//   Pro:     无音频 0.8，有音频 1.2
//   Standard:无音频 0.6，有音频 0.9
// 不接入语言控制(voice_ids / lip-sync)。

export type KlingV3Mode = 't2v' | 'i2v' | 'first-last' | 'multimodal';

export interface KlingV3Model {
  id: string;              // 内部标识
  label: string;
  tier: '4k' | 'pro' | 'standard';
  // 每秒价格(会员)。普通用户在此基础 +0.2/秒。4K 有无音频同价。
  priceMemberNoAudio: number;
  priceMemberAudio: number;
}

export const KLING_V3_MODELS: KlingV3Model[] = [
  { id: 'kling-v3-4k',       label: 'Kling v3 · 4K',   tier: '4k',       priceMemberNoAudio: 2.9, priceMemberAudio: 2.9 },
  { id: 'kling-v3-pro',      label: 'Kling v3 · 专业版', tier: 'pro',      priceMemberNoAudio: 0.8, priceMemberAudio: 1.2 },
  { id: 'kling-v3-standard', label: 'Kling v3 · 标准版', tier: 'standard', priceMemberNoAudio: 0.6, priceMemberAudio: 0.9 },
];

export const DEFAULT_KLING_V3_MODEL = 'kling-v3-standard';

// 四模式(与 Seedance 交互一致，但独立)
export const KLING_V3_MODES: { key: KlingV3Mode; label: string }[] = [
  { key: 't2v', label: '文生视频' },
  { key: 'i2v', label: '图生-首帧' },
  { key: 'first-last', label: '首尾帧' },
  { key: 'multimodal', label: '多模态' },
];

// 时长:pro/4k 支持 3-15 秒；standard 只支持 5/10 秒。Kling v3 无比例参数(跟随起始图)
export const KLING_V3_DURATIONS_FULL = ['3', '4', '5', '6', '8', '10', '12', '15'];
export const KLING_V3_DURATIONS_STANDARD = ['5', '10'];

export function klingV3Durations(tier: string): string[] {
  return tier === 'standard' ? KLING_V3_DURATIONS_STANDARD : KLING_V3_DURATIONS_FULL;
}

// 多模态参考内容上限(elements:角色/物体图 + 参考视频)
export const KLING_V3_MAX_IMAGES = 4;   // 参考图(角色/物体)最多 4
export const KLING_V3_MAX_VIDEOS = 1;   // 参考视频最多 1(elements 支持 video_url)
export const KLING_V3_MAX_TOTAL = 4;    // 图+视频 总上限

export function klingV3Count(images: number, videos: number): {
  total: number;
  canAddImage: boolean;
  canAddVideo: boolean;
} {
  const total = images + videos;
  return {
    total,
    canAddImage: images < KLING_V3_MAX_IMAGES && total < KLING_V3_MAX_TOTAL,
    canAddVideo: videos < KLING_V3_MAX_VIDEOS && total < KLING_V3_MAX_TOTAL,
  };
}

// 各模式需要的帧数(用于前端提示)
export function klingV3FrameNeed(mode: KlingV3Mode): { first: boolean; last: boolean; multimodal: boolean } {
  return {
    first: mode === 'i2v' || mode === 'first-last',
    last: mode === 'first-last',
    multimodal: mode === 'multimodal',
  };
}

// 前端价格计算(会员/普通 × 有无音频 × 秒数)
export function klingV3Price(modelId: string, generateAudio: boolean, seconds: number, isMember: boolean): number {
  const m = KLING_V3_MODELS.find((x) => x.id === modelId);
  if (!m) return 0;
  let perSec = generateAudio ? m.priceMemberAudio : m.priceMemberNoAudio;
  if (!isMember) perSec += 0.2; // 普通用户每秒 +0.2
  const secs = Math.max(1, seconds);
  return Math.round(perSec * secs * 100) / 100;
}
