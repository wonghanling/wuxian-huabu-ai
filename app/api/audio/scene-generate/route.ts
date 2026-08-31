import { NextRequest, NextResponse } from 'next/server';
import { createFalClient } from '@fal-ai/client';
import { createClient } from '@supabase/supabase-js';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 120;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 场景声 4 个模型(fal stable-audio-3),统一 0.3 元/次
const SCENE_MODELS: Record<string, { endpoint: string; needAudio: boolean }> = {
  'text-to-audio':       { endpoint: 'fal-ai/stable-audio-3/medium/text-to-audio',       needAudio: false }, // 文本转音频
  'text-to-sound':       { endpoint: 'fal-ai/stable-audio-3/medium/base/text-to-audio',  needAudio: false }, // 文本转音效
  'sound-to-sound':      { endpoint: 'fal-ai/stable-audio-3/medium/audio-to-audio',      needAudio: true  }, // 音效到音效
  'music-to-music':      { endpoint: 'fal-ai/stable-audio-3/small/music/audio-to-audio', needAudio: true  }, // 音乐到音乐
};
const SCENE_PRICE = 0.3;

// 下载 fal 音频并转存 Supabase Storage(永久 URL),失败兜底原始 URL
async function mirrorAudio(sourceUrl: string, userId: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`下载音频失败: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `audio/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    const { error } = await supabaseAdmin.storage.from('assets').upload(filename, buffer, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
    return data.publicUrl;
  } catch (e) {
    console.warn('转存场景声失败,使用原始URL:', e);
    return sourceUrl;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sceneMode, prompt, audioUrl, duration = 30, userId } = await req.json();

    const cfg = SCENE_MODELS[sceneMode];
    if (!cfg) return NextResponse.json({ error: '无效的场景声模式' }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    if (cfg.needAudio && !audioUrl) return NextResponse.json({ error: '该模式需要输入音频' }, { status: 400 });

    // 会员校验 + 扣费(照图片/视频卡一致)
    if (userId) {
      const isMember = await checkMembership(userId);
      if (!isMember) return NextResponse.json({ error: '需要开通会员才能使用' }, { status: 402 });
      const deduct = await deductBalance(userId, SCENE_PRICE, 'image_deduct', '场景声生成(stable-audio-3)', { model: cfg.endpoint });
      if (!deduct.success) return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
    }

    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let success = false;
    let caught: any = null;
    try {
      const input: any = { prompt, duration };
      if (cfg.needAudio) input.audio_url = audioUrl;

      const result: any = await fal.subscribe(cfg.endpoint, { input });
      // 输出音频 URL(stable-audio-3 返回 audio_file.url 或 audio.url)
      const rawUrl = result?.data?.audio_file?.url || result?.data?.audio?.url || result?.data?.audio_url || result?.audio?.url;
      if (!rawUrl) throw new Error('未获取到音频 URL: ' + JSON.stringify(result?.data ?? result).slice(0, 200));

      const finalUrl = userId ? await mirrorAudio(rawUrl, userId) : rawUrl;
      success = true;
      return NextResponse.json({ success: true, audioUrl: finalUrl });
    } catch (err: any) {
      caught = err;
      if (userId) await refundBalance(userId, SCENE_PRICE, '场景声生成失败退款', { model: cfg.endpoint });
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
    }
  } catch (error: any) {
    console.error('场景声生成错误:', error);
    return NextResponse.json({ error: error?.message || '服务器错误' }, { status: 500 });
  }
}
