import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

function cleanResponse(raw: string): string {
  let cleaned = raw.replace(/```json|```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) return cleaned.substring(first, last + 1);
  return cleaned;
}

async function callGemini(image: string, characterHint: string): Promise<string> {
  const parts: any[] = [];

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (match) {
    parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
  }

  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';

  parts.push({ text: `You are given ONE image. This is the START frame for a video clip.${hintLine}

# Role: Single-Frame Cinematic Motion Director

You are NOT a conversational AI. You are a deterministic JSON generator for single-image video motion planning.

# Core Task
Analyze the single image and generate a controlled cinematic motion prompt that animates it naturally, without inventing new visual content.

# VISUAL SAFETY SYSTEM (CRITICAL — MUST FOLLOW)

## Rule 1: Detail Conservation
You MUST NOT introduce any visual detail that is not clearly visible in the image.

## Rule 2: Detail Usage
- IF fine details (face, eyes, textures, clothing) are clearly visible → You MAY reference them
- IF they are NOT clearly visible → You MUST NOT describe them

## Rule 3: Detail Expansion Restriction (MOST IMPORTANT)
IF the image is a wide shot / distant subject / silhouette / blurred / lacks facial clarity:
- DO NOT zoom in
- DO NOT move camera toward subject
- DO NOT describe face / eyes / hair / micro details
- DO NOT imply "revealing details"

## Rule 4: Safe Direction Rule
- ALLOWED: high detail → lower detail (zoom_out), same level → same level (static / pan)
- FORBIDDEN: low detail → high detail (zoom_in or detail reveal)

## Rule 5: Motion Safety Rule
Motion must be visually grounded in what is shown. Do NOT imagine motion that cannot be inferred from the image.

## Rule 6: Appearance Logic
Describe only what is present. Do NOT invent characters, objects, or actions not visible.

## Rule 7: Anti-Distortion Guarantee
You MUST NOT generate any instruction that forces the video model to invent new facial or texture details.

## Rule 8: Camera Safety
If the image lacks detail → prefer "static" or "pan". Never use "zoom_in" on low-detail images.

## Rule 9: Motion Scope
Keep motion subtle and cinematic. Avoid dramatic transformations. Prefer: gentle sway, slow pan, atmospheric drift, subtle parallax.

## Rule 10: Output Constraint
Output ONLY the final_video_prompt. No transition analysis. No JSON fields except final_video_prompt.

# Output Format (STRICT JSON ONLY)
{
  "final_video_prompt": "Starting from the image, [natural cinematic motion in English]. Camera [movement] with [intensity] cinematic motion. Keep [stable elements] consistent. Maintain character identity, lighting, and environment consistency. Smooth cinematic motion."
}

OUTPUT ONLY THIS EXACT JSON STRUCTURE. NO OTHER TEXT. NO MARKDOWN. NO EXPLANATION.
Start your response with { and end with }.

IF OUTPUT IS NOT VALID JSON THE SYSTEM WILL CRASH` });

  const res = await fetch(
    `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim() ?? '';
  console.log('[SoloMotion] raw (first 300):', raw.slice(0, 300));
  return raw;
}

async function getSoloMotion(image: string, characterHint: string): Promise<any> {
  for (let i = 0; i < 2; i++) {
    const raw = await callGemini(image, characterHint);
    try {
      const parsed = JSON.parse(cleanResponse(raw));
      if (parsed.final_video_prompt) return parsed;
      console.log('[SoloMotion] missing fields, retry', i + 1);
    } catch {
      console.log('[SoloMotion] parse failed, retry', i + 1);
    }
  }
  throw new Error('SoloMotion failed: Gemini did not return valid JSON');
}

export async function POST(req: NextRequest) {
  try {
    const { image, characterHint = '' } = await req.json();

    if (!image) {
      return NextResponse.json({ error: '缺少 image 参数' }, { status: 400 });
    }

    const result = await getSoloMotion(image, characterHint);

    return NextResponse.json({ final_video_prompt: result.final_video_prompt });
  } catch (error: any) {
    console.error('单图运动引擎错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
