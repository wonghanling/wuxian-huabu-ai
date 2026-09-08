// ============================================================
// Azure Blob 上传（服务端）
//
// 为什么从 Supabase 迁过来:
// Supabase 的 object/public 路径强制返回 Cache-Control: no-cache，无视上传时
// 设的 cacheControl —— 实测同一文件 object 读到 no-cache、render/image 读到
// max-age=31536000，而 render/image 只处理图片(视频走它返回 400)，且会重编码
// (6.8MB 的图经它变 7.17MB)，对要回传给模型做图生图的画布资源有害。
//
// Azure 是原样存取:缓存头可控、不重编码、无转换延迟、无按次配额。
//
// 迁移策略:
//   · 新文件写 Azure，读 Azure
//   · 历史数据不动 —— 数据库与画布快照里已存的 Supabase URL 继续有效，
//     Supabase 存储长期保留作老数据读源。改写快照 JSON 的风险远大于收益。
//   · 路径规则与 Supabase 完全一致，便于对照与回滚
// ============================================================

import { BlobServiceClient, type BlockBlobClient } from '@azure/storage-blob';

const CONTAINER = 'assets';

/** 一年 + immutable:资源路径都带时间戳与随机串，内容永不变，缓存越久越好 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

let _client: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (_client) return _client;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('缺少 AZURE_STORAGE_CONNECTION_STRING');
  _client = BlobServiceClient.fromConnectionString(conn);
  return _client;
}

function blobOf(path: string): BlockBlobClient {
  return getClient().getContainerClient(CONTAINER).getBlockBlobClient(path);
}

/** 公开读地址。容器是 Blob 级匿名读，URL 干净不带签名 —— 可被 CDN 长期缓存 */
export function azureUrl(path: string): string {
  const account = process.env.AZURE_STORAGE_ACCOUNT || 'filmavo';
  return `https://${account}.blob.core.windows.net/${CONTAINER}/${path.replace(/^\/+/, '')}`;
}

/** 是否已配置 Azure。没配就让调用方回退 Supabase，避免漏配环境变量导致全站上传失败 */
export function azureEnabled(): boolean {
  return !!process.env.AZURE_STORAGE_CONNECTION_STRING;
}

/**
 * 上传并返回公开 URL。
 *
 * @param path        桶内路径，如 `images/{userId}/{ts}-{rand}.jpg`
 *                    沿用原 Supabase 的路径规则，便于对照
 * @param body        Buffer / Uint8Array / Blob
 * @param contentType MIME。视频必须是 video/mp4，否则浏览器会当附件下载
 *                    而不是内联播放
 */
export async function azureUpload(
  path: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<string> {
  const clean = path.replace(/^\/+/, '');
  const blob = blobOf(clean);

  const buf =
    body instanceof Blob
      ? Buffer.from(await body.arrayBuffer())
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(body);

  await blob.uploadData(buf, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobCacheControl: CACHE_CONTROL,
    },
  });

  return azureUrl(clean);
}

/**
 * 把外部 URL 的文件转存进来。
 *
 * 上游(火山引擎/fal/kie)返回的都是带签名的临时地址，几天后失效 ——
 * 不转存的话画布里的作品会静默消失。带重试是因为失败多是网络抖动或
 * 上游限流这类瞬时问题，重试一次往往就过了。
 */
export async function azureMirror(
  srcUrl: string,
  path: string,
  contentType: string,
  tries = 3
): Promise<string> {
  let lastErr: any;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('下载到空文件');
      return await azureUpload(path, buf, contentType);
    } catch (e) {
      lastErr = e;
      // 退避:立刻重试只会再撞一次限流
      if (i < tries) await new Promise((r) => setTimeout(r, i * 500 + 500));
    }
  }
  throw new Error(`转存失败（已重试 ${tries} 次）: ${lastErr?.message || lastErr}`);
}

/** 按扩展名推 MIME */
export function mimeFromPath(path: string, fallback = 'application/octet-stream'): string {
  const ext = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'webm': return 'video/webm';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    default: return fallback;
  }
}
