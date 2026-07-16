import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// fal 返回的视频链接转存到 Supabase 拿永久 URL(fal 链接会过期)
async function transferVideoToStorage(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `videos/kling-v3/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });
  if (error) throw new Error(`转存视频失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

// 轮询 Kling v3 生成结果(独立于图片 fal-query，返回视频 URL)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get('requestId');
  const endpoint = searchParams.get('endpoint');

  if (!requestId || !endpoint) {
    return NextResponse.json({ error: '缺少 requestId 或 endpoint' }, { status: 400 });
  }

  const keyInfo = await pickKey('fal');
  const fal = createFalClient({ credentials: keyInfo.keyValue });
  let success = false;
  let caught: any = null;

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result(endpoint, { requestId });
      const d = result.data as any;
      const rawUrl = d?.video?.url || d?.video_url || d?.output?.video?.url || null;
      if (!rawUrl) {
        success = true;
        return NextResponse.json({
          failed: true,
          reason: '审核未通过',
          error: '审核未通过：本次生成未产出视频，请调整描述后重试',
        }, { status: 200 });
      }
      // 转存到 Supabase(fal 链接会过期)
      let videoUrl = rawUrl;
      try {
        videoUrl = await transferVideoToStorage(rawUrl);
      } catch (e) {
        console.error('[kling-v3/query] 转存失败，降级用 fal 临时链接:', e);
      }
      success = true;
      return NextResponse.json({ success: true, videoUrl });
    }

    success = true;
    return NextResponse.json({ pending: true, status: status.status });
  } catch (error: any) {
    caught = error;
    console.error('[kling-v3/query] error:', error?.message, error?.status);
    const bodyStr = JSON.stringify(error?.body || '') + ' ' + (error?.message || '');
    const isPermanentFail =
      error?.status === 422 ||
      /no_media_generated|unsafe|not generate the expected|content policy|审核|violat|rejected|flagged/i.test(bodyStr);
    if (isPermanentFail) {
      success = true;
      return NextResponse.json({
        failed: true,
        reason: '审核未通过',
        error: '审核未通过：本次生成被平台判定为不合规或无法生成，请调整描述后重试',
      }, { status: 200 });
    }
    return NextResponse.json({ error: error.message || '查询失败' }, { status: 500 });
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
