import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { prompt, model, size, quality, images } = await req.json();

    if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 });

    const isEdit = model === 'gpt-image-2-all' || (images && images.length > 0);

    let imageUrl: string;

    if (isEdit && images && images.length > 0) {
      // 编辑/多图融合：multipart/form-data
      const formData = new FormData();
      for (const imgBase64 of images) {
        const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        formData.append('image', blob, 'image.jpg');
      }
      formData.append('prompt', prompt);
      formData.append('model', 'gpt-image-2');
      formData.append('n', '1');
      if (size) formData.append('size', size);
      if (quality) formData.append('quality', quality);

      const res = await fetch(`${YUNWU_BASE_URL}/v1/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${YUNWU_API_KEY}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      imageUrl = extractImageUrl(data);
    } else {
      // 文生图
      const res = await fetch(`${YUNWU_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-2',
          prompt,
          n: 1,
          size: size || '2048x1152',
          quality: quality || 'medium',
          format: 'jpeg',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      imageUrl = extractImageUrl(data);
    }

    return NextResponse.json({ imageUrl });
  } catch (err: any) {
    console.error('gpt-image error:', err);
    return NextResponse.json({ error: err.message || '生成失败' }, { status: 500 });
  }
}

function extractImageUrl(data: any): string {
  // 尝试标准 OpenAI images 格式
  if (data?.data?.[0]?.url) return data.data[0].url;
  if (data?.data?.[0]?.b64_json) return `data:image/jpeg;base64,${data.data[0].b64_json}`;
  // 兼容 chat.completion 格式（n1n.ai 的包装）
  const content = data?.choices?.[0]?.message?.content;
  if (content) {
    // 如果 content 是 base64
    if (content.startsWith('data:')) return content;
    // 如果 content 是 URL
    if (content.startsWith('http')) return content;
    // 如果 content 是纯 base64 字符串
    if (/^[A-Za-z0-9+/=]+$/.test(content.trim())) return `data:image/jpeg;base64,${content.trim()}`;
  }
  throw new Error('无法解析返回的图片数据: ' + JSON.stringify(data).slice(0, 200));
}
