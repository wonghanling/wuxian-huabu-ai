import { NextRequest, NextResponse } from 'next/server';
import { createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { mirrorAsset } from '@/lib/asset-upload';

export const maxDuration = 120;

// 存储客户端不再在这里建 —— 统一由 mirrorAsset 决定写 Azure 还是 Supabase

// 下载 fal 裁切后的视频并转存到自有存储(永久URL),失败兜底原始URL
//
// 走 mirrorAsset 统一入口:配了 Azure 就写 Azure(缓存头可控)，没配回退 Supabase。
// 路径规则一字未改，仍是 videos/{userId}/clip-{ts}-{rand}.mp4 ——
// 换的只是存储后端，历史文件的 URL 继续有效。
async function mirrorVideo(sourceUrl: string, userId: string): Promise<string> {
  try {
    const path = `videos/${userId}/clip-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    return await mirrorAsset(sourceUrl, path, 'video/mp4');
  } catch (e) {
    console.warn('转存裁切视频失败,使用原始URL:', e);
    return sourceUrl;
  }
}

// POST /api/video/trim — fal-ai/workflow-utilities/trim-video 裁切视频片段
// 免费给用户用(不扣费);仅做视频裁切
export async function POST(req: NextRequest) {
  try {
    const { videoUrl, start, end, userId } = await req.json();
    if (!videoUrl) return NextResponse.json({ error: '缺少 videoUrl' }, { status: 400 });
    if (start == null || end == null || end <= start) {
      return NextResponse.json({ error: '无效的区间' }, { status: 400 });
    }

    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let success = false;
    let caught: any = null;
    try {
      const result: any = await fal.subscribe('fal-ai/workflow-utilities/trim-video', {
        input: { video_url: videoUrl, start_time: start, end_time: end },
      });
      // 输出视频 URL(兜底多字段)
      const rawUrl = result?.data?.video?.url || result?.data?.video_url || result?.video?.url || result?.data?.url;
      if (!rawUrl) throw new Error('未获取到裁切视频 URL: ' + JSON.stringify(result?.data ?? result).slice(0, 200));

      const finalUrl = userId ? await mirrorVideo(rawUrl, userId) : rawUrl;
      success = true;
      return NextResponse.json({ success: true, videoUrl: finalUrl });
    } catch (err: any) {
      caught = err;
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
    }
  } catch (error: any) {
    console.error('视频裁切错误:', error);
    return NextResponse.json({ error: error?.message || '服务器错误' }, { status: 500 });
  }
}
