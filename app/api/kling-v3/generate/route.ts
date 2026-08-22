import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createFalClient } from '@fal-ai/client';
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// tier → fal endpoint 前缀
const TIER_ENDPOINT: Record<string, string> = {
  '4k': 'fal-ai/kling-video/v3/4k',
  'pro': 'fal-ai/kling-video/v3/pro',
  'standard': 'fal-ai/kling-video/v3/standard',
};

// 每秒价格(会员)。普通用户 +0.2/秒。4K 有无音频同价。
const KLING_PRICE: Record<string, { noAudio: number; audio: number }> = {
  '4k': { noAudio: 2.9, audio: 2.9 },
  'pro': { noAudio: 0.8, audio: 1.2 },
  'standard': { noAudio: 0.6, audio: 0.9 },
};

function getCharge(tier: string, generateAudio: boolean, duration: number, isMember: boolean): number {
  const p = KLING_PRICE[tier];
  if (!p) return 0;
  let perSec = generateAudio ? p.audio : p.noAudio;
  // 统一按会员价结算,不再区分会员/普通
  void isMember;
  const secs = Math.max(1, duration);
  return Math.round(perSec * secs * 100) / 100;
}

// base64 图片上传 Supabase 拿公开 URL(fal 要 http URL)；已是 URL 直接返回
async function toPublicUrl(input: string, prefix: string): Promise<string> {
  if (!input) return input;
  if (input.startsWith('http')) return input;
  if (!input.startsWith('data:')) return input;
  const match = input.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return input;
  const ext = match[1].split('/')[1] || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: match[1], upsert: false });
  if (error) throw new Error(`上传图片失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  let chargedAmount = 0;
  let userId: string | undefined;

  try {
    body = await req.json();
    const {
      tier = 'standard',
      mode = 't2v',
      prompt = '',
      duration = 5,
      generateAudio = false,
      firstFrameImage,   // 首帧(i2v/first-last)
      lastFrameImage,    // 尾帧(first-last)
      refImages,         // 多模态:参考图数组 → elements
      refVideoUrl,       // 多模态:参考视频 → elements
    } = body;
    userId = body.userId;

    const endpointBase = TIER_ENDPOINT[tier];
    if (!endpointBase) return NextResponse.json({ error: '未知的 Kling 规格' }, { status: 400 });

    // 图生走 image-to-video，文生走 text-to-video
    const isImageMode = mode === 'i2v' || mode === 'first-last' || mode === 'multimodal';
    const endpoint = `${endpointBase}/${isImageMode ? 'image-to-video' : 'text-to-video'}`;

    // 扣费(按秒 × 会员/普通 × 有无音频)
    if (userId) {
      const isMember = await checkMembership(userId);
      chargedAmount = getCharge(tier, !!generateAudio, Number(duration) || 5, isMember);
      if (chargedAmount > 0) {
        const deduct = await deductBalance(userId, chargedAmount, 'video_deduct',
          `Kling v3 ${tier} ${generateAudio ? '有声' : '无声'} ${duration}s`,
          { tier, mode, duration, generateAudio });
        if (!deduct.success) {
          return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
        }
      }
    }

    // 组装 fal input(不传 voice_ids/lip-sync 等语言控制参数)
    const input: Record<string, unknown> = {
      duration: String(Number(duration) || 5),
      generate_audio: !!generateAudio,
    };
    if (prompt) input.prompt = prompt;

    if (mode === 'i2v') {
      if (!firstFrameImage) throw new Error('图生视频需要首帧图片');
      input.start_image_url = await toPublicUrl(firstFrameImage, 'kling-v3/frames');
    } else if (mode === 'first-last') {
      if (!firstFrameImage || !lastFrameImage) throw new Error('首尾帧模式需要首帧和尾帧');
      input.start_image_url = await toPublicUrl(firstFrameImage, 'kling-v3/frames');
      input.end_image_url = await toPublicUrl(lastFrameImage, 'kling-v3/frames');
    } else if (mode === 'multimodal') {
      // 多模态 = 场景帧(start/end) + 角色元素(elements,最多3个,每个 1正面图+最多3参考图)
      // 场景起始帧(必填,视频第一帧/主场景)
      if (!firstFrameImage) throw new Error('多模态需要一张起始场景图');
      input.start_image_url = await toPublicUrl(firstFrameImage, 'kling-v3/frames');
      // 场景结束帧(可选)
      if (lastFrameImage) {
        input.end_image_url = await toPublicUrl(lastFrameImage, 'kling-v3/frames');
      }
      // 角色元素:elementsInput = [{ frontal, references:[...] }, ...]
      const elementsInput = Array.isArray(body.elements) ? body.elements : [];
      const elements: any[] = [];
      for (const el of elementsInput.slice(0, 3)) {  // 最多 3 个角色
        if (!el?.frontal) continue;
        const frontal = await toPublicUrl(el.frontal, 'kling-v3/elements');
        const refs: string[] = [];
        if (Array.isArray(el.references)) {
          for (const r of el.references.slice(0, 3)) {  // 每角色最多 3 参考图
            const u = await toPublicUrl(r, 'kling-v3/elements');
            if (u) refs.push(u);
          }
        }
        const one: any = { frontal_image_url: frontal };
        if (refs.length > 0) one.reference_image_urls = refs;
        elements.push(one);
      }
      // 参考视频元素(可选)
      if (refVideoUrl) elements.push({ video_url: refVideoUrl });
      if (elements.length > 0) input.elements = elements;
    } else {
      // t2v
      if (!prompt) throw new Error('文生视频需要提示词');
    }

    // 提交 fal 队列
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let falSuccess = false;
    let falErr: any = null;
    try {
      const submitted = await fal.queue.submit(endpoint, { input });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal 未返回 requestId');
      falSuccess = true;
      return NextResponse.json({ success: true, requestId, endpoint, pending: true });
    } catch (e) {
      falErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
    }
  } catch (error: any) {
    console.error('[kling-v3/generate] error:', error?.message);
    // 失败退款
    if (userId && chargedAmount > 0) {
      await refundBalance(userId, chargedAmount, 'Kling v3 生成失败退款', { tier: body?.tier, mode: body?.mode });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
