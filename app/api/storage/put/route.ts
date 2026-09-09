import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { putAsset, mirrorAsset } from '@/lib/asset-upload';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ============================================================
// 前端上传的后端入口
//
// 原先前端直连 Supabase Storage（浏览器端客户端 + 登录态 + RLS）。Azure Blob
// 没有等价机制 —— 要么容器可写（任何人都能写，不可接受），要么后端签 SAS 令牌
// （前端要多发一次请求拿令牌，链路更长且令牌有泄露窗口）。由后端代传更简单，
// 还顺带解决两个老问题：
//
//   1. 转存成功率：前端 fetch 上游图片受浏览器 CORS 限制、用户关页面就中断；
//      后端下载没这些约束。
//   2. 路径规范：前端旧代码把文件写进 assets/{userId}/ 根目录，与后端的
//      assets/videos/{userId}/ 不一致，日后难以区分归属。
//
// 鉴权沿用登录态：从 Bearer token 解出用户，路径里的 userId 一律用解出来的值，
// 不信前端传的 —— 否则可伪造成别人的目录写文件。
// ============================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 用途 → 路径前缀。白名单，避免前端拼出任意路径 */
const FOLDERS: Record<string, string> = {
  image: 'images',
  video: 'videos',
  audio: 'audio',
  frame: 'frames',
  mask: 'masks',
  template: 'templates/videos',
  cover: 'templates/covers',
  avatar: 'commissions',
  portfolio: 'commissions',
};

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav',
};

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });

    const { data: { user }, error: authErr } =
      await supabaseAdmin.auth.getUser(auth.replace('Bearer ', '').trim());
    if (authErr || !user) {
      return NextResponse.json({ error: '无效的登录状态' }, { status: 401 });
    }

    const ct = req.headers.get('content-type') || '';
    let kind = '';
    let ext = '';
    let url = '';

    // 情形一：转存外部 URL（模型产出的临时地址）
    if (ct.includes('application/json')) {
      const body = await req.json();
      kind = String(body.kind || 'image');
      const src = String(body.url || '');
      if (!src) return NextResponse.json({ error: '缺少 url' }, { status: 400 });

      const folder = FOLDERS[kind];
      if (!folder) return NextResponse.json({ error: `不支持的用途: ${kind}` }, { status: 400 });

      ext = src.match(/\.(jpe?g|png|webp|mp4|mov|webm|mp3|wav)(\?|$)/i)?.[1]?.toLowerCase()
        || (kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : 'jpg');

      const path = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      url = await mirrorAsset(src, path, MIME[ext]);
    }
    // 情形二：直接上传文件
    else {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      kind = String(form.get('kind') || 'image');
      if (!file) return NextResponse.json({ error: '缺少文件' }, { status: 400 });

      const folder = FOLDERS[kind];
      if (!folder) return NextResponse.json({ error: `不支持的用途: ${kind}` }, { status: 400 });

      ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
      if (!MIME[ext]) {
        return NextResponse.json({ error: `不支持的格式: ${ext || '未知'}` }, { status: 400 });
      }

      const buf = Buffer.from(await file.arrayBuffer());
      const path = `${folder}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      url = await putAsset(path, buf, MIME[ext]);
    }

    return NextResponse.json({ success: true, url });
  } catch (e: any) {
    console.error('[storage/put] 失败:', e?.message || e);
    return NextResponse.json({ error: e?.message || '上传失败' }, { status: 500 });
  }
}
