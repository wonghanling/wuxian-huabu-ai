import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { images, systemInstruction } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '请上传至少一张图片' }, { status: 400 });
    }

    const parts: any[] = [];

    for (const img of images) {
      const base64Match = img.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
      if (base64Match) {
        parts.push({ inline_data: { mime_type: `image/${base64Match[1]}`, data: base64Match[2] } });
      }
    }

    parts.push({ text: 'Analyze these reference images and output the unified visual profile JSON.' });

    const response = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 错误: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('API 未返回内容');

    // 提取 JSON（去掉可能的 markdown 代码块）
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonText = (jsonMatch[1] || text).trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      // 返回原始文本让前端显示
      return NextResponse.json({ success: true, result: text, raw: true });
    }

    return NextResponse.json({ success: true, result: JSON.stringify(parsed, null, 2) });
  } catch (error: any) {
    console.error('GEM analyze error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
