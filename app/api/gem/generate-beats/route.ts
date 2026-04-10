import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are Narrative Segmentation Engine.

Your task is to convert a Chinese story segment into a dynamic number of narrative beats.

━━━━━━━━━━━━━━━━━━━
INPUT
━━━━━━━━━━━━━━━━━━━

You will receive:

1. Chinese story text (MAX 800 Chinese characters)

━━━━━━━━━━━━━━━━━━━
CORE GOAL
━━━━━━━━━━━━━━━━━━━

Generate 3 to 6 narrative beats based on the actual content density.

Do NOT force all 6 beats if unnecessary.

━━━━━━━━━━━━━━━━━━━
AVAILABLE BEAT TYPES
━━━━━━━━━━━━━━━━━━━

You may choose from:

- establish   (world / setting)
- inciting    (trigger event)
- build       (development)
- escalate    (tension increase)
- climax      (peak action)
- resolution  (aftermath)

━━━━━━━━━━━━━━━━━━━
SELECTION RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━

- Use ONLY the beats that are necessary
- Minimum: 3 beats
- Maximum: 6 beats
- Always maintain logical progression:
  establish → inciting → build → escalate → climax → resolution
- You may skip intermediate beats if not needed

━━━━━━━━━━━━━━━━━━━
BEAT RULES
━━━━━━━━━━━━━━━━━━━

Each beat MUST:

- Be ONE sentence
- Be written in English
- Contain 10–25 words
- Describe ONE clear visual moment
- Be action-based and visually observable

━━━━━━━━━━━━━━━━━━━
FILTERING RULES
━━━━━━━━━━━━━━━━━━━

REMOVE:

- inner thoughts
- abstract narration
- emotions without visible action

KEEP:

- physical actions
- character interaction
- environment changes

━━━━━━━━━━━━━━━━━━━
IMPORTANT
━━━━━━━━━━━━━━━━━━━

- Do NOT artificially expand weak content
- Do NOT invent new events
- Compress when needed

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━

{
  "narrative_beats": [
    { "beat_type": "", "content": "" }
  ]
}

━━━━━━━━━━━━━━━━━━━
STRICT RULES
━━━━━━━━━━━━━━━━━━━

- 3 to 6 beats only
- Maintain correct order
- No duplicates
- Output ONLY JSON
- No explanation`;

export async function POST(req: NextRequest) {
  try {
    const { story } = await req.json();

    if (!story || !story.trim()) {
      return NextResponse.json({ error: '缺少故事文本' }, { status: 400 });
    }

    const userMessage = `Here is the Chinese story text:\n\n${story}\n\nGenerate the narrative beats JSON.`;

    const response = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/gemini-3-pro-preview-thinking:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.5 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 错误: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const allParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = allParts.map((p: any) => p.text ?? '').join('').trim();

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonText = (jsonMatch[1] || text).trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ success: true, result: text, raw: true });
    }

    return NextResponse.json({ success: true, result: parsed });
  } catch (error: any) {
    console.error('GEM beats error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
