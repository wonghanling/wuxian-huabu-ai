import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 });
    }

    // base64 转 File 对象
    const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: '无效的图片格式' }, { status: 400 });
    }
    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const file = new File([buffer], 'upload.png', { type: mimeType });

    const url = await fal.storage.upload(file);
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Image upload error:', error);
    return NextResponse.json({ error: error.message || '上传失败' }, { status: 500 });
  }
}
