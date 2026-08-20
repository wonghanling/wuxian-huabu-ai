import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
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
const KIE_QUERY_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';
// 交互编辑的四种模式里，只有"图层分离"有专用端点，其余走通用图生图
const KIE_MODEL_I2I = 'seedream/5-pro-image-to-image';
const KIE_MODEL_LAYER = 'seedream/5-pro-layer-decomposition';
// quality: basic=1K / high=2K；本功能固定出 2K
const KIE_QUALITY = 'high';
// 内部轮询：前端仍是一次请求拿结果，轮询在服务端完成（maxDuration 300s 足够）
const KIE_POLL_INTERVAL_MS = 2500;
const KIE_POLL_MAX = 80;   // 最长约 200 秒

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

      // ── 服务端轮询到出图 ──
      // 图层分离会返回多张(1 张底图 + N 张分离图层),所以收全部 URL；
      // 图生图只有 1 张。outUrl 取第一张,供现有前端沿用。
      let outUrls: string[] = [];
      let failReason = '';
      for (let i = 0; i < KIE_POLL_MAX; i++) {
        await new Promise((r) => setTimeout(r, KIE_POLL_INTERVAL_MS));
        const qRes = await fetch(`${KIE_QUERY_URL}?taskId=${encodeURIComponent(taskId)}`, {
          headers: { 'Authorization': `Bearer ${kieKeyInfo.keyValue}` },
        });
        const qBody = await qRes.json();
        if (!qRes.ok || qBody?.code !== 200) continue;   // 单次查询失败不中断，继续重试

        const d = qBody?.data || {};
        if (d.state === 'success') {
          try {
            const arr = JSON.parse(d.resultJson || '{}')?.resultUrls;
            outUrls = Array.isArray(arr) ? arr.filter((u: unknown) => typeof u === 'string' && u) : [];
          } catch { outUrls = []; }
          break;
        }
        if (d.state === 'fail') {
          failReason = d.failMsg || `生成失败${d.failCode ? `(${d.failCode})` : ''}`;
          break;
        }
      }
      const outUrl = outUrls[0] || '';

      // ── 失败：退款，用与方舟分支一致的返回结构 ──
      if (!outUrl) {
        if (userId) await refundBalance(userId, price, 'Seedream 编辑失败退款', { model: kieModel });
        const isModeration = /sensitive|safety|policy|审核|违规|unsafe|risk|blocked|nsfw/i.test(failReason);
        if (isModeration) {
          return NextResponse.json({ failed: true, reason: '审核未通过：本次编辑被平台判定为不合规，请调整描述后重试' }, { status: 200 });
        }
        return NextResponse.json({
          failed: true,
          reason: failReason || '生成超时或未返回图片，请重试',
        }, { status: 200 });
      }

      // ── 成功：全部图转存 Supabase 拿永久 URL ──
      // 图层分离有多张,逐张转存;单张失败降级用原 URL,不影响其余。
      const kieFinalUrls = await Promise.all(
        outUrls.map(async (u) => {
          try {
            return await transferToStorage(u);
          } catch (e) {
            console.error('[design/seedream-edit] Kie 图转存失败，降级用原 URL:', e);
            return u;
          }
        })
      );
      // imageUrl 保持单值供现有前端沿用；imageUrls 是全部结果,供图层分离的多图 UI 用
      return NextResponse.json({
        success: true,
        imageUrl: kieFinalUrls[0] || outUrl,
        imageUrls: kieFinalUrls,
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
