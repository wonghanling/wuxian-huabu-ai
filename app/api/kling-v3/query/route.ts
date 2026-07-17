import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { recordRefundReview } from '@/lib/billing';

export const maxDuration = 60;

// Kling v3 每秒价格(会员),普通用户+0.2/秒(与 generate 路由一致)
const KLING_PRICE: Record<string, { noAudio: number; audio: number }> = {
  '4k': { noAudio: 2.9, audio: 2.9 },
  'pro': { noAudio: 0.8, audio: 1.2 },
  'standard': { noAudio: 0.6, audio: 0.9 },
};
// 退款金额按普通用户价估(会员价更低,估高一点对用户有利,人工核对时可调)
function klingCharge(tier: string, audio: boolean, duration: number): number {
  const p = KLING_PRICE[tier];
  if (!p) return 0;
  const perSec = (audio ? p.audio : p.noAudio) + 0.2;
  return Math.round(perSec * Math.max(1, duration) * 100) / 100;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// fal 返回的视频链接转存到 Supabase 拿永久 URL(fal 链接会过期)
async function transferVideoToStorage(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `videos/kling-v3/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });
  if (error) throw new Error(`转存视频失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

// 轮询 Kling v3 生成结果(独立于图片 fal-query，返回视频 URL)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const endpoint = searchParams.get('endpoint');
  // 退款用(可选)
  const userId = searchParams.get('userId') || undefined;
  const tier = searchParams.get('tier') || undefined;
  const duration = Number(searchParams.get('duration') || 5);
  const audio = searchParams.get('audio') === '1';
  const refundAmount = tier ? klingCharge(tier, audio, duration) : 0;

  if (!requestId || !endpoint) {
    return NextResponse.json({ error: '缺少 requestId 或 endpoint' }, { status: 400 });
  }

  const keyInfo = await pickKey('fal');
  const fal = createFalClient({ credentials: keyInfo.keyValue });
  let success = false;
  let caught: any = null;

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const d = result.data as any;
      const rawUrl = d?.video?.url || d?.video_url || d?.output?.video?.url || null;
      if (!rawUrl) {
        success = true;
        if (userId && refundAmount > 0) {
          await recordRefundReview({ userId, amount: refundAmount, model: `kling-v3-${tier}`,
            failType: 'no_media', failReason: '生成完成但无视频产出', meta: { requestId, endpoint } });
        }
        return NextResponse.json({
          failed: true,
          reason: '审核未通过',
          error: '审核未通过：本次生成未产出视频，请调整描述后重试',
        }, { status: 200 });
      }
      // 转存到 Supabase(fal 链接会过期)
      let videoUrl = rawUrl;
      try {
        videoUrl = await transferVideoToStorage(rawUrl);
      } catch (e) {
        console.error('[kling-v3/query] 转存失败，降级用 fal 临时链接:', e);
      }
      success = true;
      return NextResponse.json({ success: true, videoUrl });
    }

    success = true;
    return NextResponse.json({ pending: true, status: status.status });
  } catch (error: any) {
    caught = error;
    console.error('[kling-v3/query] error:', error?.message, error?.status);
    const bodyStr = JSON.stringify(error?.body || '') + ' ' + (error?.message || '');
    const isPermanentFail =
      error?.status === 422 ||
      /no_media_generated|unsafe|not generate the expected|content policy|审核|violat|rejected|flagged/i.test(bodyStr);
    if (isPermanentFail) {
      success = true;
      if (userId && refundAmount > 0) {
        const isNoMedia = /no_media_generated|not generate the expected/i.test(bodyStr);
        await recordRefundReview({ userId, amount: refundAmount, model: `kling-v3-${tier}`,
          failType: isNoMedia ? 'no_media' : 'content_policy',
          failReason: (error?.message || '').slice(0, 200), meta: { requestId, endpoint, status: error?.status } });
      }
      return NextResponse.json({
        failed: true,
        reason: '审核未通过',
        error: '审核未通过：本次生成被平台判定为不合规或无法生成，请调整描述后重试',
      }, { status: 200 });
    }
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
