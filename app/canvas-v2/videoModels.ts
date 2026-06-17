'use client';

// ============ 视频模型配置 ============
// 来源:app/api/video/generate/route.ts 的 VIDEO_MODELS + lib/pricing.ts 的 VIDEO_PRICING
// 照搬原网真实参数(模型/模式/时长/比例/清晰度/音频/价格)

import { calcVideoPrice } from '@/lib/pricing';

export type VideoMode = 't2v' | 'i2v' | 'firstLastFrame';

export interface VideoModel {
  id: string;
  label: string;
  mode: VideoMode;            // t2v=文生(无参考图) i2v=首帧(1张) firstLastFrame=首尾(2张)
  durations: number[];        // 可选时长(秒)
  aspectRatios: string[];     // 可选比例(空=跟随首帧,不选比例)
  resolutions: string[];      // 清晰度
  defaultResolution: string;
  supportsAudio: boolean;     // 是否有音频开关
  price: string;              // 价格说明(照搬)
}

export const VIDEO_MODELS: VideoModel[] = [
  // —— 即梦 3.0 ——
  { id: 'jimeng-t2v', label: '即梦 3.0 文生 720P', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], resolutions: ['720p'], defaultResolution: '720p', supportsAudio: false, price: '¥0.28/秒' },
  { id: 'jimeng-i2v', label: '即梦 3.0 首帧 720P', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['720p'], defaultResolution: '720p', supportsAudio: false, price: '¥0.28/秒' },
  { id: 'jimeng-first-last', label: '即梦 3.0 首尾帧 720P', mode: 'firstLastFrame', durations: [5, 10], aspectRatios: [], resolutions: ['720p'], defaultResolution: '720p', supportsAudio: false, price: '¥0.28/秒' },
  { id: 'jimeng-1080-t2v', label: '即梦 3.0 文生 1080P', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], resolutions: ['1080p'], defaultResolution: '1080p', supportsAudio: false, price: '¥0.63/秒' },
  { id: 'jimeng-1080-i2v', label: '即梦 3.0 首帧 1080P', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['1080p'], defaultResolution: '1080p', supportsAudio: false, price: '¥0.63/秒' },
  { id: 'jimeng-1080-first-last', label: '即梦 3.0 首尾帧 1080P', mode: 'firstLastFrame', durations: [5, 10], aspectRatios: [], resolutions: ['1080p'], defaultResolution: '1080p', supportsAudio: false, price: '¥0.63/秒' },
  { id: 'jimeng-pro-t2v', label: '即梦 3.0 Pro 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], resolutions: ['1080p'], defaultResolution: '1080p', supportsAudio: false, price: '¥1.00/秒' },
  { id: 'jimeng-pro-i2v', label: '即梦 3.0 Pro 首帧', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['1080p'], defaultResolution: '1080p', supportsAudio: false, price: '¥1.00/秒' },

  // —— Wan ——
  { id: 'wan2.7-t2v', label: 'Wan 2.7 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥4.65/1080P¥6.5 起 · 含自动音频' },
  { id: 'wan2.7-i2v', label: 'Wan 2.7 首帧', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥4.65/1080P¥6.5 起 · 含自动音频' },
  { id: 'wan2.7-kf2v', label: 'Wan 2.7 首尾帧', mode: 'firstLastFrame', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥4.65/1080P¥6.5 起 · 含自动音频' },
  { id: 'wan2.6-t2v', label: 'Wan 2.6 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥0.9/1080P¥1.3 起' },
  { id: 'wan2.6-i2v', label: 'Wan 2.6 首帧', mode: 'i2v', durations: [5, 10, 15], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥0.8/1080P¥1.2 起' },
  { id: 'wan2.6-i2v-flash', label: 'Wan 2.6 首帧 Flash', mode: 'i2v', durations: [5, 10, 15], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: true, price: '会员 720P无声¥0.35起' },
  { id: 'wan2.5-t2v-preview', label: 'Wan 2.5 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['480P','720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 480P¥0.5/720P¥0.8/1080P¥1.2 起' },
  { id: 'wan2.5-i2v-preview', label: 'Wan 2.5 首帧', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['480P','720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 480P¥0.5/720P¥0.8/1080P¥1.2 起' },
  { id: 'wan2.2-kf2v-flash', label: 'Wan 2.2 首尾帧', mode: 'firstLastFrame', durations: [5], aspectRatios: [], resolutions: ['480P','720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '固定5秒 会员720P¥2.0起' },

  // —— Pixverse v6(fal,自带音频,无音频开关;720p/1080p)——
  { id: 'pixverse-t2v', label: 'Pixverse v6 文生', mode: 't2v', durations: [5, 8], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '会员 720P¥0.6/1080P¥0.9 起' },
  { id: 'pixverse-i2v', label: 'Pixverse v6 首帧', mode: 'i2v', durations: [5, 8], aspectRatios: [], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '会员 720P¥0.6/1080P¥0.9 起' },

  // —— HappyHorse(阿里云 dashscope-intl,文生视频)——
  { id: 'happyhorse-1.0-t2v', label: '快乐马 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '会员 720P¥6.25/1080P¥10.0 起 · 含自动音频' },
];

export const DEFAULT_VIDEO_MODEL = 'jimeng-i2v';

// 模式 → 帧上传需求
export function frameNeed(mode: VideoMode): { first: boolean; last: boolean } {
  if (mode === 't2v') return { first: false, last: false };        // 文生:无参考图
  if (mode === 'i2v') return { first: true, last: false };          // 首帧:1张
  return { first: true, last: true };                               // 首尾:2张
}

// 计算价格(直接复用原网 calcVideoPrice;自动兼容 720p/720P 大小写)
// 返回会员价 + 普通价两个总价(单价 × 时长)
export function videoPrice(
  modelId: string,
  resolution: string,
  duration: number,
  hasAudio: boolean,
): { member: number; normal: number } {
  const tryRes = [resolution, resolution.toUpperCase(), resolution.toLowerCase()];
  for (const res of tryRes) {
    const member = calcVideoPrice(modelId, res, duration, true, hasAudio);
    const normal = calcVideoPrice(modelId, res, duration, false, hasAudio);
    if (member > 0 || normal > 0) return { member, normal };
  }
  return { member: 0, normal: 0 };
}
