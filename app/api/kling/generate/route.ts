import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkMembership, deductBalance, refundBalance } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const runtime = 'nodejs';
export const maxDuration = 300;

const N1N_API_KEY = process.env.YUNWU_API_KEY!;
const N1N_BASE = 'https://api.n1n.ai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const KLING_LIP_SYNC_PRICE = {
  member: 1.085,  // 0.085/次 + 0.19/秒 × 5秒 = 1.035，取整后约1.085（按次固定）
  normal: 1.285,
} as const;

const KLING_MOTION_PRICE = {
  'v2.6': {
    std: { member: 0.9, normal: 1.1, resolution: '720p' },
    pro: { member: 1.5, normal: 1.7, resolution: '1080p' },
  },
  'v3.0': {
    std: { member: 1.6, normal: 1.8, resolution: '720p' },
    pro: { member: 2.1, normal: 2.3, resolution: '1080p' },
  },
} as const;

function extractFaceCandidates(data: any): Array<Record<string, unknown>> {
  const candidates = [
    data?.faces,
    data?.face_list,
    data?.face_infos,
    data?.face_info,
    data?.face_data,
    data?.face_choose,
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function extractFaceId(data: any, faces: Array<Record<string, unknown>>): string {
  const firstFace = faces[0] || {};
  return String(
    data?.face_id ??
      data?.faceId ??
      (firstFace as any)?.face_id ??
      (firstFace as any)?.faceId ??
      '-1'
  );
}

function normalizeMotionVersion(value?: string): 'v2.6' | 'v3.0' {
  if (value === 'v3.0' || value === 'kling-v3-master') return 'v3.0';
  return 'v2.6';
}

function normalizeVideoMode(value?: string): 'std' | 'pro' {
  return value === 'pro' ? 'pro' : 'std';
}

function getKlingCharge(params: {
  mode: string;
  isMember: boolean;
  motionVersion?: string;
  videoMode?: string;
  duration?: number;
}) {
  const { mode, isMember } = params;

  if (mode === 'advanced-lip-sync') {
    const amount = isMember ? KLING_LIP_SYNC_PRICE.member : KLING_LIP_SYNC_PRICE.normal;
    return {
      amount,
      description: 'Kling 对口型',
      resolution: null as string | null,
      pricingMeta: {
        chargeType: 'fixed',
        workflow: 'lip-sync',
      },
    };
  }

  if (mode !== 'motion-control') {
    return {
      amount: 0,
      description: '',
      resolution: null as string | null,
      pricingMeta: {
        chargeType: 'none',
      },
    };
  }

  const motionVersion = normalizeMotionVersion(params.motionVersion);
  const videoMode = normalizeVideoMode(params.videoMode);
  const duration = Math.max(1, Number(params.duration) || 5);
  const tier = KLING_MOTION_PRICE[motionVersion][videoMode];
  const perSecond = isMember ? tier.member : tier.normal;

  return {
    amount: Math.round(perSecond * duration * 100) / 100,
    description: `Kling 动作控制 ${motionVersion.toUpperCase()} ${videoMode.toUpperCase()}`,
    resolution: tier.resolution,
    pricingMeta: {
      chargeType: 'per_second',
      motionVersion,
      videoMode,
      duration,
      perSecond,
    },
  };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  let chargedAmount = 0;

  try {
    body = await req.json();
    const { mode, userId, ...params } = body;

    if (!mode) {
      return NextResponse.json({ error: '缺少 mode 参数' }, { status: 400 });
    }

    let endpoint = '';
    let requestBody: Record<string, unknown> = {};

    if (mode === 'text2video') {
      const {
        model_name,
        prompt,
        negative_prompt,
        cfg_scale,
        videoMode,
        sound,
        aspect_ratio,
        duration,
      } = params;

      if (!model_name || !prompt) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      endpoint = '/kling/v1/videos/text2video';
      requestBody = {
        model_name,
        prompt,
        negative_prompt: negative_prompt || '',
        cfg_scale: cfg_scale ?? 0.5,
        mode: normalizeVideoMode(videoMode),
        sound: sound || 'off',
        aspect_ratio: aspect_ratio || '16:9',
        duration: String(duration || '5'),
      };
    } else if (mode === 'image2video') {
      const {
        model_name,
        prompt,
        negative_prompt,
        cfg_scale,
        videoMode,
        image,
        image_tail,
        sound,
        duration,
      } = params;

      if (!model_name || !image) {
        return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
      }

      endpoint = '/kling/v1/videos/image2video';
      requestBody = {
        model_name,
        image,
        image_tail: image_tail || '',
        prompt: prompt || '',
        negative_prompt: negative_prompt || '',
        cfg_scale: cfg_scale ?? 0.5,
        mode: normalizeVideoMode(videoMode),
        sound: sound || 'off',
        duration: String(duration || '5'),
      };
    } else if (mode === 'motion-control') {
      const {
        prompt,
        image_url,
        video_url,
        keep_original_sound,
        character_orientation,
        videoMode,
      } = params;

      if (!image_url || !video_url) {
        return NextResponse.json({ error: '缺少参考图或参考视频' }, { status: 400 });
      }

      endpoint = '/kling/v1/videos/motion-control';
      requestBody = {
        prompt: prompt || '',
        image_url,
        video_url,
        keep_original_sound: keep_original_sound || 'no',
        character_orientation: character_orientation || 'image',
        mode: normalizeVideoMode(videoMode),
      };
    } else if (mode === 'identify-face') {
      const { video_id, video_url } = params;

      if ((!video_id && !video_url) || (video_id && video_url)) {
        return NextResponse.json({ error: 'video_id 和 video_url 需要二选一' }, { status: 400 });
      }

      endpoint = '/kling/v1/videos/identify-face';
      requestBody = video_id ? { video_id } : { video_url };
    } else if (mode === 'advanced-lip-sync') {
      const {
        session_id,
        face_id,
        audio_id,
        sound_file,
        sound_start_time,
        sound_end_time,
        sound_insert_time,
        sound_volume,
        original_audio_volume,
      } = params;

      if (!session_id || !face_id) {
        return NextResponse.json({ error: '缺少 session_id 或 face_id' }, { status: 400 });
      }

      if ((!audio_id && !sound_file) || (audio_id && sound_file)) {
        return NextResponse.json({ error: 'audio_id 和 sound_file 需要二选一' }, { status: 400 });
      }

      // sound_file 可以是 URL 或 base64，如果是 data URL 则去掉前缀
      const cleanSoundFile = sound_file
        ? (sound_file.startsWith('data:') ? sound_file.split(',')[1] : sound_file)
        : undefined;

      endpoint = '/kling/v1/videos/advanced-lip-sync';
      requestBody = {
        session_id,
        face_choose: [
          {
            face_id,
            ...(audio_id ? { audio_id } : {}),
            ...(cleanSoundFile ? { sound_file: cleanSoundFile } : {}),
            sound_start_time: Number(sound_start_time ?? 0),
            sound_end_time: Number(sound_end_time ?? 5000),
            sound_insert_time: Number(sound_insert_time ?? 0),
            sound_volume: Number(sound_volume ?? 1),
            original_audio_volume: Number(original_audio_volume ?? 1),
          },
        ],
        external_task_id: '',
        callback_url: '',
      };
    } else {
      return NextResponse.json({ error: `不支持的模式: ${mode}` }, { status: 400 });
    }

    if (userId) {
      const isMember = await checkMembership(userId);
      const charge = getKlingCharge({
        mode,
        isMember,
        motionVersion: params.motionVersion ?? params.klingMotionVersion ?? params.model_name,
        videoMode: params.videoMode ?? params.mode,
        duration: Number(params.duration ?? 5),
      });

      chargedAmount = charge.amount;

      if (chargedAmount > 0) {
        const deduct = await deductBalance(
          userId,
          chargedAmount,
          'video_deduct',
          `Kling 视频生成 - ${charge.description}`,
          {
            mode,
            motionVersion: params.motionVersion ?? params.klingMotionVersion ?? null,
            videoMode: params.videoMode ?? params.mode ?? null,
            duration: params.duration ?? null,
            ...charge.pricingMeta,
          }
        );

        if (!deduct.success) {
          return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
        }
      }
    }

    // 账号池：取一个 n1n key（仅用于本次 fetch 提交）
    const kKeyInfo = await pickKey('n1n');
    let kSuccess = false;
    let kErr: any = null;
    let res: Response;
    try {
      res = await fetch(`${N1N_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kKeyInfo.keyValue}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      kSuccess = res.ok;
    } catch (err) {
      kErr = err;
      throw err;
    } finally {
      if (!kSuccess && !kErr) {
        // 非网络错误的业务失败（如 429/500），在 finally 释放
      }
      await releaseKey(kKeyInfo.keyId, kSuccess, kSuccess ? undefined : categorizeError(kErr));
    }

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429) {
        throw new Error('服务繁忙，请稍后重试');
      }
      throw new Error(`Kling 提交失败 (${res.status}): ${err}`);
    }

    const data = await res.json();
    console.log('Kling 提交结果:', JSON.stringify(data).slice(0, 500));

    if (data.code !== 0) {
      throw new Error(`Kling 错误: ${data.message || JSON.stringify(data)}`);
    }

    if (mode === 'identify-face') {
      const responseData = data.data || {};
      console.log('identify-face 完整响应:', JSON.stringify(data));
      const faces = extractFaceCandidates(responseData);
      const sessionId = String(
        responseData.session_id || responseData.sessionId || responseData.session?.id ||
        responseData.task_id || responseData.taskId || ''
      );

      if (!sessionId) {
        throw new Error(`人脸识别未返回 session_id: ${JSON.stringify(responseData)}`);
      }

      return NextResponse.json({
        success: true,
        sessionId,
        faceId: extractFaceId(responseData, faces),
        faces,
      });
    }

    const taskId = data.data?.task_id;
    if (!taskId) {
      throw new Error(`Kling 未返回 task_id: ${JSON.stringify(data)}`);
    }

    if (userId) {
      const motionVersion = normalizeMotionVersion(
        params.motionVersion ?? params.klingMotionVersion ?? params.model_name
      );
      const videoMode = normalizeVideoMode(params.videoMode ?? params.mode);
      const resolution =
        mode === 'motion-control'
          ? KLING_MOTION_PRICE[motionVersion][videoMode].resolution
          : null;

      await supabaseAdmin.from('video_generations').insert({
        user_id: userId,
        canvas_id: null,
        prompt: params.prompt || '',
        model:
          mode === 'motion-control'
            ? `kling-motion-control-${motionVersion}-${videoMode}`
            : mode === 'advanced-lip-sync'
              ? 'kling-advanced-lip-sync'
              : `kling-${mode}`,
        duration: params.duration ? Number(params.duration) : null,
        resolution,
        aspect_ratio: params.aspect_ratio || null,
        generate_audio: params.sound === 'on',
        video_mode:
          mode === 'advanced-lip-sync'
            ? 'lip-sync'
            : mode === 'motion-control'
              ? 'motion-control'
              : mode,
        // 只存 URL，不存 base64(避免把整张图塞进数据库)
        input_image_url: (() => { const v = params.image_url || params.image; return (v && !String(v).startsWith('data:')) ? v : null; })(),
        end_image_url: (params.image_tail && !String(params.image_tail).startsWith('data:')) ? params.image_tail : null,
        status: 'processing',
        task_id: taskId,
        endpoint: mode,
        cost_credits: 0,
      });
    }

    return NextResponse.json({
      success: true,
      taskId,
      endpoint: mode,
      status: data.data?.task_status || 'submitted',
    });
  } catch (error: any) {
    console.error('Kling 生成错误:', error);

    if (body?.userId && chargedAmount > 0) {
      await refundBalance(
        body.userId,
        chargedAmount,
        `Kling 视频生成失败退款 - ${body.mode}`,
        {
          mode: body.mode,
          motionVersion: body.motionVersion ?? body.klingMotionVersion ?? null,
          videoMode: body.videoMode ?? body.mode ?? null,
        }
      );
    }

    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
