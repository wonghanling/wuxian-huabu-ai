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
  // Nano Banana 2（走 Kie nano-banana-2）
  'nano-banana-pro-2k':   0.5,
  'nano-banana-pro-4k':   0.7,
  'flux-kontext':         0.6,
  'flux-kontext-max':     1.0,
  'midjourney':           0.6,
  'mj_imagine':           0.6,
  'mj_imagine_v7':        0.6,
  'mj_niji_7':            0.6,
  'doubao-seedream':      0.3,
  'doubao-seedream-4-5-251128': 0.7,
  // Seedream 5 Pro 图片交互编辑（走 Kie，quality=high 出 2K）
  'seedream-5-pro-edit': 0.5,
  // Nano Banana Pro 多图融合（走 Kie nano-banana-pro）
  'nano-banana-pro-multi-2k': 0.7,
  'nano-banana-pro-multi-4k': 0.9,

  // GPT Image 2（走 Kie，只保留 2K/4K，不再分 medium/high）
  'gpt-image-2-2k': 0.43,
  'gpt-image-2-4k': 0.63,

  // Flux 2（走 Kie，只有 1K/2K，无 4K；Pro 与 Flex 是两个模型，Flex 更贵）
  'flux-2-pro-2k':      0.3,   // Pro 文生图
  'flux-2-pro-edit-2k': 0.3,   // Pro 图生图（8 张 input_urls）
  'flux-2-flex-2k':      0.9,  // Flex 文生图
  'flux-2-flex-edit-2k': 0.9,  // Flex 图生图（8 张 input_urls）

  // Topaz 图片放大（走 Kie topaz/image-upscale）
  'topaz-upscale-4k': 0.7,
  'topaz-upscale-8k': 1.4,

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

// 加价规则：统一按会员价结算，不再区分会员/普通。
// 两个常量保持相同值，tier() 生成的 memberPerSec 与 normalPerSec 因此相等 ——
// 82 处 tier() 调用一次性生效，无需逐个改动，也保留了以后恢复差价的可能。
const MEMBER_MARKUP = 0.2;
const NORMAL_MARKUP = 0.2;

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

// 统一价（会员与普通同价）。Seedance 走 Kie 后不再区分会员，直接给最终售价。
// costPerSec 按售价填，仅用于展示，实际扣费由后端 getKieCharge 计算。
function flat(pricePerSec: number): VideoTierPrice {
  return {
    costPerSec: pricePerSec,
    memberPerSec: pricePerSec,
    normalPerSec: pricePerSec,
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

  // ── Wan 2.7（走 Kie，统一价 720P ¥0.63/s · 1080P ¥0.90/s）──
  // 五种模式同价。含自动音频，不区分有声/无声，故不设 audioVariants。
  'wan2.7-t2v': {
    resolutions: {
      '720P':  flat(0.63),
      '1080P': flat(0.90),
    },
  },
  'wan2.7-i2v': {
    resolutions: {
      '720P':  flat(0.63),
      '1080P': flat(0.90),
    },
  },
  'wan2.7-kf2v': {
    resolutions: {
      '720P':  flat(0.63),
      '1080P': flat(0.90),
    },
  },
  'wan2.7-r2v': {
    resolutions: {
      '720P':  flat(0.63),
      '1080P': flat(0.90),
    },
  },
  'wan2.7-videoedit': {
    resolutions: {
      '720P':  flat(0.63),
      '1080P': flat(0.90),
    },
  },

  // ── 快乐马 1.1（走 Kie，统一价 720P ¥0.86/s · 1080P ¥1.07/s）──
  // 模型 key 沿用 1.0 命名，避免动前端已存卡片的 config.model（改名会让老卡查不到价）
  'happyhorse-1.0-t2v': {
    resolutions: {
      '720P':  flat(0.86),
      '1080P': flat(1.07),
    },
  },
  'happyhorse-1.0-i2v': {
    resolutions: {
      '720P':  flat(0.86),
      '1080P': flat(1.07),
    },
  },
  'happyhorse-1.0-r2v': {
    resolutions: {
      '720P':  flat(0.86),
      '1080P': flat(1.07),
    },
  },
  'happyhorse-1.0-video-edit': {
    resolutions: {
      '720P':  tier(1.05),
      '1080P': tier(1.80),
    },
  },

  // ── Seedance 2.0 系列（走 Kie AI：成本 + 0.1/秒，不分会员）──────
  // 与其他模型不同，Seedance 会员和普通同价，所以 member/normal 填同一个值。
  // 音频自带、有声无声同价，故不设 audioVariants。
  // 这里是"无视频输入"单价；多模态传参考视频时按 (输入+输出) 计费，
  // 单价更低但基数含输入时长，实际扣费由后端 getKieCharge 计算。
  // _video 后缀 = 多模态传了参考视频时的单价（更低），
  // 但计费基数变成 (参考视频时长 + 输出时长)，实际总价通常更高。
  // 2.5 升级版：最长 30s、素材上限更高，有 1080p，仍无 4K
  'doubao-seedance-2-5-260128': {
    resolutions: {
      '480p':        flat(1.14),
      '720p':        flat(2.22),
      '1080p':       flat(3.90),
      '480p_video':  flat(0.76),
      '720p_video':  flat(1.38),
      '1080p_video': flat(2.40),
    },
  },
  'doubao-seedance-2-0-260128': {
    resolutions: {
      '480p':        flat(0.74),   // 成本 0.64
      '720p':        flat(1.49),   // 成本 1.39
      '1080p':       flat(3.55),   // 成本 3.45
      '4k':          flat(7.14),   // 成本 7.04
      '480p_video':  flat(0.49),   // 成本 0.39
      '720p_video':  flat(0.95),   // 成本 0.85
      '1080p_video': flat(2.20),   // 成本 2.10
      '4k_video':    flat(4.43),   // 成本 4.33
    },
  },
  'doubao-seedance-2-0-fast-260128': {
    resolutions: {
      '480p':       flat(0.62),    // 成本 0.52
      '720p':       flat(1.22),    // 成本 1.12
      '480p_video': flat(0.40),    // 成本 0.30
      '720p_video': flat(0.78),    // 成本 0.68
    },
  },
  'doubao-seedance-2-0-mini-260128': {
    resolutions: {
      '480p':       flat(0.42),    // 成本 0.32
      '720p':       flat(0.79),    // 成本 0.69
      '480p_video': flat(0.30),    // 成本 0.20
      '720p_video': flat(0.52),    // 成本 0.42
    },
  },

  // ── FLUX 3（走 fal，会员/普通同价，按秒）──────────────────
  // 720p ¥1.24/秒 · 1080p ¥2.05/秒；四种模式同价
  'flux-3-t2v': {
    resolutions: { '720p': flat(1.24), '1080p': flat(2.05) },
  },
  'flux-3-i2v': {
    resolutions: { '720p': flat(1.24), '1080p': flat(2.05) },
  },
  'flux-3-first-last': {
    resolutions: { '720p': flat(1.24), '1080p': flat(2.05) },
  },
  'flux-3-extend': {
    resolutions: { '720p': flat(1.24), '1080p': flat(2.05) },
  },

  // ── MiniMax H3（走 Kie，会员/普通同价，按秒）──────────────
  // 768P ¥0.85/秒 · 2K ¥1.33/秒；三种模式同价
  'minimax-h3-t2v': {
    resolutions: { '768p': flat(0.63), '2k': flat(0.98) },
  },
  'minimax-h3-i2v': {
    resolutions: { '768p': flat(0.63), '2k': flat(0.98) },
  },
  'minimax-h3-r2v': {
    resolutions: { '768p': flat(0.63), '2k': flat(0.98) },
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

  // ── Pixverse v6（走 Kie，统一价 720P ¥0.43/s · 1080P ¥0.73/s）──
  // 自带音频，文生/图生同价。Kie 侧还支持 360p/540p，但画布只开 720p/1080p。
  'pixverse-t2v': {
    resolutions: { '720P': flat(0.43), '1080P': flat(0.73) },
  },
  'pixverse-i2v': {
    resolutions: { '720P': flat(0.43), '1080P': flat(0.73) },
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
  // 分辨率 key 大小写兼容：调用方有传 '720P' 的（video/generate 里 toUpperCase），
  // 也有传 '720p' 的（前端 videoPrice）。旧模型 key 是大写、新模型是小写，
  // 不兼容就会查不到而静默返回 0 —— 表现为生成成功但扣费 ¥0.00。
  const candidates = [resolution, resolution.toLowerCase(), resolution.toUpperCase()];
  let prices: VideoTierPrice | undefined;
  for (const r of candidates) {
    const withAudio = model.audioVariants && hasAudio ? model.resolutions[`${r}_audio`] : undefined;
    prices = withAudio ?? model.resolutions[r];
    if (prices) break;
  }
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
