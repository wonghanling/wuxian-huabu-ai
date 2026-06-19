import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

falSingleton.config({ credentials: process.env.FAL_KEY! });

// ============================================================
// Design Workflow 统一编辑入口
// 架构：provider × capability(mode) 两层 Adapter，按 model 选具体实现
// 接口长期不变：{ imageUrl, maskUrl?, prompt, mode, provider, model?, ratio? }
// 新能力=新 mode，新供应商=新 provider，新模型=新 model
// ============================================================

type EditMode = 'region-edit' | 'remove' | 'replace' | 'expand';

interface AdapterInput {
  fal: ReturnType<typeof createFalClient>;
  imageUrl: string;
  maskUrl?: string;
  prompt: string;
  model?: string;
  ratio?: string;
}

// ── fal: region-edit（局部重绘）─────────────────────────────
// mask 极性已由客户端按 model 处理好，服务端只透传
async function falRegionEdit(input: AdapterInput): Promise<string> {
  const { fal, imageUrl, maskUrl, prompt, model } = input;
  if (!maskUrl) throw new Error('局部重绘需要 mask');

  if (model === 'flux-inpainting') {
    // fal-ai/flux-lora/inpainting：白=重绘，黑=保留
    const res: any = await fal.subscribe('fal-ai/flux-lora/inpainting', {
      input: { image_url: imageUrl, mask_url: maskUrl, prompt, num_images: 1 },
    });
    const url = res?.data?.images?.[0]?.url || res?.images?.[0]?.url;
    if (!url) throw new Error('flux-inpainting 未返回结果图');
    return url;
  }

  // 默认 ideogram/v2/edit：黑=重绘，白=保留（mask 已在客户端反转）
  const res: any = await fal.subscribe('fal-ai/ideogram/v2/edit', {
    input: { image_url: imageUrl, mask_url: maskUrl, prompt },
  });
  const url = res?.data?.images?.[0]?.url || res?.images?.[0]?.url;
  if (!url) throw new Error('ideogram-edit 未返回结果图');
  return url;
}

// Adapter 注册表：provider → mode → 实现
// 未来 remove/replace/expand、openrouter/replicate 平行添加，不动现有
const ADAPTERS: Record<string, Partial<Record<EditMode, (i: AdapterInput) => Promise<string>>>> = {
  fal: {
    'region-edit': falRegionEdit,
    // 'expand':   falExpand,    // V1.5
    // 'remove':   falRemove,    // V2
    // 'replace':  falReplace,   // V3
  },
};

// 结果图转存 Supabase 永久存储
async function mirrorToStorage(sourceUrl: string, userId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载结果图失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `design/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`转存失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const {
      imageUrl,
      maskUrl,
      prompt,
      mode = 'region-edit',
      provider = 'fal',
      model,
      ratio,
      userId,
    } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: '缺少原图' }, { status: 400 });
    }
    if (!prompt && mode !== 'remove') {
      return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });
    }

    const providerAdapters = ADAPTERS[provider];
    const adapter = providerAdapters?.[mode as EditMode];
    if (!adapter) {
      return NextResponse.json({ error: `暂不支持 ${provider}/${mode}` }, { status: 400 });
    }

    // ── 扣费（按 mode 取 pricing key）──────────────────────────
    const price = calcImagePrice(mode);
    if (userId) {
      const deduct = await deductBalance(
        userId, price, 'image_deduct',
        `设计编辑 - ${mode}`,
        { mode, provider, model },
      );
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    // ── 账号池取 key 执行 ──────────────────────────────────────
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let falSuccess = false;
    let falErr: any = null;
    let resultUrl = '';
    try {
      resultUrl = await adapter({ fal, imageUrl, maskUrl, prompt, model, ratio });
      falSuccess = true;
    } catch (e) {
      falErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
    }

    // mirror 到 Supabase（失败则用原 URL 兜底）
    let finalUrl = resultUrl;
    if (userId) {
      try {
        finalUrl = await mirrorToStorage(resultUrl, userId);
      } catch (e) {
        console.error('design edit mirror 失败，用原 URL:', e);
      }
    }

    return NextResponse.json({ success: true, imageUrl: finalUrl, mode, provider });
  } catch (error: any) {
    console.error('Design edit API error:', error);
    if (body?.userId) {
      const price = calcImagePrice(body.mode || 'region-edit');
      await refundBalance(body.userId, price, `设计编辑失败退款 - ${body.mode}`, { mode: body.mode });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
