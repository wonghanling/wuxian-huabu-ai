'use client';

// ============ Kling 3.0 视频卡配置(独立，不与 Seedance 共享)============
//
// 已从 fal 迁到 Kie(端点 kling/kling-3-0)。迁移原因:价格全面下降，
// 且 fal 侧走账号池会在多个 key 间轮换，对账混乱。
//
// Kie 的 mode 就是清晰度档位:std=720P、pro=1080P、4K=4K
// 计费按秒(统一价，不分会员):
//   4K:    有/无音频同价 2.36
//   1080P: 有音频 1.010，无音频 0.707
//   720P:  有音频 0.774，无音频 0.572
//
// 多模态暂时下架:Kie Kling 3.0 只有 image_urls 一个图片字段，没有
// elements(角色元素 + @引用)这套结构。相关常量与类型保留，等确认无人
// 使用再决定删除。
export type KlingV3Mode = 't2v' | 'i2v' | 'first-last' | 'multimodal';

export interface KlingV3Model {
  id: string;              // 内部标识
  label: string;
  /** 传给 Kie 的 mode 值 */
  tier: '4K' | 'pro' | 'std';
  /** 每秒价格(统一价)。4K 有无音频同价 */
  priceMemberNoAudio: number;
  priceMemberAudio: number;
}

export const KLING_V3_MODELS: KlingV3Model[] = [
  { id: 'kling-v3-4k',       label: 'Kling 3.0 · 4K',    tier: '4K',  priceMemberNoAudio: 2.36,  priceMemberAudio: 2.36 },
  { id: 'kling-v3-pro',      label: 'Kling 3.0 · 1080P', tier: 'pro', priceMemberNoAudio: 0.707, priceMemberAudio: 1.010 },
  { id: 'kling-v3-standard', label: 'Kling 3.0 · 720P',  tier: 'std', priceMemberNoAudio: 0.572, priceMemberAudio: 0.774 },
];

export const DEFAULT_KLING_V3_MODEL = 'kling-v3-standard';

// 三模式。多模态暂时下架(Kie 无对应字段)，但保留 'multimodal' 类型以兼容
// 历史卡片存下的 config.mode，不至于让老卡片渲染报错。
export const KLING_V3_MODES: { key: KlingV3Mode; label: string }[] = [
  { key: 't2v', label: '文生视频' },
  { key: 'i2v', label: '图生-首帧' },
  { key: 'first-last', label: '首尾帧' },
];

// Kie Kling 3.0 三档都支持 3~15 秒(fal 时期 standard 只有 5/10)
export const KLING_V3_DURATIONS_FULL = ['3', '4', '5', '6', '8', '10', '12', '15'];
export const KLING_V3_DURATIONS_STANDARD = KLING_V3_DURATIONS_FULL;

export function klingV3Durations(tier: string): string[] {
  void tier;   // 三档时长一致，保留形参兼容调用方
  return KLING_V3_DURATIONS_FULL;
}

// ── 多模态 = 场景帧(start/end) + 角色元素(elements)────────────────
// Kling v3 结构: start_image_url(场景首帧) + end_image_url(场景末帧,可选)
//   + elements 最多 3 个角色/物体，每个角色 = 1 正面图 + 最多 3 张参考图(同一角色不同角度)
//   prompt 用 @Element1/2/3 引用
export const KLING_V3_MAX_ELEMENTS = 3;        // 角色/物体元素最多 3 个
export const KLING_V3_MAX_REF_PER_ELEMENT = 3; // 每个角色的额外参考图最多 3 张(不含正面图)

// 单个角色元素的数据结构(存在 node.config.elements 里)
export interface KlingV3Element {
  frontal: string;          // 正面图(主图)URL
  references: string[];     // 其它角度参考图 URL(最多 3)
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
  // 统一按会员价结算,不再区分会员/普通(isMember 参数保留以兼容调用方)
  void isMember;
  const secs = Math.max(1, seconds);
  return Math.round(perSec * secs * 100) / 100;
}
