import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { recordRefundReview } from '@/lib/billing';
import { calcImagePrice } from '@/lib/pricing';

// 保留单例作为最终回退
falSingleton.config({ credentials: process.env.FAL_KEY! });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const endpoint = searchParams.get('endpoint');
  // 退款用(可选):失败时按此记录待审核退款
  const userId = searchParams.get('userId') || undefined;
  const model = searchParams.get('model') || undefined;
  const quality = searchParams.get('quality') || undefined;

  // 计算这次的扣费金额(与生成路由一致)
  // key 的推导必须与 generate 路由的 pricingKey 保持一致，否则查不到价而退 0
  const refundAmount = model ? (() => {
    const key = model === 'nano-banana-pro' ? (quality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
      : model === 'nano-banana-pro-multi' ? (quality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
      : ['gpt-image-2', 'gpt-image-2-all'].includes(model) ? (quality === '4k' ? 'gpt-image-2-4k' : 'gpt-image-2-2k')
      : ['flux-2-pro', 'flux-2-pro-edit', 'flux-2-flex', 'flux-2-flex-edit'].includes(model) ? `${model}-2k`
      : model === 'topaz-upscale' ? (quality === '8k' ? 'topaz-upscale-8k' : 'topaz-upscale-4k')
      : model;
    return calcImagePrice(key);
  })() : 0;

  if (!requestId || !endpoint) {
    return NextResponse.json({ error: '缺少 requestId 或 endpoint' }, { status: 400 });
  }

  // ── Kie 通道（endpoint='c2' 中性代号）────────────────────────
  // 走在取 fal key 之前，否则查 Kie 任务会白占一个 fal 池的 key。
  // 返回格式与 fal 分支一致：{ success, imageUrl } / { error } / {}（未完成）
  if (endpoint === 'c2') {
    const kKey = await pickKey('kie');
    let kOk = false;
    let kErr: any = null;
    try {
      const res = await fetch(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(requestId)}`,
        { headers: { 'Authorization': `Bearer ${kKey.keyValue}` } }
      );
      const body = await res.json();
      kOk = res.ok && body?.code === 200;
      if (!kOk) {
        kErr = new Error(body?.msg || `查询失败: HTTP ${res.status}`);
        return NextResponse.json({ error: body?.msg || '查询失败' });
      }

      const d = body?.data || {};
      if (d.state === 'success') {
        // resultJson 是 JSON 字符串，需要二次解析
        let url = '';
        try {
          url = JSON.parse(d.resultJson || '{}')?.resultUrls?.[0] || '';
        } catch { url = ''; }
        if (url) return NextResponse.json({ success: true, imageUrl: url });
        return NextResponse.json({ error: '未返回图片地址' });
      }
      if (d.state === 'fail') {
        // 失败按既有约定记待审核退款（与 fal 分支同款处理）
        if (userId && refundAmount > 0) {
          await recordRefundReview({ userId, amount: refundAmount, model, failType: 'content_policy',
            failReason: d.failMsg || '生成失败', meta: { requestId, endpoint } });
        }
        return NextResponse.json({ failed: true, reason: d.failMsg || '生成失败' });
      }
      return NextResponse.json({});   // waiting：前端继续轮询
    } catch (err) {
      kErr = err;
      return NextResponse.json({ error: String((err as any)?.message || err) });
    } finally {
      await releaseKey(kKey, kOk, kOk ? undefined : categorizeError(kErr),
        kErr ? String(kErr?.message || kErr) : undefined);
    }
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
        // 已 COMPLETED 但无图 = no_media(未产出) → 建议退(记待审核,不自动退)
        if (userId && refundAmount > 0) {
          await recordRefundReview({ userId, amount: refundAmount, model, failType: 'no_media',
            failReason: '生成完成但无图片产出', meta: { requestId, endpoint } });
        }
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
      // 区分:no_media(未产出,建议退) vs content_policy(审核不过,可能已计费,建议不退)
      if (userId && refundAmount > 0) {
        const isNoMedia = /no_media_generated|not generate the expected/i.test(bodyStr);
        await recordRefundReview({ userId, amount: refundAmount, model,
          failType: isNoMedia ? 'no_media' : 'content_policy',
          failReason: (error?.message || '').slice(0, 200), meta: { requestId, endpoint, status: error?.status } });
      }
      return NextResponse.json({
        failed: true,
        reason: '审核未通过',
        error: '审核未通过：本次生成被平台判定为不合规或无法生成，请调整描述后重试',
      }, { status: 200 });
    }

    // 非永久失败(可能是 500 服务端/网络错误) → fal 官方明说 server error 不收费,可自动退
    // 但这里是轮询期的偶发错误,前端会重试,不在此退款(避免重试期误退)。仅 500 且已确定终止才退,
    // 交由前端轮询耗尽/明确失败处理。此处保持原样返回 500 让前端继续重试。
    return NextResponse.json({
      error: error.message || JSON.stringify(error) || '查询失败',
      detail: error?.body || null,
      status: error?.status || null,
    }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
