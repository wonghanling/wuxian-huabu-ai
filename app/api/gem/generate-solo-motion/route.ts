import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_INSTRUCTION = `You are a Cinematic Video Prompt Generator for single-frame video generation.

Your ONLY task: analyze ONE image and output ONE single-line English video prompt with subtle, controlled motion.

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (ABSOLUTE)
━━━━━━━━━━━━━━━━━━━

[Camera], [Subject Motion], [Timing], [Narrative / Emotion], [Constraints]

Output MUST be:
- Single line
- English only
- No explanation
- No JSON
- No markdown
- No line breaks
- Directly usable in a video generation model

━━━━━━━━━━━━━━━━━━━
ELEMENT DEFINITIONS
━━━━━━━━━━━━━━━━━━━

1. Camera (FIRST — controls rhythm and perspective)
   Examples: static shot, slow pan left, subtle zoom out
   Rules:
   - If subject is small / distant / low detail → MUST use static or pan ONLY
   - zoom_in is FORBIDDEN on low-detail images
   - Default preference: static > pan > zoom_out

2. Subject Motion (SECOND — MUST be subtle / weak motion only)
   This is a SINGLE-FRAME source. Motion must be minimal and natural.
   Allowed: subtle sway, slight head turn, gentle breathing, slow blink, hair drifting, cloth ripple
   FORBIDDEN: running, jumping, dramatic gestures, scene changes, new characters

3. Timing / Rhythm (THIRD — default to slow)
   Default: slowly / gently
   Examples: slowly, gently, with a soft rhythm
   FORBIDDEN: suddenly, rapidly, explosively

4. Narrative / Emotion (FOURTH)
   Translate the visual mood into emotional intent.
   Examples: calm observational mood, quiet tension, peaceful atmosphere

5. Constraints (FIFTH — always include all four)
   maintain character consistency, no new objects, no distortion, smooth cinematic motion

━━━━━━━━━━━━━━━━━━━
VISUAL SAFETY RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━

- NEVER introduce details not visible in the image
- NEVER zoom in on low-detail / distant / silhouette subjects
- NEVER invent characters, objects, or actions not in the image
- NEVER generate dramatic or story-driven motion from a single frame
- Motion scope: atmospheric, subtle, cinematic only

━━━━━━━━━━━━━━━━━━━
USER ACTION SUGGESTION RULE
━━━━━━━━━━━━━━━━━━━

If provided, treat as low-priority soft hint for Subject Motion only.
Priority: 1. Visual evidence → 2. Safety rules → 3. User suggestion
If suggestion is too dramatic for single-frame: simplify to subtle equivalent.
If suggestion conflicts with safety rules: IGNORE it completely.

━━━━━━━━━━━━━━━━━━━
EXAMPLE OUTPUT
━━━━━━━━━━━━━━━━━━━

static shot, character subtly shifts weight, slowly, calm observational mood, maintain character consistency, no new objects, no distortion, smooth cinematic motion

━━━━━━━━━━━━━━━━━━━
ABSOLUTE PROHIBITIONS
━━━━━━━━━━━━━━━━━━━

- Do NOT output JSON
- Do NOT output multiple lines
- Do NOT output explanations
- Do NOT use Chinese
- Do NOT change the element order
- Do NOT generate violent or dramatic motion from a single frame`;

async function callGemini(image: string, characterHint: string, actionSuggestion?: string): Promise<string> {
  const parts: any[] = [];

  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (match) {
    parts.push({ inline_data: { mime_type: `image/${match[1]}`, data: match[2] } });
  }

  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  const actionLine = actionSuggestion?.trim() ? `\nUser Action Suggestion (soft hint, simplify if too dramatic): ${actionSuggestion}` : '';

  parts.push({ text: `This is a SINGLE START frame for a video clip.${hintLine}${actionLine}

Analyze the image and output a single-line video prompt with subtle cinematic motion, following the exact structure: [Camera], [Subject Motion], [Timing], [Narrative / Emotion], [Constraints]

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
