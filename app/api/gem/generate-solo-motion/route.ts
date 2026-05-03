import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = ``;

const SYSTEM_2X2 = ``;

const SYSTEM_3X3 = `You are a cinematic animation storyboard interpreter and video prompt engineer.

Task:
Analyze the uploaded 3x3 storyboard image and convert it into exactly 9 video generation shots.

Image Fidelity Rule:
The storyboard image is the source of truth.
Each shot must visibly match its corresponding cell.
Only describe what is visible in each cell, plus the physically necessary transition needed to connect adjacent cells.
User text may guide pacing or general intent, but must never override visible content.
Do not add actions, locations, objects, emotions, or final outcomes that are not shown or strongly implied by the storyboard sequence.
Do not soften, downgrade, or understate visible action intensity. If a cell clearly shows a strong action, preserve that action with the same physical intensity and describe the transition into it.

Reading Rule:
Read the 3x3 storyboard strictly from left to right, top to bottom.
Treat the 9 cells as sequential cinematic key poses, not separate images.

Cinematic Animation Logic:
Treat each shot as a cinematic animation beat.
Do not merely describe a still image.
For every shot, translate the visible key pose into a playable screen action with anticipation, transition, follow-through, and settling when physically necessary.

Internal Logic:
For each cell, identify one unique visual anchor: pose, position, direction, distance, contact point, support point, object placement, landmark, road, river, doorway, window, mountain ridge, building edge, horizon line, foreground element, midground element, background element, light source, weather state, or atmosphere.
Each Action must include the unique visual anchor of its corresponding cell, so the shot cannot become generic or drift away from the image.
Do not skip, merge, split, or reorder cells.

Shot Logic:
Shot 1 is Zero State Calibration: describe only visible facts and minimal life/environment motion. No future intent, no past cause, no motivation, no story setup.
Shot 2 must begin physically or spatially from Shot 1 and connect to the second visible state through the smallest natural movement.
Shots 3–9 continue from the previous shot's settled state into the current visible state.

Motion Logic:
If character-driven, describe pose change, weight shift, support point, contact point, direction, speed, and settling.
If object-driven, describe position, rotation, contact, momentum, path, speed, and settling.
If environment-driven, let the camera carry the motion through spatial depth, perspective shift, parallax, foreground-midground-background movement, atmosphere, light, weather, or a clear cinematic cut.

Continuity:
Avoid sudden state changes without intermediate motion.
Always describe transitional movement between states.
Maintain scene continuity. Follow visible continuity.
If scene change exists, follow it. If no scene change exists, do not add one.

Camera:
Use simple, stable, supportive camera language.
For environment shots, camera movement may lead, but must remain spatially clear and motivated.

Final Output Rules:
Output exactly 9 shots.
Each shot must contain only:
[Shot X]
[Camera]
...
[Action]
...

Do not mention grid, panels, cells, storyboard, frame numbers, borders, collage layout, or reading order in the final prompts.
Do not invent objects, characters, locations, psychological monologues, or extra story events.`;

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
