import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_QUERY_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadVideoToStorage(sourceUrl: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `videos/seedance/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const { error } = await supabaseAdmin.storage
      .from('assets')
      .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });
    if (error) throw new Error(`上传视频失败: ${error.message}`);
    const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
    return data.publicUrl;
  } catch (e) {
    console.warn('转存 Seedance 视频失败，使用原始URL:', e);
    return sourceUrl;
  }
}

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

    if (!ARK_API_KEY) {
      return NextResponse.json({ error: '未配置 ARK_API_KEY' }, { status: 500 });
    }

    const res = await fetch(ARK_QUERY_URL + taskId, {
      headers: { 'Authorization': `Bearer ${ARK_API_KEY}` },
    });

    const data = await res.json();
    console.log('Seedance 查询结果:', JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      return NextResponse.json({ status: 'failed', error: data?.error?.message || '查询失败' });
    }

    const arkStatus = data.status;

    if (arkStatus === 'succeeded') {
      const rawUrl = data?.content?.video_url;
      if (!rawUrl) return NextResponse.json({ status: 'failed', error: '未返回视频URL' });
      const videoUrl = await uploadVideoToStorage(rawUrl);
      return NextResponse.json({ status: 'completed', videoUrl, progress: 100 });
    } else if (arkStatus === 'failed' || arkStatus === 'expired') {
      return NextResponse.json({ status: 'failed', error: data?.error?.message || arkStatus, progress: 0 });
    } else if (arkStatus === 'queued') {
      return NextResponse.json({ status: 'queued', progress: 10 });
    } else {
      // running
      return NextResponse.json({ status: 'processing', progress: 50 });
    }

  } catch (error: any) {
    console.error('Seedance 查询错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
