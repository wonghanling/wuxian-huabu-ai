import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 120;

const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL || 'https://llm-api.net';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_INSTRUCTION = `You are a Cinematic Video Prompt Generator for dual-frame (Start → End) video generation.

Your ONLY task: analyze two images and output ONE single-line English video prompt.

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
   Examples: slow pan left, static shot, subtle zoom out
   Rules:
   - If subject is small / distant / low detail → MUST use static or pan ONLY
   - zoom_in is FORBIDDEN on low-detail images
   - If shot scale changes significantly between frames → treat as cut, use static

2. Subject Motion (SECOND — fused subject + action)
   Must be inferred from visual difference between Start and End frame.
   Examples: character slowly turning head, figure stepping forward
   Rules:
   - Only describe motion visible or inferable from the two frames
   - Do NOT invent actions not implied by the images

3. Timing / Rhythm (THIRD)
   Must reflect the intensity of change between frames:
   - Small change → slowly / gradually
   - Large change → suddenly / rapidly
   - Can combine: slowly at first, then suddenly accelerates

4. Narrative / Emotion (FOURTH)
   Translate the visual mood into emotional intent.
   Examples: tense atmosphere, calm observational mood, fear-driven tension

5. Constraints (FIFTH — always include all four)
   maintain character consistency, no new objects, no distortion, smooth cinematic motion

━━━━━━━━━━━━━━━━━━━
VISUAL SAFETY RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━

- NEVER introduce details not visible in Start Image
- NEVER zoom in on low-detail / distant / silhouette subjects
- NEVER invent characters, objects, or actions not in the frames
- If subject only appears in End Image: use "gradually becomes visible"
- Shot scale change (wide → close-up): use static camera, describe as cut-implied motion

━━━━━━━━━━━━━━━━━━━
USER ACTION SUGGESTION RULE
━━━━━━━━━━━━━━━━━━━

If provided, treat as low-priority soft hint for Subject Motion only.
Priority: 1. Visual evidence → 2. Safety rules → 3. User suggestion
If suggestion conflicts with safety rules: IGNORE it completely.
Never use suggestion to control camera, change shot scale, or add new objects.

━━━━━━━━━━━━━━━━━━━
EXAMPLE OUTPUT
━━━━━━━━━━━━━━━━━━━

slow pan right, biomechanical humanoid running across rooftop, gradually accelerating then suddenly jumping, tense atmosphere, maintain character consistency, no new objects, no distortion, smooth cinematic motion

━━━━━━━━━━━━━━━━━━━
ABSOLUTE PROHIBITIONS
━━━━━━━━━━━━━━━━━━━

- Do NOT output JSON
- Do NOT output multiple lines
- Do NOT output explanations
- Do NOT use Chinese
- Do NOT change the element order`;

async function callGemini(startImage: string, endImage: string, characterHint: string, actionSuggestion?: string): Promise<string> {
  const parts: any[] = [];

  const startMatch = startImage.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (startMatch) {
    parts.push({ inline_data: { mime_type: `image/${startMatch[1]}`, data: startMatch[2] } });
  }

  const endMatch = endImage.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (endMatch) {
    parts.push({ inline_data: { mime_type: `image/${endMatch[1]}`, data: endMatch[2] } });
  }

  const hintLine = characterHint?.trim() ? `\nCharacter Hint: ${characterHint}` : '';
  const actionLine = actionSuggestion?.trim() ? `\nUser Action Suggestion (soft hint only): ${actionSuggestion}` : '';

  parts.push({ text: `The FIRST image is the START frame. The SECOND image is the END frame.${hintLine}${actionLine}

Analyze the visual difference between the two frames and output a single-line video prompt following the exact structure: [Camera], [Subject Motion], [Timing], [Narrative / Emotion], [Constraints]

Output the prompt only. Nothing else.` });

  const keyInfo = await pickKey('n1n');
  let success = false;
  let caught: any = null;
  let res: Response;
  try {
    res = await fetch(
      `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${keyInfo.keyValue}` },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );
    success = res.ok;
  } catch (err) {
    caught = err;
    throw err;
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }

  if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim() ?? '';
  console.log('[Step3] raw:', raw.slice(0, 300));
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const { startImage, endImage, characterHint = '', actionSuggestion = '', userId } = await req.json();

    // 守卫：会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    if (!startImage || !endImage) {
      return NextResponse.json({ error: '缺少 startImage 或 endImage' }, { status: 400 });
    }

    const prompt = await callGemini(startImage, endImage, characterHint, actionSuggestion);

    // 清理多余换行，确保单行输出
    const cleaned = prompt.replace(/\n+/g, ' ').trim();

    return NextResponse.json({ result: cleaned, final_video_prompt: cleaned });
  } catch (error: any) {
    console.error('Step3 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
