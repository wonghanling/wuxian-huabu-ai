import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { deductBalance, refundBalance, checkMembership } from '@/lib/billing';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;

// 回退保险
falSingleton.config({ credentials: process.env.FAL_KEY! });

const STEP4_PRICE = 1.5; // 固定 ¥1.5/次

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio = '2048x1152', imageBase64Array, userId } = await req.json();

    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    if (!imageBase64Array || imageBase64Array.length === 0) return NextResponse.json({ error: '缺少图片' }, { status: 400 });

    // 守卫：会员检查
    if (userId) {
      const isMember = await checkMembership(userId);
      if (!isMember) return NextResponse.json({ error: '需要开通会员才能使用导演引擎' }, { status: 402 });

      // 扣费 ¥1.5
      const deduct = await deductBalance(userId, STEP4_PRICE, 'image_deduct', 'GEM Step4 分镜图生成（GPT Image 2）', { model: 'gpt-image-2', aspectRatio });
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    const sizeMap: Record<string, { width: number; height: number }> = {
      '2048x1152': { width: 2048, height: 1152 },
      '2160x3840': { width: 2160, height: 3840 },
      '2048x2048': { width: 2048, height: 2048 },
    };

    // 账号池：取一个可用 fal key
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let success = false;
    let caughtErr: any = null;

    try {
      // 上传图片到 fal storage 拿 URL（base64 需上传，URL 直接用）
      const allImages: string[] = [];
      for (const img of imageBase64Array) {
        if (img.startsWith('http')) {
          allImages.push(img);
          console.log('[StoryboardImage] direct url:', img.slice(0, 80));
        } else {
          const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
          const url = await fal.storage.upload(file);
          console.log('[StoryboardImage] fal url:', url);
          allImages.push(url);
        }
      }

      const submitted = await fal.queue.submit('openai/gpt-image-2/edit', {
        input: {
          prompt,
          image_urls: allImages,
          image_size: sizeMap[aspectRatio] || { width: 2048, height: 1152 },
          quality: 'high',
          num_images: 1,
          output_format: 'jpeg',
        },
      });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal.ai 未返回 requestId');

      success = true;
      return NextResponse.json({ success: true, requestId, endpoint: 'openai/gpt-image-2/edit', pending: true });
    } catch (err) {
      caughtErr = err;
      // 失败退款
      if (userId) {
        await refundBalance(userId, STEP4_PRICE, 'GEM Step4 分镜图生成失败退款', { model: 'gpt-image-2', aspectRatio });
      }
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caughtErr));
    }
  } catch (error: any) {
    console.error('StoryboardImage 错误:', error);
    console.error('StoryboardImage error body:', JSON.stringify(error?.body));
    return NextResponse.json({ error: error.message || '服务器错误', body: error?.body }, { status: 500 });
  }
}
