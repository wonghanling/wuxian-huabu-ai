// ============================================================
// 定价配置
// 会员价 = 成本 + 0.4元/秒，普通价 = 成本 + 0.6元/秒
// 图片按次计费，会员/普通同价
// ============================================================

export const MEMBERSHIP_PRICE = 39; // 元/月

// ============================================================
// 图片定价（按次，会员/普通同价）
// ============================================================
export const IMAGE_PRICING: Record<string, number> = {
  'nano-banana':          0.5,
  'virtual-try-on':       0.3,   // 虚拟试衣(fal image-apps-v2)
  'nano-banana-pro-2k':   1.0,
  'nano-banana-pro-4k':   1.2,
  'flux-kontext':         0.6,
  'flux-kontext-max':     1.0,
  'midjourney':           0.6,
  'mj_imagine':           0.6,
  'mj_imagine_v7':        0.6,
  'mj_niji_7':            0.6,
  'doubao-seedream':      0.3,
  'doubao-seedream-4-5-251128': 0.7,
  'nano-banana-pro-multi-2k': 1.1,
  'nano-banana-pro-multi-4k': 2.2,
  // GPT Image 2 medium
  'gpt-image-2-medium-1920x1080': 0.5,
  'gpt-image-2-medium-1080x1920': 0.5,
  'gpt-image-2-medium-1080x1080': 0.5,
  'gpt-image-2-medium-2048x1152': 0.4,
  'gpt-image-2-medium-3840x2160': 0.9,
  'gpt-image-2-medium-2160x3840': 0.9,
  'gpt-image-2-medium-2048x2048': 0.5,
  // GPT Image 2 high
  'gpt-image-2-high-1920x1080': 1.2,
  'gpt-image-2-high-1080x1920': 1.2,
  'gpt-image-2-high-1080x1080': 1.2,
  'gpt-image-2-high-2048x1152': 1.2,
  'gpt-image-2-high-3840x2160': 3.1,
  'gpt-image-2-high-2160x3840': 3.1,
  'gpt-image-2-high-2048x2048': 1.7,

  // Flux 2 Pro 文生图(售卖价,会员普通同价;wide=16:9/9:16, square=1:1)
  'flux-2-pro-1080-wide':   0.53,
  'flux-2-pro-1080-square': 0.42,
  'flux-2-pro-2k-wide':     0.53,
  'flux-2-pro-2k-square':   0.75,
  'flux-2-pro-4k-wide':     1.29,
  'flux-2-pro-4k-square':   2.04,
  // Flux 2 Pro 图生图(edit)
  'flux-2-pro-edit-1080-wide':   0.75,
  'flux-2-pro-edit-1080-square': 0.53,
  'flux-2-pro-edit-2k-wide':     0.75,
  'flux-2-pro-edit-2k-square':   1.18,
  'flux-2-pro-edit-4k-wide':     2.26,
  'flux-2-pro-edit-4k-square':   3.88,

  // Design Workflow（设计编辑能力）
  'ideogram-v3-turbo':    0.3,   // 局部重绘 快速
  'ideogram-v3-balanced': 0.5,   // 局部重绘 标准
  'ideogram-v3-quality':  0.7,   // 局部重绘 高质量
  'flux-fill':            1.7,   // Flux Fill 专业
  'gpt-edit-low':         0.15,  // GPT 编辑 低质量
  'gpt-edit-medium':      0.5,   // GPT 编辑 中质量
  'gpt-edit-high':        1.6,   // GPT 编辑 高质量
  'remove':               0.3,   // 删除对象
  'replace':              0.5,   // 替换
  'expand':               0.3,   // 扩图
  'bg-replace':           0.3,   // 换背景
  'text-layer':           0.7,   // 海报文字编辑
  'extract':              0,     // 抠图(免费)
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

// 统一加价规则：会员 = 成本 + 0.2/秒，普通 = 成本 + 0.4/秒
// （即梦 / Wan / Veo / Seedance 全部统一，方便计算）
const MEMBER_MARKUP = 0.2;
const NORMAL_MARKUP = 0.4;

function tier(costPerSec: number): VideoTierPrice {
  return {
    costPerSec,
    memberPerSec: Math.round((costPerSec + MEMBER_MARKUP) * 100) / 100,
    normalPerSec: Math.round((costPerSec + NORMAL_MARKUP) * 100) / 100,
  };
}

// Seedance 历史别名：与 tier 同规则（+0.2 会员 / +0.4 普通），保留以兼容旧引用
function tierSeedance(costPerSec: number): VideoTierPrice {
  return tier(costPerSec);
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
  // 成本来自阿里云百炼官方价(无音频选项)
  'wan2.6-t2v': {
    resolutions: {
      '720P':  tier(0.70), // 会员1.10 / 普通1.30
      '1080P': tier(1.10), // 会员1.50 / 普通1.70
    },
  },
  'wan2.6-i2v': {
    resolutions: {
      '720P':  tier(0.60), // 会员1.00 / 普通1.20
      '1080P': tier(1.00), // 会员1.40 / 普通1.60
    },
  },

  // ── Wan 2.6 Flash（仅此型号有有声/无声之分）──────────────
  // key 规则：分辨率 + "_audio" 表示有声版
  'wan2.6-i2v-flash': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.15), // 无声 会员0.55/普通0.75
      '720P_audio':  tier(0.30), // 有声 会员0.70/普通0.90
      '1080P':       tier(0.25), // 无声 会员0.65/普通0.85
      '1080P_audio': tier(0.50), // 有声 会员0.90/普通1.10
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

  // ── Wan 2.7（新协议,成本¥0.73/s 720P / ¥1.10/s 1080P）──
  'wan2.7-t2v': {
    resolutions: {
      '720P':  tier(0.73),
      '1080P': tier(1.10),
    },
  },
  'wan2.7-i2v': {
    resolutions: {
      '720P':  tier(0.73),  // 会员¥0.93 / 普通¥1.13
      '1080P': tier(1.10),  // 会员¥1.30 / 普通¥1.50
    },
  },
  'wan2.7-kf2v': {
    resolutions: {
      '720P':  tier(0.73),
      '1080P': tier(1.10),
    },
  },
  'wan2.7-r2v': {
    resolutions: {
      '720P':  tier(0.73),
      '1080P': tier(1.10),
    },
  },
  'wan2.7-videoedit': {
    resolutions: {
      '720P':  tier(0.73),
      '1080P': tier(1.10),
    },
  },

  // ── HappyHorse（成本¥1.05/s 720P / ¥1.80/s 1080P）──────
  'happyhorse-1.0-t2v': {
    resolutions: {
      '720P':  tier(1.05),  // 会员¥1.25 / 普通¥1.45
      '1080P': tier(1.80),  // 会员¥2.00 / 普通¥2.20
    },
  },
  'happyhorse-1.0-i2v': {
    resolutions: {
      '720P':  tier(1.05),
      '1080P': tier(1.80),
    },
  },
  'happyhorse-1.0-r2v': {
    resolutions: {
      '720P':  tier(1.05),
      '1080P': tier(1.80),
    },
  },
  'happyhorse-1.0-video-edit': {
    resolutions: {
      '720P':  tier(1.05),
      '1080P': tier(1.80),
    },
  },

  // ── Seedance 2.0（新规则：成本+0.2会员 / +0.4普通）────────
  // 有声 = 无声成本 + 0.2/秒（音频额外成本）
  'doubao-seedance-2-0-260128': {
    audioVariants: true,
    resolutions: {
      '480p':        tierSeedance(0.51), // 会员 0.71 / 普通 0.91
      '480p_audio':  tierSeedance(0.71), // 会员 0.91 / 普通 1.11
      '720p':        tierSeedance(1.09), // 会员 1.29 / 普通 1.49
      '720p_audio':  tierSeedance(1.29), // 会员 1.49 / 普通 1.69
      '1080p':       tierSeedance(2.61), // 会员 2.81 / 普通 3.01
      '1080p_audio': tierSeedance(2.81), // 会员 3.01 / 普通 3.21
    },
  },
  // ── Seedance 2.0 Fast（新规则）────────────────────────────
  'doubao-seedance-2-0-fast-260128': {
    audioVariants: true,
    resolutions: {
      '480p':        tierSeedance(0.40), // 会员 0.60 / 普通 0.80
      '480p_audio':  tierSeedance(0.60), // 会员 0.80 / 普通 1.00
      '720p':        tierSeedance(0.86), // 会员 1.06 / 普通 1.26
      '720p_audio':  tierSeedance(1.06), // 会员 1.26 / 普通 1.46
    },
  },

  // ── Kling 动作控制（按秒，std=720p，pro=1080p）──────────
  'kling-motion-v2.6-std': {
    resolutions: { '720p': tier(0.5) },  // 0.9/秒
  },
  'kling-motion-v2.6-pro': {
    resolutions: { '1080p': tier(0.9) }, // 1.5/秒
  },
  'kling-motion-v3.0-std': {
    resolutions: { '720p': tier(1.2) },  // 1.6/秒
  },
  'kling-motion-v3.0-pro': {
    resolutions: { '1080p': tier(1.5) }, // 2.1/秒
  },

  // ── Veo 3.1 系列（成本来自官方,有声/无声分开;720p与1080p同价,4K单独）──
  // 标准版:720/1080 无声1.35 有声2.71;4K 无声2.71 有声4.06
  'veo3.1-t2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(1.35),
      '1080P':       tier(1.35),
      '720P_audio':  tier(2.71),
      '1080P_audio': tier(2.71),
      '4K':          tier(2.71),
      '4K_audio':    tier(4.06),
    },
  },
  'veo3.1-i2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(1.35),
      '1080P':       tier(1.35),
      '720P_audio':  tier(2.71),
      '1080P_audio': tier(2.71),
      '4K':          tier(2.71),
      '4K_audio':    tier(4.06),
    },
  },
  // Fast 版:720/1080 无声0.68 有声1.02;4K 无声2.03 有声2.37
  'veo3.1-fast-t2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.68),
      '1080P':       tier(0.68),
      '720P_audio':  tier(1.02),
      '1080P_audio': tier(1.02),
      '4K':          tier(2.03),
      '4K_audio':    tier(2.37),
    },
  },
  'veo3.1-fast-i2v': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(0.68),
      '1080P':       tier(0.68),
      '720P_audio':  tier(1.02),
      '1080P_audio': tier(1.02),
      '4K':          tier(2.03),
      '4K_audio':    tier(2.37),
    },
  },
  // 首尾帧:价格与标准版完全一样(不是 Fast)
  'veo3.1-first-last': {
    audioVariants: true,
    resolutions: {
      '720P':        tier(1.35),
      '1080P':       tier(1.35),
      '720P_audio':  tier(2.71),
      '1080P_audio': tier(2.71),
      '4K':          tier(2.71),
      '4K_audio':    tier(4.06),
    },
  },

  // ── Pixverse v6(fal,统一带音频,无音频开关;只 720p/1080p)──
  'pixverse-t2v': {
    resolutions: { '720P': tier(0.4), '1080P': tier(0.7) },
  },
  'pixverse-i2v': {
    resolutions: { '720P': tier(0.4), '1080P': tier(0.7) },
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
