import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

fal.config({ credentials: process.env.FAL_KEY! });

// fal.ai 视频模型配置
const VIDEO_MODELS: Record<string, {
  endpoint: string;
  mode: 't2v' | 'i2v' | 'firstLastFrame';
  durationFormat: 'veo' | 'wan' | 'none'; // veo="4s", wan="5", none=不传
  hasAspectRatio: boolean;
  hasResolution: boolean;
  hasAudio: boolean;
  imageParam?: string; // i2v 时图片参数名
}> = {
  'veo3.1-t2v':        { endpoint: 'fal-ai/veo3.1',                                        mode: 't2v',          durationFormat: 'veo', hasAspectRatio: true,  hasResolution: true,  hasAudio: true },
  'veo3.1-i2v':        { endpoint: 'fal-ai/veo3.1/image-to-video',                         mode: 'i2v',          durationFormat: 'veo', hasAspectRatio: true,  hasResolution: true,  hasAudio: true,  imageParam: 'image_url' },
  'veo3.1-fast-t2v':   { endpoint: 'fal-ai/veo3.1/fast',                                   mode: 't2v',          durationFormat: 'veo', hasAspectRatio: true,  hasResolution: true,  hasAudio: true },
  'veo3.1-fast-i2v':   { endpoint: 'fal-ai/veo3.1/fast/image-to-video',                    mode: 'i2v',          durationFormat: 'veo', hasAspectRatio: true,  hasResolution: true,  hasAudio: true,  imageParam: 'image_url' },
  'veo3.1-first-last': { endpoint: 'fal-ai/veo3.1/fast/first-last-frame-to-video',         mode: 'firstLastFrame', durationFormat: 'veo', hasAspectRatio: true, hasResolution: true,  hasAudio: true },
  'wan2.5-t2v':        { endpoint: 'fal-ai/wan-25-preview/text-to-video',                  mode: 't2v',          durationFormat: 'wan', hasAspectRatio: true,  hasResolution: true,  hasAudio: false },
  'wan2.5-i2v':        { endpoint: 'fal-ai/wan-25-preview/image-to-video',                 mode: 'i2v',          durationFormat: 'wan', hasAspectRatio: false, hasResolution: true,  hasAudio: false, imageParam: 'image_url' },
  'kling2.6-i2v':      { endpoint: 'fal-ai/kling-video/v2.6/pro/image-to-video',           mode: 'i2v',          durationFormat: 'wan', hasAspectRatio: false, hasResolution: false, hasAudio: true,  imageParam: 'start_image_url' },
  'kling3-std-i2v':    { endpoint: 'fal-ai/kling-video/v3/standard/image-to-video',        mode: 'i2v',          durationFormat: 'wan', hasAspectRatio: false, hasResolution: false, hasAudio: true,  imageParam: 'start_image_url' },
  'ovi-i2v':           { endpoint: 'fal-ai/ovi/image-to-video',                            mode: 'i2v',          durationFormat: 'none', hasAspectRatio: false, hasResolution: false, hasAudio: false, imageParam: 'image_url' },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      model,
      aspectRatio = '16:9',
      duration = 5,
      resolution = '1080p',
      startFrameImage,
      endFrameImage,
    } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const cfg = VIDEO_MODELS[model];
    if (!cfg) {
      return NextResponse.json({ error: `不支持的视频模型: ${model}` }, { status: 400 });
    }

    // 构建 fal 输入参数
    const input: Record<string, unknown> = { prompt };

    // 时长格式
    if (cfg.durationFormat === 'veo') {
      input.duration = `${duration}s`;
    } else if (cfg.durationFormat === 'wan') {
      input.duration = String(duration);
    }

    if (cfg.hasAspectRatio) input.aspect_ratio = aspectRatio;
    if (cfg.hasResolution)  input.resolution = resolution;
    if (cfg.hasAudio)       input.generate_audio = true;

    // Veo 系列需要 safety_tolerance
    if (cfg.endpoint.includes('veo')) {
      input.safety_tolerance = '4';
    }

    // 图片参数
    if (cfg.mode === 'i2v' && cfg.imageParam && startFrameImage) {
      input[cfg.imageParam] = startFrameImage;
    }
    if (cfg.mode === 'firstLastFrame') {
      if (startFrameImage) input.first_frame_url = startFrameImage;
      if (endFrameImage)   input.last_frame_url  = endFrameImage;
    }
    // Kling 尾帧
    if ((model === 'kling2.6-i2v' || model === 'kling3-std-i2v') && endFrameImage) {
      input.end_image_url = endFrameImage;
    }

    // 提交到 fal 队列
    const { request_id } = await fal.queue.submit(cfg.endpoint, { input });

    return NextResponse.json({
      success: true,
      taskId: request_id,
      endpoint: cfg.endpoint,
      status: 'queued',
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
