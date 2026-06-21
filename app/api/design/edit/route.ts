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

type EditMode = 'region-edit' | 'remove' | 'replace' | 'expand' | 'bg-replace';

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

type AdapterFn = (i: AdapterInput) => AdapterPlan | Promise<AdapterPlan>;

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
    // openai/gpt-image-2/edit via fal：image_urls(数组)，白=重绘，黑=保留
    return {
      endpoint: 'openai/gpt-image-2/edit',
      input: { image_urls: [imageUrl], mask_url: maskUrl, prompt },
    };
  }

  // 默认 ideogram/v2/edit：黑=重绘，白=保留（mask 已在客户端反转）
  return {
    endpoint: 'fal-ai/ideogram/v2/edit',
    input: { image_url: imageUrl, mask_url: maskUrl, prompt },
  };
}

// ── fal: bg-replace（换背景）──────────────────────────────────
// bria/product-shot：一步换背景，自动识别主体，无需 mask
function falBgReplace(input: AdapterInput): AdapterPlan {
  const { imageUrl, prompt } = input;
  if (!prompt) throw new Error('换背景需要描述新背景');
  return {
    endpoint: 'fal-ai/bria/product-shot',
    input: { image_url: imageUrl, scene_description: prompt },
  };
}

// ── fal: replace（替换对象）──────────────────────────────────
// 涂抹区域 + 描述想替换成什么，走 ideogram/v2/edit（语义理解强）
function falReplace(input: AdapterInput): AdapterPlan {
  const { imageUrl, maskUrl, prompt } = input;
  if (!maskUrl) throw new Error('替换需要涂抹选区');
  if (!prompt) throw new Error('替换需要描述目标');
  // ideogram mask: 黑=重绘，白=保留（前端已按此极性导出）
  return {
    endpoint: 'fal-ai/ideogram/v2/edit',
    input: { image_url: imageUrl, mask_url: maskUrl, prompt },
  };
}

// ── fal: remove（消除对象）──────────────────────────────────
// bria/eraser：涂白=要删除区域，背景自动填充，不需要 prompt
function falRemove(input: AdapterInput): AdapterPlan {
  const { imageUrl, maskUrl } = input;
  if (!maskUrl) throw new Error('消除需要涂抹选区');
  return {
    endpoint: 'fal-ai/bria/eraser',
    input: { image_url: imageUrl, mask_url: maskUrl },
  };
}

// ── fal: expand（扩图）────────────────────────────────────────
// bria/expand 需要：canvas_size[w,h] + original_image_size[w,h] + original_image_location[x,y]
// 解析原图尺寸 → 按目标比例算出能容纳原图的画布 → 原图居中放置
async function falExpand(input: AdapterInput): Promise<AdapterPlan> {
  const { imageUrl, ratio } = input;
  if (!ratio) throw new Error('扩图需要指定目标比例');
  const [rw, rh] = ratio.split(':').map(Number);
  if (!rw || !rh) throw new Error('比例格式错误');

  // 下载原图解析宽高
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('无法获取原图');
  const buf = Buffer.from(await imgRes.arrayBuffer());
  let origW = 1024, origH = 1024;
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    // JPEG
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC2)) {
        origH = (buf[i+5] << 8) | buf[i+6];
        origW = (buf[i+7] << 8) | buf[i+8];
        break;
      }
      i += 2 + ((buf[i+2] << 8) | buf[i+3]);
    }
  } else if (buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    // PNG
    origW = (buf[16]<<24)|(buf[17]<<16)|(buf[18]<<8)|buf[19];
    origH = (buf[20]<<24)|(buf[21]<<16)|(buf[22]<<8)|buf[23];
  }

  // 按目标比例算画布，保证完整容纳原图（只扩不裁）
  const targetRatio = rw / rh;
  let cw: number, ch: number;
  if (targetRatio > origW / origH) {
    ch = origH; cw = Math.round(origH * targetRatio);   // 更宽：保高扩宽
  } else {
    cw = origW; ch = Math.round(origW / targetRatio);   // 更高：保宽扩高
  }
  // 原图居中放置
  const locX = Math.round((cw - origW) / 2);
  const locY = Math.round((ch - origH) / 2);

  return {
    endpoint: 'fal-ai/bria/expand',
    input: {
      image_url: imageUrl,
      canvas_size: [cw, ch],
      original_image_size: [origW, origH],
      original_image_location: [locX, locY],
    },
  };
}

// Adapter 注册表：provider → mode → 实现（返回 endpoint+input，统一异步提交）
const ADAPTERS: Record<string, Partial<Record<EditMode, AdapterFn>>> = {
  fal: {
    'region-edit': falRegionEdit,
    'expand':      falExpand,
    'remove':      falRemove,
    'replace':     falReplace,
    'bg-replace':  falBgReplace,
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
    if (!prompt && mode !== 'remove' && mode !== 'expand') {
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
    const plan = await adapter({ imageUrl, maskUrl, prompt: await ensureEnglishPrompt(prompt), model, ratio });
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
