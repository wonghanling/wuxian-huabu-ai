import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { putAsset } from '@/lib/asset-upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getVideoExtension(file: File): '.mp4' | '.mov' | null {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.mp4')) return '.mp4';
  if (lowerName.endsWith('.mov')) return '.mov';
  if (file.type === 'video/mp4') return '.mp4';
  if (file.type === 'video/quicktime') return '.mov';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '缺少视频文件' }, { status: 400 });
    }

    const ext = getVideoExtension(file);
    if (!ext) {
      return NextResponse.json({ error: '仅支持 mp4 或 mov 视频' }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: '视频文件不能超过 100MB' }, { status: 400 });
    }

    const contentType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `videos/uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    // 走 putAsset:配了 Azure 写 Azure(缓存头可控)，没配回退 Supabase。
    // 路径与 MIME 原样沿用，只换存储后端。
    const data = { publicUrl: await putAsset(filename, buffer, contentType) };

    return NextResponse.json({
      success: true,
      url: data.publicUrl,
      name: file.name,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Kling 视频上传错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
