import { NextRequest, NextResponse } from 'next/server';

const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    const apiUrl = `https://allapi.store/v1/video/query?id=${encodeURIComponent(taskId)}`;

    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${YUNWU_API_KEY}`
      }
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      return NextResponse.json({ error: '查询任务状态失败', details: errorData }, { status: 500 });
    }

    const taskData = await apiResponse.json();
    console.log('云雾API响应:', JSON.stringify(taskData, null, 2));

    // 映射状态
    let status = 'processing';
    let progress = 0;
    let videoUrl = null;

    if (taskData.status === 'video_generation_completed' || taskData.status === 'completed') {
      status = 'completed';
      progress = 100;
      videoUrl = taskData.video_url ||
                 taskData.detail?.video?.url ||
                 taskData.video?.url ||
                 taskData.detail?.output?.video_url ||
                 taskData.data?.video_url ||
                 taskData.data?.url ||
                 taskData.url;
    } else if (taskData.status === 'failed' || taskData.status === 'error') {
      status = 'failed';
      progress = 0;
    } else if (taskData.status === 'video_generating' || taskData.status === 'processing') {
      status = 'processing';
      progress = 60;
    } else if (taskData.status === 'pending' || taskData.status === 'image_downloading') {
      status = 'pending';
      progress = 20;
    } else {
      status = 'processing';
      progress = 40;
    }

    return NextResponse.json({
      success: true,
      taskId: taskId,
      status: status,
      progress: progress,
      videoUrl: videoUrl,
    });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({ error: '服务器错误', details: error.message }, { status: 500 });
  }
}
