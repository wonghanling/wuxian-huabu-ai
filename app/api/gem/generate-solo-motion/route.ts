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

async function callGPT(image: string, characterHint: string, actionSuggestion: string): Promise<string> {
  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  const actionLine = actionSuggestion?.trim() ? `\nUser Direction (soft hint): ${actionSuggestion}` : '';

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const imageContent = match ? [{
    type: 'image_url',
    image_url: { url: image }
  }] : [];

  const res = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Analyze the image and output ONE continuous cinematic video prompt.

Your response MUST follow this exact format on a single line:
[Camera], [Subject Motion], [Timing], [Narrative/Emotion], [Constraints]

No explanations. No line breaks. No extra text.${hintLine}${actionLine}`
            }
          ]
        }
      ],
      max_tokens: 512,
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`GPT API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? '';
  console.log('[SoloMotion] raw:', raw.slice(0, 300));
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const { image, characterHint = '', actionSuggestion = '' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const prompt = await callGPT(image, characterHint, actionSuggestion);

    // 确保单行输出
    const cleaned = prompt.replace(/\n+/g, ' ').trim();

    return NextResponse.json({ final_video_prompt: cleaned });
  } catch (error: any) {
    console.error('SoloMotion 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
