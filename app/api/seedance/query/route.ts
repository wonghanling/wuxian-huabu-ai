import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, pickKeyById, releaseKey, categorizeError } from '@/lib/api-key-pool';

// 火山北京节点仅国内/亚太可稳定连通，指定函数跑在香港区(默认美国 iad1 连火山超时)
export const preferredRegion = 'hkg1';

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
    const arkKeyId = request.nextUrl.searchParams.get('arkKeyId');
    if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

    if (!ARK_API_KEY) {
      return NextResponse.json({ error: '未配置 ARK_API_KEY' }, { status: 500 });
    }

    // 用指定 key 查询，避免多 key 时任务 ID 找不到
    const arkQKeyInfo = arkKeyId ? await pickKeyById(arkKeyId, 'ark') : await pickKey('ark');
    let arkQSuccess = false;
    let arkQErr: any = null;
    let res: Response;
    try {
      res = await fetch(ARK_QUERY_URL + taskId, {
        headers: { 'Authorization': `Bearer ${arkQKeyInfo.keyValue}` },
      });
      arkQSuccess = res.ok;
    } catch (err) {
      arkQErr = err;
      throw err;
    } finally {
      await releaseKey(arkQKeyInfo.keyId, arkQSuccess, arkQSuccess ? undefined : categorizeError(arkQErr));
    }

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
