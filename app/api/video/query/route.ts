import { NextRequest, NextResponse } from 'next/server';
import { Service } from '@volcengine/openapi';

const FAL_KEY = process.env.FAL_KEY!;
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY!;

const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengQuery = volcService.createJSONAPI('CVSync2AsyncGetResult', { Version: '2022-08-31' });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId   = searchParams.get('taskId');
    const endpoint = searchParams.get('endpoint');

    if (!taskId || !endpoint) {
      return NextResponse.json({ error: '缺少 taskId 或 endpoint' }, { status: 400 });
    }

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;
    let errorDetail: any = null;

    if (endpoint.startsWith('jimeng:')) {
      // 即梦 火山引擎查询
      const reqKey = endpoint.replace('jimeng:', '');
      const jmRes = await jimengQuery({ req_key: reqKey, task_id: taskId }) as any;
      console.log('即梦查询结果:', JSON.stringify(jmRes).slice(0, 500));

      if (jmRes?.code !== 10000) {
        status = 'failed';
        progress = 0;
        errorDetail = jmRes?.message;
      } else {
        const jmStatus = jmRes?.data?.status;
        if (jmStatus === 'done') {
          videoUrl = jmRes?.data?.video_url || null;
          status = videoUrl ? 'completed' : 'failed';
          progress = videoUrl ? 100 : 0;
        } else if (jmStatus === 'in_queue') {
          status = 'pending';
          progress = 10;
        } else if (jmStatus === 'generating') {
          status = 'processing';
          progress = 50;
        } else {
          status = 'failed';
          progress = 0;
          errorDetail = jmStatus;
        }
      }
    } else if (endpoint.startsWith('dashscope:')) {
      // DashScope 官方 API 查询
      const res = await fetch(
        `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${DASHSCOPE_KEY}` } }
      );

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: '查询状态失败', details: err }, { status: 500 });
      }

      const data = await res.json();
      const taskStatus = data?.output?.task_status;
      console.log('DashScope 状态:', taskStatus);

      if (taskStatus === 'SUCCEEDED') {
        videoUrl = data?.output?.video_url || null;
        status = videoUrl ? 'completed' : 'failed';
        progress = videoUrl ? 100 : 0;
      } else if (taskStatus === 'PENDING') {
        status = 'pending';
        progress = 10;
      } else if (taskStatus === 'RUNNING') {
        status = 'processing';
        progress = 50;
      } else {
        status = 'failed';
        progress = 0;
        errorDetail = data?.output;
      }
    } else {
      // fal 查询
      const appId = endpoint.split('/').slice(0, 2).join('/');

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
          const errText = await resultRes.text();
          console.log('fal result fetch failed:', resultRes.status, errText);
          errorDetail = errText;
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
        errorDetail = statusData;
      }
    }

    return NextResponse.json({ success: true, taskId, status, progress, videoUrl, errorDetail });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
