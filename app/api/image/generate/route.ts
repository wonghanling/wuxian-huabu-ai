import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

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
    provider: 'n1n',
    yunwuModel: 'gemini-3-pro-image-preview',
    apiType: 'gemini-native',
    supportsImage: true,
  },
  'mj_imagine': {
    provider: 'n1n',
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
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
    falEndpoint: 'fal-ai/flux-pro/kontext/max/text-to-image',
    supportsImage: true, // 有图时走 kontext（图生图）
  },
  'flux-kontext-max': {
    provider: 'fal',
    falEndpoint: 'fal-ai/flux-pro/kontext/max/text-to-image',
    supportsImage: true,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, prompt, aspectRatio = '1:1', imageBase64 } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    if (modelConfig.requiresImage && !imageBase64) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    let imageUrl = '';

    // ── fal.ai 路径 ──────────────────────────────────────────────
    if (modelConfig.provider === 'fal') {
      const hasImage = !!imageBase64;
      // 有图走 kontext（图生图），无图走 text-to-image
      const endpoint = hasImage
        ? 'fal-ai/flux-pro/kontext/max'
        : (modelConfig.falEndpoint ?? 'fal-ai/flux-pro/kontext/max/text-to-image');

      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspectRatio,
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '2',
      };

      if (hasImage) {
        input.image_url = imageBase64; // base64 data URL 或公开 URL
      }

      const result = await fal.subscribe(endpoint, { input });
      const images = (result.data as any)?.images;
      if (images && images.length > 0) {
        imageUrl = images[0].url;
      }

      if (!imageUrl) throw new Error('fal.ai 未返回图片');

    // ── n1n.ai 路径 ──────────────────────────────────────────────
    } else if (modelConfig.apiType === 'gemini-native') {
      const parts: any[] = [];
      if (imageBase64) {
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
      const response = await fetch(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ botType: 'MID_JOURNEY', prompt, base64Array: [], notifyHook: '', state: '' }),
      });
      if (!response.ok) throw new Error(`API 错误: ${response.status}`);
      const data = await response.json();
      if (data.code !== 1) throw new Error(data.description || '生成失败');

      const taskId = data.result;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const s = await fetch(`${YUNWU_BASE_URL}/mj/task/${taskId}/fetch`, {
          headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}` },
        });
        if (s.ok) {
          const sd = await s.json();
          if (sd.status === 'SUCCESS' && sd.imageUrl) { imageUrl = sd.imageUrl; break; }
          if (sd.status === 'FAILURE') throw new Error('图片生成失败');
        }
      }
      if (!imageUrl) throw new Error('图片生成超时');

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
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
