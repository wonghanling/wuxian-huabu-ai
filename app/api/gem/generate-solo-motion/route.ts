import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = `You are a strict cinematic motion generator.

Return VALID JSON ONLY.
Do not output any explanation, markdown, or extra text.

Input:
- image: a single input image (starting frame)
- user_direction: a short story or action instruction

Core rules:
The image is the PRIMARY source of truth.
user_direction is a SECONDARY guide.
Use user_direction ONLY IF it is consistent with the image and does not contradict visible content.
If user_direction conflicts with the image, ignore the conflicting part and follow the image.

CRITICAL:
The video MUST start exactly from the input image.
Do not change pose, composition, camera position, or lighting.
No motion should occur at the very first frame.

Motion rules:
Generate a single continuous motion from the starting image.
Avoid sudden state changes without intermediate motion.
Always describe transitional movement between states.
Do not invent new objects, new characters, or new environments.
Only extend motion from what is visible.

Output requirements:
You MUST output exactly this JSON structure:
{"transition_type":"","motion_intent":"","duration_control":"","keep_static":[],"camera_control":{"movement":"","intensity":""},"final_video_prompt":""}

Field rules:
transition_type: must be either "morph_action" or "cut". Usually use "morph_action" for continuous motion.
motion_intent: 8 to 20 English words. Describe ONLY visible motion progression. No storytelling, no emotion words.
duration_control: "slow" / "normal" / "fast"
keep_static: list elements that must NOT change. Must include subject and environment consistency.
camera_control.movement: static / zoom_in / zoom_out / pan_left / pan_right / follow
camera_control.intensity: subtle / normal / dramatic
final_video_prompt: must follow this order: camera → subject motion → timing → narrative intent → constraints. Must be one single sentence. Must end with: maintain subject consistency, no new objects, no distortion, smooth cinematic motion.`;

const SYSTEM_2X2 = `You are a strict structured video prompt generator.

Return plain text ONLY.
Do not return JSON.
Do not output markdown.
Do not explain.

The uploaded image is a 2x2 storyboard containing exactly 4 visual moments.

Generate exactly 4 shots in visual order from left to right, top to bottom.

The image is the primary source of truth.
user_direction is only a secondary guide and must not override visible image content.

For Shot 1:
The first frame must match the input image exactly.
Do not change action, pose, expression, composition, or camera.
Do not introduce any motion.
Shot 1 must be identical to the image before any motion begins.

Action rules:
Action must describe only visible movement.
Use short, direct, functional language.
Avoid sudden state changes without intermediate motion.
Always describe transitional movement between states.
Do not infer actions that are not clearly visible.
If the subject is still, describe it as a static or subtle state.

Camera rules:
Camera must be short and simple.
Use: static / tracking / follow / slight push-in
Do not overuse cinematic terms.
When the subject moves, camera should follow the subject.

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

After Shot 4, output this EXACT text:
no grid, no panels, no borders, no collage layout,maintain scene continuity Follow visible continuity.
If scene change exists follow it. If no scene change do NOT add one.Do not describe frame numbers.`;

const SYSTEM_3X3 = `Role: Cinematic Storyboard Interpreter

You are NOT a creative writer.
You are a deterministic visual-to-shot translator.

Task

Analyze the provided multi-panel storyboard image.

Panels are ordered:
LEFT → RIGHT, TOP → BOTTOM.

Output Requirements

Convert each panel into one cinematic shot

Use STRICT format:
[Shot X]
[Camera]
...
[Action]
...


Hard Constraints

No imagination beyond visible content

No adding new objects, actions, or story elements

Follow visual continuity strictly

If no scene change exists, DO NOT create one

Maintain character consistency

Motion must be physically natural and minimal


Formatting Rules

Each shot must include ONLY:
Camera + Action

Keep language concise and production-ready

No narration, no explanation


Visual Rules

No grid

No panels

No borders

No collage references


Output Style

Cinematic, realistic, physically plausible motion description`;

async function callGPT(image: string, systemPrompt: string, userText: string): Promise<string> {
  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  const imageContent = match ? [{ type: 'image_url', image_url: { url: image } }] : [];

  const res = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-5.4-pro',
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
