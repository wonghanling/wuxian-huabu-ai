'use client';

import { createClient } from '@/lib/supabase/client';
import { mirrorUrlToStorage } from '@/lib/canvas-storage';

// ============================================================
// canvas-v2 后端集成工具 — 1:1 复刻原网 app/canvas 的调用方式
// 后端接口零改动,只是把调用逻辑搬到 React Flow 卡片里复用
// ============================================================

// 获取当前用户 ID(生成时传给后端做扣费/会员校验)
export async function getUserId(): Promise<string | undefined> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id;
  } catch {
    return undefined;
  }
}

// 上传图片到 Supabase storage(assets bucket)—— 照搬原网 uploadImageToStorage
// 统一转 JPEG,返回 publicUrl;未登录或失败返回 null
export async function uploadImageToStorage(file: File): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('请先登录'); return null; }

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas 初始化失败')); return; }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('转 JPEG 失败'));
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => reject(new Error('图片加载失败,可能是格式不支持'));
      img.src = URL.createObjectURL(file);
    });

    const filename = `images/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from('assets').upload(filename, jpegBlob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`上传失败: ${error.message}`);
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (err: any) {
    alert('图片上传失败: ' + err.message);
    return null;
  }
}

// 上传任意文件(视频/音频)到 Supabase storage,原始文件不转码(照原网)
// type 决定路径前缀:video→videos/ audio→audio/
export async function uploadFileToStorage(file: File, type: 'video' | 'audio'): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('请先登录'); return null; }
    const dotExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : (type === 'video' ? '.mp4' : '.mp3');
    const prefix = type === 'video' ? 'videos' : 'audio';
    const filename = `${prefix}/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${dotExt}`;
    const contentType = file.type || (type === 'video' ? 'video/mp4' : 'audio/mpeg');
    const { error } = await supabase.storage.from('assets').upload(filename, file, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`上传失败: ${error.message}`);
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (err: any) {
    alert((type === 'video' ? '视频' : '音频') + '上传失败: ' + err.message);
    return null;
  }
}

// softCompress:最长边 2048,转 JPEG base64(照搬原网)
export function softCompressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 2048;
      if (img.width <= maxSide && img.height <= maxSide) { resolve(dataUrl); return; }
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============ 图片生成 ============
// 照搬原网契约:POST /api/image/generate,fal 异步则轮询 /api/image/fal-query
export interface ImageGenParams {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageQuality?: string;
  imageUrlArray?: string[];     // 参考图 URL(传给 fal)
  imageBase64Array?: string[];  // 参考图 base64(传给 n1n 多图)
  imageBase64?: string;         // 单张 base64
  userId?: string;
}

// 返回最终图片 URL
export async function generateImage(params: ImageGenParams): Promise<string> {
  const res = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      aspectRatio: params.aspectRatio || '1:1',
      imageQuality: params.imageQuality || '2k',
      imageUrlArray: params.imageUrlArray,
      imageBase64Array: params.imageBase64Array,
      imageBase64: params.imageBase64,
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '生成失败');

  // 同步直接返回
  if (data.imageUrl && !data.pending) return data.imageUrl;

  // fal 异步轮询
  if (data.pending && data.requestId) {
    const hasImg = (params.imageUrlArray?.length ?? 0) > 0;
    // endpoint 由后端返回优先,否则按是否带图推断(照搬原网默认)
    const endpoint = data.endpoint || (hasImg ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2');
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const refundQs = params.userId ? `&userId=${encodeURIComponent(params.userId)}&model=${encodeURIComponent(params.model)}&quality=${encodeURIComponent(params.imageQuality || '2k')}` : '';
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}${refundQs}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.failed) throw new Error(qData.reason || qData.error || '审核未通过');
        if (qData.error) throw new Error(qData.error);
        if (attempts > 60) throw new Error('生成超时');
        return poll();
      } catch (e: any) {
        if (e.message && (e.message.includes('超时') || e.message.includes('error') || e.message.includes('审核') || e.message.includes('失败'))) throw e;
        if (attempts > 60) throw new Error('生成超时');
        await new Promise((r) => setTimeout(r, 5000));
        return poll();
      }
    };
    return poll();
  }

  // MJ 异步轮询(taskId)
  if (data.pending && data.taskId) {
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      const qRes = await fetch(`/api/image/mj-query?taskId=${encodeURIComponent(data.taskId)}`);
      const qData = await qRes.json();
      // 后端返回 { status: 'completed'|'failed'|'pending', imageUrl?, error? }
      if (qData.status === 'completed' && qData.imageUrl) return qData.imageUrl;
      if (qData.status === 'failed') throw new Error(qData.error || 'MJ 生成失败');
      if (attempts > 60) throw new Error('生成超时');
      return poll();
    };
    return poll();
  }

  throw new Error('未获取到图片');
}

// ============ 虚拟试衣 ============
// POST /api/tryon → 返回 pending+requestId+endpoint,复用 /api/image/fal-query 轮询
export interface TryOnParams {
  personImageUrl: string;
  clothingImageUrl: string;
  preservePose?: boolean;
  aspectRatio?: string;
  userId?: string;
}

export async function generateTryOn(params: TryOnParams): Promise<string> {
  const res = await fetch('/api/tryon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personImageUrl: params.personImageUrl,
      clothingImageUrl: params.clothingImageUrl,
      preservePose: params.preservePose ?? true,
      aspectRatio: params.aspectRatio || '3:4',
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '虚拟试衣失败');

  if (data.imageUrl && !data.pending) return data.imageUrl;

  if (data.pending && data.requestId) {
    const endpoint = data.endpoint || 'fal-ai/image-apps-v2/virtual-try-on';
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const refundQs = params.userId ? `&userId=${encodeURIComponent(params.userId)}&model=virtual-try-on` : '';
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}${refundQs}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.failed) throw new Error(qData.reason || qData.error || '审核未通过');
        if (qData.error) throw new Error(qData.error);
        if (attempts > 60) throw new Error('生成超时');
        return poll();
      } catch (e: any) {
        if (e.message && (e.message.includes('超时') || e.message.includes('error') || e.message.includes('审核') || e.message.includes('失败'))) throw e;
        if (attempts > 60) throw new Error('生成超时');
        await new Promise((r) => setTimeout(r, 5000));
        return poll();
      }
    };
    return poll();
  }

  throw new Error('未获取到试穿图');
}

// ============ 输出 mirror 转存 ============
// 第三方生成 URL 会过期,转存到自己 Supabase 拿永久 URL(照原网 mirrorUrlToStorage)
// 失败保留原 URL 兜底,不阻塞
export async function mirrorOutput(url: string, type: 'image' | 'video'): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !url) return url;
    return await mirrorUrlToStorage(user.id, url, type);
  } catch (err) {
    console.warn('mirror 转存失败,保留原 URL:', err);
    return url;
  }
}

// ============ 视频生成 ============
// 照原网契约:POST /api/video/generate 返回 {taskId, endpoint},轮询 /api/video/query
export interface VideoGenParams {
  prompt: string;
  model: string;
  aspectRatio?: string;
  duration?: number;
  resolution?: string;
  generateAudio?: boolean;
  startFrameImage?: string;   // 首帧(URL 或 base64)
  endFrameImage?: string;     // 尾帧
  refImages?: string[];       // r2v 参考图(URL)
  refVoices?: string[];       // wan2.7-r2v 音色:按参考素材顺序(图先视频后)依次分配
  refVideos?: string[];       // r2v 参考视频(URL)
  editVideo?: string;         // 视频编辑 待编辑视频(URL);升分辨率的源视频也用它
  sourceHeight?: number;      // 升分辨率:源视频高度,后端用它换算 upscale_factor
  cameraTemplate?: string;    // jimeng-camera 专用
  cameraStrength?: string;
  userId?: string;
}

// 返回最终视频 URL;onProgress 可选回调更新进度/状态
export async function generateVideo(
  params: VideoGenParams,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || '';

  const res = await fetch('/api/video/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 带 token:后端据此判断用户有没有自带阿里云 key(BYOK)
      // 没登录/没配 key 时自动走平台账号池,行为和以前一致
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio || '16:9',
      duration: params.duration ?? 5,
      resolution: params.resolution ?? '720p',
      generateAudio: params.generateAudio ?? false,
      startFrameImage: params.startFrameImage,
      endFrameImage: params.endFrameImage,
      refImages: params.refImages,
      refVoices: params.refVoices,
      refVideos: params.refVideos,
      editVideo: params.editVideo,
      sourceHeight: params.sourceHeight,
      cameraTemplate: params.cameraTemplate,
      cameraStrength: params.cameraStrength,
      userId: params.userId || undefined,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '视频生成请求失败');
  }
  const data = await res.json();
  const taskId = data.taskId;
  const endpoint = data.endpoint;
  const keyId = data.keyId;  // dashscope 必须用创建任务的同一把 key 查询
  const byok = data.byok === true;  // 用了自带 key,轮询必须用同一把
  if (!taskId) throw new Error('未返回 taskId');

  // 轮询(5秒间隔,60次超时,照原网)
  let attempts = 0;
  const poll = async (): Promise<string> => {
    if (attempts >= 60) throw new Error('视频生成超时,请稍后重试');
    attempts++;
    await new Promise((r) => setTimeout(r, 5000));
    const qRes = await fetch(`/api/video/query?taskId=${encodeURIComponent(taskId)}&endpoint=${encodeURIComponent(endpoint || '')}&keyId=${encodeURIComponent(keyId || '')}${byok ? '&byok=1' : ''}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (!qRes.ok) return poll();
    const qData = await qRes.json();
    const progress = qData.progress || 30;
    const statusText = qData.status === 'pending' ? '排队中...' : qData.status === 'processing' ? '生成中...' : '处理中...';
    onProgress?.(progress, statusText);
    if (qData.status === 'completed' && qData.videoUrl) return qData.videoUrl;
    if (qData.status === 'failed') throw new Error(qData.error || '视频生成失败');
    return poll();
  };
  return poll();
}

// ============ Seedance 生成 ============
// 照原网契约:POST /api/seedance/generate 返回 {taskId, arkKeyId},轮询 /api/seedance/query
// 首帧/尾帧/参考图/参考视频/参考音频 全部传 storage URL(后端自适应:data:转URL,http直接用)
// 注意:refAudioBase64 字段名是历史遗留,实际存的是音频 URL(原网已全URL化)
export interface SeedanceGenParams {
  mode: string;               // t2v / i2v / first-last / multimodal
  model: string;
  prompt: string;
  ratio?: string;
  duration?: number;          // -1=智能
  resolution?: string;
  generateAudio?: boolean;
  firstFrameImage?: string;
  lastFrameImage?: string;
  refImages?: string[];       // 多模态参考图(URL 数组)
  refVideoUrl?: string;       // 参考视频 URL
  refAudioUrl?: string;       // 参考音频 URL(后端字段叫 refAudioBase64,但传URL)
  refVideoSeconds?: number;   // 参考视频总时长(秒):带视频输入按 (输入+输出) 计费
  userId?: string;
}

export async function generateSeedance(
  params: SeedanceGenParams,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  // 带 token:后端据此判断用户有没有自带方舟 key(BYOK)
  // 没登录/没配 key 时后端自动走平台账号池,行为和以前一致
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || '';

  const res = await fetch('/api/seedance/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      mode: params.mode,
      model: params.model,
      prompt: params.prompt,
      ratio: params.ratio || '16:9',
      duration: params.duration ?? 5,
      resolution: params.resolution || '720p',
      generateAudio: params.generateAudio ?? true,
      firstFrameImage: params.firstFrameImage || undefined,
      lastFrameImage: params.lastFrameImage || undefined,
      refImages: params.refImages && params.refImages.length > 0 ? params.refImages : undefined,
      refVideoUrl: params.refVideoUrl || undefined,
      refAudioBase64: params.refAudioUrl || undefined,  // 后端字段名,实际传 URL
      refVideoSeconds: params.refVideoSeconds || 0,     // 带视频输入计费用
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || '提交失败');
  const taskId = data.taskId;
  const arkKeyId = data.arkKeyId || '';
  const byok = data.byok === true;   // 用了自带 key,轮询必须用同一把
  const channel = data.channel || '';  // 后端回传的通道代号,轮询时原样带回
  if (!taskId) throw new Error('未返回 taskId');

  let attempts = 0;
  const poll = async (): Promise<string> => {
    attempts++;
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const qRes = await fetch(
        '/api/seedance/query?taskId=' + taskId
          + (arkKeyId ? '&arkKeyId=' + arkKeyId : '')
          + (byok ? '&byok=1' : '')
          + (channel ? '&channel=' + channel : ''),
        { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
      );
      const qData = await qRes.json();
      if (qData.status === 'completed' && qData.videoUrl) return qData.videoUrl;
      if (qData.status === 'failed') throw new Error(qData.error || 'Seedance 生成失败');
      if (attempts >= 120) throw new Error('生成超时');
      const prog = qData.status === 'queued' ? 10 : Math.min(90, 10 + attempts * 1.5);
      onProgress?.(prog, qData.status === 'queued' ? '排队中...' : '生成中...');
      return poll();
    } catch (e: any) {
      if (e?.message && (e.message.includes('超时') || e.message.includes('失败'))) throw e;
      if (attempts >= 120) throw new Error('生成超时');
      onProgress?.(50, '网络重试中...');
      await new Promise((r) => setTimeout(r, 8000));
      return poll();
    }
  };
  return poll();
}

// ============ Kling v3 视频(独立，走 fal，不与 Seedance 共享)============
export interface KlingV3GenParams {
  tier: string;               // 4k / pro / standard
  mode: string;               // t2v / i2v / first-last / multimodal
  prompt: string;
  duration?: number;
  generateAudio?: boolean;
  firstFrameImage?: string;   // 场景起始帧
  lastFrameImage?: string;    // 场景结束帧(可选)
  elements?: { frontal: string; references: string[] }[];  // 多模态:角色元素(最多3,每个1正面+最多3参考)
  refVideoUrl?: string;       // 多模态参考视频 → elements
  userId?: string;
}

export async function generateKlingV3(
  params: KlingV3GenParams,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const res = await fetch('/api/kling-v3/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tier: params.tier,
      mode: params.mode,
      prompt: params.prompt,
      duration: params.duration ?? 5,
      generateAudio: params.generateAudio ?? false,
      firstFrameImage: params.firstFrameImage || undefined,
      lastFrameImage: params.lastFrameImage || undefined,
      elements: params.elements && params.elements.length > 0 ? params.elements : undefined,
      refVideoUrl: params.refVideoUrl || undefined,
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || '提交失败');
  const requestId = data.requestId;
  const endpoint = data.endpoint;
  if (!requestId || !endpoint) throw new Error('未返回 requestId');

  let attempts = 0;
  const poll = async (): Promise<string> => {
    attempts++;
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const refundQs = params.userId ? `&userId=${encodeURIComponent(params.userId)}&tier=${encodeURIComponent(params.tier)}&duration=${params.duration ?? 5}&audio=${params.generateAudio ? 1 : 0}` : '';
      const qRes = await fetch(`/api/kling-v3/query?requestId=${encodeURIComponent(requestId)}&endpoint=${encodeURIComponent(endpoint)}${refundQs}`);
      const qData = await qRes.json();
      if (qData.success && qData.videoUrl) return qData.videoUrl;
      if (qData.failed) throw new Error(qData.reason || qData.error || '审核未通过');
      if (attempts >= 120) throw new Error('生成超时');
      onProgress?.(Math.min(90, 10 + attempts * 1.5), '生成中...');
      return poll();
    } catch (e: any) {
      if (e?.message && (e.message.includes('超时') || e.message.includes('失败') || e.message.includes('审核'))) throw e;
      if (attempts >= 120) throw new Error('生成超时');
      onProgress?.(50, '网络重试中...');
      await new Promise((r) => setTimeout(r, 8000));
      return poll();
    }
  };
  return poll();
}

// ============ Kling 对口型 ============
// 两步:① identify-face 识别人脸拿 session_id/face_id ② advanced-lip-sync 生成 → 轮询
// 视频/音频都传 storage URL(后端要求非 data: 的真实 URL)
export interface KlingLipSyncParams {
  videoUrl: string;           // 源视频 URL
  audioUrl: string;           // 音频 URL
  soundStart?: number;
  soundEnd?: number;
  soundInsert?: number;
  soundVolume?: number;
  originalVolume?: number;
}

export async function generateKlingLipSync(
  params: KlingLipSyncParams,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  // ① 人脸识别
  onProgress?.(5, '识别人脸中...');
  const faceRes = await fetch('/api/kling/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'identify-face', video_url: params.videoUrl }),
  });
  const faceData = await faceRes.json();
  if (!faceRes.ok) throw new Error(`人脸识别失败: ${faceData?.error || ''}`);
  const sessionId = faceData.sessionId;
  const faceId = faceData.faceId || '-1';

  // ② 提交对口型
  onProgress?.(20, '提交生成中...');
  const res = await fetch('/api/kling/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'advanced-lip-sync',
      session_id: sessionId,
      face_id: faceId,
      sound_file: params.audioUrl,
      sound_start_time: params.soundStart ?? 0,
      sound_end_time: params.soundEnd ?? 5000,
      sound_insert_time: params.soundInsert ?? 0,
      sound_volume: params.soundVolume ?? 1,
      original_audio_volume: params.originalVolume ?? 1,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`生成失败: ${data?.error || ''}`);
  const taskId = data.taskId;
  if (!taskId) throw new Error('未返回 taskId');

  // ③ 轮询(5秒间隔,60次超时,照原网)
  let attempts = 0;
  const poll = async (): Promise<string> => {
    attempts++;
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const qRes = await fetch(`/api/kling/query?taskId=${taskId}&mode=lip-sync`);
      const qData = await qRes.json();
      if (qData.status === 'completed' && qData.videoUrl) return qData.videoUrl;
      if (qData.status === 'failed') throw new Error(qData.error || '生成失败');
      if (attempts >= 60) throw new Error('生成超时');
      onProgress?.(Math.min(90, 20 + attempts * 2), '生成中...');
      return poll();
    } catch (e: any) {
      if (e?.message && (e.message.includes('超时') || e.message.includes('失败'))) throw e;
      if (attempts >= 60) throw new Error('生成超时');
      onProgress?.(50, '网络重试中...');
      await new Promise((r) => setTimeout(r, 8000));
      return poll();
    }
  };
  return poll();
}

// ============ 工具:URL → base64(GEM Step3/Step4 后端要 base64) ============
export async function urlToBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise<string>((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result as string);
    rd.onerror = reject;
    rd.readAsDataURL(blob);
  });
}

// ============ GEM 分镜 Step2(文案输出) ============
export async function generateGemStoryboard(params: {
  images?: string[]; script: string; gridSize: string; mode: string; userId?: string;
}): Promise<string> {
  const res = await fetch('/api/gem/generate-storyboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: params.images && params.images.length > 0 ? params.images : undefined,
      script: params.script, gridSize: params.gridSize, mode: params.mode,
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data.result as string;
}

// ============ GEM 导演引擎 Step3(过渡指令文案) ============
export async function generateGemTransitions(params: {
  startImage: string; endImage: string; characterHint?: string; actionSuggestion?: string; userId?: string;
}): Promise<string> {
  const startB64 = await urlToBase64(params.startImage);
  const endB64 = await urlToBase64(params.endImage);
  const res = await fetch('/api/gem/generate-transitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startImage: startB64, endImage: endB64,
      characterHint: params.characterHint || '', actionSuggestion: params.actionSuggestion || '',
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return (data.prompt ?? data.result) as string;
}

// ============ GEM 导演引擎 Step4(分镜图片) ============
const GEM4_TEMPLATE: Record<string, string> = {
  'single': '/fenjingmuban2x2.jpg', '2x2': '/fenjingmuban2x2.jpg', '3x3': '/fenjingmuban3X3.jpg',
};
const GEM4_SIZE: Record<string, string> = {
  '16:9': '2048x1152', '9:16': '2160x3840', '1:1': '2048x2048',
};

export async function generateGemStoryboardImage(params: {
  inputType: 'single' | '2x2' | '3x3';
  scriptMode?: 'normal' | 'detail';
  duration: number; ratio: string; actionSuggestion?: string;
  userImages: string[]; userId?: string;
}, onProgress?: (p: number) => void): Promise<string> {
  const action = params.actionSuggestion || '';
  let prompt = '';
  if (params.inputType === 'single') {
    prompt = `图1是人物三视角参考图，用于保持角色外观、服装、比例的一致性。图2是剧情首帧，定义起始场景、构图、光线和氛围。根据这两张参考图，设计4个连续电影级分镜画面：第1格严格还原首帧构图，第2-4格按剧情发展推进动作。把4个画面嵌入分镜脚本模板的4个空白画面框里，同时只在模板说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效，不覆盖画面框。整体为一个${params.duration}s电影级镜头，时间轴按动作节奏分配。${action}`;
  } else {
    const shotCount = params.inputType === '2x2' ? 4 : 9;
    const gridLabel = shotCount === 9 ? '9宫格' : '4宫格';
    prompt = params.scriptMode === 'detail'
      ? `把${gridLabel}分镜图的画面嵌入分镜脚本模板的空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。写一个${params.duration}s电影级细化动作分镜脚本，这${shotCount}个宫格是细化动作分解，整体为一个${params.duration}s镜头，可以跳过重复帧，时间轴按实际动作节奏分配。${action}`
      : `把${gridLabel}分镜图的画面嵌入分镜脚本模板的空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。写一个${params.duration}s电影级分镜脚本。${action}`;
  }

  const templateUrl = GEM4_TEMPLATE[params.inputType];
  const templateBlob = await fetch(`${templateUrl}?v=${Math.random()}`, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('模板图加载失败');
    return r.blob();
  });
  const templateB64 = await new Promise<string>((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result as string);
    rd.onerror = reject;
    rd.readAsDataURL(templateBlob);
  });

  // 用户图保持 URL 直传(后端认 http 直接用,避免 base64 撑爆 4.5MB 请求体导致 413);
  // 只有 data: 开头的(本地未上传)才转 base64。模板图是本地资源仍转 base64。
  const userImgArr = await Promise.all(
    params.userImages.map((u) => (u && u.startsWith('http') ? Promise.resolve(u) : urlToBase64(u)))
  );
  const imageBase64Array = params.inputType === 'single'
    ? [...userImgArr, templateB64]
    : [userImgArr[0], templateB64];

  onProgress?.(10);
  const res = await fetch('/api/gem/generate-storyboard-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt, aspectRatio: GEM4_SIZE[params.ratio] || '2048x1152',
      imageBase64Array, userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  if (data.imageUrl && !data.pending) return data.imageUrl;
  if (data.pending && data.requestId) {
    const endpoint = data.endpoint || 'fal-ai/nano-banana-2/edit';
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
      const qData = await qRes.json();
      if (qData.success && qData.imageUrl) return qData.imageUrl;
      if (qData.error) throw new Error(qData.error);
      if (attempts > 60) throw new Error('生成超时');
      onProgress?.(Math.min(90, 10 + attempts * 2));
      return poll();
    };
    return poll();
  }
  throw new Error('未获取到分镜图');
}

// ============ 文本卡:普通文本生成 ============
// POST /api/chat 返回 data.content
export async function generateText(params: {
  model: string; prompt: string; imageUrl?: string; userId?: string;
}): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      imageUrl: params.imageUrl || undefined,
      stream: false,
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '生成失败');
  return data.content as string;
}

// ============ 文本卡:提示词优化模式 ============
// POST /api/optimize-prompt 返回 data.optimizedPrompt(会员每日100次额度)
export async function optimizePrompt(params: {
  userInput: string; duration?: string; ratio?: string; uploadedImage?: string; userId?: string;
}): Promise<string> {
  const res = await fetch('/api/optimize-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInput: params.userInput,
      duration: params.duration || '13-15秒',
      ratio: params.ratio || '16:9',
      uploadedImage: params.uploadedImage || undefined,
      userId: params.userId || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '优化失败');
  return data.optimizedPrompt as string;
}

// ============================================================
// Design Workflow — 统一编辑入口
// 接口长期不变：mode + provider + model，新能力只加值不改签名
// ============================================================

// 上传 mask PNG 到 Supabase storage（masks/{userId}/），返回公开 URL
export async function uploadMaskToStorage(blob: Blob): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('请先登录'); return null; }
    const filename = `masks/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error } = await supabase.storage.from('assets').upload(filename, blob, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
    if (error) throw new Error(`mask 上传失败: ${error.message}`);
    const { data } = supabase.storage.from('assets').getPublicUrl(filename);
    return data.publicUrl;
  } catch (err: any) {
    alert('mask 上传失败: ' + err.message);
    return null;
  }
}

export type DesignEditMode = 'region-edit' | 'remove' | 'replace' | 'expand' | 'gpt-edit';

// 调用 /api/design/edit，异步提交后轮询 fal-query，返回结果图 URL
export async function editDesignImage(params: {
  imageUrl: string;
  maskUrl?: string;
  prompt: string;
  mode: DesignEditMode;
  provider?: string;
  model?: string;
  ratio?: string;
  userId?: string;
  imageWidth?: number;   // 原图宽度（px），用于按 MP 动态计费
  imageHeight?: number;  // 原图高度（px）
}): Promise<string> {
  const res = await fetch('/api/design/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      maskUrl: params.maskUrl || undefined,
      prompt: params.prompt,
      mode: params.mode,
      provider: params.provider || 'fal',
      model: params.model || undefined,
      ratio: params.ratio || undefined,
      userId: params.userId || undefined,
      imageWidth: params.imageWidth || undefined,
      imageHeight: params.imageHeight || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '编辑失败');

  // 同步直接返回（兼容）
  if (data.imageUrl && !data.pending) return data.imageUrl;

  // 异步：轮询 /api/image/fal-query（复用现有通用 fal 轮询）
  if (data.pending && data.requestId && data.endpoint) {
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(data.endpoint)}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.failed) throw new Error(qData.reason || qData.error || '审核未通过');
        if (qData.error) throw new Error(qData.error);
        if (attempts > 80) throw new Error('编辑超时');
        return poll();
      } catch (e: any) {
        if (e.message && (e.message.includes('超时') || e.message.includes('未返回'))) throw e;
        if (attempts > 80) throw new Error('编辑超时');
        await new Promise((r) => setTimeout(r, 5000));
        return poll();
      }
    };
    return poll();
  }

  throw new Error('编辑失败：未返回结果');
}

// ============================================================
// 抠图（透明 PNG）— 调 /api/design/extract → fal-ai/birefnet
// ============================================================
export async function extractImage(params: {
  imageUrl: string;
  userId?: string;
}): Promise<string> {
  const res = await fetch('/api/design/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl: params.imageUrl, userId: params.userId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '抠图失败');

  if (data.imageUrl && !data.pending) return data.imageUrl;

  if (data.pending && data.requestId && data.endpoint) {
    let attempts = 0;
    const poll = async (): Promise<string> => {
      attempts++;
      await new Promise((r) => setTimeout(r, 3000));
      const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(data.endpoint)}`);
      const qData = await qRes.json();
      if (qData.success && qData.imageUrl) return qData.imageUrl;
      if (qData.error) throw new Error(qData.error);
      if (attempts > 60) throw new Error('抠图超时');
      return poll();
    };
    return poll();
  }

  throw new Error('抠图失败：未返回结果');
}