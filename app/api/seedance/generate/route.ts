import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 60;

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Seedance 定价（用户侧价格，会员/普通）
const SEEDANCE_PRICE: Record<string, { member: number; normal: number }> = {
  'doubao-seedance-2-0-260128_480p':  { member: 0.71, normal: 0.91 },
  'doubao-seedance-2-0-260128_720p':  { member: 1.29, normal: 1.49 },
  'doubao-seedance-2-0-260128_1080p': { member: 2.81, normal: 3.01 },
  'doubao-seedance-2-0-fast-260128_480p': { member: 0.60, normal: 0.80 },
  'doubao-seedance-2-0-fast-260128_720p': { member: 1.06, normal: 1.26 },
};

function getSeedanceCharge(model: string, resolution: string, generateAudio: boolean, duration: number, isMember: boolean) {
  const key = `${model}_${resolution}`;
  const price = SEEDANCE_PRICE[key];
  if (!price) return 0;
  const perSec = isMember ? price.member : price.normal;
  const secs = duration === -1 ? 5 : Math.max(1, duration);
  return Math.round(perSec * secs * 100) / 100;
}

// 上传 base64 图片到 Supabase Storage，返回公开 URL
async function uploadBase64ToStorage(base64: string, prefix: string): Promise<string> {
  if (!base64 || !base64.startsWith('data:')) return base64;
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return base64;
  const mimeType = match[1];
  const ext = mimeType.split('/')[1] || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage.from('assets').upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`上传图片失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  let chargedAmount = 0;

  try {
    body = await req.json();
    const {
      mode = 't2v',
      model = 'doubao-seedance-2-0-260128',
      prompt = '',
      ratio = '16:9',
      duration = 5,
      resolution = '720p',
      generateAudio = true,
      firstFrameImage,
      lastFrameImage,
      refImages,
      refVideoUrl,
      refAudioBase64,
      userId,
    } = body;

    if (!ARK_API_KEY) {
      return NextResponse.json({ error: '未配置 ARK_API_KEY' }, { status: 500 });
    }

    // 扣费
    if (userId) {
      const isMember = await checkMembership(userId);
      chargedAmount = getSeedanceCharge(model, resolution, generateAudio, Number(duration), isMember);
      if (chargedAmount > 0) {
        const deduct = await deductBalance(userId, chargedAmount, 'video_deduct',
          `Seedance 视频生成 ${model} ${resolution} ${generateAudio ? '有声' : '无声'}`,
          { model, resolution, generateAudio, duration, mode });
        if (!deduct.success) {
          return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
        }
      }
    }

    // 构建 content 数组
    const content: any[] = [];

    // 文本提示词
    if (prompt) {
      content.push({ type: 'text', text: prompt });
    }

    if (mode === 't2v') {
      // 文生视频：只需提示词，已在上面添加
      if (!prompt) return NextResponse.json({ error: '文生视频需要提示词' }, { status: 400 });

    } else if (mode === 'i2v') {
      // 图生视频-首帧
      if (!firstFrameImage) return NextResponse.json({ error: '需要首帧图片' }, { status: 400 });
      const url = await uploadBase64ToStorage(firstFrameImage, 'seedance/frames');
      content.push({ type: 'image_url', image_url: { url }, role: 'first_frame' });

    } else if (mode === 'first-last') {
      // 图生视频-首尾帧
      if (!firstFrameImage || !lastFrameImage) return NextResponse.json({ error: '需要首帧和尾帧图片' }, { status: 400 });
      const firstUrl = await uploadBase64ToStorage(firstFrameImage, 'seedance/frames');
      const lastUrl = await uploadBase64ToStorage(lastFrameImage, 'seedance/frames');
      content.push({ type: 'image_url', image_url: { url: firstUrl }, role: 'first_frame' });
      content.push({ type: 'image_url', image_url: { url: lastUrl }, role: 'last_frame' });

    } else if (mode === 'multimodal') {
      // 多模态参考
      if ((!refImages || refImages.length === 0) && !refVideoUrl) {
        return NextResponse.json({ error: '多模态模式需要至少一张参考图或视频URL' }, { status: 400 });
      }
      // 参考图片
      if (refImages && refImages.length > 0) {
        for (const img of refImages) {
          const url = await uploadBase64ToStorage(img, 'seedance/refs');
          content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
        }
      }
      // 参考视频
      if (refVideoUrl) {
        content.push({ type: 'video_url', video_url: { url: refVideoUrl }, role: 'reference_video' });
      }
      // 参考音频
      if (refAudioBase64) {
        content.push({ type: 'audio_url', audio_url: { url: refAudioBase64 }, role: 'reference_audio' });
      }
    }

    // 构建请求体
    const requestBody: any = {
      model,
      content,
      resolution,
      ratio,
      generate_audio: generateAudio,
    };

    // 时长：-1 表示智能选择
    if (duration === -1) {
      requestBody.duration = -1;
    } else {
      requestBody.duration = Number(duration) || 5;
    }

    console.log('Seedance 请求:', JSON.stringify({ model, mode, ratio, resolution, duration, generate_audio: generateAudio }));

    // 账号池：取一个 ARK key
    const keyInfo = await pickKey('ark');
    let arkSuccess = false;
    let arkErr: any = null;
    let data: any;
    try {
      const res = await fetch(ARK_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyInfo.keyValue}`,
        },
        body: JSON.stringify(requestBody),
      });

      data = await res.json();
      console.log('Seedance 提交结果:', JSON.stringify(data).slice(0, 300));

      if (!res.ok) {
        arkErr = new Error(data?.error?.message || data?.message || '提交失败');
        (arkErr as any).status = res.status;
        throw arkErr;
      }
      arkSuccess = true;
    } catch (err) {
      if (!arkErr) arkErr = err;
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, arkSuccess, arkSuccess ? undefined : categorizeError(arkErr));
    }

    const taskId = data.id;
    if (!taskId) throw new Error('未返回任务ID');

    return NextResponse.json({ success: true, taskId, arkKeyId: keyInfo.keyId });

  } catch (error: any) {
    console.error('Seedance 生成错误:', error);

    if (body?.userId && chargedAmount > 0) {
      await refundBalance(body.userId, chargedAmount, `Seedance 视频生成失败退款`, {
        model: body.model, resolution: body.resolution, mode: body.mode,
      });
    }

    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
