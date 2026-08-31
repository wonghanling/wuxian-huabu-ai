// ============================================================
// 静态资源 URL 收口
//
// 目的:全站 105 处硬编码的 Supabase 资源地址集中到这里，将来切到
// Azure Blob(多区就近加载)时只改本文件，不必再动 10+ 个页面。
//
// 本次改动不改变任何行为 —— 输出的 URL 与原先逐字相同。切换是下一步。
//
// 背景:资源分两类，迁移策略不同
//   1. 站点素材(首页/TV 页/展示组件的图片视频) —— 路径固定，可整批迁移
//   2. 用户上传与生成结果 —— 运行时产生，走后端上传路径(见 33 处 upload)
// 本文件管第 1 类;第 2 类要在后端上传处收口。
// ============================================================

/** Supabase 项目地址。切 Azure 时把 ASSET_HOST 换成 Front Door 域名即可 */
const SUPABASE_HOST = 'https://qvcantdhbsulcucufwtp.supabase.co';

/**
 * 资源根地址。三阶段演进:
 *   现在   Supabase（本文件仅做收口，行为不变）
 *   下一步 香港 Azure Blob 直连，验证上传与读取
 *   最终   Azure Front Door 统一入口，按用户位置就近取副本
 *
 * 用环境变量而非常量，是为了能先在预览环境切一半流量验证，
 * 不必改代码来回切。未设时回落到 Supabase，保证不会因漏配而全站白图。
 */
const ASSET_HOST = process.env.NEXT_PUBLIC_ASSET_HOST || SUPABASE_HOST;

const IS_SUPABASE = ASSET_HOST === SUPABASE_HOST;

/**
 * 取静态资源 URL。
 *
 * @param path  桶内路径，如 'videos/hero-fast.mp4'、'images/logo.png'
 *              （不要以 / 开头，也不含 assets/ 前缀）
 * @param opts.quality  图片压缩质量。
 *   Supabase 走它的图片转换服务(render/image?quality=N);
 *   Azure Blob 没有这个能力 —— 迁移时素材要预先压好再上传，
 *   届时本参数在 Azure 分支下被忽略，不会报错也不会变形。
 */
export function assetUrl(path: string, opts?: { quality?: number }): string {
  const clean = path.replace(/^\/+/, '');

  if (!IS_SUPABASE) {
    // Azure(或 Front Door):路径即 URL，不带任何签名或转换参数 ——
    // 这样 URL 长期稳定、可被 CDN 缓存，也便于跨区复制后共用同一路径。
    return `${ASSET_HOST}/assets/${clean}`;
  }

  // Supabase:图片带 quality 时走转换服务，其余走对象直读
  if (opts?.quality) {
    return `${SUPABASE_HOST}/storage/v1/render/image/public/assets/${clean}?quality=${opts.quality}`;
  }
  return `${SUPABASE_HOST}/storage/v1/object/public/assets/${clean}`;
}

/** 图片专用简写:默认 quality=80，与现有 105 处硬编码中的用法一致 */
export function imageUrl(path: string, quality = 80): string {
  return assetUrl(path, { quality });
}

/** 视频专用简写:视频不走图片转换，始终对象直读 */
export function videoUrl(path: string): string {
  return assetUrl(path);
}
