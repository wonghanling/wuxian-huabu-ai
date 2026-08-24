import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { deductBalance, refundBalance, checkMembership } from '@/lib/billing';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300;

// 回退保险
falSingleton.config({ credentials: process.env.FAL_KEY! });

// 走 Kie 后与图片卡的 GPT Image 2 同价：2K ¥0.43 / 4K ¥0.63
// 前端仍传尺寸值(GEM4_SIZE)，这里映射到 Kie 的比例 + 清晰度两档。
const STEP4_SPEC: Record<string, { ratio: string; res: '2K' | '4K'; price: number }> = {
  '2048x1152': { ratio: '16:9', res: '2K', price: 0.43 },
  '2048x2048': { ratio: '1:1',  res: '2K', price: 0.43 },
  '2160x3840': { ratio: '9:16', res: '4K', price: 0.63 },
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, aspectRatio = '2048x1152', imageBase64Array, userId } = await req.json();

    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    if (!imageBase64Array || imageBase64Array.length === 0) return NextResponse.json({ error: '缺少图片' }, { status: 400 });

    const spec = STEP4_SPEC[aspectRatio] ?? STEP4_SPEC['2048x1152'];

    // 守卫：会员检查
    if (userId) {
      const isMember = await checkMembership(userId);
      if (!isMember) return NextResponse.json({ error: '需要开通会员才能使用导演引擎' }, { status: 402 });

      // 扣费
      const deduct = await deductBalance(userId, spec.price, 'image_deduct', 'GEM Step4 分镜图生成（GPT Image 2）', { model: 'gpt-image-2', aspectRatio });
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    // 图片先转成 URL —— Kie 只吃 URL 不吃 base64。
    // 画布传来的多是 Storage URL，可直传;剩下的 data: 老数据借 fal storage 转存。
    const allImages: string[] = [];
    const needUpload = imageBase64Array.some((img: string) => !img.startsWith('http'));
    if (needUpload) {
      const falKeyInfo = await pickKey('fal');
      let upOk = false;
      try {
        const fal = createFalClient({ credentials: falKeyInfo.keyValue });
        for (const img of imageBase64Array) {
          if (img.startsWith('http')) { allImages.push(img); continue; }
          const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
          allImages.push(await fal.storage.upload(file));
        }
        upOk = true;
      } finally {
        await releaseKey(falKeyInfo.keyId, upOk);
      }
    } else {
      allImages.push(...imageBase64Array);
    }

    // 提交到 Kie 的 GPT Image 2 图转图（Step4 一定带图，故固定用 i2i 端点）
    const keyInfo = await pickKey('kie');
    let success = false;
    let caughtErr: any = null;

    try {
      const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyInfo.keyValue}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-2-image-to-image',
          input: {
            prompt,
            input_urls: allImages.slice(0, 16),   // 上游上限 16 张
            aspect_ratio: spec.ratio,
            resolution: spec.res,
          },
        }),
      });
      const createData = await createRes.json();
      // Kie 用 body 的 code 表达错误，HTTP 状态可能仍是 200
      if (!createRes.ok || createData?.code !== 200) {
        throw new Error(createData?.msg || createData?.message || '提交失败');
      }
      const requestId = createData?.data?.taskId;
      if (!requestId) throw new Error('未返回任务ID');

      success = true;
      // 复用既有的 pending + requestId + endpoint 契约:endpoint='c2' 会走
      // fal-query 的 Kie 分支，前端轮询逻辑一行不用改。
      return NextResponse.json({ success: true, requestId, endpoint: 'c2', pending: true });
    } catch (err) {
      caughtErr = err;
      // 失败退款
      if (userId) {
        await refundBalance(userId, spec.price, 'GEM Step4 分镜图生成失败退款', { model: 'gpt-image-2', aspectRatio });
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
