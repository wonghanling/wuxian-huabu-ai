import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROXY_KEY = process.env.UPLOAD_PROXY_KEY!;

export async function POST(req: NextRequest) {
  try {
    // 鉴权
    const authHeader = req.headers.get('x-proxy-key');
    if (!PROXY_KEY || authHeader !== PROXY_KEY) {
      return NextResponse.json({ error: '无效的代理密钥' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    let buffer: Buffer;
    let mimeType: string;
    let ext: string;
    let folder: string;

    if (contentType.includes('application/json')) {
      // base64 图片上传（视频帧图片）
      const { base64, type } = await req.json();
      if (!base64 || !type) {
        return NextResponse.json({ error: '缺少 base64 或 type' }, { status: 400 });
      }
      mimeType = type; // e.g. 'image/jpeg'
      ext = mimeType.split('/')[1] || 'jpg';
      buffer = Buffer.from(base64, 'base64');
      folder = 'frames';
    } else {
      // 二进制文件上传（视频文件）
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: '缺少文件' }, { status: 400 });
      }

      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.mp4') && !lowerName.endsWith('.mov')) {
        return NextResponse.json({ error: '仅支持 mp4 或 mov 视频' }, { status: 400 });
      }
      if (file.size > 100 * 1024 * 1024) {
        return NextResponse.json({ error: '视频文件不能超过 100MB' }, { status: 400 });
      }

      mimeType = lowerName.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
      ext = lowerName.endsWith('.mov') ? 'mov' : 'mp4';
      buffer = Buffer.from(await file.arrayBuffer());
      folder = 'videos/uploads';
    }

    const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from('assets')
      .upload(filename, buffer, { contentType: mimeType, upsert: false });

    if (error) {
      throw new Error(`上传失败: ${error.message}`);
    }

    const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);

    return NextResponse.json({ success: true, url: data.publicUrl });

  } catch (error: any) {
    console.error('upload-proxy 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
