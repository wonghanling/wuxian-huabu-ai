import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin';

// ============================================================================
// Filmavo TV 素材上传（仅管理员）
// ============================================================================
// 后台直接选文件上传，服务端存进 Supabase Storage 并返回公开 URL ——
// 管理员不需要自己去 Supabase 后台找链接。
//
// POST multipart/form-data: file
// 返回 { url }
// ============================================================================

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 视频给到 100MB，图片其实远小于此
const MAX_BYTES = 100 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(req: NextRequest) {
  // 鉴权：Bearer token → 用户 → 邮箱白名单
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: '登录已失效' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: '无权限' }, { status: 403 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: '表单解析失败' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: '未选择文件' }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 100MB` },
      { status: 400 }
    );
  }

  const mime = file.type || 'application/octet-stream';
  const ext = EXT_BY_TYPE[mime];
  if (!ext) {
    return NextResponse.json(
      { error: `不支持的格式：${mime}。视频用 mp4/mov/webm，图片用 jpg/png/webp/gif` },
      { status: 400 }
    );
  }

  // 文件名全部重新生成：原名可能带空格或中文，URL 里会被编码成 %20 之类
  const filename = `tv-assets/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabaseAdmin.storage
      .from('assets')
      .upload(filename, buffer, { contentType: mime, cacheControl: '31536000', upsert: false });
    if (error) return NextResponse.json({ error: `上传失败: ${error.message}` }, { status: 500 });

    const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
    return NextResponse.json({
      success: true,
      url: data.publicUrl,
      kind: mime.startsWith('video/') ? 'video' : 'image',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || '上传失败' }, { status: 500 });
  }
}
