import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';
import { createClient } from '@supabase/supabase-js';

fal.config({ credentials: process.env.FAL_KEY! });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ModelConfig = {
  name: string;
  endpoint: string;
  mode: 't2v' | 'i2v' | 'firstLastFrame';
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  defaultResolution: string;
  supportsAudio: boolean;
  audioBuiltIn: boolean;
  supportsEndFrame: boolean;
  durationFormat: 'seconds' | 'number' | 'none';
  imageParamName?: string;
  endImageParamName?: string;
  i2vNoAspectRatio?: boolean;
  provider?: 'fal' | 'dashscope';
  dashscopeModel?: string;
};

const VIDEO_MODELS: Record<string, ModelConfig> = {
  'veo3.1-t2v': {
    name: 'Veo 3.1 文生视频',
    endpoint: 'fal-ai/veo3.1',
    mode: 't2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
  },
  'veo3.1-i2v': {
    name: 'Veo 3.1 图生视频',
    endpoint: 'fal-ai/veo3.1/image-to-video',
    mode: 'i2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
    imageParamName: 'image_url',
  },
  'veo3.1-fast-t2v': {
    name: 'Veo 3.1 Fast 文生视频',
    endpoint: 'fal-ai/veo3.1/fast',
    mode: 't2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
  },
  'veo3.1-fast-i2v': {
    name: 'Veo 3.1 Fast 图生视频',
    endpoint: 'fal-ai/veo3.1/fast/image-to-video',
    mode: 'i2v',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'seconds',
    imageParamName: 'image_url',
  },
  'veo3.1-first-last': {
    name: 'Veo 3.1 首尾帧',
    endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    mode: 'firstLastFrame',
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p', '4k'],
    defaultResolution: '720p',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'seconds',
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
  },
  'wan2.6-t2v': {
    name: 'Wan 2.6 文生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-t2v',
    provider: 'dashscope',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'wan2.5-t2v-preview': {
    name: 'Wan 2.5 文生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.5-t2v-preview',
    provider: 'dashscope',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'wan2.6-i2v': {
    name: 'Wan 2.6 图生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-i2v',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.6-i2v-flash': {
    name: 'Wan 2.6 图生视频 Flash',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.6-i2v-flash',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10, 15],
    aspectRatios: [],
    resolutions: ['720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.5-i2v-preview': {
    name: 'Wan 2.5 图生视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.5-i2v-preview',
    provider: 'dashscope',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'img_url',
    i2vNoAspectRatio: true,
  },
  'wan2.2-kf2v-flash': {
    name: 'Wan 2.2 首尾帧视频',
    endpoint: 'dashscope',
    dashscopeModel: 'wan2.2-kf2v-flash',
    provider: 'dashscope',
    mode: 'firstLastFrame',
    durations: [5],
    aspectRatios: [],
    resolutions: ['480P', '720P', '1080P'],
    defaultResolution: '720P',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'img_url',
    endImageParamName: 'img_url_last',
    i2vNoAspectRatio: true,
  },
  'kling2.6-i2v': {
    name: 'Kling 2.6 Pro 图生视频',
    endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'start_image_url',
    endImageParamName: 'end_image_url',
  },
  'kling3-std-i2v': {
    name: 'Kling 3 Standard 图生视频',
    endpoint: 'fal-ai/kling-video/v3/standard/image-to-video',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: true,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    imageParamName: 'start_image_url',
    endImageParamName: 'end_image_url',
  },
  'ovi-i2v': {
    name: 'Ovi 图生视频',
    endpoint: 'fal-ai/ovi/image-to-video',
    mode: 'i2v',
    durations: [],
    aspectRatios: [],
    resolutions: [],
    defaultResolution: '',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'none',
    imageParamName: 'image_url',
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      model,
      aspectRatio,
      duration,
      resolution,
      generateAudio = false,
      startFrameImage,
      endFrameImage,
      userId,
      canvasId,
    } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const cfg = VIDEO_MODELS[model];
    if (!cfg) {
      return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
    }

    // i2v 模型必须有图片
    if ((cfg.mode === 'i2v' || cfg.mode === 'firstLastFrame') && !startFrameImage) {
      return NextResponse.json({ error: '该模型需要上传图片' }, { status: 400 });
    }

    // 构建 fal 输入参数
    const input: Record<string, unknown> = { prompt };

    // 时长
    if (cfg.durationFormat === 'seconds' && duration) {
      input.duration = `${duration}s`;
    } else if (cfg.durationFormat === 'number' && duration) {
      input.duration = String(duration);
    }

    // 比例：i2v/firstLastFrame 用 "auto"，t2v 用用户选的
    if (cfg.mode === 't2v' && cfg.aspectRatios.length > 0 && aspectRatio) {
      input.aspect_ratio = aspectRatio;
    } else if ((cfg.mode === 'i2v' || cfg.mode === 'firstLastFrame') && !cfg.i2vNoAspectRatio) {
      input.aspect_ratio = 'auto';
    }

    // 分辨率
    if (cfg.resolutions.length > 0 && resolution) {
      input.resolution = resolution;
    }

    // 音频（有开关的模型才传，用户主动开启才传 true）
    if (cfg.supportsAudio && !cfg.audioBuiltIn) {
      input.generate_audio = generateAudio === true;
    }

    // Veo 系列安全等级（字符串类型）+ auto_fix
    if (cfg.endpoint.includes('veo')) {
      input.safety_tolerance = '4';
      input.auto_fix = true;
    }

    // 图片参数 - base64 先上传到 Storage 变成公开 URL
    const toPublicUrl = async (base64: string): Promise<string> => {
      if (!base64 || !base64.startsWith('data:')) return base64;
      const match = base64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return base64;
      const mimeType = match[1];
      const ext = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(match[2], 'base64');
      const filename = `frames/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabaseAdmin.storage.from('assets').upload(filename, buffer, { contentType: mimeType, upsert: false });
      if (error) throw new Error(`上传帧图片失败: ${error.message}`);
      const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
      return data.publicUrl;
    };

    if (cfg.mode === 'i2v' && cfg.imageParamName && startFrameImage) {
      input[cfg.imageParamName] = await toPublicUrl(startFrameImage);
    }
    if (cfg.mode === 'firstLastFrame') {
      if (!startFrameImage || !endFrameImage) {
        return NextResponse.json({ error: '该模型需要同时上传首帧和尾帧图片' }, { status: 400 });
      }
      if (cfg.imageParamName) input[cfg.imageParamName] = await toPublicUrl(startFrameImage);
      if (cfg.endImageParamName) input[cfg.endImageParamName] = await toPublicUrl(endFrameImage);
    }
    // Kling 尾帧
    if (cfg.supportsEndFrame && cfg.endImageParamName && endFrameImage && cfg.mode === 'i2v') {
      input[cfg.endImageParamName] = await toPublicUrl(endFrameImage);
    }

    let taskId: string;
    let taskEndpoint: string;

    if (cfg.provider === 'dashscope') {
      // DashScope 官方 API
      const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY!;
      const dsInput: Record<string, unknown> = { prompt };
      const dsParams: Record<string, unknown> = { prompt_extend: true };

      // 图片参数
      if (cfg.mode === 'i2v' && cfg.imageParamName) {
        dsInput[cfg.imageParamName] = input[cfg.imageParamName];
      }
      if (cfg.mode === 'firstLastFrame') {
        if (cfg.imageParamName) dsInput[cfg.imageParamName] = input[cfg.imageParamName];
        if (cfg.endImageParamName) dsInput[cfg.endImageParamName] = input[cfg.endImageParamName];
      }

      // 时长
      if (duration) dsParams.duration = Number(duration);

      // 分辨率
      if (resolution) dsParams.resolution = resolution;

      // 音频：wan2.6 系列默认有声，用户不开启则显式关闭
      if (cfg.dashscopeModel?.startsWith('wan2.6')) {
        dsParams.audio = generateAudio === true;
      }

      const dsRes = await fetch(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DASHSCOPE_KEY}`,
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: cfg.dashscopeModel,
            input: dsInput,
            parameters: dsParams,
          }),
        }
      );

      if (!dsRes.ok) {
        const err = await dsRes.text();
        throw new Error(`DashScope 提交失败: ${err}`);
      }

      const dsData = await dsRes.json();
      taskId = dsData.output?.task_id;
      if (!taskId) throw new Error(`DashScope 未返回 task_id: ${JSON.stringify(dsData)}`);
      taskEndpoint = `dashscope:${cfg.dashscopeModel}`;
    } else {
      // fal 队列
      const { request_id } = await fal.queue.submit(cfg.endpoint, { input });
      taskId = request_id;
      taskEndpoint = cfg.endpoint;
    }

    // 写入数据库记录
    if (userId) {
      await supabaseAdmin.from('video_generations').insert({
        user_id: userId,
        canvas_id: canvasId || null,
        prompt,
        model,
        duration: duration || null,
        resolution: resolution || null,
        aspect_ratio: aspectRatio || null,
        generate_audio: generateAudio,
        video_mode: cfg.mode === 'firstLastFrame' ? 'first-last-frame' : cfg.mode === 'i2v' ? 'first-frame' : 'text',
        input_image_url: startFrameImage || null,
        end_image_url: endFrameImage || null,
        status: 'processing',
        task_id: taskId,
        endpoint: taskEndpoint,
        cost_credits: 0,
      });
    }

    return NextResponse.json({
      success: true,
      taskId,
      endpoint: taskEndpoint,
      status: 'queued',
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
