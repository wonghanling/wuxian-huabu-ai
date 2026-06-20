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
      console.log('[fal-query] result:', JSON.stringify(result).slice(0, 300));
      const images = (result.data as any)?.images;
      const imageUrl = images?.[0]?.url;
      if (!imageUrl) {
        success = true; // fal 通讯成功，只是无图（审核拒绝），不算 key 失败
        return NextResponse.json({ error: 'fal.ai 未返回图片' }, { status: 500 });
      }
      success = true;
      return NextResponse.json({ success: true, imageUrl });
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
    return NextResponse.json({
      error: error.message || JSON.stringify(error) || '查询失败',
      detail: error?.body || null,
      status: error?.status || null,
    }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
