import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const TEMPLATE_3X3 = 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/fenjingmuban/fenjingmuban3X3.jpg';

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${base64}`;
}

function extractImageUrl(data: any): string {
  if (data?.data?.[0]?.url) return data.data[0].url;
  if (data?.data?.[0]?.b64_json) return `data:image/jpeg;base64,${data.data[0].b64_json}`;
  const content = data?.choices?.[0]?.message?.content;
  if (content) {
    if (content.startsWith('data:')) return content;
    if (content.startsWith('http')) return content;
    if (/^[A-Za-z0-9+/=]+$/.test(content.trim())) return `data:image/jpeg;base64,${content.trim()}`;
  }
  throw new Error('无法解析返回的图片数据: ' + JSON.stringify(data).slice(0, 200));
}

export async function POST(req: NextRequest) {
  try {
    const { image, inputType, duration, scriptMode, ratio = '16:9', storyPrompt = '' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const isCellMode = scriptMode === 'detail';
    const shotCount = inputType === '2x2' ? 4 : 9;
    const gridLabel = shotCount === 9 ? '9宫格' : '4宫格';

    const prompt = isCellMode
      ? `根据上传的${gridLabel}分镜图写一个${duration}s电影级细化动作分镜脚本。这${shotCount}个宫格是细化动作分解，整体为一个${duration}s镜头，可以跳过重复帧，时间轴按实际动作节奏分配。把上传的分镜嵌入内置模板空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。${storyPrompt}`
      : `根据上传的${gridLabel}分镜图写一个${duration}s电影级分镜脚本，把上传的${gridLabel}分镜嵌入内置模板空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。${storyPrompt}`;

    const sizeMap: Record<string, string> = {
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '1:1': '1024x1024',
    };
    const size = sizeMap[ratio] || '1536x1024';

    const templateBase64 = await urlToBase64(TEMPLATE_3X3);

    const formData = new FormData();
    for (const imgBase64 of [image, templateBase64]) {
      const match = imgBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) throw new Error('无效的图片格式');
      const buffer = Buffer.from(match[2], 'base64');
      const blob = new Blob([buffer], { type: `image/${match[1]}` });
      formData.append('image[]', blob, `image.${match[1]}`);
    }
    formData.append('prompt', prompt);
    formData.append('model', 'gpt-image-2');
    formData.append('n', '1');
    formData.append('size', size);
    formData.append('quality', 'high');

    const res = await fetch(`${YUNWU_BASE_URL}/v1/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${YUNWU_API_KEY}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `API 错误: ${res.status}`);

    const imageUrl = extractImageUrl(data);
    return NextResponse.json({ imageData: imageUrl });
  } catch (error: any) {
    console.error('StoryboardImage 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
