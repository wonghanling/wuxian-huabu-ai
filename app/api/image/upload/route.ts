import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const maxDuration = 60;

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let file: File;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const uploaded = formData.get('file') as File | null;
      if (!uploaded) {
        return NextResponse.json({ error: '缺少文件' }, { status: 400 });
      }
      file = uploaded;
    } else {
      // 兼容旧的 base64 方式（多图融合等）
      const { imageBase64 } = await req.json();
      if (!imageBase64) {
        return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
      }
      const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: '无效的图片格式' }, { status: 400 });
      }
      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      file = new File([buffer], 'upload.jpg', { type: mimeType });
    }

    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: error.message || '上传失败' }, { status: 500 });
  }
}
