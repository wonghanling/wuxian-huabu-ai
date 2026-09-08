// ============================================================
// 服务端资源上传的统一入口
//
// 内部决定写 Azure 还是 Supabase:
//   配了 AZURE_STORAGE_CONNECTION_STRING → 写 Azure（缓存头可控）
//   没配                                  → 回退 Supabase（不至于全站上传失败）
//
// 为什么迁 Azure: Supabase 的 object/public 路径强制返回 no-cache，无视上传
// 时设的 cacheControl。实测同一文件 object 读 no-cache、render/image 读
// max-age=31536000，但 render/image 只处理图片（视频返回 400）且会重编码 ——
// 对要回传给模型做图生图的画布资源有害。
//
// 路径规则一律沿用原来的，只换存储后端。历史数据不动：数据库与画布快照里
// 已存的 Supabase URL 继续有效，Supabase 长期保留作老数据读源。
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { azureEnabled, azureUpload, azureMirror, mimeFromPath } from './azure-storage';

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** 上传并返回公开 URL。path 沿用原 Supabase 路径规则 */
export async function putAsset(
  path: string,
  body: Buffer | Uint8Array | Blob,
  contentType?: string
): Promise<string> {
  const clean = path.replace(/^\/+/, '');
  const mime = contentType || mimeFromPath(clean);

  if (azureEnabled()) return azureUpload(clean, body, mime);

  const sb = sbAdmin();
  const buf =
    body instanceof Blob
      ? Buffer.from(await body.arrayBuffer())
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(body);
  const { error } = await sb.storage.from('assets').upload(clean, buf, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return sb.storage.from('assets').getPublicUrl(clean).data.publicUrl;
}

/**
 * 把上游临时地址转存进来，返回永久 URL。
 * 上游（火山引擎/fal/kie）给的都是带签名的临时地址，几天后失效 ——
 * 不转存的话画布里的作品会静默消失。
 */
export async function mirrorAsset(
  srcUrl: string,
  path: string,
  contentType?: string
): Promise<string> {
  const clean = path.replace(/^\/+/, '');
  const mime = contentType || mimeFromPath(clean);

  if (azureEnabled()) return azureMirror(srcUrl, clean, mime);

  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
  return putAsset(clean, Buffer.from(await res.arrayBuffer()), mime);
}
