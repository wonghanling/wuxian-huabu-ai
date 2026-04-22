import { fal } from '@fal-ai/client';

// 压缩图片到指定大小
function compressImageBase64(dataUrl: string, maxSize = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// 判断是否是 base64
function isBase64(s: string) {
  return s.startsWith('data:');
}

// base64 转 Blob 上传到 fal storage
async function uploadBase64ToFal(base64: string): Promise<string> {
  const compressed = await compressImageBase64(base64);
  const match = compressed.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error('无效的图片格式');
  const mimeType = match[1];
  const blob = await fetch(compressed).then(r => r.blob());
  const file = new File([blob], `image.jpg`, { type: mimeType });
  const url = await fal.storage.upload(file);
  return url;
}

export type PreparedImage = {
  imageBase64?: string;
  imageBase64Array?: string[];
  imageUrlArray?: string[];
};

/**
 * 根据模型自动处理图片格式
 * - nano-banana-pro: 需要 fal storage URL → imageUrlArray
 * - nano-banana: 需要 base64 → imageBase64Array
 * - 其他 (flux-kontext, doubao, mj): 需要 base64 → imageBase64
 */
export async function prepareImageForModel(
  imageData: string,
  model: string
): Promise<PreparedImage> {
  if (!imageData) return {};

  if (model === 'nano-banana-pro') {
    // 需要 fal storage URL
    if (isBase64(imageData)) {
      const url = await uploadBase64ToFal(imageData);
      return { imageUrlArray: [url] };
    } else {
      // 已经是 URL（Supabase 等）直接用
      return { imageUrlArray: [imageData] };
    }
  }

  if (model === 'nano-banana') {
    // 需要 base64 数组
    if (isBase64(imageData)) {
      const compressed = await compressImageBase64(imageData);
      return { imageBase64Array: [compressed] };
    } else {
      // URL 转 base64
      const res = await fetch(imageData);
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const compressed = await compressImageBase64(base64);
      return { imageBase64Array: [compressed] };
    }
  }

  // flux-kontext, doubao, mj 等：需要 base64
  if (isBase64(imageData)) {
    const compressed = await compressImageBase64(imageData);
    return { imageBase64: compressed };
  } else {
    // URL 转 base64
    const res = await fetch(imageData);
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
    const compressed = await compressImageBase64(base64);
    return { imageBase64: compressed };
  }
}
