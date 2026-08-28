import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, userKeyToKeyInfo, releaseUserAwareKey, categorizeError, type KeyInfo } from '@/lib/api-key-pool';
import { lookupUserKey, userKeyInvalidMessage, dashscopeHost } from '@/lib/user-api-keys';

export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { Service } from '@volcengine/openapi';
import { calcVideoPrice, OVI_PRICE } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

// 火山引擎即梦服务
const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengSubmit = volcService.createJSONAPI('CVSync2AsyncSubmitTask', { Version: '2022-08-31' });
const jimengQuery  = volcService.createJSONAPI('CVSync2AsyncGetResult',  { Version: '2022-08-31' });

falSingleton.config({ credentials: process.env.FAL_KEY! });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 从 Authorization Bearer token 解出 userId（BYOK 取 key 用）
// 不能用请求体里的 userId，否则可伪造成别人蹭 key
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

type ModelConfig = {
  name: string;
  endpoint: string;
  // upscale=视频升分辨率(后处理):吃一个已有视频，把它提到更高分辨率。
  // 无提示词/比例/时长/音频等生成参数
  mode: 't2v' | 'i2v' | 'firstLastFrame' | 'r2v' | 'videoedit' | 'upscale';
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsAudio: boolean;
  audioBuiltIn: boolean;
  supportsEndFrame: boolean;
  durationFormat: 'seconds' | 'number' | 'none';
  imageParamName?: string;
  endImageParamName?: string;
  i2vNoAspectRatio?: boolean;
  provider?: 'fal' | 'dashscope' | 'jimeng' | 'kie';
  /**
   * Kie 各模型的参数形态差异（provider='kie' 时生效）。不设则用 H3 的默认形态。
   *   resKey    清晰度字段名：'resolution'(Wan/快乐马/H3) | 'quality'(Pixverse)
   *   resCase   清晰度大小写：'upper'=768P/2K(H3) | 'lower'=720p/1080p(2.7 等)
   *             | 'keep'=原样传 480P/720P/1080P(Wan 3.0)
   *   imgStyle  图片传法：'frame'=first_frame_url/last_frame_url(Wan)
   *             | 'urls'=image_urls 数组(快乐马/Pixverse) | 'single'=image_url(H3)
   *   refStyle  参考素材字段：'wan'=reference_image/reference_video/reference_voice
   *             | 'h3'=reference_image_urls/..._video_urls/..._audio_urls
   *             | 'single'=reference_image(快乐马,仅图)
   *   audioBool 音频用布尔字段 audio(Wan 3.0)，而非 2.7 的 reference_voice 音色
   */
  kieParams?: {
    resKey?: 'resolution' | 'quality';
    resCase?: 'upper' | 'lower' | 'keep';
    imgStyle?: 'frame' | 'urls' | 'single';
    refStyle?: 'wan' | 'h3' | 'single';
    audioBool?: boolean;
  };
  dashscopeModel?: string;
  jimengReqKey?: string;
  // 运镜模式专用
  supportsCamera?: boolean;
};

const VIDEO_MODELS: Record<string, ModelConfig> = {
  'veo3.1-t2v': {
    name: 'Veo 3.1 文生视频',
    endpoint: 'fal-ai/veo3.1',
    mode: 't2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
  },
  'veo3.1-i2v': {
    name: 'Veo 3.1 图生视频',
    endpoint: 'fal-ai/veo3.1/image-to-video',
    mode: 'i2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
    imageParamName: 'image_url',
  },
  'veo3.1-fast-t2v': {
    name: 'Veo 3.1 Fast 文生视频',
    endpoint: 'fal-ai/veo3.1/fast',
    mode: 't2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
  },
  'veo3.1-fast-i2v': {
    name: 'Veo 3.1 Fast 图生视频',
    endpoint: 'fal-ai/veo3.1/fast/image-to-video',
    mode: 'i2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
    imageParamName: 'image_url',
  },
  'veo3.1-first-last': {
    name: 'Veo 3.1 首尾帧',
    endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    mode: 'firstLastFrame',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'seconds',
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  // —— Pixverse v6(fal,自带音频不传开关;720p/1080p)——
  // ── MiniMax H3（走 Kie，与 Seedance 同一套 createTask/recordInfo 接口）──
  // endpoint 复用为 Kie 的模型 ID；provider 标记 'kie' 走新分支
  'minimax-h3-t2v': {
    name: 'MiniMax H3 文生视频',
    endpoint: 'minimax-h3/text-to-video',
    mode: 't2v',
    durations: [4, 6, 10],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    resolutions: ['768p', '2k'],
    defaultResolution: '768p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    provider: 'kie',
  },
  'minimax-h3-i2v': {
    name: 'MiniMax H3 首帧生视频',
    endpoint: 'minimax-h3/image-to-video',
    mode: 'i2v',
    durations: [4, 6, 10],
    aspectRatios: [],
    resolutions: ['768p', '2k'],
    defaultResolution: '768p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    provider: 'kie',
  },
  'minimax-h3-r2v': {
    name: 'MiniMax H3 参考生视频',
    endpoint: 'minimax-h3/reference-to-video',
    mode: 'r2v',
    durations: [4, 6, 10],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    resolutions: ['768p', '2k'],
    defaultResolution: '768p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    provider: 'kie',
  },

  // ── FLUX 3（走 fal 队列，复用现有 fal 分支）────────────────
  // 分辨率 720p/1080p，时长 5-20；自带音频生成。
  // 首尾帧用 start_image_url / end_image_url（与其他模型的字段名不同）。
  'flux-3-t2v': {
    name: 'FLUX 3 文生视频',
    endpoint: 'blackforestlabs/flux-3/text-to-video',
    mode: 't2v',
    durations: [5, 6, 8, 10, 12, 15, 20],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '2:1'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'flux-3-i2v': {
    name: 'FLUX 3 首帧生视频',
    endpoint: 'blackforestlabs/flux-3/image-to-video',
    mode: 'i2v',
    durations: [5, 6, 8, 10, 12, 15, 20],
    aspectRatios: [],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
  },
  'flux-3-first-last': {
    name: 'FLUX 3 首尾帧生视频',
    endpoint: 'blackforestlabs/flux-3/first-last-frame-to-video',
    mode: 'firstLastFrame',
    durations: [5, 6, 8, 10, 12, 15, 20],
    aspectRatios: [],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'start_image_url',
    endImageParamName: 'end_image_url',
    i2vNoAspectRatio: true,
  },
  // FLUX 视频升分辨率(后处理,走 fal)。上游 schema:
  //   video_url       必填,MP4,最长 20s / 最大 50MB
  //   upscale_factor  浮点倍率(默认 2) —— 上游没有分辨率枚举,
  //                   故 resolutions 的 1080P/2K/4K 只是给用户的说法,
  //                   后端按"目标高度 / 输入高度"换算成倍率
  //   creativity      0=精确 1=创意增强(默认 1) —— 固定 0,不做创意模式
  //   prompt / safety_tolerance  创意模式才用,精确模式不传
  'flux-video-upscale': {
    name: 'FLUX 视频升分辨率',
    endpoint: 'blackforestlabs/flux-video-upscale',
    mode: 'upscale',
    durations: [],
    aspectRatios: [],
    resolutions: ['1080P', '2K', '4K'],
    defaultResolution: '1080P',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'none',
  },

  'flux-3-extend': {
    name: 'FLUX 3 扩展视频',
    endpoint: 'blackforestlabs/flux-3/extend-video',
    mode: 'videoedit',
    durations: [5, 6, 8, 10, 12, 15, 20],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '2:1'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
  },

  'pixverse-t2v': {
    name: 'Pixverse v6 文生视频',
    endpoint: 'pixverse-v6/text-to-video',
    provider: 'kie',
    mode: 't2v',
    durations: [5, 8],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resKey: 'quality', resCase: 'lower' },
  },
  'pixverse-i2v': {
    name: 'Pixverse v6 图生视频',
    endpoint: 'pixverse-v6/image-to-video',
    provider: 'kie',
    mode: 'i2v',
    durations: [5, 8],
    aspectRatios: [],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
    kieParams: { resKey: 'quality', resCase: 'lower', imgStyle: 'urls' },
  },
  // wan2.7 新协议(input.media 数组格式,endpoint=dashscope27)
  // ── Wan 3.0（走 Kie）──────────────────────────────────────
  // 两个端点参数完全一致，仅速度与价格不同:
  //   wan/3-0-video        标准版
  //   wan/3-0-video-prime  高速版
  // 与 2.7 的差异:多 480P 档、默认 1080P、时长 2~30s、比例多 adaptive、
  // 音频是布尔开关 audio(2.7 是 reference_voice 音色)、
  // 参考素材字段带 _urls 后缀且三类各自独立(图 10/视频 5/音频 5)。
  'wan3.0-t2v': {
    name: 'Wan 3.0 文生视频',
    endpoint: 'wan/3-0-video',
    provider: 'kie',
    mode: 't2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true },
  },
  'wan3.0-i2v': {
    name: 'Wan 3.0 图生视频',
    endpoint: 'wan/3-0-video',
    provider: 'kie',
    mode: 'i2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    imageParamName: 'image_url',
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, imgStyle: 'frame' },
  },
  'wan3.0-kf2v': {
    name: 'Wan 3.0 首尾帧',
    endpoint: 'wan/3-0-video',
    provider: 'kie',
    mode: 'firstLastFrame',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    imageParamName: 'image_url',
    endImageParamName: 'end_image_url',
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, imgStyle: 'frame' },
  },
  'wan3.0-r2v': {
    name: 'Wan 3.0 参考内容',
    endpoint: 'wan/3-0-video',
    provider: 'kie',
    mode: 'r2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, refStyle: 'h3' },
  },
  'wan3.0-prime-t2v': {
    name: 'Wan 3.0 文生视频 高速',
    endpoint: 'wan/3-0-video-prime',
    provider: 'kie',
    mode: 't2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true },
  },
  'wan3.0-prime-i2v': {
    name: 'Wan 3.0 图生视频 高速',
    endpoint: 'wan/3-0-video-prime',
    provider: 'kie',
    mode: 'i2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    imageParamName: 'image_url',
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, imgStyle: 'frame' },
  },
  'wan3.0-prime-kf2v': {
    name: 'Wan 3.0 首尾帧 高速',
    endpoint: 'wan/3-0-video-prime',
    provider: 'kie',
    mode: 'firstLastFrame',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    imageParamName: 'image_url',
    endImageParamName: 'end_image_url',
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, imgStyle: 'frame' },
  },
  'wan3.0-prime-r2v': {
    name: 'Wan 3.0 参考内容 高速',
    endpoint: 'wan/3-0-video-prime',
    provider: 'kie',
    mode: 'r2v',
    durations: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30],
    aspectRatios: ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '1080P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'keep', audioBool: true, refStyle: 'h3' },
  },
  'wan2.7-t2v': {
    name: 'Wan 2.7 文生视频',
    endpoint: 'wan/2-7-text-to-video',
    provider: 'kie',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'lower' },
  },
  'wan2.7-i2v': {
    name: 'Wan 2.7 图生视频',
    endpoint: 'wan/2-7-image-to-video',
    provider: 'kie',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
    kieParams: { resCase: 'lower', imgStyle: 'frame' },
  },
  'wan2.7-kf2v': {
    name: 'Wan 2.7 首尾帧',
    endpoint: 'wan/2-7-image-to-video',
    provider: 'kie',
    mode: 'firstLastFrame',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'image_url',
    endImageParamName: 'end_image_url',
    i2vNoAspectRatio: true,
    kieParams: { resCase: 'lower', imgStyle: 'frame' },
  },
  // wan2.7 参考内容(r2v):media reference_image/reference_video
  'wan2.7-r2v': {
    name: 'Wan 2.7 参考内容',
    endpoint: 'wan/2-7-r2v',
    provider: 'kie',
    mode: 'r2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'lower', refStyle: 'wan' },
  },
  // wan2.7 视频编辑:media type=video
  'wan2.7-videoedit': {
    name: 'Wan 2.7 视频编辑',
    endpoint: 'wan/2-7-videoedit',
    provider: 'kie',
    mode: 'videoedit',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'lower' },
  },
  // HappyHorse 首帧(i2v):media first_frame
  'happyhorse-1.0-i2v': {
    name: 'HappyHorse 图生视频',
    endpoint: 'happyhorse-1-1/image-to-video',
    provider: 'kie',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
    kieParams: { resCase: 'lower', imgStyle: 'urls' },
  },
  // HappyHorse 参考内容(r2v)
  'happyhorse-1.0-r2v': {
    name: 'HappyHorse 参考内容',
    endpoint: 'happyhorse-1-1/reference-to-video',
    provider: 'kie',
    mode: 'r2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'lower', refStyle: 'single' },
  },
  // HappyHorse 视频编辑
  'happyhorse-1.0-video-edit': {
    name: 'HappyHorse 视频编辑',
    endpoint: 'dashscope27',
    dashscopeModel: 'happyhorse-1.0-video-edit',
    provider: 'dashscope',
    mode: 'videoedit',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  // HappyHorse 文生视频(阿里云 dashscope-intl,同 wan 账号池)
  'happyhorse-1.0-t2v': {
    name: 'HappyHorse 文生视频',
    endpoint: 'happyhorse-1-1/text-to-video',
    provider: 'kie',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    kieParams: { resCase: 'lower' },
  },
  'wan2.6-t2v': {
    name: 'Wan 2.6 文生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-t2v',
    provider: 'dashscope',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'wan2.5-t2v-preview': {
    name: 'Wan 2.5 文生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.5-t2v-preview',
    provider: 'dashscope',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'wan2.6-i2v': {
    name: 'Wan 2.6 图生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-i2v',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.6-i2v-flash': {
    name: 'Wan 2.6 图生视频 Flash',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-i2v-flash',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.5-i2v-preview': {
    name: 'Wan 2.5 图生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.5-i2v-preview',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.2-kf2v-flash': {
    name: 'Wan 2.2 首尾帧视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.2-kf2v-flash',
    provider: 'dashscope',
    mode: 'firstLastFrame',
    durations: [5],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
    i2vNoAspectRatio: true,
  },
  // 即梦 3.0 Pro（1080P，文生+图生首帧）
  'jimeng-pro-t2v': {
    name: '即梦 3.0 Pro 文生视频',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-pro-i2v': {
    name: '即梦 3.0 Pro 图生视频',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  // 即梦 3.0 720P
  'jimeng-t2v': {
    name: '即梦 3.0 文生视频 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-i2v': {
    name: '即梦 3.0 图生视频首帧 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-first-last': {
    name: '即梦 3.0 首尾帧 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30',
    provider: 'jimeng',
    mode: 'firstLastFrame',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-camera': {
    name: '即梦 3.0 运镜 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_recamera_v30',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsCamera: true,
  },
  // 即梦 3.0 1080P
  'jimeng-1080-t2v': {
    name: '即梦 3.0 文生视频 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30_1080p',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-1080-i2v': {
    name: '即梦 3.0 图生视频首帧 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30_1080',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-1080-first-last': {
    name: '即梦 3.0 首尾帧 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30_1080',
    provider: 'jimeng',
    mode: 'firstLastFrame',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'ovi-i2v': {
    name: 'Ovi 图生视频',
    endpoint: 'fal-ai/ovi/image-to-video',
    mode: 'i2v',
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'none',
    imageParamName: 'image_url',
  },
};

export async function POST(req: NextRequest) {
  let body: any = {};
  let videoPrice = 0;
  try {
    body = await req.json();
    const {
      prompt,
      model,
      aspectRatio,
      duration,
      resolution,
      generateAudio = false,
      startFrameImage,
      endFrameImage,
      refImages,
      refVoices,
      refVideos,
      editVideo,
      userId,
      canvasId,
      cameraTemplate,
      cameraStrength,
    } = body;

    if (!model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const cfg = VIDEO_MODELS[model];
    if (!cfg) {
      return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
    }

    // 提示词必填 —— 但视频升分辨率是后处理，只吃一个视频、没有提示词，
    // 故校验下移到 cfg 之后，按模式放行。
    if (!prompt && cfg.mode !== 'upscale') {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // i2v 模型必须有图片
    if ((cfg.mode === 'i2v' || cfg.mode === 'firstLastFrame') && !startFrameImage) {
      return NextResponse.json({ error: '该模型需要上传图片' }, { status: 400 });
    }

    // ── BYOK：只对 dashscope 模型生效 ────────────────────────────
    // 用户填了阿里云百炼 key → 用他的 key、不扣平台余额、不占池并发
    // 没填 / 非 dashscope 模型 → 走平台池 + 正常扣费（改造前行为完全不变）
    // 注意 jimeng / fal 分支不受影响：userDashscopeKey 只在 dashscope 分支被用到
    //   active  → 用他的 key、不扣平台余额
    //   invalid → 直接报错，绝不回退平台池（否则会悄悄扣他的画布余额）
    //   none    → 走平台池 + 正常扣费（改造前行为）
    //
    // 同一张视频卡片的下拉里混着三个上游，按本次选中模型的 cfg.provider 分流：
    //   jimeng    → volc（即梦，AK/SK 双 key）
    //   dashscope → dashscope（Wan / 快乐马）
    //   fal       → 不开放 BYOK（Pixverse 等）
    // 用户只填了阿里云 key 却选即梦时，byokProvider 是 volc、查不到 → 照常走平台池，不会串。
    const byokProvider: 'volc' | 'dashscope' | null =
      cfg.provider === 'jimeng' ? 'volc'
      : (cfg.provider === 'dashscope' || cfg.endpoint === 'dashscope27') ? 'dashscope'
      : null;

    const authedUserId = byokProvider ? await getAuthedUserId(req) : null;
    const byokLookup = byokProvider
      ? await lookupUserKey(authedUserId, byokProvider)
      : ({ kind: 'none' } as const);

    if (byokLookup.kind === 'invalid') {
      // 此时还没扣费、没提交上游，直接返回即可
      return NextResponse.json(
        { error: userKeyInvalidMessage(byokProvider!, byokLookup.lastError), byokInvalid: true },
        { status: 402 }
      );
    }

    const userByokKey = byokLookup.kind === 'active' ? byokLookup.key : null;
    const useByok = !!userByokKey;
    // 各上游分支只认自己那把，避免拿错 provider 的 key
    const userDashscopeKey = byokProvider === 'dashscope' ? userByokKey : null;
    const userVolcKey = byokProvider === 'volc' ? userByokKey : null;

    // ── 扣费（BYOK 跳过：用户在阿里云控制台自付）──────────────────
    if (userId && !useByok) {
      // 先查会员状态
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('is_member, member_expires_at')
        .eq('id', userId)
        .single();
      const isMember = !!(
        userData?.is_member &&
        userData?.member_expires_at &&
        new Date(userData.member_expires_at) > new Date()
      );

      // OVI 按次，其余按秒
      if (model === 'ovi-i2v') {
        videoPrice = OVI_PRICE;
      } else {
        const res = (resolution || cfg.defaultResolution).toUpperCase();
        videoPrice = calcVideoPrice(model, res, Number(duration) || 5, isMember, generateAudio === true);
      }

      const deduct = await deductBalance(
        userId, videoPrice, 'video_deduct',
        `视频生成 - ${cfg.name}`,
        { model, duration, resolution, generateAudio },
      );
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    // 构建 fal 输入参数
    const input: Record<string, unknown> = { prompt };

    // 时长
    if (cfg.durationFormat === 'seconds' && duration) {
      input.duration = `${duration}s`;
    } else if (cfg.durationFormat === 'number' && duration) {
      input.duration = String(duration);
    }

    // 比例：i2v/firstLastFrame 用 "auto"，t2v 用用户选的
    if (cfg.mode === 't2v' && cfg.aspectRatios.length > 0 && aspectRatio) {
      input.aspect_ratio = aspectRatio;
    } else if ((cfg.mode === 'i2v' || cfg.mode === 'firstLastFrame') && !cfg.i2vNoAspectRatio) {
      input.aspect_ratio = 'auto';
    }

    // 分辨率
    // 升分辨率模型除外:它的 resolutions(1080P/2K/4K)只是给用户看的说法，
    // 上游没有 resolution 参数，只有浮点 upscale_factor(下方单独处理)。
    if (cfg.resolutions.length > 0 && resolution && cfg.mode !== 'upscale') {
      input.resolution = resolution;
    }

    // 音频（有开关的模型才传，用户主动开启才传 true）
    if (cfg.supportsAudio && !cfg.audioBuiltIn) {
      input.generate_audio = generateAudio === true;
    }

    // Pixverse:自带音频(无开关),显式开启音频生成(参数名 generate_audio_switch,默认false)
    if (cfg.endpoint.includes('pixverse')) {
      input.generate_audio_switch = true;
    }

    // Veo 系列安全等级（字符串类型）+ auto_fix
    if (cfg.endpoint.includes('veo')) {
      input.safety_tolerance = '4';
      input.auto_fix = true;
    }

    // 图片参数 - base64 先上传到 Storage 变成公开 URL
    const toPublicUrl = async (base64: string): Promise<string> => {
      if (!base64 || !base64.startsWith('data:')) return base64;
      const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return base64;
      const mimeType = match[1];
      const ext = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(match[2], 'base64');
      const filename = `frames/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabaseAdmin.storage.from('assets').upload(filename, buffer, { contentType: mimeType, upsert: false });
      if (error) throw new Error(`上传帧图片失败: ${error.message}`);
      const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
      return data.publicUrl;
    };

    if (cfg.mode === 'i2v' && cfg.imageParamName && startFrameImage) {
      input[cfg.imageParamName] = await toPublicUrl(startFrameImage);
    }
    if (cfg.mode === 'firstLastFrame') {
      if (!startFrameImage || !endFrameImage) {
        return NextResponse.json({ error: '该模型需要同时上传首帧和尾帧图片' }, { status: 400 });
      }
      if (cfg.imageParamName) input[cfg.imageParamName] = await toPublicUrl(startFrameImage);
      if (cfg.endImageParamName) input[cfg.endImageParamName] = await toPublicUrl(endFrameImage);
    }

    // FLUX 3 扩展视频：走 fal，需要传入待扩展的视频 URL
    // （其他 videoedit 模型走 dashscope 的 media 数组，与此无关）
    if (cfg.endpoint.startsWith('blackforestlabs/flux-3/extend-video')) {
      if (!editVideo) {
        return NextResponse.json({ error: '扩展视频需要先上传一个视频' }, { status: 400 });
      }
      input.video_url = editVideo;
    }

    // FLUX 视频升分辨率：只吃视频 + 倍率，其余生成参数一概不传
    if (cfg.mode === 'upscale') {
      if (!editVideo) {
        return NextResponse.json({ error: '升分辨率需要先上传一个视频' }, { status: 400 });
      }
      const vUrl = await toPublicUrl(editVideo);
      input.video_url = vUrl || editVideo;

      // 上游只有浮点倍率，没有分辨率枚举 —— 用目标高度 / 输入高度换算。
      // 输入高度由前端随请求带上(取不到时按 720p 估，2 倍是上游默认值)。
      const targetH = resolution === '4K' ? 2160 : resolution === '2K' ? 1440 : 1080;
      const srcH = Number((body as any).sourceHeight) || 720;
      // 倍率夹在 [1, 4]:低于 1 是缩小(无意义)，高于 4 上游会拒
      const factor = Math.min(4, Math.max(1, targetH / srcH));
      input.upscale_factor = Number(factor.toFixed(2));

      input.creativity = 0;   // 固定精确模式(不做创意增强，故不传 prompt)
      delete input.prompt;
      delete input.generate_audio;
      delete input.aspect_ratio;
      delete input.duration;
    }

    // FLUX 3：自带音频生成（默认 true），安全等级用较宽松的 3
    if (cfg.endpoint.startsWith('blackforestlabs/flux-3/')) {
      input.generate_audio = true;
      input.safety_tolerance = 3;
    }
    let taskId: string;
    let taskEndpoint: string;
    let taskKeyId: string | null = null;   // dashscope 任务必须用创建它的同一 key 查询

    // ========================================================================
    // Kie 通道（MiniMax H3）
    // ========================================================================
    // 与 Seedance 走同一套 createTask/recordInfo 接口，但参数名不同：
    //   分辨率是 768P/2K（大写 P）、时长只能 4/6/10、图生用 image_url 单值、
    //   参考生视频用 reference_image_urls / reference_video_urls / reference_audio_urls
    // cfg.endpoint 存的是 Kie 模型 ID（如 minimax-h3/text-to-video）
    if (cfg.provider === 'kie') {
      const kieKeyInfo = await pickKey('kie');
      let kieSuccess = false;
      let kieErr: any = null;
      let kieData: any;
      try {
        // 各模型参数形态不同，用 cfg.kieParams 描述；不设则沿用 H3 的形态
        const kp = cfg.kieParams ?? {};
        const resKey = kp.resKey ?? 'resolution';
        const resCase = kp.resCase ?? 'upper';
        const imgStyle = kp.imgStyle ?? 'single';
        const refStyle = kp.refStyle ?? 'h3';

        const rawRes = (resolution || cfg.defaultResolution).toLowerCase();
        // H3 要大写(768P / 2K)，Wan 2.7 / 快乐马 / Pixverse 用小写(720p / 1080p)，
        // Wan 3.0 用大写档位名(480P / 720P / 1080P)，原样传即可
        const resValue = resCase === 'keep'
          ? (resolution || cfg.defaultResolution).toUpperCase()
          : resCase === 'upper'
          ? (rawRes === '2k' ? '2K' : '768P')
          : rawRes;

        const kieInput: Record<string, unknown> = {
          prompt: prompt || undefined,
          duration: Number(duration) || cfg.durations[0],
          [resKey]: resValue,
        };
        if (aspectRatio && cfg.aspectRatios.length > 0) kieInput.aspect_ratio = aspectRatio;
        // Wan 3.0：音频是布尔开关(上游默认 true)，按前端开关显式传
        if (kp.audioBool) kieInput.audio = !!generateAudio;

        if (cfg.mode === 'i2v' || cfg.mode === 'firstLastFrame') {
          const first = await toPublicUrl(input[cfg.imageParamName || 'image_url'] as string);
          if (!first) throw new Error('首帧图片处理失败');
          if (imgStyle === 'frame') {
            // Wan：首帧与尾帧分开传，同一端点既做首帧也做首尾帧
            kieInput.first_frame_url = first;
            if (cfg.mode === 'firstLastFrame' && cfg.endImageParamName) {
              const last = await toPublicUrl(input[cfg.endImageParamName] as string);
              if (!last) throw new Error('尾帧图片处理失败');
              kieInput.last_frame_url = last;
            }
          } else if (imgStyle === 'urls') {
            kieInput.image_urls = [first];   // 快乐马 / Pixverse
          } else {
            kieInput.image_url = first;      // H3
          }
        } else if (cfg.mode === 'r2v') {
          const imgs: string[] = [];
          for (const raw of (Array.isArray(refImages) ? refImages : [])) {
            const u = await toPublicUrl(raw);
            if (u) imgs.push(u);
          }
          const vids: string[] = [];
          for (const raw of (Array.isArray(refVideos) ? refVideos : [])) {
            const u = await toPublicUrl(raw);
            if (u) vids.push(u);
          }
          const auds: string[] = [];
          for (const raw of (Array.isArray(refVoices) ? refVoices : [])) {
            const u = await toPublicUrl(raw);
            if (u) auds.push(u);
          }
          if (imgs.length === 0 && vids.length === 0) {
            throw new Error('参考生视频需要至少一张参考图或一个参考视频');
          }
          if (refStyle === 'wan') {
            // Wan 2.7：字段无 _urls 后缀，音频是单值"音色"(reference_voice)
            if (imgs.length > 0) kieInput.reference_image = imgs;
            if (vids.length > 0) kieInput.reference_video = vids;
            if (auds.length > 0) kieInput.reference_voice = auds[0];
          } else if (refStyle === 'single') {
            // 快乐马：只支持参考图
            if (imgs.length > 0) kieInput.reference_image = imgs;
          } else {
            // H3：三类各自数组；音频不能单独使用，必须配合图或视频(上游硬约束)
            if (imgs.length > 0) kieInput.reference_image_urls = imgs;
            if (vids.length > 0) kieInput.reference_video_urls = vids;
            if (auds.length > 0) kieInput.reference_audio_urls = auds;
          }
        } else if (cfg.mode === 'videoedit') {
          // Wan 2.7 视频编辑：传待编辑的视频 URL
          if (!editVideo) throw new Error('视频编辑需要先上传一个视频');
          const u = await toPublicUrl(editVideo);
          kieInput.video_url = u || editVideo;
        }

        const kRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieKeyInfo.keyValue}`,
          },
          body: JSON.stringify({ model: cfg.endpoint, input: kieInput }),
        });
        kieData = await kRes.json();
        console.log('Kie(H3) 提交结果:', JSON.stringify(kieData).slice(0, 300));

        // Kie 用 body 里的 code 表达错误，HTTP 状态可能仍是 200
        if (!kRes.ok || kieData?.code !== 200) {
          const code = kieData?.code ?? kRes.status;
          kieErr = new Error(
            code === 429 ? '当前生成请求过多，请稍等几秒再试'
              : (kieData?.msg || kieData?.message || '提交失败')
          );
          (kieErr as any).status = code;
          throw kieErr;
        }
        kieSuccess = true;
      } catch (err) {
        if (!kieErr) kieErr = err;
        throw err;
      } finally {
        await releaseKey(kieKeyInfo, kieSuccess, kieSuccess ? undefined : categorizeError(kieErr), kieErr ? String(kieErr?.message || kieErr) : undefined);
      }

      taskId = kieData?.data?.taskId;
      if (!taskId) throw new Error('未返回任务ID');
      // 用中性代号，不在前端暴露上游供应商
      taskEndpoint = 'c2';
      taskKeyId = null;

    } else if (cfg.provider === 'jimeng') {
      // 即梦 火山引擎 API（BYOK 优先，否则平台账号池取一组双 key）
      // 两种情况都是"一组 AK/SK 动态创建 volcService"，只是 key 来源不同
      const jmKeyInfo: KeyInfo = userVolcKey
        ? userKeyToKeyInfo(userVolcKey, 'volc')
        : await pickKey('volc');
      const jmVolcService = new Service({
        host: 'visual.volcengineapi.com',
        region: 'cn-north-1',
        serviceName: 'cv',
        accessKeyId: jmKeyInfo.keyValue,
        secretKey: jmKeyInfo.secondaryValue || '',
      });
      const jmSubmit = jmVolcService.createJSONAPI('CVSync2AsyncSubmitTask', { Version: '2022-08-31' });

      let jmSuccess = false;
      let jmErr: any = null;
      try {
      const jmBody: Record<string, unknown> = {
        req_key: cfg.jimengReqKey,
        prompt,
        seed: -1,
      };

      // 时长转帧数：5s=121帧，10s=241帧
      if (duration) jmBody.frames = Number(duration) === 10 ? 241 : 121;

      // 比例（仅 t2v）
      if (cfg.mode === 't2v' && aspectRatio) jmBody.aspect_ratio = aspectRatio;

      // 图片（i2v 首帧）
      if (cfg.mode === 'i2v' && startFrameImage) {
        const url = await toPublicUrl(startFrameImage);
        jmBody.image_urls = [url];
      }

      // 首尾帧
      if (cfg.mode === 'firstLastFrame') {
        const startUrl = await toPublicUrl(startFrameImage);
        const endUrl   = await toPublicUrl(endFrameImage);
        jmBody.image_urls = [startUrl, endUrl];
      }

      // 运镜模式额外参数
      if (cfg.supportsCamera) {
        jmBody.template_id = cameraTemplate || 'dynamic_orbit';
        jmBody.camera_strength = cameraStrength || 'medium';
      }

      const jmRes = await jmSubmit(jmBody) as any;
      console.log('即梦提交结果:', JSON.stringify(jmRes).slice(0, 500));

      if (jmRes?.code !== 10000) {
        jmErr = new Error(`即梦提交失败: ${jmRes?.message || JSON.stringify(jmRes)}`);
        throw jmErr;
      }
      taskId = jmRes?.data?.task_id;
      if (!taskId) {
        jmErr = new Error(`即梦未返回 task_id: ${JSON.stringify(jmRes)}`);
        throw jmErr;
      }
      taskEndpoint = `jimeng:${cfg.jimengReqKey}`;
      jmSuccess = true;
      } catch (err) {
        if (!jmErr) jmErr = err;
        throw err;
      } finally {
        await releaseUserAwareKey(jmKeyInfo, jmSuccess, jmSuccess ? undefined : categorizeError(jmErr), jmErr ? String(jmErr?.message || jmErr) : undefined);
      }

    } else if (cfg.endpoint === 'dashscope27') {
      // wan2.7 新协议：input.media 数组格式（与旧版 input.image_url 不同）
      // BYOK：有用户 key 用他的（上面已读出，不重复查库），否则走平台池
      const dsKeyInfo: KeyInfo = userDashscopeKey
        ? userKeyToKeyInfo(userDashscopeKey, 'dashscope')
        : await pickKey('dashscope');
      let dsSuccess = false;
      let dsErr: any = null;
      try {
        const media: Record<string, string>[] = [];
        if (cfg.mode === 'r2v') {
          // 参考内容:参考图 reference_image + 参考视频 reference_video(总≤5)
          const imgs: string[] = Array.isArray(refImages) ? refImages : [];
          const vids: string[] = Array.isArray(refVideos) ? refVideos : [];
          // 音色仅 wan2.7-r2v 支持:按参考素材顺序(图先视频后)依次分配 refVoices
          const isWan27R2v = cfg.dashscopeModel === 'wan2.7-r2v';
          const voicePool: string[] = isWan27R2v && Array.isArray(refVoices) ? [...refVoices] : [];
          let voiceIdx = 0;
          for (const u of imgs) {
            const url = await toPublicUrl(u);
            if (!url) continue;
            const item: Record<string, string> = { type: 'reference_image', url };
            const voice = voicePool[voiceIdx++];
            if (voice) {
              const voiceUrl = await toPublicUrl(voice);
              if (voiceUrl) item.reference_voice = voiceUrl;
            }
            media.push(item);
          }
          for (const u of vids) {
            const url = await toPublicUrl(u);
            if (!url) continue;
            const item: Record<string, string> = { type: 'reference_video', url };
            const voice = voicePool[voiceIdx++];
            if (voice) {
              const voiceUrl = await toPublicUrl(voice);
              if (voiceUrl) item.reference_voice = voiceUrl;
            }
            media.push(item);
          }
          if (media.length === 0) {
            return NextResponse.json({ error: '参考内容模式需至少一张参考图或一个参考视频' }, { status: 400 });
          }
        } else if (cfg.mode === 'videoedit') {
          // 视频编辑:待编辑视频 type=video
          if (!editVideo) {
            return NextResponse.json({ error: '视频编辑模式需上传待编辑视频' }, { status: 400 });
          }
          const url = await toPublicUrl(editVideo);
          media.push({ type: 'video', url });
        } else {
          // i2v/firstLastFrame:首帧/尾帧
          const firstFrame = input['image_url'] || input['img_url'];
          if (firstFrame) media.push({ type: 'first_frame', url: firstFrame as string });
          const lastFrame = input['end_image_url'];
          if (lastFrame) media.push({ type: 'last_frame', url: lastFrame as string });
        }

        const dsInput: Record<string, unknown> = { prompt };
        if (media.length > 0) dsInput.media = media;

        const dsParams: Record<string, unknown> = { prompt_extend: true };
        if (duration) dsParams.duration = Number(duration);
        if (resolution) dsParams.resolution = resolution;

        // BYOK 时按用户填的站点切 baseURL；平台池恒为国际站（改造前行为）
        const dsRes = await fetch(
          `${dashscopeHost(dsKeyInfo.region)}/api/v1/services/aigc/video-generation/video-synthesis`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${dsKeyInfo.keyValue}`,
              'Content-Type': 'application/json',
              'X-DashScope-Async': 'enable',
            },
            body: JSON.stringify({
              model: cfg.dashscopeModel,
              input: dsInput,
              parameters: dsParams,
            }),
          }
        );

        if (!dsRes.ok) {
          const err = await dsRes.text();
          dsErr = new Error(`wan2.7 提交失败: ${err}`);
          (dsErr as any).status = dsRes.status;
          throw dsErr;
        }

        const dsData = await dsRes.json();
        taskId = dsData.output?.task_id;
        if (!taskId) {
          dsErr = new Error(`wan2.7 未返回 task_id: ${JSON.stringify(dsData)}`);
          throw dsErr;
        }
        taskEndpoint = `dashscope:${cfg.dashscopeModel}`;
        taskKeyId = dsKeyInfo.keyId;
        dsSuccess = true;
      } catch (err) {
        if (!dsErr) dsErr = err;
        throw err;
      } finally {
        await releaseUserAwareKey(dsKeyInfo, dsSuccess, dsSuccess ? undefined : categorizeError(dsErr), dsErr ? String(dsErr?.message || dsErr) : undefined);
      }

    } else if (cfg.provider === 'dashscope') {
      // DashScope 官方 API（BYOK 优先，否则平台账号池）
      const dsKeyInfo: KeyInfo = userDashscopeKey
        ? userKeyToKeyInfo(userDashscopeKey, 'dashscope')
        : await pickKey('dashscope');
      let dsSuccess = false;
      let dsErr: any = null;
      try {
      const dsInput: Record<string, unknown> = { prompt };
      const dsParams: Record<string, unknown> = { prompt_extend: true };

      if (cfg.mode === 'i2v' && cfg.imageParamName) {
        dsInput[cfg.imageParamName] = input[cfg.imageParamName];
      }
      if (cfg.mode === 'firstLastFrame') {
        if (cfg.imageParamName) dsInput[cfg.imageParamName] = input[cfg.imageParamName];
        if (cfg.endImageParamName) dsInput[cfg.endImageParamName] = input[cfg.endImageParamName];
      }

      if (duration) dsParams.duration = Number(duration);
      if (resolution) dsParams.resolution = resolution;
      if (cfg.dashscopeModel?.startsWith('wan2.6')) {
        dsParams.audio = generateAudio === true;
      }

      const dsTask = cfg.dashscopeModel?.includes('kf2v') ? 'image2video' : 'video-generation';
      // BYOK 时按用户填的站点切 baseURL；平台池恒为国际站（改造前行为）
      const dsRes = await fetch(
        `${dashscopeHost(dsKeyInfo.region)}/api/v1/services/aigc/${dsTask}/video-synthesis`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dsKeyInfo.keyValue}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: cfg.dashscopeModel,
            input: dsInput,
            parameters: dsParams,
          }),
        }
      );

      if (!dsRes.ok) {
        const err = await dsRes.text();
        dsErr = new Error(`DashScope 提交失败: ${err}`);
        (dsErr as any).status = dsRes.status;
        throw dsErr;
      }

      const dsData = await dsRes.json();
      taskId = dsData.output?.task_id;
      if (!taskId) {
        dsErr = new Error(`DashScope 未返回 task_id: ${JSON.stringify(dsData)}`);
        throw dsErr;
      }
      taskEndpoint = `dashscope:${cfg.dashscopeModel}`;
      taskKeyId = dsKeyInfo.keyId;
      dsSuccess = true;
      } catch (err) {
        if (!dsErr) dsErr = err;
        throw err;
      } finally {
        await releaseUserAwareKey(dsKeyInfo, dsSuccess, dsSuccess ? undefined : categorizeError(dsErr), dsErr ? String(dsErr?.message || dsErr) : undefined);
      }

    } else {
      // fal 队列（账号池）
      const keyInfo = await pickKey('fal');
      const fal = createFalClient({ credentials: keyInfo.keyValue });
      let falSuccess = false;
      let falErr: any = null;
      try {
        const { request_id } = await fal.queue.submit(cfg.endpoint, { input });
        taskId = request_id;
        taskEndpoint = cfg.endpoint;
        falSuccess = true;
      } catch (err) {
        falErr = err;
        throw err;
      } finally {
        await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
      }
    }

    // 写入数据库记录
    if (userId) {
      await supabaseAdmin.from('video_generations').insert({
        user_id: userId,
        canvas_id: canvasId || null,
        prompt,
        model,
        duration: duration || null,
        resolution: resolution ? resolution.toLowerCase() : null,
        aspect_ratio: aspectRatio || null,
        generate_audio: generateAudio,
        video_mode: cfg.mode === 'firstLastFrame' ? 'first-last-frame' : cfg.mode === 'i2v' ? 'first-frame' : 'text',
        // 只存 URL，不存 base64(base64 会把整张图塞进数据库，撑爆表)。
        // 已上传的场景优先取转换后的 URL；若原值是 base64 则不存(记 null)。
        input_image_url: (startFrameImage && !startFrameImage.startsWith('data:')) ? startFrameImage : ((input[cfg.imageParamName || ''] as string) || null),
        end_image_url: (endFrameImage && !endFrameImage.startsWith('data:')) ? endFrameImage : ((input[cfg.endImageParamName || ''] as string) || null),
        status: 'processing',
        task_id: taskId,
        endpoint: taskEndpoint,
        cost_credits: 0,
      });
    }

    return NextResponse.json({
      success: true,
      taskId,
      endpoint: taskEndpoint,
      keyId: taskKeyId,
      // byok=true 时前端轮询要带上，query 才知道该用用户 key 而不是平台池
      byok: useByok,
      status: 'queued',
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    // 生成失败退款
    if (body?.userId && videoPrice > 0) {
      await refundBalance(body.userId, videoPrice, `视频生成失败退款 - ${body.model}`, { model: body.model });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
