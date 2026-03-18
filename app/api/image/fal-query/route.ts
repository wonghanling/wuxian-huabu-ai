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

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const images = (result.data as any)?.images;
      const imageUrl = images?.[0]?.url;
      if (!imageUrl) return NextResponse.json({ error: 'fal.ai 未返回图片' }, { status: 500 });
      return NextResponse.json({ success: true, imageUrl });
    }

    if (status.status === 'FAILED') {
      return NextResponse.json({ error: 'fal.ai 任务失败' }, { status: 500 });
    }

    // IN_QUEUE 或 IN_PROGRESS
    return NextResponse.json({ pending: true, status: status.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  }
}
