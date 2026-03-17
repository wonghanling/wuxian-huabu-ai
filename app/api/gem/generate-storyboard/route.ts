import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { visualProfile, script, systemInstruction } = await req.json();

    if (!visualProfile || !script) {
      return NextResponse.json({ error: '缺少视觉档案或剧本' }, { status: 400 });
    }

    const userMessage = `Here is the visual profile from Step 1:

${visualProfile}

Here is the Chinese script:

${script}

Generate the 5x5 storyboard JSON with exactly 25 shots.`;

    const response = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/gemini-3-pro-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.7 },
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

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonText = (jsonMatch[1] || text).trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ success: true, result: text, raw: true });
    }

    return NextResponse.json({ success: true, result: JSON.stringify(parsed, null, 2) });
  } catch (error: any) {
    console.error('GEM storyboard error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
