import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { visualJson } = await req.json();
    if (!visualJson) return NextResponse.json({ error: '缺少 visualJson' }, { status: 400 });

    const userPrompt = `From the following visual profile JSON, extract a single concise character_hint string.

Rules:
- Output ONLY a plain English string, no JSON, no markdown
- Format: "Character reference: [key visual traits]"
- Include: hair color/style, distinctive body parts, eye color, clothing style, cybernetic features if any
- Max 20 words after "Character reference:"
- Example: "Character reference: silver-white hair, mechanical right arm, cyan glowing eye, cyberpunk style"

Visual Profile JSON:
${typeof visualJson === 'string' ? visualJson : JSON.stringify(visualJson)}`;

    const res = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
    const data = await res.json();
    const hint = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    if (!hint) throw new Error('未能提取 character hint');

    return NextResponse.json({ hint });
  } catch (error: any) {
    console.error('extract-character-hint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
