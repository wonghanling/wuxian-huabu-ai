'use client';

// ============ 图片模型配置 ============
// 全部来源:app/api/image/generate/route.ts 的 IMAGE_MODELS
//          + app/canvas/CustomCard.tsx 的下拉显示名/价格(照搬原项目,价格一致)

export interface ImageModel {
  id: string;        // 传给 /api/image/generate 的 model 值
  label: string;     // 显示名
  price: string;     // 价格说明(照搬原网站)
  // 清晰度选项(部分模型有);没有则用通用比例
  qualityOptions?: { value: string; label: string }[];
  // 该模型是否走"尺寸"而非"比例"(gpt-image-2 系列)
  useSizeNotRatio?: boolean;
  // 是否支持参考图(来自 API supportsImage/requiresImage;false 则不显示参考图/上传)
  supportsImage?: boolean;
  // 限定比例选项(不设则用通用 RATIO_OPTIONS);flux-2-pro 只 16:9/9:16/1:1
  ratios?: { value: string; label: string }[];
}

// Flux 2 价格查询。走 Kie 后只有 1K/2K(无 4K),且价格不随比例变化 ——
// Pro ¥0.3、Flex ¥0.9,所以只按模型 ID 查;quality/ratio 保留形参兼容既有调用方。
export function fluxImagePrice(modelId: string, quality?: string, ratio?: string): number {
  void quality; void ratio;
  const map: Record<string, number> = {
    'flux-2-pro': 0.3, 'flux-2-pro-edit': 0.3,
    'flux-2-flex': 0.9, 'flux-2-flex-edit': 0.9,
  };
  return map[modelId] ?? 0;
}

// Kie 的 Flux 2 支持 8 种比例(比原 fal 的 3 种多)
const FLUX_RATIOS = [
  { value: '16:9', label: '16:9 宽屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '1:1', label: '1:1 正方形' },
  { value: '4:3', label: '4:3 横图' },
  { value: '3:4', label: '3:4 竖图' },
  { value: '3:2', label: '3:2 横图' },
  { value: '2:3', label: '2:3 竖图' },
];

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'nano-banana-pro', label: 'Nano Banana 2', price: '2K ¥0.5 / 4K ¥0.7', supportsImage: true,
    qualityOptions: [{ value: '2k', label: '2K — ¥0.5/次' }, { value: '4k', label: '4K — ¥0.7/次' }] },
  { id: 'nano-banana', label: 'Nano Banana', price: '¥0.5/次', supportsImage: true },
  { id: 'nano-banana-pro-multi', label: '多图融合 Nano Banana Pro', price: '2K ¥0.7 / 4K ¥0.9', supportsImage: true,
    qualityOptions: [{ value: '2k', label: '2K — ¥0.7/次' }, { value: '4k', label: '4K — ¥0.9/次' }] },
  // GPT Image 2 走 Kie 后改用比例 + 2K/4K 两档,不再用尺寸和 medium/high 双画质
  { id: 'gpt-image-2', label: 'GPT Image 2', price: '2K ¥0.43 / 4K ¥0.63', supportsImage: true,
    qualityOptions: [{ value: '2k', label: '2K — ¥0.43/次' }, { value: '4k', label: '4K — ¥0.63/次' }] },
  { id: 'gpt-image-2-all', label: 'GPT Image 2 多图融合', price: '2K ¥0.43 / 4K ¥0.63', supportsImage: true,
    qualityOptions: [{ value: '2k', label: '2K — ¥0.43/次' }, { value: '4k', label: '4K — ¥0.63/次' }] },
  { id: 'mj_imagine', label: 'Midjourney', price: '¥0.6/次', supportsImage: true },
  { id: 'mj_imagine_v7', label: 'Midjourney V7', price: '¥0.6/次', supportsImage: true },
  { id: 'mj_niji_7', label: 'Niji 7 动漫', price: '¥0.6/次', supportsImage: true },
  { id: 'doubao-seedream-4-5-251128', label: '豆包 Seedream 5.0', price: '¥0.7/次', supportsImage: true },
  // Flux 2(走 Kie;只 1K/2K,无 4K)。Pro 与 Flex 是两个模型,Flex 贵三倍。
  { id: 'flux-2-pro', label: 'Flux 2 Pro 文生图', price: '¥0.3/次', ratios: FLUX_RATIOS,
    qualityOptions: [{ value: '1k', label: '1K — ¥0.3/次' }, { value: '2k', label: '2K — ¥0.3/次' }] },
  { id: 'flux-2-pro-edit', label: 'Flux 2 Pro 图生图', price: '¥0.3/次', supportsImage: true, ratios: FLUX_RATIOS,
    qualityOptions: [{ value: '1k', label: '1K — ¥0.3/次' }, { value: '2k', label: '2K — ¥0.3/次' }] },
  { id: 'flux-2-flex', label: 'Flux 2 Flex 文生图', price: '¥0.9/次', ratios: FLUX_RATIOS,
    qualityOptions: [{ value: '1k', label: '1K — ¥0.9/次' }, { value: '2k', label: '2K — ¥0.9/次' }] },
  { id: 'flux-2-flex-edit', label: 'Flux 2 Flex 图生图', price: '¥0.9/次', supportsImage: true, ratios: FLUX_RATIOS,
    qualityOptions: [{ value: '1k', label: '1K — ¥0.9/次' }, { value: '2k', label: '2K — ¥0.9/次' }] },
  // Topaz 图片放大(走 Kie;只需一张输入图,无提示词)
  { id: 'topaz-upscale', label: 'Topaz 图片放大', price: '4K ¥0.7 / 8K ¥1.4', supportsImage: true,
    qualityOptions: [{ value: '4k', label: '4K — ¥0.7/次' }, { value: '8k', label: '8K — ¥1.4/次' }] },
];

export const DEFAULT_IMAGE_MODEL = 'nano-banana-pro';

// 比例选项(照搬原项目,通用模型用)
export const RATIO_OPTIONS: { value: string; label: string }[] = [
  { value: '1:1', label: '1:1 正方形' },
  { value: '4:3', label: '4:3 横图' },
  { value: '3:4', label: '3:4 竖图' },
  { value: '16:9', label: '16:9 宽屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '3:2', label: '3:2 横图' },
  { value: '2:3', label: '2:3 竖图' },
  { value: '21:9', label: '21:9 超宽' },
];

// 尺寸选项(gpt-image-2 系列专用,带 medium/high 双价)
export const SIZE_OPTIONS: { value: string; label: string; priceMedium: string; priceHigh: string }[] = [
  { value: '1920x1080', label: '16:9 1080p', priceMedium: '¥0.5', priceHigh: '¥1.2' },
  { value: '1080x1920', label: '9:16 1080p', priceMedium: '¥0.5', priceHigh: '¥1.2' },
  { value: '1080x1080', label: '1:1 1080p', priceMedium: '¥0.5', priceHigh: '¥1.2' },
  { value: '2048x1152', label: '16:9 2K', priceMedium: '¥0.4', priceHigh: '¥1.2' },
  { value: '2048x2048', label: '1:1 2K', priceMedium: '¥0.5', priceHigh: '¥1.7' },
  { value: '3840x2160', label: '16:9 4K', priceMedium: '¥0.9', priceHigh: '¥3.1' },
  { value: '2160x3840', label: '9:16 4K', priceMedium: '¥0.9', priceHigh: '¥3.1' },
];

// 画质选项(gpt-image-2 系列)
export const QUALITY_OPTIONS = [
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

// 比例 → 宽高数值,用于卡片按比例显示(默认正方形,上传/输出后按真实比例)
export function ratioToWH(ratio: string, base = 320): { w: number; h: number } {
  // 尺寸形式 "1920x1080"
  if (ratio.includes('x')) {
    const [w, h] = ratio.split('x').map(Number);
    if (w && h) return scaleToBase(w, h, base);
  }
  // 比例形式 "16:9"
  if (ratio.includes(':')) {
    const [w, h] = ratio.split(':').map(Number);
    if (w && h) return scaleToBase(w, h, base);
  }
  return { w: base, h: base };
}

function scaleToBase(w: number, h: number, base: number): { w: number; h: number } {
  // 长边固定为 base,短边按比例
  if (w >= h) return { w: base, h: Math.round((base * h) / w) };
  return { w: Math.round((base * w) / h), h: base };
}
