// ============================================================
// 定价配置
// 会员价 = 成本 + 0.4元/秒，普通价 = 成本 + 0.6元/秒
// 图片按次计费，会员/普通同价
// ============================================================

export const MEMBERSHIP_PRICE = 115; // 元/月

// ============================================================
// 图片定价（按次，会员/普通同价）
// ============================================================
export const IMAGE_PRICING: Record<string, number> = {
  'nano-banana':          0.5,
  'nano-banana-pro-2k':   0.7,
  'nano-banana-pro-4k':   1.5,
  'flux-kontext':         0.6,
  'flux-kontext-max':     1.0,
  'midjourney':           0.6,
  'doubao-seedream':      0.3,
  'nano-banana-pro-multi-2k': 1.5,
  'nano-banana-pro-multi-4k': 2.5,
};

// ============================================================
// OVI（按次，会员/普通同价）
// ============================================================
export const OVI_PRICE = 1.78;

// ============================================================
// 视频定价（按秒）
// costPerSec: 成本/秒
// memberMarkup: 会员加价/秒（固定 0.4）
// normalMarkup: 普通加价/秒（固定 0.6）
// fixedSeconds: 固定时长（仅 wan2.2-kf2v-flash）
// hasAudio: 是否区分有声/无声
// ============================================================

export interface VideoTierPrice {
  costPerSec: number;
  memberPerSec: number;
  normalPerSec: number;
}

export interface VideoModelPrice {
  resolutions: Record<string, VideoTierPrice>;
  fixedSeconds?: number; // 固定时长，不传则按实际秒数
  audioVariants?: boolean; // true = 有声/无声分开定价，key 用 "720P_audio" / "720P"
}

const MEMBER_MARKUP = 0.4;
const NORMAL_MARKUP = 0.6;

function tier(costPerSec: number): VideoTierPrice {
  return {
    costPerSec,
    memberPerSec: costPerSec + MEMBER_MARKUP,
    normalPerSec: costPerSec + NORMAL_MARKUP,
  };
}

export const VIDEO_PRICING: Record<string, VideoModelPrice> = {

  // ── 即梦 3.0 ──────────────────────────────────────────────
  'jimeng-t2v': {
    resolutions: { '720P': tier(0.28) },
  },
  'jimeng-1080-t2v': {
    resolutions: { '1080P': tier(0.63) },
  },
  'jimeng-i2v': {
    resolutions: { '720P': tier(0.28) },
  },
  'jimeng-1080-i2v': {
    resolutions: { '1080P': tier(0.63) },
  },
  'jimeng-first-last': {
    resolutions: { '720P': tier(0.28) },
  },
  'jimeng-1080-first-last': {
    resolutions: { '1080P': tier(0.63) },
  },
  'jimeng-camera': {
    resolutions: { '720P': tier(0.28) }, // 运镜同 720P 标准价
  },

  // ── 即梦 3.0 Pro ──────────────────────────────────────────
  'jimeng-pro-t2v': {
    resolutions: { '1080P': tier(1.00) },
  },
  'jimeng-pro-i2v': {
    resolutions: { '1080P': tier(1.00) },
  },

  // ── Wan 2.5 ───────────────────────────────────────────────
  'wan2.5-t2v-preview': {
    resolutions: {
      '480P':  tier(0.30),
      '720P':  tier(0.60),
      '1080P': tier(1.00),
    },
  },
  'wan2.5-i2v-preview': {
    resolutions: {
      '480P':  tier(0.30),
      '720P':  tier(0.60),
      '1080P': tier(1.00),
    },
  },

  // ── Wan 2.6 ───────────────────────────────────────────────
  'wan2.6-t2v': {
    resolutions: {
      '720P':  tier(0.60),
      '1080P': tier(1.00),
    },
  },
  'wan2.6-i2v': {
    resolutions: {
      '720P':  tier(0.60),
      '1080P': tier(1.00),
    },
  },

  // ── Wan 2.6 Flash（有声/无声分开）────────────────────────
  // key 规则：分辨率 + "_audio" 表示有声版
  'wan2.6-i2v-flash': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.15), // 无声
      '720P_audio':  tier(0.30), // 有声
      '1080P':       tier(0.25), // 无声
      '1080P_audio': tier(0.50), // 有声
    },
  },

  // ── Wan 2.2 首尾帧 Flash（固定5秒）──────────────────────
  'wan2.2-kf2v-flash': {
    fixedSeconds: 5,
    resolutions: {
      '480P':  tier(0.10),
      '720P':  tier(0.20),
      '1080P': tier(0.48),
    },
  },

  // ── Veo 3.1 系列（有声/无声分开）────────────────────────
  'veo3.1-t2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(1.38),
      '1080P':       tier(1.38),
      '720P_audio':  tier(2.76),
      '1080P_audio': tier(2.76),
      '4K':          tier(2.76),
      '4K_audio':    tier(4.14),
    },
  },
  'veo3.1-i2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(1.38),
      '1080P':       tier(1.38),
      '720P_audio':  tier(2.76),
      '1080P_audio': tier(2.76),
      '4K':          tier(2.76),
      '4K_audio':    tier(4.14),
    },
  },
  'veo3.1-fast-t2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.69),
      '1080P':       tier(0.69),
      '720P_audio':  tier(1.035),
      '1080P_audio': tier(1.035),
      '4K':          tier(2.07),
      '4K_audio':    tier(2.415),
    },
  },
  'veo3.1-fast-i2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.69),
      '1080P':       tier(0.69),
      '720P_audio':  tier(1.035),
      '1080P_audio': tier(1.035),
      '4K':          tier(2.07),
      '4K_audio':    tier(2.415),
    },
  },
  'veo3.1-first-last': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.69),
      '1080P':       tier(0.69),
      '720P_audio':  tier(1.035),
      '1080P_audio': tier(1.035),
      '4K':          tier(2.07),
      '4K_audio':    tier(2.415),
    },
  },
};

// ============================================================
// 计算视频费用
// ============================================================
export function calcVideoPrice(
  modelKey: string,
  resolution: string,
  durationSeconds: number,
  isMember: boolean,
  hasAudio = false,
): number {
  // OVI 按次
  if (modelKey === 'ovi-i2v') return OVI_PRICE;

  const model = VIDEO_PRICING[modelKey];
  if (!model) return 0;

  const seconds = model.fixedSeconds ?? durationSeconds;
  const resKey = model.audioVariants && hasAudio ? `${resolution}_audio` : resolution;
  const prices = model.resolutions[resKey] ?? model.resolutions[resolution];
  if (!prices) return 0;

  const perSec = isMember ? prices.memberPerSec : prices.normalPerSec;
  return Math.round(perSec * seconds * 100) / 100;
}

// ============================================================
// 计算图片费用
// ============================================================
export function calcImagePrice(modelKey: string): number {
  return IMAGE_PRICING[modelKey] ?? 1.0;
}
