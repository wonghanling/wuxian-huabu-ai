import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const maxDuration = 300;

fal.config({ credentials: process.env.FAL_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio = '2048x1152', imageBase64Array } = await req.json();

    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    if (!imageBase64Array || imageBase64Array.length === 0) return NextResponse.json({ error: '缺少图片' }, { status: 400 });

    const sizeMap: Record<string, string> = {
      '2048x1152': 'landscape_16_9',
      '2160x3840': 'portrait_16_9',
      '2048x2048': 'square_hd',
    };

    // 上传图片到 fal storage 拿 URL
    const allImages: string[] = [];
    for (const img of imageBase64Array) {
      const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
      const url = await fal.storage.upload(file);
      console.log('[StoryboardImage] fal url:', url);
      allImages.push(url);
    }

    const input = {
      prompt,
      image_urls: allImages,
      image_size: sizeMap[aspectRatio] || 'landscape_16_9',
      quality: 'high',
      num_images: 1,
      output_format: 'jpeg',
    };

    const submitted = await fal.queue.submit('openai/gpt-image-2/edit', {
      input: {
        prompt,
        image_urls: allImages,
        image_size: sizeMap[aspectRatio] || 'landscape_16_9',
        quality: 'high',
        num_images: 1,
        output_format: 'jpeg',
      },
    });
    const requestId = submitted.request_id;
    if (!requestId) throw new Error('fal.ai 未返回 requestId');

    return NextResponse.json({ success: true, requestId, endpoint: 'openai/gpt-image-2/edit', pending: true });
  } catch (error: any) {
    console.error('StoryboardImage 错误:', error);
    console.error('StoryboardImage error body:', JSON.stringify(error?.body));
    return NextResponse.json({ error: error.message || '服务器错误', body: error?.body }, { status: 500 });
  }
}
