'use client';

// ============ 视频模型配置 ============
// 来源:app/api/video/generate/route.ts 的 VIDEO_MODELS + lib/pricing.ts 的 VIDEO_PRICING
// 照搬原网真实参数(模型/模式/时长/比例/清晰度/音频/价格)

import { calcVideoPrice } from '@/lib/pricing';

// upscale=升分辨率(后处理):吃一个已有视频，把它提到更高分辨率。
// 与 videoedit 一样需要上传视频，但没有提示词/比例/时长/音频这些生成参数。
export type VideoMode = 't2v' | 'i2v' | 'firstLastFrame' | 'r2v' | 'videoedit' | 'upscale';

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
  /**
   * r2v 参考素材上限。不设则用默认 { total: 5 }(Wan 2.7 的限制)。
   * MiniMax H3 支持 9 图 + 3 视频 + 3 音频。
   */
  refLimits?: { images: number; videos: number; audios: number; total: number };
  /**
   * r2v 支持上传参考音频。两种语义不同,UI 文案区分:
   *   'voice'     Wan 2.7 的"音色",按参考素材顺序(图先视频后)依次分配
   *   'reference' MiniMax H3 的"参考音频",整体作为风格参考,
   *               且不能单独使用(必须配合参考图或参考视频)
   * 不设则该模型没有音频入口。
   */
  refAudioKind?: 'voice' | 'reference';
}

/** 取某模型的 r2v 素材上限;未声明的沿用 Wan 2.7 的总数 5 */
export function videoRefLimits(modelId?: string): { images: number; videos: number; audios: number; total: number } {
  const m = VIDEO_MODELS.find((x) => x.id === modelId);
  return m?.refLimits ?? { images: 5, videos: 5, audios: 5, total: 5 };
}

export const VIDEO_MODELS: VideoModel[] = [
  // —— 即梦 3.0 ——

  // —— Wan 3.0（多 480P 档、时长 2~30s、比例含 adaptive）——
  // 参考内容的素材上限比 2.7 宽松得多:2.7 是三类共享总数 5，
  // 3.0 是图 10 / 视频 5 / 音频 5 各自独立，故必须显式写 refLimits。
  { id: 'wan3.0-t2v', label: 'Wan 3.0 文生', mode: 't2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: [], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.30/720P ¥0.63/1080P ¥1.17 每秒' },
  { id: 'wan3.0-i2v', label: 'Wan 3.0 首帧', mode: 'i2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.30/720P ¥0.63/1080P ¥1.17 每秒' },
  { id: 'wan3.0-kf2v', label: 'Wan 3.0 首尾帧', mode: 'firstLastFrame', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.30/720P ¥0.63/1080P ¥1.17 每秒' },
  { id: 'wan3.0-r2v', label: 'Wan 3.0 参考内容', mode: 'r2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.30/720P ¥0.63/1080P ¥1.17 每秒', refLimits: { images: 10, videos: 5, audios: 5, total: 20 }, refAudioKind: 'reference' },
  { id: 'wan3.0-prime-t2v', label: 'Wan 3.0 高速 文生', mode: 't2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: [], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.50/720P ¥0.95/1080P ¥1.80 每秒' },
  { id: 'wan3.0-prime-i2v', label: 'Wan 3.0 高速 首帧', mode: 'i2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.50/720P ¥0.95/1080P ¥1.80 每秒' },
  { id: 'wan3.0-prime-kf2v', label: 'Wan 3.0 高速 首尾帧', mode: 'firstLastFrame', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.50/720P ¥0.95/1080P ¥1.80 每秒' },
  { id: 'wan3.0-prime-r2v', label: 'Wan 3.0 高速 参考内容', mode: 'r2v', durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30], aspectRatios: ['adaptive','16:9','9:16','1:1','4:3','3:4'], resolutions: ['480P','720P','1080P'], defaultResolution: '1080P', supportsAudio: true, price: '480P ¥0.50/720P ¥0.95/1080P ¥1.80 每秒', refLimits: { images: 10, videos: 5, audios: 5, total: 20 }, refAudioKind: 'reference' },

  // —— Wan ——
  { id: 'wan2.7-t2v', label: 'Wan 2.7 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.63/1080P ¥0.90 每秒 · 含自动音频' },
  { id: 'wan2.7-i2v', label: 'Wan 2.7 首帧', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.63/1080P ¥0.90 每秒 · 含自动音频' },
  { id: 'wan2.7-kf2v', label: 'Wan 2.7 首尾帧', mode: 'firstLastFrame', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.63/1080P ¥0.90 每秒 · 含自动音频' },

  // —— Pixverse v6(fal,自带音频,无音频开关;720p/1080p)——
  // —— MiniMax H3 ——
  // 三个端点对应三种模式;分辨率 768P/2K(注意大写 P),时长仅 4/6/10 秒。
  // r2v 素材上限 9图/3视频/3音频(视频卡默认是总数 5,这里显式放开)。
  { id: 'minimax-h3-t2v', label: 'MiniMax H3 文生', mode: 't2v', durations: [4, 6, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['768p','2k'], defaultResolution: '768p', supportsAudio: false, price: '768P ¥0.85/2K ¥1.33 每秒' },
  { id: 'minimax-h3-i2v', label: 'MiniMax H3 首帧', mode: 'i2v', durations: [4, 6, 10], aspectRatios: [], resolutions: ['768p','2k'], defaultResolution: '768p', supportsAudio: false, price: '768P ¥0.85/2K ¥1.33 每秒' },
  { id: 'minimax-h3-r2v', label: 'MiniMax H3 参考生视频', mode: 'r2v', durations: [4, 6, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['768p','2k'], defaultResolution: '768p', supportsAudio: false, price: '768P ¥0.85/2K ¥1.33 每秒', refLimits: { images: 9, videos: 3, audios: 3, total: 15 }, refAudioKind: 'reference' },

  // —— FLUX 3（走 fal）——
  // 四个端点;分辨率 720p/1080p,时长 5-20 秒(首尾帧不支持 auto,须给明确时长)。
  // 自带音频生成(generate_audio 默认 true),不额外收费。
  { id: 'flux-3-t2v', label: 'FLUX 3 文生', mode: 't2v', durations: [5, 6, 8, 10, 12, 15, 20], aspectRatios: ['16:9','9:16','1:1','4:3','3:4','21:9','2:1'], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥1.24/1080P ¥2.05 每秒' },
  { id: 'flux-3-i2v', label: 'FLUX 3 首帧', mode: 'i2v', durations: [5, 6, 8, 10, 12, 15, 20], aspectRatios: [], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥1.24/1080P ¥2.05 每秒' },
  { id: 'flux-3-first-last', label: 'FLUX 3 首尾帧', mode: 'firstLastFrame', durations: [5, 6, 8, 10, 12, 15, 20], aspectRatios: [], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥1.24/1080P ¥2.05 每秒' },
  { id: 'flux-3-extend', label: 'FLUX 3 扩展视频', mode: 'videoedit', durations: [5, 6, 8, 10, 12, 15, 20], aspectRatios: ['16:9','9:16','1:1','4:3','3:4','21:9','2:1'], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥1.24/1080P ¥2.05 每秒' },
  // 升分辨率:后处理，把已有视频提到更高分辨率。无提示词/比例/时长/音频。
  // 上游限制:MP4、最长 20 秒、最大 50MB。
  { id: 'flux-video-upscale', label: 'FLUX 视频升分辨率', mode: 'upscale', durations: [], aspectRatios: [], resolutions: ['1080P','2K','4K'], defaultResolution: '1080P', supportsAudio: false, price: '1080P ¥1.00/2K ¥1.70/4K ¥3.80 每秒' },

  { id: 'pixverse-t2v', label: 'Pixverse v6 文生', mode: 't2v', durations: [5, 8], aspectRatios: ['16:9','9:16','1:1'], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥0.43/1080P ¥0.73 每秒 · 含自动音频' },
  { id: 'pixverse-i2v', label: 'Pixverse v6 首帧', mode: 'i2v', durations: [5, 8], aspectRatios: [], resolutions: ['720p','1080p'], defaultResolution: '720p', supportsAudio: false, price: '720P ¥0.43/1080P ¥0.73 每秒 · 含自动音频' },

  // —— HappyHorse(阿里云 dashscope-intl,文生视频)——
  { id: 'happyhorse-1.0-t2v', label: '快乐马 1.1 文生', mode: 't2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.86/1080P ¥1.07 每秒 · 含自动音频' },
  { id: 'happyhorse-1.0-i2v', label: '快乐马 1.1 首帧', mode: 'i2v', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.86/1080P ¥1.07 每秒 · 含自动音频' },
  { id: 'happyhorse-1.0-r2v', label: '快乐马 1.1 参考内容', mode: 'r2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.86/1080P ¥1.07 每秒 · 含自动音频' },

  // —— Wan 2.7 参考内容 / 视频编辑 ——
  { id: 'wan2.7-r2v', label: 'Wan 2.7 参考内容', mode: 'r2v', durations: [5, 10], aspectRatios: ['16:9','9:16','1:1','4:3'], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.63/1080P ¥0.90 每秒 · 含自动音频', refAudioKind: 'voice' },
  { id: 'wan2.7-videoedit', label: 'Wan 2.7 视频编辑', mode: 'videoedit', durations: [5, 10], aspectRatios: [], resolutions: ['720P','1080P'], defaultResolution: '720P', supportsAudio: false, price: '720P ¥0.63/1080P ¥0.90 每秒 · 含自动音频' },
];

export const DEFAULT_VIDEO_MODEL = 'wan2.7-i2v';

// 模式 → 帧上传需求
export function frameNeed(mode: VideoMode): { first: boolean; last: boolean } {
  if (mode === 'i2v') return { first: true, last: false };          // 首帧:1张
  if (mode === 'firstLastFrame') return { first: true, last: true }; // 首尾:2张
  return { first: false, last: false };                             // t2v/r2v/videoedit:不走首尾帧UI
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
