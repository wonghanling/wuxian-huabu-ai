import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

// 保留单例作为最终回退
falSingleton.config({ credentials: process.env.FAL_KEY! });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const endpoint = searchParams.get('endpoint');

  if (!requestId || !endpoint) {
    return NextResponse.json({ error: '缺少 requestId 或 endpoint' }, { status: 400 });
  }

  // 账号池：取一个 fal key 查询
  const keyInfo = await pickKey('fal');
  const fal = createFalClient({ credentials: keyInfo.keyValue });
  let success = false;
  let caught: any = null;

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });
    console.log('[fal-query] status:', JSON.stringify(status));

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      console.log('[fal-query] result:', JSON.stringify(result).slice(0, 500));
      const d = result.data as any;
      // 多路径兜底：不同端点返回结构不同
      // - 标准 fal: data.images[0].url
      // - GPT Image 2 edit: data.image.url 或 data.images[0].url
      // - 部分端点: data.image_url
      const imageUrl =
        d?.images?.[0]?.url ||
        d?.image?.url ||
        d?.image_url ||
        d?.output?.[0] ||
        null;
      if (!imageUrl) {
        success = true;
        console.error('[fal-query] 无法解析图片 URL，完整 data:', JSON.stringify(d).slice(0, 400));
        // 已 COMPLETED 但无图 → 永久失败，返回 failed 让前端停止(而非 500 被重试)
        return NextResponse.json({
          failed: true,
          reason: '审核未通过',
          error: '审核未通过：本次生成未产出图片，请调整描述后重试',
        }, { status: 200 });
      }
      success = true;
      return NextResponse.json({ success: true, imageUrl, raw: d });
    }

    // IN_QUEUE 或 IN_PROGRESS
    success = true;
    return NextResponse.json({ pending: true, status: status.status });
  } catch (error: any) {
    caught = error;
    console.error('[fal-query] error:', error);
    if (error?.body) {
      console.error('[fal-query] error body:', JSON.stringify(error.body));
    }
    if (error?.status) {
      console.error('[fal-query] error status:', error.status);
    }

    // 识别"永久失败"：fal 审核未通过 / 无法生成(no_media_generated) / 422 等，
    // 这类不该继续轮询，直接返回 failed 让前端立即停止并提示，而不是 500 被当作可重试
    const bodyStr = JSON.stringify(error?.body || '') + ' ' + (error?.message || '');
    const isPermanentFail =
      error?.status === 422 ||
      /no_media_generated|unsafe|not generate the expected|content policy|审核|violat|rejected|flagged/i.test(bodyStr);

    if (isPermanentFail) {
      success = true; // 已得到平台的明确结论(非本方 key 故障)，不算 key 失败
      return NextResponse.json({
        failed: true,
        reason: '审核未通过',
        error: '审核未通过：本次生成被平台判定为不合规或无法生成，请调整描述后重试',
      }, { status: 200 });
    }

    return NextResponse.json({
      error: error.message || JSON.stringify(error) || '查询失败',
      detail: error?.body || null,
      status: error?.status || null,
    }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
