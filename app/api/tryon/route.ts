import { NextRequest, NextResponse } from 'next/server';
import { createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

// ============================================================
// 虚拟试衣 · fal-ai/image-apps-v2/virtual-try-on
// 输入:人物图 + 衣服图(+ 保留姿势 + 宽高比) → 输出试穿图
// 账号池 pickKey('fal') + 扣费 deductBalance,失败退款;
// 异步:返回 requestId + endpoint,前端复用 /api/image/fal-query 轮询
// 独立路由,不动图片生成路由
// ============================================================

const ENDPOINT = 'fal-ai/image-apps-v2/virtual-try-on';
const PRICING_KEY = 'virtual-try-on';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体解析失败' }, { status: 400 });
  }

  const { personImageUrl, clothingImageUrl, preservePose = true, aspectRatio = '3:4', userId } = body || {};

  if (!personImageUrl || !clothingImageUrl) {
    return NextResponse.json({ error: '请提供人物图和衣服图' }, { status: 400 });
  }

  // 扣费(失败返回 402)
  const price = calcImagePrice(PRICING_KEY);
  if (userId) {
    const deduct = await deductBalance(
      userId, price, 'image_deduct',
      '虚拟试衣',
      { model: PRICING_KEY },
    );
    if (!deduct.success) {
      return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
    }
  }

  // 账号池取 fal key
  const keyInfo = await pickKey('fal');
  const fal = createFalClient({ credentials: keyInfo.keyValue });
  let falSuccess = false;
  let falErr: any = null;

  try {
    const input = {
      person_image_url: personImageUrl,
      clothing_image_url: clothingImageUrl,
      preserve_pose: !!preservePose,
      aspect_ratio: { ratio: aspectRatio },   // fal 要求对象格式 { ratio: "3:4" }
    };
    const submitted = await fal.queue.submit(ENDPOINT, { input: input as any });
    const requestId = submitted.request_id;
    if (!requestId) throw new Error('fal.ai 未返回 requestId');

    falSuccess = true;
    return NextResponse.json({ success: true, requestId, endpoint: ENDPOINT, pending: true });
  } catch (error: any) {
    falErr = error;
    console.error('[tryon] error:', error);
    if (userId) {
      await refundBalance(userId, price, '虚拟试衣失败退款', { model: PRICING_KEY });
    }
    return NextResponse.json({ error: error?.message || '虚拟试衣失败' }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
  }
}
