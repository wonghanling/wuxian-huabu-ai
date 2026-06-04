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
    const { error } = await supabase.storage.from('assets').upload(filename, jpegBlob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error(`上传失败: ${error.message}`);
    const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
    return urlData.publicUrl;
  } catch (err: any) {
    alert('图片上传失败: ' + err.message);
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
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.error) throw new Error(qData.error);
        if (attempts > 60) throw new Error('生成超时');
        return poll();
      } catch (e: any) {
        if (e.message && (e.message.includes('超时') || e.message.includes('error'))) throw e;
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
      if (qData.success && qData.imageUrl) return qData.imageUrl;
      if (qData.error) throw new Error(qData.error);
      if (attempts > 60) throw new Error('生成超时');
      return poll();
    };
    return poll();
  }

  throw new Error('未获取到图片');
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
