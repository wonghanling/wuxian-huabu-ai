import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const maxDuration = 300;
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

fal.config({ credentials: process.env.FAL_KEY! });

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 图片模型配置
const IMAGE_MODELS: Record<string, {
  provider: 'n1n' | 'fal';
  yunwuModel?: string;
  falEndpoint?: string;
  apiType?: 'chat' | 'midjourney' | 'replicate' | 'image-generation' | 'gemini-native';
  requiresImage?: boolean;
  supportsImage?: boolean;
}> = {
  // --- n1n.ai 模型 ---
  'nano-banana': {
    provider: 'n1n',
    yunwuModel: 'gemini-2.5-flash-image',
    apiType: 'gemini-native',
    supportsImage: true,
  },
  'nano-banana-pro': {
    provider: 'fal',
    falEndpoint: 'fal-ai/nano-banana-2/edit',
    supportsImage: true,
  },
  'mj_imagine': {
    provider: 'n1n',
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
    supportsImage: true,
  },
  'doubao-seedream-4-5-251128': {
    provider: 'n1n',
    yunwuModel: 'doubao-seedream-4-5-251128',
    apiType: 'image-generation',
    supportsImage: true,
  },
  // --- fal.ai 模型 ---
  'flux-kontext': {
    provider: 'fal',
    falEndpoint: 'fal-ai/flux-pro/kontext/max',
    requiresImage: true, // 必须上传图片，专做图生图
  },
  'flux-kontext-max': {
    provider: 'fal',
    falEndpoint: 'fal-ai/flux-pro/kontext/max/text-to-image',
    // 纯文生图，不需要图片
  },
  'nano-banana-pro-multi': {
    provider: 'fal',
    falEndpoint: 'fal-ai/nano-banana-pro/edit',
    requiresImage: true,
    supportsImage: true,
  },
};

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { model, prompt, aspectRatio = '1:1', imageBase64, imageBase64Array, imageUrlArray, userId, imageQuality } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    if (model === 'nano-banana-pro-multi' && (!imageUrlArray || imageUrlArray.length === 0)) {
      return NextResponse.json({ error: '多图融合模型需要至少一张图片' }, { status: 400 });
    } else if (modelConfig.requiresImage && model !== 'nano-banana-pro-multi' && !imageBase64) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    // ── 扣费 ──────────────────────────────────────────────────
    const pricingKey = model === 'nano-banana-pro'
      ? (imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
      : model === 'nano-banana-pro-multi'
      ? (imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
      : model;
    const price = calcImagePrice(pricingKey);
    if (userId) {
      const deduct = await deductBalance(
        userId, price, 'image_deduct',
        `图片生成 - ${model}`,
        { model, aspectRatio },
      );
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
    }

    let imageUrl = '';

    // ── fal.ai 路径 ──────────────────────────────────────────────
    if (modelConfig.provider === 'fal') {
      const endpoint = modelConfig.falEndpoint!;
      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspectRatio,
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '2',
      };

      // 多图融合模型：传 image_urls 数组 + resolution
      if (model === 'nano-banana-pro-multi') {
        const urls: string[] = imageUrlArray && Array.isArray(imageUrlArray) ? imageUrlArray : [];
        if (urls.length === 0) throw new Error('多图融合模型需要至少一张图片');
        input.image_urls = urls;
        input.resolution = imageQuality === '4k' ? '4K' : '2K';
        delete input.aspect_ratio;
        delete input.output_format;
        delete input.safety_tolerance;
      } else if (model === 'nano-banana-pro') {
        // 有图用 /edit，无图用纯文生图 endpoint
        const hasImages = imageUrlArray && Array.isArray(imageUrlArray) && imageUrlArray.length > 0;
        const actualEndpoint = hasImages ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2';
        input.resolution = imageQuality === '4k' ? '4K' : '2K';
        delete input.aspect_ratio;
        delete input.num_images;
        delete input.output_format;
        delete input.safety_tolerance;
        if (hasImages) {
          input.image_urls = imageUrlArray;
        }
        const submitted = await fal.queue.submit(actualEndpoint, { input });
        const requestId = submitted.request_id;
        if (!requestId) throw new Error('fal.ai 未返回 requestId');
        return NextResponse.json({ success: true, requestId, model, prompt, pending: true });
      } else if (imageBase64) {
        input.image_url = imageBase64;
      }

      const submitted = await fal.queue.submit(endpoint, { input });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal.ai 未返回 requestId');

      return NextResponse.json({ success: true, requestId, model, prompt, pending: true });

    // ── n1n.ai 路径 ──────────────────────────────────────────────
    } else if (modelConfig.apiType === 'gemini-native') {
      const parts: any[] = [];

      // 多图支持（imageBase64Array 优先）
      if (imageBase64Array && Array.isArray(imageBase64Array)) {
        imageBase64Array.forEach(img => {
          const base64Match = img.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
          if (base64Match) {
            parts.push({ inline_data: { mime_type: `image/${base64Match[1]}`, data: base64Match[2] } });
          }
        });
      } else if (imageBase64) {
        // 单图兼容
        const base64Match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
        if (base64Match) {
          parts.push({ inline_data: { mime_type: `image/${base64Match[1]}`, data: base64Match[2] } });
        }
      }

      parts.push({ text: prompt });

      const response = await fetch(
        `${YUNWU_BASE_URL}/v1beta/models/${modelConfig.yunwuModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio } },
          }),
        }
      );

      if (!response.ok) throw new Error(`API 错误: ${response.status}`);
      const data = await response.json();
      const responseParts = data.candidates?.[0]?.content?.parts;
      if (!responseParts) throw new Error('响应中没有 parts');

      for (const part of responseParts) {
        const inlineData = part.inlineData || part.inline_data;
        if (inlineData?.data) {
          imageUrl = `data:${inlineData.mimeType || inlineData.mime_type || 'image/png'};base64,${inlineData.data}`;
          break;
        } else if (part.text?.startsWith('http')) {
          imageUrl = part.text;
          break;
        }
      }
      if (!imageUrl) throw new Error('无法解析图片');

    } else if (modelConfig.apiType === 'midjourney') {
      const base64Array = imageBase64 ? [imageBase64] : [];
      const response = await fetch(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botType: 'MID_JOURNEY', prompt, base64Array, notifyHook: '', state: '' }),
      });
      if (!response.ok) throw new Error(`API 错误: ${response.status}`);
      const data = await response.json();
      if (data.code !== 1) throw new Error(data.description || '生成失败');

      // 直接返回 taskId，让前端轮询
      return NextResponse.json({ success: true, taskId: data.result, model, prompt, pending: true });

    } else if (modelConfig.apiType === 'image-generation') {
      const requestBody: any = {
        model: modelConfig.yunwuModel,
        prompt,
        n: 1,
        size: aspectRatio || '1:1',
      };
      if (imageBase64) requestBody.image = imageBase64;

      const response = await fetch(`${YUNWU_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(`API 错误: ${response.status}`);
      const data = await response.json();
      if (data.data?.[0]) {
        imageUrl = data.data[0].url || (data.data[0].b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
      }
      if (!imageUrl) throw new Error('无法解析图片 URL');
    }

    return NextResponse.json({ success: true, imageUrl, model, prompt });
  } catch (error: any) {
    console.error('Image API error:', error);
    // 生成失败退款（精确还原扣费金额）
    if (body?.userId) {
      const refundKey = body.model === 'nano-banana-pro'
        ? (body.imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
        : body.model === 'nano-banana-pro-multi'
        ? (body.imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
        : body.model;
      const price = calcImagePrice(refundKey);
      await refundBalance(body.userId, price, `图片生成失败退款 - ${body.model}`, { model: body.model });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
