import { NextRequest, NextResponse } from 'next/server';

const FAL_KEY = process.env.FAL_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId   = searchParams.get('taskId');
    const endpoint = searchParams.get('endpoint'); // 前端传来的原始 endpoint

    if (!taskId || !endpoint) {
      return NextResponse.json({ error: '缺少 taskId 或 endpoint' }, { status: 400 });
    }

    // appId 只取前两段，避免 SDK 路径截断 bug
    const appId = endpoint.split('/').slice(0, 2).join('/');

    // 查询状态
    const statusRes = await fetch(
      `https://queue.fal.run/${appId}/requests/${taskId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    );

    if (!statusRes.ok) {
      const err = await statusRes.text();
      return NextResponse.json({ error: '查询状态失败', details: err }, { status: 500 });
    }

    const statusData = await statusRes.json();
    const falStatus: string = statusData.status; // IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED

    let status = 'processing';
    let progress = 0;
    let videoUrl: string | null = null;

    if (falStatus === 'COMPLETED') {
      // 获取结果
      const resultRes = await fetch(
        `https://queue.fal.run/${appId}/requests/${taskId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      );
      if (resultRes.ok) {
        const resultData = await resultRes.json();
        videoUrl = resultData?.video?.url ?? resultData?.videos?.[0]?.url ?? null;
      }
      status = 'completed';
      progress = 100;
    } else if (falStatus === 'FAILED') {
      status = 'failed';
      progress = 0;
    } else if (falStatus === 'IN_PROGRESS') {
      status = 'processing';
      progress = 60;
    } else {
      // IN_QUEUE
      status = 'pending';
      progress = 10;
    }

    return NextResponse.json({ success: true, taskId, status, progress, videoUrl });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
