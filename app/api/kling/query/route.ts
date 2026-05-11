import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const runtime = 'nodejs';

const N1N_API_KEY = process.env.YUNWU_API_KEY!;
const N1N_BASE = 'https://api.n1n.ai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MODE_ENDPOINT: Record<string, string> = {
  text2video: '/kling/v1/videos/text2video',
  image2video: '/kling/v1/videos/image2video',
  'motion-control': '/kling/v1/videos/motion-control',
  'advanced-lip-sync': '/kling/v1/videos/advanced-lip-sync',
  'lip-sync': '/kling/v1/videos/advanced-lip-sync',
};

async function uploadVideoToStorage(sourceUrl: string, userId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });

  if (error) throw new Error(`上传视频失败: ${error.message}`);

  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId');
    const mode = request.nextUrl.searchParams.get('mode');

    if (!taskId || !mode) {
      return NextResponse.json({ error: '缺少 taskId 或 mode' }, { status: 400 });
    }

    const endpointBase = MODE_ENDPOINT[mode];
    if (!endpointBase) {
      return NextResponse.json({ error: `不支持的 mode: ${mode}` }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    let userId = 'anonymous';

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      if (user) userId = user.id;
    }

    // 账号池：取一个 n1n key 查询
    const qKeyInfo = await pickKey('n1n');
    let qSuccess = false;
    let qErr: any = null;
    let res: Response;
    try {
      res = await fetch(`${N1N_BASE}${endpointBase}/${taskId}`, {
        headers: {
          Authorization: `Bearer ${qKeyInfo.keyValue}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      qSuccess = res.ok;
    } catch (err) {
      qErr = err;
      throw err;
    } finally {
      await releaseKey(qKeyInfo.keyId, qSuccess, qSuccess ? undefined : categorizeError(qErr));
    }

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `查询失败 (${res.status}): ${err}` }, { status: 500 });
    }

    const data = await res.json();
    console.log('Kling 查询结果:', JSON.stringify(data).slice(0, 500));

    if (data.code !== 0) {
      return NextResponse.json({ error: `Kling 错误: ${data.message}` }, { status: 500 });
    }

    const taskData = data.data;
    const rawStatus = taskData?.task_status || 'submitted';
    const videos = taskData?.task_result?.videos || [];
    const rawVideoUrl = videos[0]?.url || null;

    let status = 'processing';
    let progress = 30;
    let videoUrl = rawVideoUrl;

    if (rawStatus === 'succeed') {
      if (rawVideoUrl) {
        try {
          videoUrl = await uploadVideoToStorage(rawVideoUrl, userId);
        } catch (error) {
          console.warn('Kling 视频转存失败，回退原始 URL:', error);
          videoUrl = rawVideoUrl;
        }
      }

      status = videoUrl ? 'completed' : 'failed';
      progress = videoUrl ? 100 : 0;
    } else if (rawStatus === 'submitted') {
      status = 'pending';
      progress = 5;
    } else if (rawStatus === 'processing') {
      status = 'processing';
      progress = 50;
    } else if (rawStatus === 'failed') {
      status = 'failed';
      progress = 0;
    }

    return NextResponse.json({
      success: true,
      taskId,
      status,
      progress,
      videoUrl,
      errorDetail: rawStatus === 'failed' ? taskData?.task_status_msg : null,
    });
  } catch (error: any) {
    console.error('Kling 查询错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
