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

export async function POST(req: NextRequest) {
  try {
    const { image, inputType, duration, scriptMode, ratio = '1:1', storyPrompt = '' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    // 构建 prompt
    const isCellMode = scriptMode === 'detail'; // 细化动作脚本
    const shotCount = inputType === '2x2' ? 4 : 9;
    const templateUrl = TEMPLATE_3X3; // 后续可扩展 2x2 模板

    let prompt = '';
    if (isCellMode) {
      prompt = `根据上传的${shotCount === 9 ? '9宫格' : '4宫格'}分镜图写一个${duration}s电影级细化动作分镜脚本。这${shotCount}个宫格是细化动作分解，整体为一个${duration}s镜头，可以跳过重复帧，时间轴按实际动作节奏分配（每格约${(duration / shotCount).toFixed(1)}s）。把上传的分镜嵌入内置模板空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。${storyPrompt ? storyPrompt : ''}`;
    } else {
      prompt = `根据上传的${shotCount === 9 ? '9宫格' : '4宫格'}分镜图写一个${duration}s电影级分镜脚本。把上传的分镜嵌入内置模板空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。${storyPrompt ? storyPrompt : ''}`;
    }

    // 获取模板图 base64
    const templateBase64 = await urlToBase64(templateUrl);

    // 比例直接映射到 gpt-image-2 支持的尺寸
    const sizeMap: Record<string, string> = {
      '16:9': '1536x1024',
      '9:16': '1024x1536',
      '1:1': '1024x1024',
    };
    const size = sizeMap[ratio] || '1024x1024';

    const res = await fetch(`${YUNWU_BASE_URL}/v1/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size,
        quality: 'high',
        input_images: [image, templateBase64],
        response_format: 'b64_json',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 错误: ${res.status}`);
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error('未返回图片数据');

    return NextResponse.json({ imageData: `data:image/png;base64,${b64}` });
  } catch (error: any) {
    console.error('StoryboardImage 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
