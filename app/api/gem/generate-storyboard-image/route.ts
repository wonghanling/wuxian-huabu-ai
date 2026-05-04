import { NextRequest, NextResponse } from 'next/server';
import * as fal from '@fal-ai/serverless-client';

export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio = '2048x1152', imageBase64Array } = await req.json();

    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    if (!imageBase64Array || imageBase64Array.length === 0) return NextResponse.json({ error: '缺少图片' }, { status: 400 });

    const sizeMap: Record<string, { width: number; height: number }> = {
      '2048x1152': { width: 2048, height: 1152 },
      '3840x2160': { width: 3840, height: 2160 },
      '2160x3840': { width: 2160, height: 3840 },
      '2048x2048': { width: 2048, height: 2048 },
    };

    // 上传图片到 fal storage
    const imageUrls: string[] = [];
    for (const img of imageBase64Array) {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      const url = await fal.storage.upload(file);
      imageUrls.push(url);
    }

    const input: Record<string, unknown> = {
      prompt,
      image_size: sizeMap[aspectRatio] || { width: 2048, height: 1152 },
      quality: 'high',
      image_urls: imageUrls,
    };

    const submitted = await fal.queue.submit('openai/gpt-image-2/edit', { input });
    const requestId = submitted.request_id;
    if (!requestId) throw new Error('fal.ai 未返回 requestId');

    return NextResponse.json({ success: true, requestId, endpoint: 'openai/gpt-image-2/edit', pending: true });
  } catch (error: any) {
    console.error('StoryboardImage 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
