import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

falSingleton.config({ credentials: process.env.FAL_KEY! });

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 检测中文并自动翻译成英文（走 n1n gpt-4o-mini，速度快成本低）
async function ensureEnglishPrompt(prompt: string): Promise<string> {
  const hasChinese = /[一-鿿]/.test(prompt);
  if (!hasChinese) return prompt;
  try {
    const res = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Translate the following image editing instruction to English. Output only the translated text, no explanation.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
      }),
    });
    const data = await res.json();
    const translated = data?.choices?.[0]?.message?.content?.trim();
    if (translated) return translated;
  } catch (e) {
    console.error('[design/edit] prompt 翻译失败，使用原文:', e);
  }
  return prompt;
}

// ============================================================
// Design Workflow 统一编辑入口
// 架构：provider × capability(mode) 两层 Adapter，按 model 选具体实现
// 接口长期不变：{ imageUrl, maskUrl?, prompt, mode, provider, model?, ratio? }
// 新能力=新 mode，新供应商=新 provider，新模型=新 model
// ============================================================

type EditMode = 'region-edit' | 'remove' | 'replace' | 'expand';

interface AdapterInput {
  imageUrl: string;
  maskUrl?: string;
  prompt: string;
  model?: string;
  ratio?: string;
}

// Adapter 只决定 endpoint + input，提交走异步队列（避免 Vercel/Azure 函数超时 504）
interface AdapterPlan {
  endpoint: string;
  input: Record<string, unknown>;
}

// ── fal: region-edit（局部重绘）─────────────────────────────
// mask 极性已由客户端按 model 处理好，服务端只透传
function falRegionEdit(input: AdapterInput): AdapterPlan {
  const { imageUrl, maskUrl, prompt, model } = input;
  if (!maskUrl) throw new Error('局部重绘需要 mask');

  if (model === 'flux-inpainting') {
    // fal-ai/flux-lora/inpainting：白=重绘，黑=保留
    return {
      endpoint: 'fal-ai/flux-lora/inpainting',
      input: { image_url: imageUrl, mask_url: maskUrl, prompt, num_images: 1 },
    };
  }

  if (model === 'flux-fill') {
    // fal-ai/flux-pro/v1/fill：白=重绘，黑=保留（同 flux-inpainting 极性）
    return {
      endpoint: 'fal-ai/flux-pro/v1/fill',
      input: { image_url: imageUrl, mask_url: maskUrl, prompt, num_images: 1 },
    };
  }

  if (model === 'gpt-image-edit') {
    // openai/gpt-image-2 edit via fal（注意：无 fal-ai/ 前缀）：白=重绘，黑=保留
    return {
      endpoint: 'openai/gpt-image-2/edit',
      input: { image_url: imageUrl, mask_url: maskUrl, prompt },
    };
  }

  // 默认 ideogram/v2/edit：黑=重绘，白=保留（mask 已在客户端反转）
  return {
    endpoint: 'fal-ai/ideogram/v2/edit',
    input: { image_url: imageUrl, mask_url: maskUrl, prompt },
  };
}

// Adapter 注册表：provider → mode → 实现（返回 endpoint+input，统一异步提交）
// 未来 remove/replace/expand、openrouter/replicate 平行添加，不动现有
const ADAPTERS: Record<string, Partial<Record<EditMode, (i: AdapterInput) => AdapterPlan>>> = {
  fal: {
    'region-edit': falRegionEdit,
    // 'expand':   falExpand,    // V1.5
    // 'remove':   falRemove,    // V2
    // 'replace':  falReplace,   // V3
  },
};

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

    // ── 账号池取 key，异步提交（立即返回 requestId，前端轮询 fal-query）──
    const plan = adapter({ imageUrl, maskUrl, prompt: await ensureEnglishPrompt(prompt), model, ratio });
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let falSuccess = false;
    let falErr: any = null;
    try {
      const submitted = await fal.queue.submit(plan.endpoint, { input: plan.input });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal.ai 未返回 requestId');
      falSuccess = true;
      // 返回 pending + requestId + endpoint，前端轮询 /api/image/fal-query
      return NextResponse.json({ success: true, pending: true, requestId, endpoint: plan.endpoint, mode, provider });
    } catch (e) {
      falErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
    }
  } catch (error: any) {
    console.error('Design edit API error:', error);
    if (body?.userId) {
      const price = calcImagePrice(body.mode || 'region-edit');
      await refundBalance(body.userId, price, `设计编辑失败退款 - ${body.mode}`, { mode: body.mode });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
