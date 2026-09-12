import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { putAsset } from '@/lib/asset-upload';
import { calcImagePrice } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

// ============================================================================
// 通道开关：'kie' = 走 Kie（当前），'ark' = 走火山方舟（旧版，可回退）
// ============================================================================
// 两套请求格式不同（方舟同步返回图 URL，Kie 异步需轮询），代码并存。
// 要回退方舟：把这个常量改回 'ark' 即可，方舟那套逻辑原样保留。
const SEEDREAM_CHANNEL: 'kie' | 'ark' = 'kie';

// 火山引擎 Seedream 5.0 Pro 图片生成/编辑(同步返回图 URL)
const ARK_IMAGE_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const SEEDREAM_MODEL = 'doubao-seedream-5-0-pro-260628';
const PRICE_KEY = 'seedream-5-pro-edit';

// ── Kie ──
const KIE_CREATE_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
// 交互编辑的四种模式里，只有"图层分离"有专用端点，其余走通用图生图
const KIE_MODEL_I2I = 'seedream/5-pro-image-to-image';
const KIE_MODEL_LAYER = 'seedream/5-pro-layer-decomposition';
// quality: basic=1K / high=2K；本功能固定出 2K
const KIE_QUALITY = 'high';
// 内部轮询：前端仍是一次请求拿结果，轮询在服务端完成（maxDuration 300s 足够）

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
  return await putAsset(filename, buffer, 'image/jpeg');
}

// 交互编辑三种模式(图层分离/精准坐标/任意标记)在 API 层无差别，均为 image + prompt → 单图
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    // mode 仅 Kie 通道用于选端点（layer=图层分离走专用端点，其余走图生图）；
    // 前端不传也能正常工作，默认走图生图 —— 方舟通道完全忽略此字段。
    const { imageUrl, prompt, size, mode, userId } = body;

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

    // ========================================================================
    // Kie 通道（当前启用）
    // ========================================================================
    // 对前端的契约与方舟完全一致：同样返回 { success, imageUrl }，
    // 审核不过同样返回 { failed, reason }。轮询在服务端内部完成，前端无需改动。
    if (SEEDREAM_CHANNEL === 'kie') {
      const kieModel = mode === 'layer' ? KIE_MODEL_LAYER : KIE_MODEL_I2I;
      const kieKeyInfo = await pickKey('kie');
      let kieSuccess = false;
      let kieErr: any = null;
      let taskId = '';

      // ── 提交任务 ──
      try {
        // 两个端点的参数不同,不能共用:
        //   layer-decomposition: image_url(单值) + size(auto/1K/1.5K/2K)
        //                        输出 1 张底图 + N 张分离图层(图层固定 PNG)
        //   image-to-image     : image_urls(数组) + aspect_ratio + quality(basic/high)
        const kieInput: Record<string, unknown> = mode === 'layer'
          ? {
              prompt,
              image_url: imageUrl,
              size: '2K',
              output_format: 'png',
            }
          : {
              prompt,
              image_urls: [imageUrl],
              aspect_ratio: 'auto',
              quality: KIE_QUALITY,
              output_format: 'jpeg',
            };
        const res = await fetch(KIE_CREATE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieKeyInfo.keyValue}`,
          },
          body: JSON.stringify({ model: kieModel, input: kieInput }),
        });
        const submitted = await res.json();
        console.log('[seedream-edit] Kie 提交:', JSON.stringify(submitted).slice(0, 260));

        // Kie 用 body 里的 code 表达错误，HTTP 状态可能仍是 200
        if (!res.ok || submitted?.code !== 200) {
          const code = submitted?.code ?? res.status;
          kieErr = new Error(submitted?.msg || submitted?.message || `提交失败(${code})`);
          (kieErr as any).status = code;
          throw kieErr;
        }
        taskId = submitted?.data?.taskId || '';
        if (!taskId) throw new Error('未返回任务ID');
        kieSuccess = true;
      } catch (err) {
        if (!kieErr) kieErr = err;
        throw err;
      } finally {
        await releaseKey(kieKeyInfo, kieSuccess, kieSuccess ? undefined : categorizeError(kieErr), kieErr ? String(kieErr?.message || kieErr) : undefined);
      }

      // ── 只返回 taskId，由前端轮询 /api/design/seedream-query ──
      // 原先在这里一路轮询到出图。但 Azure App Service 的负载均衡器有 230 秒
      // 硬性请求超时(改不了，maxDuration 设 300 也无效)，而实测有耗时 6 分钟
      // 才出图的情况 —— 请求被掐断，用户看到失败而 Kie 那边已经出图，
      // 钱扣了图拿不到。
      //
      // 改成两段式后每次请求只几秒，总时长不再受 230 秒限制。
      // 退款移到查询侧:此刻还不知道成败，不能在这里退。
      return NextResponse.json({
        success: true,
        pending: true,
        taskId,
        price,           // 前端轮询时带回来，失败时据此退款
      });
    }

    // ========================================================================
    // 火山方舟通道（旧版，SEEDREAM_CHANNEL='ark' 时启用）
    // ========================================================================
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
