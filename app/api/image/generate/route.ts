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
  provider: 'n1n' | 'fal' | 'kie';
  yunwuModel?: string;
  falEndpoint?: string;
  /** Kie 模型 ID（provider='kie' 时用） */
  kieModel?: string;
  /**
   * 带参考图时改用的 Kie 模型 ID。
   *
   * GPT Image 2 与 Flux 2 在 Kie 侧把"文生图"和"图转图"拆成两个端点，
   * 文生图端点根本没有输入图字段 —— 传了会被忽略。
   * 而画布里同一张卡既能纯文生成、也能连上游图做图转图
   * （角色设计卡、时空镜头延展卡更是以图转图为主），
   * 所以这里按"本次有没有图"自动切端点，卡片无需拆成两个模型。
   */
  kieModelWithImage?: string;
  /** 带图时的输入图字段名（文生图端点没有图字段，故与 kieModelWithImage 配对） */
  kieImgKeyWithImage?: 'image_input' | 'input_urls' | 'image_url';
  /**
   * Kie 各模型的参数形态差异：
   *   imgKey  输入图字段名（各家不同，写错会被上游静默忽略 → 表现为"没读参考图"）：
   *           'image_input'(Nano Banana 2/Pro) | 'input_urls'(GPT Image 2 / Flux 2)
   *           | 'image_url'(Topaz，单图非数组)
   *   noPrompt  该模型不接受提示词（Topaz 放大）
   *   maxImages 输入图上限
   */
  kieParams?: {
    imgKey?: 'image_input' | 'input_urls' | 'image_url';
    noPrompt?: boolean;
    maxImages?: number;
    /**
     * 清晰度的表达方式（各家不一样，传错上游直接拒）：
     *   'resolution'  默认。Nano Banana / GPT Image 2 收 1K/2K/4K
     *   'resCapped2K' 同 resolution，但上游只到 2K（Flux 2）—— 4k 会被压到 2K
     *   'upscale'     Topaz：字段是 upscale_factor，值是倍数 2/4 而非分辨率
     *   'none'        不传清晰度
     */
    resMode?: 'resolution' | 'resCapped2K' | 'upscale' | 'none';
  };
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
    provider: 'kie',
    kieModel: 'nano-banana-2',
    kieParams: { imgKey: 'image_input', maxImages: 14 },
    supportsImage: true,
  },
  'mj_imagine': {
    provider: 'n1n',
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
    supportsImage: true,
  },
  'mj_imagine_v7': {
    provider: 'n1n',
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
    supportsImage: true,
  },
  'mj_niji_7': {
    provider: 'n1n',
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
    supportsImage: true,
  },
  'doubao-seedream-4-5-251128': {
    provider: 'n1n',
    // 内部 key 保持不变(兼容老画布已存卡)，实际调用升级为 n1n 的 Seedream 5.0
    yunwuModel: 'doubao-seedream-5-0-260128',
    apiType: 'image-generation',
    supportsImage: true,
  },
  'gpt-image-2': {
    provider: 'kie',
    kieModel: 'gpt-image-2-text-to-image',
    kieModelWithImage: 'gpt-image-2-image-to-image',
    kieImgKeyWithImage: 'input_urls',
    supportsImage: true,
  },
  'gpt-image-2-all': {
    provider: 'kie',
    kieModel: 'gpt-image-2-image-to-image',
    kieParams: { imgKey: 'input_urls', maxImages: 16 },
    requiresImage: true,
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
    provider: 'kie',
    kieModel: 'nano-banana-pro',
    kieParams: { imgKey: 'image_input', maxImages: 8 },
    requiresImage: true,
    supportsImage: true,
  },
  'flux-2-pro': {
    provider: 'kie',
    kieModel: 'flux-2/pro-text-to-image',
    kieModelWithImage: 'flux-2/pro-image-to-image',
    kieImgKeyWithImage: 'input_urls',
    kieParams: { resMode: 'resCapped2K' },
    supportsImage: true,
  },
  'flux-2-pro-edit': {
    provider: 'kie',
    kieModel: 'flux-2/pro-image-to-image',
    kieParams: { imgKey: 'input_urls', maxImages: 8, resMode: 'resCapped2K' },
    requiresImage: true,
    supportsImage: true,
  },
  'flux-2-flex': {
    provider: 'kie',
    kieModel: 'flux-2/flex-text-to-image',
    kieModelWithImage: 'flux-2/flex-image-to-image',
    kieImgKeyWithImage: 'input_urls',
    kieParams: { resMode: 'resCapped2K' },
    supportsImage: true,
  },
  'flux-2-flex-edit': {
    provider: 'kie',
    kieModel: 'flux-2/flex-image-to-image',
    kieParams: { imgKey: 'input_urls', maxImages: 8, resMode: 'resCapped2K' },
    requiresImage: true,
    supportsImage: true,
  },
  'topaz-upscale': {
    provider: 'kie',
    kieModel: 'topaz/image-upscale',
    kieParams: { imgKey: 'image_url', noPrompt: true, maxImages: 1, resMode: 'upscale' },
    requiresImage: true,
    supportsImage: true,
  },
};

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { model, prompt, aspectRatio = '1:1', imageBase64, imageBase64Array, imageUrlArray, userId, imageQuality } = body;

    if (!model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 提示词必填 —— 但 Topaz 放大这类模型不接受提示词，只吃一张输入图。
    // 校验拆到 modelConfig 之后，才能按模型放行。
    if (!prompt && !modelConfig.kieParams?.noPrompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (model === 'nano-banana-pro-multi' && (!imageUrlArray || imageUrlArray.length === 0)) {
      return NextResponse.json({ error: '多图融合模型需要至少一张图片' }, { status: 400 });
    } else if (modelConfig.requiresImage && model !== 'nano-banana-pro-multi' && !imageBase64 && !(imageUrlArray && imageUrlArray.length > 0)) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    // ── 扣费 ──────────────────────────────────────────────────
    // 走 Kie 后价格结构简化:Flux 2 不再随比例变化(Pro 全档 ¥0.3 / Flex 全档 ¥0.9),
    // GPT Image 2 只有 2K/4K 两档、不再分 medium/high。
    const pricingKey = model === 'nano-banana-pro'
      ? (imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
      : model === 'nano-banana-pro-multi'
      ? (imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
      : ['gpt-image-2', 'gpt-image-2-all'].includes(model)
      ? (imageQuality === '4k' ? 'gpt-image-2-4k' : 'gpt-image-2-2k')
      : ['flux-2-pro', 'flux-2-pro-edit', 'flux-2-flex', 'flux-2-flex-edit'].includes(model)
      ? `${model}-2k`                                   // Pro/Flex 1K 与 2K 同价
      : model === 'topaz-upscale'
      ? (imageQuality === '8k' ? 'topaz-upscale-8k' : 'topaz-upscale-4k')
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

    // ── Kie 路径 ────────────────────────────────────────────────
    // 与 fal 的差异：Kie 是异步任务制(提交 → 轮询)，且只吃 http URL 不吃 base64。
    // 对前端的契约不变：同样返回 { success, imageUrl }。
    if (modelConfig.provider === 'kie') {
      const kp = modelConfig.kieParams ?? {};

      // 输入图先收齐 —— 画布里的图一律是 http URL（不存 base64，这是画布能挂
      // 几百张卡而不卡的前提），Kie 也只吃 URL，直接透传无需转码或转存。
      // 顺序沿用前端给的：连线上游的在前，本地上传的在后。
      const urls = (Array.isArray(imageUrlArray) ? imageUrlArray : [])
        .filter((u: any) => typeof u === 'string' && u.startsWith('http'));

      // 端点按"本次有没有图"决定：GPT Image 2 / Flux 2 的文生图端点没有输入图
      // 字段，带图却发去文生图端点，图会被上游静默忽略（表现为"没读参考图"）。
      // 角色设计卡、时空镜头延展卡就是这条路径 —— 它们以图转图为主。
      const useImgEndpoint = urls.length > 0 && !!modelConfig.kieModelWithImage;
      const kieModelId = useImgEndpoint ? modelConfig.kieModelWithImage! : modelConfig.kieModel;
      const imgKey = useImgEndpoint ? modelConfig.kieImgKeyWithImage : kp.imgKey;

      const kieInput: Record<string, unknown> = {};
      if (!kp.noPrompt) {
        kieInput.prompt = prompt;
        // 比例：Kie 各模型都收 aspect_ratio 枚举（Topaz 不需要）
        kieInput.aspect_ratio = aspectRatio || '1:1';
      }

      // 清晰度：各家表达方式不同，传错上游直接拒。
      //   Flux 2 上游只到 2K（画布若选了 4k 就压到 2K，不然提交失败）
      //   Topaz 用 upscale_factor 倍数（4K→2 倍、8K→4 倍），不是分辨率字符串
      const qRaw = String(imageQuality || '2k').toLowerCase();
      const resMode = kp.resMode ?? 'resolution';
      if (resMode === 'upscale') {
        kieInput.upscale_factor = qRaw === '8k' ? '4' : '2';
      } else if (resMode === 'resCapped2K') {
        kieInput.resolution = qRaw === '1k' ? '1K' : '2K';
      } else if (resMode !== 'none') {
        kieInput.resolution = qRaw.toUpperCase();
      }

      if (imgKey) {
        if (urls.length === 0 && modelConfig.requiresImage) {
          throw new Error('该模型需要至少一张输入图');
        }
        if (urls.length > 0) {
          const capped = kp.maxImages ? urls.slice(0, kp.maxImages) : urls;
          // Topaz 收单张，字段是 image_url（非数组）
          kieInput[imgKey] = imgKey === 'image_url' ? capped[0] : capped;
        }
      }

      const keyInfo = await pickKey('kie');
      let ok = false;
      let kErr: any = null;
      let taskId = '';
      try {
        const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyInfo.keyValue}`,
          },
          body: JSON.stringify({ model: kieModelId, input: kieInput }),
        });
        const createData = await createRes.json();
        // Kie 用 body 的 code 表达错误，HTTP 状态可能仍是 200
        if (!createRes.ok || createData?.code !== 200) {
          throw new Error(createData?.msg || createData?.message || '提交失败');
        }
        taskId = createData?.data?.taskId;
        if (!taskId) throw new Error('未返回任务ID');
        ok = true;
      } catch (err) {
        kErr = err;
        throw err;
      } finally {
        await releaseKey(keyInfo, ok, ok ? undefined : categorizeError(kErr),
          kErr ? String(kErr?.message || kErr) : undefined);
      }

      // 提交完立刻返回，让前端轮询 —— 不在服务端阻塞等待出图，
      // 否则一张图会占住一个函数实例数十秒。
      //
      // 复用既有的 pending + requestId + endpoint 契约（原本给 fal 异步用的），
      // 前端 api.ts 的轮询逻辑一行都不用改，fal-query 里加一个 c2 分支即可。
      // endpoint 用中性代号，不在前端暴露上游名称。
      return NextResponse.json({ success: true, pending: true, requestId: taskId, endpoint: 'c2' });
    }

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
        // 保留 aspect_ratio：nano-banana-2 文生图/图生图端点均支持该参数(枚举含1:1/16:9/9:16等)，
        // 让出图比例始终跟用户选的一致
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
      // 版本参数:V7 加 --v 7;Niji7 加 --niji 7 且 botType 用 NIJI_JOURNEY
      const isNiji = model === 'mj_niji_7';
      const verParam = model === 'mj_imagine_v7' ? ' --v 7' : isNiji ? ' --niji 7' : '';
      const mjBotType = isNiji ? 'NIJI_JOURNEY' : 'MID_JOURNEY';
      const mjPrompt = `${prompt}${arParam}${verParam}`;
      const response = await fetchWithN1nPool(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botType: mjBotType, prompt: mjPrompt, base64Array, notifyHook: '', state: '' }),
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
