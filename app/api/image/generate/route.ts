import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 300;
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 保留单例配置作为最终回退（Node 模块 pickKey 失败也会 fallback env，这里是双保险）
falSingleton.config({ credentials: process.env.FAL_KEY! });

// 用账号池执行 n1n 请求，自动 pickKey/releaseKey
async function fetchWithN1nPool(url: string, init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
  const keyInfo = await pickKey('n1n');
  let success = false;
  let caught: any = null;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        'Authorization': `Bearer ${keyInfo.keyValue}`,
      },
    });
    success = res.ok;
    return res;
  } catch (err) {
    caught = err;
    throw err;
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 图片模型配置
const IMAGE_MODELS: Record<string, {
  provider: 'n1n' | 'fal';
  yunwuModel?: string;
  falEndpoint?: string;
  apiType?: 'chat' | 'midjourney' | 'replicate' | 'image-generation' | 'gemini-native' | 'gpt-image';
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
  'gpt-image-2': {
    provider: 'fal',
    falEndpoint: 'openai/gpt-image-2/edit',
    supportsImage: true,
  },
  'gpt-image-2-all': {
    provider: 'fal',
    falEndpoint: 'openai/gpt-image-2/edit',
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
  'flux-2-pro': {
    provider: 'fal',
    falEndpoint: 'fal-ai/flux-2-pro',
    // 纯文生图
  },
  'flux-2-pro-edit': {
    provider: 'fal',
    falEndpoint: 'fal-ai/flux-2-pro/edit',
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
    } else if (modelConfig.requiresImage && model !== 'nano-banana-pro-multi' && !imageBase64 && !(imageUrlArray && imageUrlArray.length > 0)) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    // ── 扣费 ──────────────────────────────────────────────────
    // Flux 2 Pro 复合价 key:flux-2-pro[-edit]-{档位}-{wide|square}
    const fluxKey = (m: string, q?: string, ar?: string) => {
      const tier = q === '4k' ? '4k' : q === '2k' ? '2k' : '1080';
      const shape = ar === '1:1' ? 'square' : 'wide';   // 16:9/9:16=wide,1:1=square
      const editSeg = m === 'flux-2-pro-edit' ? 'edit-' : '';
      return `flux-2-pro-${editSeg}${tier}-${shape}`;
    };
    const pricingKey = model === 'nano-banana-pro'
      ? (imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
      : model === 'nano-banana-pro-multi'
      ? (imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
      : ['gpt-image-2', 'gpt-image-2-all'].includes(model)
      ? `gpt-image-2-${imageQuality || 'medium'}-${aspectRatio || '2048x1152'}`
      : ['flux-2-pro', 'flux-2-pro-edit'].includes(model)
      ? fluxKey(model, imageQuality, aspectRatio)
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
      // 账号池：取一个可用 key 创建请求级 fal client（下面所有 fal.xxx 用它）
      const keyInfo = await pickKey('fal');
      const fal = createFalClient({ credentials: keyInfo.keyValue });
      let falSuccess = false;
      let falErr: any = null;
      try {
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
        // 有图时保留 aspect_ratio，让出图比例跟用户选的一致
        if (!hasImages) delete input.aspect_ratio;
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
      } else if (['flux-2-pro', 'flux-2-pro-edit'].includes(model)) {
        // Flux 2 Pro：image_size 用比例枚举 + 档位决定尺寸;edit 传 image_urls
        delete input.aspect_ratio;
        delete input.num_images;
        // 比例 → flux image_size 枚举(只 16:9/9:16/1:1)
        const sizeEnum = aspectRatio === '9:16' ? 'portrait_16_9'
          : aspectRatio === '1:1' ? 'square_hd'
          : 'landscape_16_9';  // 16:9 默认
        input.image_size = sizeEnum;
        input.num_images = 1;
        // 图生图:传参考图 URL
        if (model === 'flux-2-pro-edit') {
          const urls: string[] = imageUrlArray && Array.isArray(imageUrlArray) ? imageUrlArray.filter((u: any) => typeof u === 'string' && u.startsWith('http')) : [];
          if (urls.length === 0) throw new Error('图生图需要至少一张图片');
          input.image_urls = urls;
        }
        const submitted = await fal.queue.submit(modelConfig.falEndpoint!, { input });
        const requestId = submitted.request_id;
        if (!requestId) throw new Error('fal.ai 未返回 requestId');
        return NextResponse.json({ success: true, requestId, endpoint: modelConfig.falEndpoint, model, prompt, pending: true });
      } else if (['gpt-image-2', 'gpt-image-2-all'].includes(model)) {
        // GPT Image 2：尺寸用 image_size，画质用 quality，图片传 URL
        delete input.aspect_ratio;
        delete input.num_images;
        delete input.output_format;
        delete input.safety_tolerance;

        // 尺寸：把 "2048x1152" 转成 {width, height}
        const sizeMap: Record<string, {width: number, height: number}> = {
          '1920x1080': { width: 1920, height: 1080 },
          '1080x1920': { width: 1080, height: 1920 },
          '1080x1080': { width: 1080, height: 1080 },
          '2048x1152': { width: 2048, height: 1152 },
          '3840x2160': { width: 3840, height: 2160 },
          '2160x3840': { width: 2160, height: 3840 },
          '2048x2048': { width: 2048, height: 2048 },
        };
        input.image_size = sizeMap[aspectRatio] || { width: 2048, height: 1152 };
        input.quality = imageQuality || 'high';
        input.num_images = 1;
        input.output_format = 'jpeg';

        // 图片处理：先上传到 fal storage 拿 URL（或直接使用已有 URL）
        const allImages: string[] = [];
        if (imageUrlArray && Array.isArray(imageUrlArray)) {
          // 前端直接传 URL 数组（瘦身路径，避免 Vercel 4.5MB 限制）
          for (const img of imageUrlArray) {
            if (typeof img !== 'string') continue;
            if (img.startsWith('http')) {
              allImages.push(img);
            } else if (img.startsWith('data:')) {
              // 兼容老数据（连接的上游卡还存着 base64）
              const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const blob = new Blob([buffer], { type: 'image/jpeg' });
              const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
              const url = await fal.storage.upload(file);
              allImages.push(url);
            }
          }
        } else if (imageBase64Array && Array.isArray(imageBase64Array)) {
          for (const img of imageBase64Array) {
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
            const url = await fal.storage.upload(file);
            allImages.push(url);
          }
        } else if (imageBase64) {
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
          const url = await fal.storage.upload(file);
          allImages.push(url);
        }
        const gptEndpoint = allImages.length > 0 ? 'openai/gpt-image-2/edit' : 'openai/gpt-image-2';
        if (allImages.length > 0) input.image_urls = allImages;
        console.log('[gpt-image-2] input:', JSON.stringify(input));

        const submitted = await fal.queue.submit(gptEndpoint, { input });
        const requestId = submitted.request_id;
        if (!requestId) throw new Error('fal.ai 未返回 requestId');
        falSuccess = true;
        return NextResponse.json({ success: true, requestId, endpoint: gptEndpoint, model, prompt, pending: true });
      } else if (imageUrlArray && Array.isArray(imageUrlArray) && imageUrlArray.length > 0 && typeof imageUrlArray[0] === 'string' && imageUrlArray[0].startsWith('http')) {
        // 参考图走 URL(瘦身,不进请求体避免 413);fal 认 http URL,直接用第一张
        input.image_url = imageUrlArray[0];
      } else if (imageBase64) {
        input.image_url = imageBase64;
      }

      const submitted = await fal.queue.submit(endpoint, { input });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal.ai 未返回 requestId');

      falSuccess = true;
      return NextResponse.json({ success: true, requestId, model, prompt, pending: true });
      } catch (e) {
        falErr = e;
        throw e;
      } finally {
        await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
      }

    // ── n1n.ai 路径 ──────────────────────────────────────────────
    } else if (modelConfig.apiType === 'gemini-native') {
      const parts: any[] = [];

      // 辅助：把 URL 转 base64（云雾 Gemini 只认 inline_data）
      const urlToInlineData = async (url: string) => {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          const mimeType = contentType.includes('png') ? 'image/png' : contentType.includes('webp') ? 'image/webp' : 'image/jpeg';
          const b64 = Buffer.from(buf).toString('base64');
          return { inline_data: { mime_type: mimeType, data: b64 } };
        } catch (err) {
          console.error('URL 转 base64 失败:', url, err);
          return null;
        }
      };

      // 优先处理 URL 数组（瘦身路径）
      if (imageUrlArray && Array.isArray(imageUrlArray)) {
        for (const img of imageUrlArray) {
          if (typeof img !== 'string') continue;
          if (img.startsWith('http')) {
            const part = await urlToInlineData(img);
            if (part) parts.push(part);
          } else if (img.startsWith('data:')) {
            const base64Match = img.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
            if (base64Match) {
              parts.push({ inline_data: { mime_type: `image/${base64Match[1]}`, data: base64Match[2] } });
            }
          }
        }
      } else if (imageBase64Array && Array.isArray(imageBase64Array)) {
        // 兼容：base64 数组（老数据或其他分支）
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

      const response = await fetchWithN1nPool(
        `${YUNWU_BASE_URL}/v1beta/models/${modelConfig.yunwuModel}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      // 参考图:base64 直接用;只有 URL(瘦身)时服务端 fetch 转 base64(不进请求体)
      const base64Array: string[] = [];
      if (imageBase64) {
        base64Array.push(imageBase64);
      } else if (imageUrlArray && Array.isArray(imageUrlArray) && imageUrlArray.length > 0) {
        for (const u of imageUrlArray) {
          if (typeof u !== 'string') continue;
          if (u.startsWith('data:')) { base64Array.push(u); }
          else if (u.startsWith('http')) {
            try {
              const ir = await fetch(u);
              const ibuf = await ir.arrayBuffer();
              const ict = ir.headers.get('content-type') || 'image/jpeg';
              const imime = ict.includes('png') ? 'image/png' : ict.includes('webp') ? 'image/webp' : 'image/jpeg';
              base64Array.push(`data:${imime};base64,${Buffer.from(ibuf).toString('base64')}`);
            } catch (e) { console.error('MJ 参考图 URL→base64 失败:', e); }
          }
        }
      }
      // MJ 通过 --ar 参数控制比例，转换格式（1:1 → --ar 1:1）
      const arParam = aspectRatio && aspectRatio !== '1:1' ? ` --ar ${aspectRatio}` : '';
      const mjPrompt = `${prompt}${arParam}`;
      const response = await fetchWithN1nPool(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botType: 'MID_JOURNEY', prompt: mjPrompt, base64Array, notifyHook: '', state: '' }),
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
      // 参考图:base64 直接用;只有 URL(瘦身)时在服务端 fetch 转 base64(不进请求体,不会 413)
      if (imageBase64) {
        requestBody.image = imageBase64;
      } else if (imageUrlArray && Array.isArray(imageUrlArray) && imageUrlArray.length > 0) {
        const first = imageUrlArray[0];
        if (typeof first === 'string' && first.startsWith('data:')) {
          requestBody.image = first;
        } else if (typeof first === 'string' && first.startsWith('http')) {
          try {
            const ir = await fetch(first);
            const ibuf = await ir.arrayBuffer();
            const ict = ir.headers.get('content-type') || 'image/jpeg';
            const imime = ict.includes('png') ? 'image/png' : ict.includes('webp') ? 'image/webp' : 'image/jpeg';
            requestBody.image = `data:${imime};base64,${Buffer.from(ibuf).toString('base64')}`;
          } catch (e) {
            console.error('豆包参考图 URL→base64 失败:', e);
          }
        }
      }

      const response = await fetchWithN1nPool(`${YUNWU_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(`API 错误: ${response.status}`);
      const data = await response.json();
      if (data.data?.[0]) {
        imageUrl = data.data[0].url || (data.data[0].b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
      }
      if (!imageUrl) throw new Error('无法解析图片 URL');

    } else if (modelConfig.apiType === 'gpt-image') {
      const hasImages = imageBase64Array && imageBase64Array.length > 0;

      if (hasImages) {
        // 多图融合/图生图：multipart/form-data
        const formData = new FormData();
        for (const imgBase64 of imageBase64Array) {
          const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          formData.append('image', blob, 'image.jpg');
        }
        formData.append('prompt', prompt);
        formData.append('model', 'gpt-image-2');
        formData.append('n', '1');
        if (aspectRatio) formData.append('size', aspectRatio);
        if (imageQuality) formData.append('quality', imageQuality);

        const response = await fetchWithN1nPool(`${YUNWU_BASE_URL}/v1/images/edits`, {
          method: 'POST',
          headers: {},
          body: formData,
        });
        if (!response.ok) throw new Error(`API 错误: ${response.status}`);
        const data = await response.json();
        imageUrl = extractGptImageUrl(data);
      } else {
        // 文生图
        const response = await fetchWithN1nPool(`${YUNWU_BASE_URL}/v1/images/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-image-2',
            prompt,
            n: 1,
            size: aspectRatio || '2048x1152',
            quality: imageQuality || 'medium',
            format: 'jpeg',
          }),
        });
        if (!response.ok) throw new Error(`API 错误: ${response.status}`);
        const data = await response.json();
        imageUrl = extractGptImageUrl(data);
      }
      if (!imageUrl) throw new Error('无法解析图片');
    }

    return NextResponse.json({ success: true, imageUrl, model, prompt });
  } catch (error: any) {
    console.error('Image API error:', error);
    if (body?.userId) {
      const refundKey = body.model === 'nano-banana-pro'
        ? (body.imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
        : body.model === 'nano-banana-pro-multi'
        ? (body.imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
        : ['gpt-image-2', 'gpt-image-2-all'].includes(body.model)
        ? `gpt-image-2-${body.imageQuality || 'medium'}-${body.aspectRatio || '2048x1152'}`
        : ['flux-2-pro', 'flux-2-pro-edit'].includes(body.model)
        ? `flux-2-pro-${body.model === 'flux-2-pro-edit' ? 'edit-' : ''}${body.imageQuality === '4k' ? '4k' : body.imageQuality === '2k' ? '2k' : '1080'}-${body.aspectRatio === '1:1' ? 'square' : 'wide'}`
        : body.model;
      const price = calcImagePrice(refundKey);
      await refundBalance(body.userId, price, `图片生成失败退款 - ${body.model}`, { model: body.model });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

function extractGptImageUrl(data: any): string {
  if (data?.data?.[0]?.url) return data.data[0].url;
  if (data?.data?.[0]?.b64_json) return `data:image/jpeg;base64,${data.data[0].b64_json}`;
  const content = data?.choices?.[0]?.message?.content;
  if (content) {
    if (content.startsWith('data:')) return content;
    if (content.startsWith('http')) return content;
    if (/^[A-Za-z0-9+/=]+$/.test(content.trim())) return `data:image/jpeg;base64,${content.trim()}`;
  }
  return '';
}
