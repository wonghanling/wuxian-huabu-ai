import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_INSTRUCTION = `You are a cinematic video prompt generator.

The output format must ALWAYS follow:

[Camera]
[Subject Motion]
[Timing]
[Narrative/Emotion]
[Constraints]

---

The input is an image. It may represent:
- a single scene
- or a sequence of moments (storyboard)

You must infer how much motion is already defined in the image.

---

CORE LOGIC:

If the image contains a clear sequence of actions:
- Treat it as a motion sequence
- Reconstruct the action exactly as shown
- Follow the visual progression strictly
- Do NOT invent new story events

If the image is a single scene:
- Generate natural motion based on the subject
- Add subtle cinematic progression

---

CRITICAL RULE:

Follow visible continuity.
Do NOT invent unseen story elements.

- If scene change exists → follow it
- If no scene change → do NOT add one

---

FORBIDDEN:

- mentioning grid, panels, storyboard
- describing frame numbers
- splitting into multiple shots

---

OUTPUT:

ONE continuous cinematic video prompt.`;

async function callGemini(image: string, characterHint: string, actionSuggestion: string): Promise<string> {
  const parts: any[] = [];

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (match) {
    parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
  }

  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  const actionLine = actionSuggestion?.trim() ? `\nUser Direction (soft hint): ${actionSuggestion}` : '';

  parts.push({ text: `Analyze the image and output ONE continuous cinematic video prompt.${hintLine}${actionLine}

Output the prompt only. Nothing else.` });

  const res = await fetch(
    `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim() ?? '';
  console.log('[SoloMotion] raw:', raw.slice(0, 300));
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const { image, characterHint = '', actionSuggestion = '' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const prompt = await callGemini(image, characterHint, actionSuggestion);

    // 确保单行输出
    const cleaned = prompt.replace(/\n+/g, ' ').trim();

    return NextResponse.json({ final_video_prompt: cleaned });
  } catch (error: any) {
    console.error('SoloMotion 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
