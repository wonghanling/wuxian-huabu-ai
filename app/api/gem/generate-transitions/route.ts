import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_PROMPT = `# Role: Independent Cinematic Motion & Transition Director

# Objective
Analyze exactly TWO adjacent storyboard frames (Start Image and End Image) and generate a strict JSON object describing the transition between them.

You are NOT a conversational AI.
You are a deterministic JSON generator for video transition planning.

# Input
You will receive:
1. Start Image
2. End Image
3. Optional Character Hint (short visual anchor text)

# Core Task
Your task is to determine how the visual content in Start Image transitions into the visual content in End Image.

You must:
1. Compare the visual delta between the two images
2. Classify the transition type
3. Describe only the motion/change
4. Identify elements that must remain stable
5. Suggest camera movement
6. Generate a final video prompt that can be directly copied into a video generation model

# Transition Rules

## 1. Transition Type
Choose exactly one:
- "morph_action" → same character / same scene / continuous motion / transformation / pose shift
- "cut" → major scene change / abrupt composition shift / clear location or time jump

## 2. Motion Intent
- 8–20 English words
- Describe ONLY the visual change from Start Image to End Image
- Focus on movement, transformation, weight shift, pose change, or action delta
- Do NOT restate the full scene
- Do NOT write generic storytelling

## 3. Duration Control
Choose exactly one: "slow" | "normal" | "fast"

## 4. Keep Static
- Return 2–5 short English phrases
- Visual anchors that should remain stable

## 5. Camera Control
{
  "movement": "static" | "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "follow",
  "intensity": "subtle" | "normal" | "dramatic"
}

## 6. Final Video Prompt
Format:
Starting from the first image, [rewrite motion_intent into natural cinematic English].

Camera [translate camera movement into natural English] with [intensity] cinematic motion.

Keep [keep_static elements] consistent.

Maintain character identity, lighting, and environment consistency.
Smooth cinematic motion.

# Output Format (STRICT JSON ONLY)
{
  "transition_type": "morph_action",
  "motion_intent": "...",
  "duration_control": "normal",
  "keep_static": ["..."],
  "camera_control": {
    "movement": "static",
    "intensity": "subtle"
  },
  "final_video_prompt": "..."
}

# Strict Constraints
- Output ONLY valid JSON
- NO markdown, NO code fences, NO explanations
- JSON must start with "{" and end with "}"`;

function cleanResponse(raw: string): string {
  let cleaned = raw.replace(/```json|```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) return cleaned.substring(first, last + 1);
  return cleaned;
}

async function callGemini(startImage: string, endImage: string, characterHint: string): Promise<string> {
  const parts: any[] = [];

  // Start Image
  const startMatch = startImage.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (startMatch) {
    parts.push({ text: 'Start Image:' });
    parts.push({ inline_data: { mime_type: `image/${startMatch[1]}`, data: startMatch[2] } });
  }

  // End Image
  const endMatch = endImage.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (endMatch) {
    parts.push({ text: 'End Image:' });
    parts.push({ inline_data: { mime_type: `image/${endMatch[1]}`, data: endMatch[2] } });
  }

  const hintText = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  parts.push({ text: `Analyze the transition from Start Image to End Image and output strict JSON only.${hintText}` });

  const res = await fetch(
    `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim() ?? '';
  console.log('[Step3] raw (first 300):', raw.slice(0, 300));
  return raw;
}

async function getTransition(startImage: string, endImage: string, characterHint: string): Promise<any> {
  for (let i = 0; i < 2; i++) {
    const raw = await callGemini(startImage, endImage, characterHint);
    try {
      const parsed = JSON.parse(cleanResponse(raw));
      if (parsed.transition_type && parsed.final_video_prompt) return parsed;
      console.log('[Step3] missing fields, retry', i + 1);
    } catch {
      console.log('[Step3] parse failed, retry', i + 1);
    }
  }
  throw new Error('Step3 failed: Gemini did not return valid JSON');
}

export async function POST(req: NextRequest) {
  try {
    const { startImage, endImage, characterHint = '' } = await req.json();

    if (!startImage || !endImage) {
      return NextResponse.json({ error: '缺少 startImage 或 endImage' }, { status: 400 });
    }

    const result = await getTransition(startImage, endImage, characterHint);

    return NextResponse.json({
      result: JSON.stringify(result, null, 2),
    });
  } catch (error: any) {
    console.error('导演引擎错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
