import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// 已迁 Kie，不再需要 fal 客户端
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { putAsset } from '@/lib/asset-upload';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Kie 的 Kling 3.0 只有一个端点，档位靠 input.mode 区分
const KIE_MODEL = 'kling/kling-3-0';

// 前端传来的 tier → Kie 的 mode。mode 即清晰度:std=720P、pro=1080P、4K=4K
const TIER_MODE: Record<string, string> = {
  '4k': '4K',
  'pro': 'pro',
  'standard': 'std',
  // 兼容前端直接传 Kie 值的情况
  '4K': '4K',
  'std': 'std',
};

// 每秒价格(统一价，不分会员)。迁 Kie 后全面下降。
const KLING_PRICE: Record<string, { noAudio: number; audio: number }> = {
  '4k': { noAudio: 2.36, audio: 2.36 },   // 4K 有无音频同价
  'pro': { noAudio: 0.707, audio: 1.010 },
  'standard': { noAudio: 0.572, audio: 0.774 },
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
  return await putAsset(filename, buffer, match[1]);
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

    const kieMode = TIER_MODE[tier];
    if (!kieMode) return NextResponse.json({ error: '未知的 Kling 规格' }, { status: 400 });

    // 多模态已下架:Kie Kling 3.0 只有 image_urls 一个图片字段，没有
    // elements(角色元素 + @引用)那套结构，无法等价迁移。
    if (mode === 'multimodal') {
      return NextResponse.json(
        { error: '多模态模式暂不可用，请改用文生 / 图生 / 首尾帧' },
        { status: 400 }
      );
    }

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

    // 组装 Kie input。与 fal 时期的差别:
    //   图片字段    fal 是 start_image_url / end_image_url 两个
    //               Kie 是 image_urls 一个数组，靠顺序区分首帧与尾帧
    //   音频开关    fal 是 generate_audio，Kie 是 sound(默认 false)
    //   清晰度      fal 在端点路径里，Kie 用 input.mode(std/pro/4K)
    const input: Record<string, unknown> = {
      duration: String(Number(duration) || 5),
      sound: !!generateAudio,
      mode: kieMode,
    };
    if (prompt) input.prompt = prompt;

    if (mode === 'i2v') {
      if (!firstFrameImage) throw new Error('图生视频需要首帧图片');
      input.image_urls = [await toPublicUrl(firstFrameImage, 'kling-v3/frames')];
    } else if (mode === 'first-last') {
      if (!firstFrameImage || !lastFrameImage) throw new Error('首尾帧模式需要首帧和尾帧');
      input.image_urls = [
        await toPublicUrl(firstFrameImage, 'kling-v3/frames'),
        await toPublicUrl(lastFrameImage, 'kling-v3/frames'),
      ];
    } else {
      // t2v:不传 image_urls。此时 aspect_ratio 才有意义 —— 有图时上游会
      // 按图片自动适配比例。前端目前不传这个参数，不传则用上游默认 16:9。
      if (!prompt) throw new Error('文生视频需要提示词');
      const ar = body?.aspectRatio || body?.ratio;
      if (ar) input.aspect_ratio = ar;
    }

    // 提交 Kie 任务
    const keyInfo = await pickKey('kie');
    let kieSuccess = false;
    let kieErr: any = null;
    try {
      const res = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyInfo.keyValue}`,
        },
        body: JSON.stringify({ model: KIE_MODEL, input }),
      });
      const data = await res.json();
      // Kie 用 body 的 code 表达错误，HTTP 状态可能仍是 200
      if (!res.ok || data?.code !== 200) {
        throw new Error(data?.msg || data?.message || `提交失败 HTTP ${res.status}`);
      }
      const requestId = data?.data?.taskId;
      if (!requestId) throw new Error('Kie 未返回 taskId');
      kieSuccess = true;
      // endpoint 用中性代号 c2 —— 与其它 Kie 通道一致，查询侧据此走 Kie 分支
      return NextResponse.json({ success: true, requestId, endpoint: 'c2', pending: true });
    } catch (e) {
      kieErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, kieSuccess, kieSuccess ? undefined : categorizeError(kieErr));
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
