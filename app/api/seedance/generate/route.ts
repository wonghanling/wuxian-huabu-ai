import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';
import { pickKey, releaseKey, userKeyToKeyInfo, releaseUserAwareKey, categorizeError, type KeyInfo } from '@/lib/api-key-pool';
import { lookupUserKey, userKeyInvalidMessage } from '@/lib/user-api-keys';

export const maxDuration = 60;

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';
const KIE_CREATE_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// 通道开关：'kie' = 走 Kie AI（当前），'ark' = 走火山方舟（旧版，可回退）
// ============================================================================
// 两套请求格式不同（方舟用 content 数组，Kie 用扁平 input 对象），代码并存。
// 要回退方舟：把这个常量改回 'ark' 即可，方舟那套逻辑和定价原样保留。
const SEEDANCE_CHANNEL: 'kie' | 'ark' = 'kie';

// ============================================================================
// Kie AI 定价：成本 + 0.1/秒，不分会员
// ============================================================================
// 售价公式：
//   无视频输入 = (成本单价 + 0.1) × 输出时长
//   带视频输入 = (成本单价 + 0.1) × (输入视频总时长 + 输出时长)
// 带视频输入单价更低，但计费基数含输入时长，所以传长参考视频反而更贵。
const KIE_PRICE: Record<string, { noVideo: number; withVideo: number }> = {
  // 标准版 bytedance/seedance-2
  'seedance-2_480p':  { noVideo: 0.74, withVideo: 0.49 },
  'seedance-2_720p':  { noVideo: 1.49, withVideo: 0.95 },
  'seedance-2_1080p': { noVideo: 3.55, withVideo: 2.20 },
  'seedance-2_4k':    { noVideo: 7.14, withVideo: 4.43 },
  // Fast 版 bytedance/seedance-2-fast
  'seedance-2-fast_480p': { noVideo: 0.62, withVideo: 0.40 },
  'seedance-2-fast_720p': { noVideo: 1.22, withVideo: 0.78 },
  // Mini 版 bytedance/seedance-2-mini
  'seedance-2-mini_480p': { noVideo: 0.42, withVideo: 0.30 },
  'seedance-2-mini_720p': { noVideo: 0.79, withVideo: 0.52 },
};

// 画布模型 ID → Kie 模型 ID
const KIE_MODEL_MAP: Record<string, string> = {
  'doubao-seedance-2-0-260128':      'bytedance/seedance-2',
  'doubao-seedance-2-0-fast-260128': 'bytedance/seedance-2-fast',
  'doubao-seedance-2-0-mini-260128': 'bytedance/seedance-2-mini',
};

/**
 * Kie 计费。refVideoSeconds 是参考视频总时长（秒），>0 时按"带视频输入"计价，
 * 且计费基数为 输入时长 + 输出时长。
 *
 * 保守设计：前端拿不到视频时长时传 0，此时按"无视频输入"单价计（单价更高），
 * 宁可多收也不少收 —— 少收就是平台净亏。
 */
function getKieCharge(
  model: string,
  resolution: string,
  duration: number,
  refVideoSeconds: number
): number {
  const kieModel = (KIE_MODEL_MAP[model] || '').replace('bytedance/', '');
  const price = KIE_PRICE[`${kieModel}_${(resolution || '').toLowerCase()}`];
  if (!price) return 0;

  const outSecs = duration === -1 ? 5 : Math.max(1, duration);
  const hasVideo = refVideoSeconds > 0;
  const perSec = hasVideo ? price.withVideo : price.noVideo;
  const billedSecs = hasVideo ? refVideoSeconds + outSecs : outSecs;

  return Math.round(perSec * billedSecs * 100) / 100;
}

// ============================================================================
// 火山方舟定价（旧版，SEEDANCE_CHANNEL='ark' 时启用）
// ============================================================================
const SEEDANCE_PRICE: Record<string, { member: number; normal: number }> = {
  'doubao-seedance-2-0-260128_480p':  { member: 0.71, normal: 0.91 },
  'doubao-seedance-2-0-260128_720p':  { member: 1.29, normal: 1.49 },
  'doubao-seedance-2-0-260128_1080p': { member: 2.81, normal: 3.01 },
  'doubao-seedance-2-0-fast-260128_480p': { member: 0.60, normal: 0.80 },
  'doubao-seedance-2-0-fast-260128_720p': { member: 1.06, normal: 1.26 },
};

function getSeedanceCharge(model: string, resolution: string, generateAudio: boolean, duration: number, isMember: boolean) {
  const key = `${model}_${resolution}`;
  const price = SEEDANCE_PRICE[key];
  if (!price) return 0;
  const perSec = isMember ? price.member : price.normal;
  const secs = duration === -1 ? 5 : Math.max(1, duration);
  return Math.round(perSec * secs * 100) / 100;
}

/**
 * 服务端探测视频时长（秒，向上取整）。
 *
 * 兜底用：前端读不到时长时（网络抖动、格式异常）会传 0，
 * 若直接按"无视频输入"单价计，虽然不少收但和前端显示价不一致。
 * 这里用 Range 只取文件头几百 KB，解析 MP4 的 mvhd box 拿时长。
 * 解析不出返回 0，退回无视频输入单价（更高，不会漏钱）。
 */
function parseMvhdSeconds(buf: Buffer): number {
  // mvhd box 结构（偏移相对 'mvhd' 这 4 个字节的起点）：
  //   +0  'mvhd'
  //   +4  version(1B) + flags(3B)
  //   version 0: +8 creation(4) +12 modification(4) +16 timescale(4) +20 duration(4)
  //   version 1: +8 creation(8) +16 modification(8) +24 timescale(4) +28 duration(8)
  // 实测验证：timescale=1000, duration=8250 → 8.25s
  const idx = buf.indexOf('mvhd');
  if (idx < 0) return 0;
  const version = buf[idx + 4];
  let timescale = 0;
  let duration = 0;
  try {
    if (version === 1) {
      timescale = buf.readUInt32BE(idx + 24);
      duration = Number(buf.readBigUInt64BE(idx + 28));
    } else {
      timescale = buf.readUInt32BE(idx + 16);
      duration = buf.readUInt32BE(idx + 20);
    }
  } catch {
    return 0;
  }
  if (!timescale || !duration) return 0;
  // 四舍五入而非向上取整：视频实际时长常带小数（帧数/帧率，如 25fps 126 帧 = 5.04s），
  // 向上取整会把 5 秒视频算成 6 秒，用户会认为乱收费。
  const secs = Math.round(duration / timescale);
  // 合理性检查：Kie 限制单个参考视频 2-15 秒，明显越界视为解析错误
  return secs > 0 && secs <= 120 ? secs : 0;
}

async function fetchRange(url: string, range: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { Range: range } });
    if (!res.ok && res.status !== 206) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function probeVideoSeconds(url: string): Promise<number> {
  try {
    // moov（含 mvhd）可能在文件头也可能在尾部。实测 Supabase 上的转存视频是
    // ftyp → free → mdat(数据) → moov，即 moov 在最后，所以先探尾部。
    const tail = await fetchRange(url, 'bytes=-262144');
    if (tail) {
      const secs = parseMvhdSeconds(tail);
      if (secs > 0) return secs;
    }
    // 尾部没有再试头部（渐进式 MP4 的 moov 在前）
    const head = await fetchRange(url, 'bytes=0-262143');
    if (head) {
      const secs = parseMvhdSeconds(head);
      if (secs > 0) return secs;
    }
    return 0;
  } catch {
    return 0;
  }
}

// 上传 base64 图片到 Supabase Storage，返回公开 URL
async function uploadBase64ToStorage(base64: string, prefix: string): Promise<string> {
  if (!base64 || !base64.startsWith('data:')) return base64;
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return base64;
  const mimeType = match[1];
  const ext = mimeType.split('/')[1] || 'jpg';
  const buffer = Buffer.from(match[2], 'base64');
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin.storage.from('assets').upload(filename, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`上传图片失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

// 从 Authorization Bearer token 解出 userId（BYOK 取 key 用）
// 不能用请求体里的 userId，否则可伪造成别人蹭 key
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any = {};
  let chargedAmount = 0;

  try {
    body = await req.json();
    const {
      mode = 't2v',
      model = 'doubao-seedance-2-0-260128',
      prompt = '',
      ratio = '16:9',
      duration = 5,
      resolution = '720p',
      generateAudio = true,
      firstFrameImage,
      lastFrameImage,
      refImages,
      refVideoUrl,
      refAudioBase64,
      refVideoSeconds,   // 参考视频总时长(秒)，Kie"带视频输入"计费要用；前端读 video.duration 传来
      userId,
    } = body;

    // ── BYOK：先看用户有没有自带方舟 key（userId 从 token 解，不信请求体）──
    //   active  → 用他的 key、不扣平台余额
    //   invalid → 直接报错，绝不回退平台池（否则会悄悄扣他的画布余额）
    //   none    → 走平台池 + 正常扣费（改造前行为）
    // 注意：BYOK 只对方舟通道有意义（用户填的是方舟 Key）。走 Kie 时一律用平台
    // 账号池并正常扣费，否则会拿用户的方舟 Key 去调 Kie、或误判为失效而拦住生成。
    const authedUserId = SEEDANCE_CHANNEL === 'ark' ? await getAuthedUserId(req) : null;
    const arkLookup = SEEDANCE_CHANNEL === 'ark'
      ? await lookupUserKey(authedUserId, 'ark')
      : ({ kind: 'none' } as const);

    if (arkLookup.kind === 'invalid') {
      // 此时还没扣费、没提交上游，直接返回即可
      return NextResponse.json(
        { error: userKeyInvalidMessage('ark', arkLookup.lastError), byokInvalid: true },
        { status: 402 }
      );
    }

    const userArkKey = arkLookup.kind === 'active' ? arkLookup.key : null;
    const useByok = !!userArkKey;

    // 仅方舟通道的平台池路径要求 env 有 ARK_API_KEY 兜底；Kie 和 BYOK 都不依赖它
    if (SEEDANCE_CHANNEL === 'ark' && !useByok && !ARK_API_KEY) {
      return NextResponse.json({ error: '未配置 ARK_API_KEY' }, { status: 500 });
    }

    // 扣费（BYOK 跳过：用户在火山引擎控制台自付）
    // 扣费时机、退款逻辑、余额不足返回 402 —— 全部沿用原有约定，只是价格来源随通道切换
    if (userId && !useByok) {
      const isMember = await checkMembership(userId);

      // 参考视频时长：优先用前端传来的（与用户看到的价格一致）；
      // 前端读不到时（传 0）服务端自己探一次，避免显示价与实扣不一致
      let billRefSecs = Number(refVideoSeconds) || 0;
      if (SEEDANCE_CHANNEL === 'kie' && billRefSecs === 0 && mode === 'multimodal' && refVideoUrl) {
        billRefSecs = await probeVideoSeconds(refVideoUrl);
        if (billRefSecs > 0) console.log(`[Seedance] 服务端探测参考视频时长: ${billRefSecs}s`);
      }

      chargedAmount = SEEDANCE_CHANNEL === 'kie'
        ? getKieCharge(model, resolution, Number(duration), billRefSecs)
        : getSeedanceCharge(model, resolution, generateAudio, Number(duration), isMember);
      if (chargedAmount > 0) {
        const deduct = await deductBalance(userId, chargedAmount, 'video_deduct',
          `Seedance 视频生成 ${model} ${resolution} ${generateAudio ? '有声' : '无声'}`,
          { model, resolution, generateAudio, duration, mode });
        if (!deduct.success) {
          return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
        }
      }
    }

    // 构建 content 数组
    const content: any[] = [];

    // 文本提示词
    if (prompt) {
      content.push({ type: 'text', text: prompt });
    }

    if (mode === 't2v') {
      // 文生视频：只需提示词，已在上面添加
      if (!prompt) return NextResponse.json({ error: '文生视频需要提示词' }, { status: 400 });

    } else if (mode === 'i2v') {
      // 图生视频-首帧
      if (!firstFrameImage) return NextResponse.json({ error: '需要首帧图片' }, { status: 400 });
      const url = await uploadBase64ToStorage(firstFrameImage, 'seedance/frames');
      content.push({ type: 'image_url', image_url: { url }, role: 'first_frame' });

    } else if (mode === 'first-last') {
      // 图生视频-首尾帧
      if (!firstFrameImage || !lastFrameImage) return NextResponse.json({ error: '需要首帧和尾帧图片' }, { status: 400 });
      const firstUrl = await uploadBase64ToStorage(firstFrameImage, 'seedance/frames');
      const lastUrl = await uploadBase64ToStorage(lastFrameImage, 'seedance/frames');
      content.push({ type: 'image_url', image_url: { url: firstUrl }, role: 'first_frame' });
      content.push({ type: 'image_url', image_url: { url: lastUrl }, role: 'last_frame' });

    } else if (mode === 'multimodal') {
      // 多模态参考
      if ((!refImages || refImages.length === 0) && !refVideoUrl) {
        return NextResponse.json({ error: '多模态模式需要至少一张参考图或视频URL' }, { status: 400 });
      }
      // 参考图片
      if (refImages && refImages.length > 0) {
        for (const img of refImages) {
          const url = await uploadBase64ToStorage(img, 'seedance/refs');
          content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
        }
      }
      // 参考视频
      if (refVideoUrl) {
        content.push({ type: 'video_url', video_url: { url: refVideoUrl }, role: 'reference_video' });
      }
      // 参考音频
      if (refAudioBase64) {
        content.push({ type: 'audio_url', audio_url: { url: refAudioBase64 }, role: 'reference_audio' });
      }
    }

    // 构建请求体
    const requestBody: any = {
      model,
      content,
      resolution,
      ratio,
      generate_audio: generateAudio,
    };

    // 时长：-1 表示智能选择
    if (duration === -1) {
      requestBody.duration = -1;
    } else {
      requestBody.duration = Number(duration) || 5;
    }

    console.log('Seedance 请求:', JSON.stringify({ channel: SEEDANCE_CHANNEL, model, mode, ratio, resolution, duration, generate_audio: generateAudio }));

    // ========================================================================
    // Kie AI 通道（当前启用）
    // ========================================================================
    // 与方舟的差异仅在请求格式和响应字段：Kie 用扁平 input 对象、返回 data.taskId。
    // 对前端的契约完全一致：同样返回 { success, taskId }，同样轮询 /api/seedance/query。
    if (SEEDANCE_CHANNEL === 'kie') {
      const kieModel = KIE_MODEL_MAP[model];
      if (!kieModel) {
        return NextResponse.json({ error: `不支持的模型: ${model}` }, { status: 400 });
      }

      // 复用上面已上传好的 URL（uploadBase64ToStorage 的结果都在 content 里）
      const pick = (role: string) =>
        content.find((c: any) => c.role === role)?.image_url?.url as string | undefined;

      const kieInput: Record<string, unknown> = {
        prompt: prompt || undefined,
        resolution: (resolution || '720p').toLowerCase(),
        aspect_ratio: ratio || '16:9',
        duration: duration === -1 ? 5 : (Number(duration) || 5),
        generate_audio: !!generateAudio,
      };

      if (mode === 'i2v') {
        kieInput.first_frame_url = pick('first_frame');
      } else if (mode === 'first-last') {
        kieInput.first_frame_url = pick('first_frame');
        kieInput.last_frame_url = pick('last_frame');
      } else if (mode === 'multimodal') {
        const refImgs = content
          .filter((c: any) => c.role === 'reference_image')
          .map((c: any) => c.image_url?.url)
          .filter(Boolean);
        if (refImgs.length > 0) kieInput.reference_image_urls = refImgs;
        if (refVideoUrl) kieInput.reference_video_urls = [refVideoUrl];
        if (refAudioBase64) kieInput.reference_audio_urls = [refAudioBase64];
      }

      const kieKeyInfo = await pickKey('kie');
      let kieSuccess = false;
      let kieErr: any = null;
      let kieData: any;
      try {
        const res = await fetch(KIE_CREATE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieKeyInfo.keyValue}`,
          },
          body: JSON.stringify({ model: kieModel, input: kieInput }),
        });

        kieData = await res.json();
        console.log('Kie 提交结果:', JSON.stringify(kieData).slice(0, 300));

        // Kie 用 body 里的 code 表达错误，HTTP 状态可能仍是 200
        if (!res.ok || kieData?.code !== 200) {
          kieErr = new Error(kieData?.msg || kieData?.message || '提交失败');
          (kieErr as any).status = kieData?.code || res.status;
          throw kieErr;
        }
        kieSuccess = true;
      } catch (err) {
        if (!kieErr) kieErr = err;
        throw err;
      } finally {
        await releaseKey(kieKeyInfo.keyId, kieSuccess, kieSuccess ? undefined : categorizeError(kieErr), kieErr ? String(kieErr?.message || kieErr) : undefined);
      }

      const kieTaskId = kieData?.data?.taskId;
      if (!kieTaskId) throw new Error('未返回任务ID');

      // channel 回传给前端，轮询时带上，query 才知道查哪个上游
      return NextResponse.json({ success: true, taskId: kieTaskId, channel: 'kie' });
    }

    // ========================================================================
    // 火山方舟通道（旧版，SEEDANCE_CHANNEL='ark' 时启用）
    // ========================================================================
    // 取 key：BYOK 用用户自己的（上面已读出，不重复查库）；否则走平台账号池
    const keyInfo: KeyInfo = userArkKey
      ? userKeyToKeyInfo(userArkKey, 'ark')
      : await pickKey('ark');
    let arkSuccess = false;
    let arkErr: any = null;
    let data: any;
    try {
      const res = await fetch(ARK_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keyInfo.keyValue}`,
        },
        body: JSON.stringify(requestBody),
      });

      data = await res.json();
      console.log('Seedance 提交结果:', JSON.stringify(data).slice(0, 300));

      if (!res.ok) {
        arkErr = new Error(data?.error?.message || data?.message || '提交失败');
        (arkErr as any).status = res.status;
        throw arkErr;
      }
      arkSuccess = true;
    } catch (err) {
      if (!arkErr) arkErr = err;
      throw err;
    } finally {
      await releaseUserAwareKey(keyInfo, arkSuccess, arkSuccess ? undefined : categorizeError(arkErr), arkErr ? String(arkErr?.message || arkErr) : undefined);
    }

    const taskId = data.id;
    if (!taskId) throw new Error('未返回任务ID');

    // byok=true 时前端轮询要带上，query 才知道该用用户 key 而不是平台池
    return NextResponse.json({ success: true, taskId, arkKeyId: keyInfo.keyId, byok: useByok });

  } catch (error: any) {
    console.error('Seedance 生成错误:', error);

    // chargedAmount 在 BYOK 路径恒为 0，所以这里天然不会误退款
    if (body?.userId && chargedAmount > 0) {
      await refundBalance(body.userId, chargedAmount, `Seedance 视频生成失败退款`, {
        model: body.model, resolution: body.resolution, mode: body.mode,
      });
    }

    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
