import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = ``;

const SYSTEM_2X2 = ``;

const SYSTEM_3X3 = `You are a strict structured video prompt generator.

Return plain text ONLY.
Do not return JSON.
Do not output markdown.
Do not explain.

The uploaded image is a 3x3 storyboard containing exactly 9 visual moments.

Generate exactly 9 shots in visual order from left to right, top to bottom.

The image is the primary source of truth.
user_direction is only a secondary guide and must not override visible image content.

---

For Shot 1:
The first frame must match the input image exactly.
Do not change action, pose, expression, composition, or camera.
Do not introduce any motion.
Shot 1 must be identical to the image before any motion begins.

---

Action rules:

Action must describe visible content, including both motion and subtle states.

If no clear motion is visible, describe the current visible state (such as stillness, posture, or facial expression).

Each shot must represent a progression of action, not a repetition of the same state.

Do not repeat the same action across consecutive shots.

If an action continues, describe its progression:
- start
- continuation
- completion

Avoid sudden state changes without intermediate motion.

Always describe transitional movement between states.

Do not assume actions that are not clearly visible.

---

Camera rules:

Camera must be short and functional.

Use:
static / tracking / follow / slight push-in

Camera should remain consistent unless a change is clearly required.

When the subject moves, camera should follow the subject.

Do not overuse cinematic or complex camera descriptions.

---

Output format:

[Shot 1]
[Camera]
...
[Action]
...

[Shot 2]
[Camera]
...
[Action]
...

[Shot 3]
[Camera]
...
[Action]
...

[Shot 4]
[Camera]
...
[Action]
...

[Shot 5]
[Camera]
...
[Action]
...

[Shot 6]
[Camera]
...
[Action]
...

[Shot 7]
[Camera]
...
[Action]
...

[Shot 8]
[Camera]
...
[Action]
...

[Shot 9]
[Camera]
...
[Action]
...

---

After Shot 9, output this EXACT text:

no grid, no panels, no borders, no collage layout,maintain scene continuity Follow visible continuity.
If scene change exists follow it. If no scene change do NOT add one.Do not describe frame numbers.`;

async function callGPT(image: string, systemPrompt: string, userText: string): Promise<string> {
  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const imageContent = match ? [{ type: 'image_url', image_url: { url: image } }] : [];

  const res = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: userText }
          ]
        }
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });

  if (!res.ok) throw new Error(`GPT API 错误: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

export async function POST(req: NextRequest) {
  try {
    const { image, characterHint = '', actionSuggestion = '', inputType = 'single' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const directionLine = [characterHint, actionSuggestion].filter(Boolean).join(' ');
    const userDirection = directionLine ? `user_direction: ${directionLine}` : 'user_direction: none';

    let systemPrompt: string;
    let userText: string;

    if (inputType === '2x2') {
      systemPrompt = SYSTEM_2X2;
      userText = '';
    } else if (inputType === '3x3') {
      systemPrompt = SYSTEM_3X3;
      const extraHints = [characterHint, actionSuggestion].filter(Boolean).join('. ');
      userText = extraHints ? `Additional context: ${extraHints}` : '';
    } else {
      systemPrompt = SYSTEM_SINGLE;
      userText = `user_direction: ${directionLine || 'none'}

Analyze the image. Output VALID JSON ONLY matching this exact schema:
{"transition_type":"","motion_intent":"","duration_control":"","keep_static":[],"camera_control":{"movement":"","intensity":""},"final_video_prompt":""}

No markdown. No explanation. JSON only.`;
    }

    const raw = await callGPT(image, systemPrompt, userText);
    console.log('[SoloMotion] raw:', raw.slice(0, 300));

    // 2x2 和 3x3 是纯文本，直接用原始输出
    if (inputType === '2x2' || inputType === '3x3') {
      return NextResponse.json({ final_video_prompt: raw.trim() });
    }

    // 解析 JSON 输出，拼成可读 prompt
    let finalPrompt = raw;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.shots) {
          finalPrompt = parsed.shots
            .map((s: any) => {
              const parts = [s.camera, s.action, s.environment, s.mood].filter(Boolean).join(', ');
              return `Shot ${s.shot}: ${parts}`;
            })
            .join('\n');
        } else if (parsed.shot) {
          const s = parsed.shot;
          finalPrompt = [s.camera, s.action, s.environment, s.mood].filter(Boolean).join(', ');
        } else if (parsed.final_video_prompt) {
          finalPrompt = parsed.final_video_prompt;
        } else {
          finalPrompt = [parsed.camera, parsed.action, parsed.timing, parsed.narrative_emotion, parsed.constraints]
            .filter(Boolean).join(', ');
        }
      }
    } catch {
      // JSON 解析失败就直接用原始输出
    }

    const cleaned = finalPrompt.trim();
    return NextResponse.json({ final_video_prompt: cleaned });
  } catch (error: any) {
    console.error('SoloMotion 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
