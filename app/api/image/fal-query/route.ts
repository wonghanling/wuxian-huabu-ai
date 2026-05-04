import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

fal.config({ credentials: process.env.FAL_KEY! });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const endpoint = searchParams.get('endpoint');

  if (!requestId || !endpoint) {
    return NextResponse.json({ error: '缺少 requestId 或 endpoint' }, { status: 400 });
  }

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });
    console.log('[fal-query] status:', JSON.stringify(status));

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      console.log('[fal-query] result:', JSON.stringify(result).slice(0, 300));
      const images = (result.data as any)?.images;
      const imageUrl = images?.[0]?.url;
      if (!imageUrl) return NextResponse.json({ error: 'fal.ai 未返回图片' }, { status: 500 });
      return NextResponse.json({ success: true, imageUrl });
    }

    // IN_QUEUE 或 IN_PROGRESS
    return NextResponse.json({ pending: true, status: status.status });
  } catch (error: any) {
    console.error('[fal-query] error:', error);
    return NextResponse.json({ error: error.message || JSON.stringify(error) || '查询失败' }, { status: 500 });
  }
}
