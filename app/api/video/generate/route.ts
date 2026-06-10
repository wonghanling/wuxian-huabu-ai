import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { Service } from '@volcengine/openapi';
import { calcVideoPrice, OVI_PRICE } from '@/lib/pricing';
import { deductBalance, refundBalance } from '@/lib/billing';

// 火山引擎即梦服务
const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengSubmit = volcService.createJSONAPI('CVSync2AsyncSubmitTask', { Version: '2022-08-31' });
const jimengQuery  = volcService.createJSONAPI('CVSync2AsyncGetResult',  { Version: '2022-08-31' });

falSingleton.config({ credentials: process.env.FAL_KEY! });

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
  provider?: 'fal' | 'dashscope' | 'jimeng';
  dashscopeModel?: string;
  jimengReqKey?: string;
  // 运镜模式专用
  supportsCamera?: boolean;
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
  // —— Pixverse v6(fal,自带音频不传开关;720p/1080p)——
  'pixverse-t2v': {
    name: 'Pixverse v6 文生视频',
    endpoint: 'fal-ai/pixverse/v6/text-to-video',
    mode: 't2v',
    durations: [5, 8],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'pixverse-i2v': {
    name: 'Pixverse v6 图生视频',
    endpoint: 'fal-ai/pixverse/v6/image-to-video',
    mode: 'i2v',
    durations: [5, 8],
    aspectRatios: [],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: true,
    supportsEndFrame: false,
    durationFormat: 'number',
    imageParamName: 'image_url',
    i2vNoAspectRatio: true,
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
    imageParamName: 'first_frame_url',
    endImageParamName: 'last_frame_url',
    i2vNoAspectRatio: true,
  },
  // 即梦 3.0 Pro（1080P，文生+图生首帧）
  'jimeng-pro-t2v': {
    name: '即梦 3.0 Pro 文生视频',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-pro-i2v': {
    name: '即梦 3.0 Pro 图生视频',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_ti2v_v30_pro',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  // 即梦 3.0 720P
  'jimeng-t2v': {
    name: '即梦 3.0 文生视频 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-i2v': {
    name: '即梦 3.0 图生视频首帧 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-first-last': {
    name: '即梦 3.0 首尾帧 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30',
    provider: 'jimeng',
    mode: 'firstLastFrame',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-camera': {
    name: '即梦 3.0 运镜 720P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_recamera_v30',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['720p'],
    defaultResolution: '720p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
    supportsCamera: true,
  },
  // 即梦 3.0 1080P
  'jimeng-1080-t2v': {
    name: '即梦 3.0 文生视频 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_t2v_v30_1080p',
    provider: 'jimeng',
    mode: 't2v',
    durations: [5, 10],
    aspectRatios: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
  },
  'jimeng-1080-i2v': {
    name: '即梦 3.0 图生视频首帧 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_v30_1080',
    provider: 'jimeng',
    mode: 'i2v',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: false,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
  },
  'jimeng-1080-first-last': {
    name: '即梦 3.0 首尾帧 1080P',
    endpoint: 'jimeng',
    jimengReqKey: 'jimeng_i2v_first_tail_v30_1080',
    provider: 'jimeng',
    mode: 'firstLastFrame',
    durations: [5, 10],
    aspectRatios: [],
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    audioBuiltIn: false,
    supportsEndFrame: true,
    durationFormat: 'number',
    i2vNoAspectRatio: true,
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
  let body: any = {};
  let videoPrice = 0;
  try {
    body = await req.json();
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
      cameraTemplate,
      cameraStrength,
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

    // ── 扣费 ──────────────────────────────────────────────────
    if (userId) {
      // 先查会员状态
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('is_member, member_expires_at')
        .eq('id', userId)
        .single();
      const isMember = !!(
        userData?.is_member &&
        userData?.member_expires_at &&
        new Date(userData.member_expires_at) > new Date()
      );

      // OVI 按次，其余按秒
      if (model === 'ovi-i2v') {
        videoPrice = OVI_PRICE;
      } else {
        const res = (resolution || cfg.defaultResolution).toUpperCase();
        videoPrice = calcVideoPrice(model, res, Number(duration) || 5, isMember, generateAudio === true);
      }

      const deduct = await deductBalance(
        userId, videoPrice, 'video_deduct',
        `视频生成 - ${cfg.name}`,
        { model, duration, resolution, generateAudio },
      );
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足，请充值' }, { status: 402 });
      }
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
    let taskId: string;
    let taskEndpoint: string;

    if (cfg.provider === 'jimeng') {
      // 即梦 火山引擎 API（账号池：每次请求取一组双 key 动态创建 volcService）
      const jmKeyInfo = await pickKey('volc');
      const jmVolcService = new Service({
        host: 'visual.volcengineapi.com',
        region: 'cn-north-1',
        serviceName: 'cv',
        accessKeyId: jmKeyInfo.keyValue,
        secretKey: jmKeyInfo.secondaryValue || '',
      });
      const jmSubmit = jmVolcService.createJSONAPI('CVSync2AsyncSubmitTask', { Version: '2022-08-31' });

      let jmSuccess = false;
      let jmErr: any = null;
      try {
      const jmBody: Record<string, unknown> = {
        req_key: cfg.jimengReqKey,
        prompt,
        seed: -1,
      };

      // 时长转帧数：5s=121帧，10s=241帧
      if (duration) jmBody.frames = Number(duration) === 10 ? 241 : 121;

      // 比例（仅 t2v）
      if (cfg.mode === 't2v' && aspectRatio) jmBody.aspect_ratio = aspectRatio;

      // 图片（i2v 首帧）
      if (cfg.mode === 'i2v' && startFrameImage) {
        const url = await toPublicUrl(startFrameImage);
        jmBody.image_urls = [url];
      }

      // 首尾帧
      if (cfg.mode === 'firstLastFrame') {
        const startUrl = await toPublicUrl(startFrameImage);
        const endUrl   = await toPublicUrl(endFrameImage);
        jmBody.image_urls = [startUrl, endUrl];
      }

      // 运镜模式额外参数
      if (cfg.supportsCamera) {
        jmBody.template_id = cameraTemplate || 'dynamic_orbit';
        jmBody.camera_strength = cameraStrength || 'medium';
      }

      const jmRes = await jmSubmit(jmBody) as any;
      console.log('即梦提交结果:', JSON.stringify(jmRes).slice(0, 500));

      if (jmRes?.code !== 10000) {
        jmErr = new Error(`即梦提交失败: ${jmRes?.message || JSON.stringify(jmRes)}`);
        throw jmErr;
      }
      taskId = jmRes?.data?.task_id;
      if (!taskId) {
        jmErr = new Error(`即梦未返回 task_id: ${JSON.stringify(jmRes)}`);
        throw jmErr;
      }
      taskEndpoint = `jimeng:${cfg.jimengReqKey}`;
      jmSuccess = true;
      } catch (err) {
        if (!jmErr) jmErr = err;
        throw err;
      } finally {
        await releaseKey(jmKeyInfo.keyId, jmSuccess, jmSuccess ? undefined : categorizeError(jmErr));
      }

    } else if (cfg.provider === 'dashscope') {
      // DashScope 官方 API（账号池）
      const dsKeyInfo = await pickKey('dashscope');
      let dsSuccess = false;
      let dsErr: any = null;
      try {
      const dsInput: Record<string, unknown> = { prompt };
      const dsParams: Record<string, unknown> = { prompt_extend: true };

      if (cfg.mode === 'i2v' && cfg.imageParamName) {
        dsInput[cfg.imageParamName] = input[cfg.imageParamName];
      }
      if (cfg.mode === 'firstLastFrame') {
        if (cfg.imageParamName) dsInput[cfg.imageParamName] = input[cfg.imageParamName];
        if (cfg.endImageParamName) dsInput[cfg.endImageParamName] = input[cfg.endImageParamName];
      }

      if (duration) dsParams.duration = Number(duration);
      if (resolution) dsParams.resolution = resolution;
      if (cfg.dashscopeModel?.startsWith('wan2.6')) {
        dsParams.audio = generateAudio === true;
      }

      const dsTask = cfg.dashscopeModel?.includes('kf2v') ? 'image2video' : 'video-generation';
      const dsRes = await fetch(
        `https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/${dsTask}/video-synthesis`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${dsKeyInfo.keyValue}`,
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
        dsErr = new Error(`DashScope 提交失败: ${err}`);
        (dsErr as any).status = dsRes.status;
        throw dsErr;
      }

      const dsData = await dsRes.json();
      taskId = dsData.output?.task_id;
      if (!taskId) {
        dsErr = new Error(`DashScope 未返回 task_id: ${JSON.stringify(dsData)}`);
        throw dsErr;
      }
      taskEndpoint = `dashscope:${cfg.dashscopeModel}`;
      dsSuccess = true;
      } catch (err) {
        if (!dsErr) dsErr = err;
        throw err;
      } finally {
        await releaseKey(dsKeyInfo.keyId, dsSuccess, dsSuccess ? undefined : categorizeError(dsErr));
      }

    } else {
      // fal 队列（账号池）
      const keyInfo = await pickKey('fal');
      const fal = createFalClient({ credentials: keyInfo.keyValue });
      let falSuccess = false;
      let falErr: any = null;
      try {
        const { request_id } = await fal.queue.submit(cfg.endpoint, { input });
        taskId = request_id;
        taskEndpoint = cfg.endpoint;
        falSuccess = true;
      } catch (err) {
        falErr = err;
        throw err;
      } finally {
        await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
      }
    }

    // 写入数据库记录
    if (userId) {
      await supabaseAdmin.from('video_generations').insert({
        user_id: userId,
        canvas_id: canvasId || null,
        prompt,
        model,
        duration: duration || null,
        resolution: resolution ? resolution.toLowerCase() : null,
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
    // 生成失败退款
    if (body?.userId && videoPrice > 0) {
      await refundBalance(body.userId, videoPrice, `视频生成失败退款 - ${body.model}`, { model: body.model });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
