import { NextRequest, NextResponse } from 'next/server';

const FAL_KEY = process.env.FAL_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId   = searchParams.get('taskId');
    const endpoint = searchParams.get('endpoint');

    if (!taskId || !endpoint) {
      return NextResponse.json({ error: '缺少 taskId 或 endpoint' }, { status: 400 });
    }

    // appId 只取前两段
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
    console.log('fal 状态:', statusData.status);

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;

    if (statusData.status === 'COMPLETED') {
      const resultRes = await fetch(
        `https://queue.fal.run/${appId}/requests/${taskId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      );
      if (resultRes.ok) {
        const data = await resultRes.json();
        console.log('fal result full:', JSON.stringify(data).slice(0, 1000));
        videoUrl = data?.video?.url || data?.video_url || data?.url || data?.videos?.[0]?.url || null;
        console.log('视频URL:', videoUrl);
      } else {
        console.log('fal result fetch failed:', resultRes.status, await resultRes.text());
      }
      status = videoUrl ? 'completed' : 'failed';
      progress = videoUrl ? 100 : 0;
    } else if (statusData.status === 'IN_QUEUE') {
      status = 'pending';
      progress = 10;
    } else if (statusData.status === 'IN_PROGRESS') {
      status = 'processing';
      progress = 50;
    } else {
      status = 'failed';
      progress = 0;
    }

    return NextResponse.json({ success: true, taskId, status, progress, videoUrl });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

