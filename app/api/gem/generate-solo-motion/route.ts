import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_INSTRUCTION = `You are a cinematic video prompt generator.

The user has explicitly selected the input type. You MUST follow it strictly.

Input types:
- "single": one image
- "2x2": four-frame storyboard
- "3x3": nine-frame storyboard

---

RULES:

If input_type = "single":
- Treat the image as one scene
- Generate natural cinematic motion
- Add subtle progression

If input_type = "2x2":
- Treat the image as four consecutive key moments
- Reconstruct a continuous motion between them
- Do NOT describe four separate shots

If input_type = "3x3":
- Treat the image as a detailed sequence of keyframes
- Reconstruct a full continuous action
- Preserve subject and scene consistency

---

CRITICAL CONSTRAINTS:

- Do NOT mention grid, panels, borders, collage, or layout
- Do NOT output numbers or frame indexes
- Do NOT describe "first frame", "second frame"
- Generate ONE continuous cinematic video prompt

---

OUTPUT FORMAT (STRICT):

[Camera]
[Subject Motion]
[Timing]
[Narrative/Emotion]
[Constraints]

---

STYLE:

- Cinematic
- Smooth motion
- Physically plausible
- Strong subject consistency

---

The user input is only a direction. The image is the main source of truth.`;

async function callGemini(image: string, characterHint: string, actionSuggestion: string, inputType: string): Promise<string> {
  const parts: any[] = [];

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (match) {
    parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
  }

  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  const actionLine = actionSuggestion?.trim() ? `\nUser Direction (soft hint): ${actionSuggestion}` : '';

  const inputTypeInstruction = inputType === '2x2'
    ? 'This image is a 2x2 four-frame storyboard showing four consecutive key moments. Treat them as one continuous motion sequence, NOT four separate shots.'
    : inputType === '3x3'
    ? 'This image is a 3x3 nine-frame storyboard showing a detailed sequence of keyframes. Reconstruct the full continuous action across all nine frames as ONE single video prompt.'
    : 'This is a single image. Generate natural cinematic motion from it.';

  parts.push({ text: `input_type: "${inputType}"

${inputTypeInstruction}${hintLine}${actionLine}

Output ONE continuous cinematic video prompt only. Do NOT describe separate frames or shots. Nothing else.` });

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
    const { image, characterHint = '', actionSuggestion = '', inputType = 'single' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const prompt = await callGemini(image, characterHint, actionSuggestion, inputType);

    // 确保单行输出
    const cleaned = prompt.replace(/\n+/g, ' ').trim();

    return NextResponse.json({ final_video_prompt: cleaned });
  } catch (error: any) {
    console.error('SoloMotion 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
