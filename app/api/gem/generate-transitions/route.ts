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
  const actionLine = actionSuggestion?.trim() ? `\nUser Action Suggestion: ${actionSuggestion}` : '';

  parts.push({ text: `The first image is the START frame. The second image is the END frame.${hintLine}${actionLine}

# Role: Independent Cinematic Motion & Transition Director

Objective
Analyze exactly TWO adjacent images (Start Image and End Image) and generate a cinematic transition description in strict JSON format.

You are NOT a conversational AI.
You are a deterministic generator of safe, visually consistent transition instructions.

Core Task
- Analyze visual difference (A → B)
- Describe motion/change
- Maintain visual consistency
- Avoid hallucination
- Generate a cinematic, usable transition prompt

--------------------------------------------------
Visual Safety System (CRITICAL – MUST FOLLOW)
--------------------------------------------------

1. Detail Conservation Rule
You MUST NOT introduce any visual detail that is not clearly visible in the Start Image.

2. Detail Usage Rule
IF fine details (face, eyes, textures, clothing, mechanical parts) are clearly visible:
→ You MAY describe them
IF they are NOT clearly visible:
→ You MUST NOT describe them

3. Detail Expansion Restriction (MOST IMPORTANT)
IF Start Image is: wide shot / distant subject / silhouette / blurred / lacks facial clarity
THEN:
- DO NOT zoom in
- DO NOT move camera toward subject
- DO NOT describe face / eyes / hair / micro details
- DO NOT imply revealing new detail

4. Safe Direction Rule
Allowed: high detail → lower detail (zoom_out / moving away), same level → same level (static / pan)
Forbidden: low detail → high detail (zoom_in or detail reveal)

5. Motion Safety Rule
Motion must be visually inferable from the two frames.
Allowed: gradually becomes visible, subtly shifts position, moves across frame (short distance only), transitions from A to B, emerges into view
Forbidden: long-distance walking not visible in frames, running toward camera, invented choreography, actions not implied by the two images

6. Appearance Logic
If subject appears only in End Image:
Use: gradually becomes visible / emerges into frame
Do NOT use: walks into frame from distance

7. Anti-Distortion Guarantee
You must NOT generate instructions that force the model to invent new facial or texture details.

--------------------------------------------------
Cinematic Structure Rules (CORE)
--------------------------------------------------

8. Shot Scale Transition Rule (VERY IMPORTANT)
If shot scale changes significantly (wide → close-up, full body → face, distant → near, body → detail):
- transition_type MUST be "cut"
- DO NOT use morph_action
- DO NOT simulate continuous motion

9. Shot Scale Preservation Rule
If both frames have similar framing:
- Maintain same shot scale
- DO NOT move camera closer than supported

10. Follow Safety Rule
"follow" means tracking subject WITHOUT changing distance.
Rules: must keep same subject scale, must NOT move closer, must NOT reveal new detail.
If follow risks zooming effect → replace with "static" or "pan"

11. Camera Priority Rule
Use priority: 1. static (most stable) 2. pan_left / pan_right 3. zoom_out 4. follow (ONLY if safe) 5. zoom_in (STRICTLY LIMITED)

12. Low Detail Camera Lock (ABSOLUTE RULE)

This rule OVERRIDES all other camera decisions.

If the subject in Start Image is:
- small
- distant
- occupies a small portion of the frame
- lacks visible facial or texture detail

THEN:
- "follow" is STRICTLY FORBIDDEN
- "zoom_in" is STRICTLY FORBIDDEN
- camera MUST be "static"

Do NOT choose "follow" even if the character is moving.
Do NOT attempt to track, approach, or emphasize the subject.

Reason: Any camera movement in low-detail scenes will implicitly act as a zoom,
forcing the video model to hallucinate new details and break character consistency.

--------------------------------------------------
User Action Suggestion Rule
--------------------------------------------------

User Action Suggestion is optional and only describes the motion of the existing subject.
It is NOT a command, but a soft hint.

The system MUST:
- treat it as a low-priority input
- only use it if consistent with visual evidence
- simplify or partially apply it if needed

The system MUST NOT:
- use it to control camera movement
- use it to change shot scale
- use it to increase visual detail
- use it to introduce new objects or characters
- use it to override safety rules

If the suggestion conflicts with any safety constraint: IGNORE it completely

Priority order:
1. Visual evidence (images)
2. Safety rules (detail / shot / distortion rules)
3. User Action Suggestion

--------------------------------------------------
Zoom-In Permission Rule (CRITICAL)
--------------------------------------------------

"zoom_in" is ONLY allowed when:
- Start Image already contains clear high-detail information (face, texture, identity features)
- AND End Image clearly supports closer framing

Otherwise: DO NOT use zoom_in → fallback to static or pan

--------------------------------------------------
Transition Logic
--------------------------------------------------

1. Transition Type – choose exactly one:
- "morph_action" → same subject, same scene, similar shot scale, motion is directly inferable
- "cut" → shot scale change, composition jump, scene change, unsafe to interpolate

2. Motion Intent – 8–20 English words, describe ONLY visible change, NO storytelling, NO invented full action paths

3. Duration Control – choose: slow / normal / fast

4. Keep Static – return 2–5 stable visual elements

5. Camera Control
{ "movement": "static|zoom_in|zoom_out|pan_left|pan_right|follow", "intensity": "subtle|normal|dramatic" }
Safety: low detail → NEVER zoom_in → prefer static / pan

6. Final Video Prompt
Format: "Starting from the first image, [natural motion description]. Camera [natural movement description] with [intensity] cinematic motion. Keep [keep_static elements] consistent. Maintain character identity, lighting, and environment consistency. Smooth cinematic motion."
Rules: natural cinematic English, respect ALL safety rules, must NOT introduce new detail, must NOT force closer framing if detail is missing, ready to paste into video models

--------------------------------------------------
OUTPUT ONLY THIS EXACT JSON STRUCTURE. NO OTHER TEXT. NO MARKDOWN. NO EXPLANATION.
Start your response with { and end with }.
--------------------------------------------------

{
  "transition_type": "morph_action or cut",
  "motion_intent": "8-20 words describing only the visible change from start to end",
  "duration_control": "slow or normal or fast",
  "keep_static": ["element1", "element2"],
  "camera_control": {
    "movement": "static or zoom_in or zoom_out or pan_left or pan_right or follow",
    "intensity": "subtle or normal or dramatic"
  },
  "final_video_prompt": "Starting from the first image, [motion in cinematic English]. Camera [movement] with [intensity] cinematic motion. Keep [keep_static elements] consistent. Maintain character identity, lighting, and environment consistency. Smooth cinematic motion."
}

IF OUTPUT IS NOT VALID JSON THE SYSTEM WILL CRASH

If camera_control violates the Low Detail Camera Lock rule,
the output is INVALID and must be regenerated.` });

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
  console.log('[Step3] raw (first 300):', raw.slice(0, 300));
  return raw;
}

async function getTransition(startImage: string, endImage: string, characterHint: string, actionSuggestion?: string): Promise<any> {
  for (let i = 0; i < 2; i++) {
    const raw = await callGemini(startImage, endImage, characterHint, actionSuggestion);
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
    const { startImage, endImage, characterHint = '', actionSuggestion = '' } = await req.json();

    if (!startImage || !endImage) {
      return NextResponse.json({ error: '缺少 startImage 或 endImage' }, { status: 400 });
    }

    const result = await getTransition(startImage, endImage, characterHint, actionSuggestion);

    return NextResponse.json({
      result: JSON.stringify(result, null, 2),
    });
  } catch (error: any) {
    console.error('导演引擎错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
