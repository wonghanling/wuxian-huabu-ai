import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

// 火山引擎 Seedream 5.0 Pro 图片生成/编辑(同步返回图 URL)
const ARK_IMAGE_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const SEEDREAM_MODEL = 'doubao-seedream-5-0-pro-260628';
const PRICE_KEY = 'seedream-5-pro-edit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 火山返回的 TOS 图片链接 24 小时后失效，转存到自己的 Supabase 拿永久 URL
async function transferToStorage(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载生成图失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `images/seedream-edit/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`转存失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

// 交互编辑三种模式(图层分离/精准坐标/任意标记)在 API 层无差别，均为 image + prompt → 单图
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { imageUrl, prompt, size, userId } = body;

    if (!imageUrl) return NextResponse.json({ error: '缺少原图' }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: '缺少编辑指令' }, { status: 400 });

    // 扣费(先扣，失败退)
    const price = calcImagePrice(PRICE_KEY);
    if (userId) {
      const deduct = await deductBalance(userId, price, 'image_deduct', 'Seedream 5.0 Pro 编辑', { model: SEEDREAM_MODEL });
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    // 账号池取火山 key
    const keyInfo = await pickKey('ark');
    let arkSuccess = false;
    let arkErr: any = null;
    let data: any;
    try {
      const reqBody: Record<string, unknown> = {
        model: SEEDREAM_MODEL,
        prompt,
        image: imageUrl,                       // 支持 URL(涂鸦合并图上传后的 URL)
        // 注: Seedream 5.0 Pro 只生成单图，不支持 sequential_image_generation 参数(那是 Lite/4.x 组图用)
        response_format: 'url',
        watermark: false,
      };
      // 尺寸可选(宽x高)，不传则模型按参考图自适应
      if (size && typeof size === 'string') reqBody.size = size;

      const res = await fetch(ARK_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyInfo.keyValue}`,
        },
        body: JSON.stringify(reqBody),
      });
      data = await res.json();

      if (!res.ok) {
        arkErr = new Error(data?.error?.message || data?.message || `生成失败(${res.status})`);
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

    // 解析出图 URL
    const outUrl = data?.data?.[0]?.url;
    if (!outUrl) {
      // 无图返回视为审核不过/无法生成 → 直接失败(退款)，不让前端空转
      if (userId) await refundBalance(userId, price, 'Seedream 编辑失败退款', { model: SEEDREAM_MODEL });
      return NextResponse.json({ failed: true, reason: '审核未通过：本次编辑被平台判定为不合规或无法生成，请调整描述后重试' }, { status: 200 });
    }

    // 火山图 24h 过期，转存 Supabase 拿永久 URL(转存失败则降级用原 URL，至少当次能看到)
    let finalUrl = outUrl;
    try {
      finalUrl = await transferToStorage(outUrl);
    } catch (e) {
      console.error('[design/seedream-edit] 转存失败，降级用火山临时URL:', e);
    }

    return NextResponse.json({ success: true, imageUrl: finalUrl });
  } catch (error: any) {
    console.error('[design/seedream-edit] error:', error);
    // 火山审核类错误(常含 sensitive/safety/审核 关键词)→ 明确失败提示，避免前端把它当网络错误重试
    const msg = error?.message || '';
    const isModeration = /sensitive|safety|policy|审核|违规|unsafe|risk|blocked/i.test(msg);
    if (body?.userId) {
      await refundBalance(body.userId, calcImagePrice(PRICE_KEY), 'Seedream 编辑失败退款', { model: SEEDREAM_MODEL });
    }
    if (isModeration) {
      return NextResponse.json({ failed: true, reason: '审核未通过：本次编辑被平台判定为不合规，请调整描述后重试' }, { status: 200 });
    }
    return NextResponse.json({ error: msg || '服务器错误' }, { status: 500 });
  }
}
