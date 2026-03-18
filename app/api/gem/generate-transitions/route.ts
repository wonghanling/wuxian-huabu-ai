import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_PROMPT = `You are a Dynamic Video Linking Engine.

Your task is to convert a storyboard JSON into precise video transition instructions between adjacent shots.

This is NOT a storyboard task.
This is NOT an image generation task.
This is a motion planning and transition control task.

━━━━━━━━━━━━━━━━━━━
INPUT
━━━━━━━━━━━━━━━━━━━

You will receive a storyboard JSON containing N shots.

Each shot includes:
- shot_number
- framing
- description
- visual_elements
- action

━━━━━━━━━━━━━━━━━━━
CORE OBJECTIVE
━━━━━━━━━━━━━━━━━━━

Generate transition instructions between every adjacent pair of shots.

Total transitions must be exactly N - 1.

Each transition represents how Shot[i] evolves into Shot[i+1].

━━━━━━━━━━━━━━━━━━━
TRANSITION TYPES
━━━━━━━━━━━━━━━━━━━

You must classify each transition into ONE of the following:

1. "morph_action"
- Use when motion is continuous
- Same character and same scene
- Includes body movement, transformation, or camera continuity

2. "cut"
- Use when scene changes significantly
- Different location, time, or composition
- DO NOT attempt visual blending

━━━━━━━━━━━━━━━━━━━
MOTION INTENT RULES
━━━━━━━━━━━━━━━━━━━

For each transition, generate a concise motion description:

- Focus ONLY on change between Shot A and Shot B
- Do NOT restate the full scene
- Use cinematic motion language
- Emphasize physical movement, transformation, or continuity

━━━━━━━━━━━━━━━━━━━
DURATION CONTROL
━━━━━━━━━━━━━━━━━━━

Assign one of:

- "slow"
- "normal"
- "fast"

━━━━━━━━━━━━━━━━━━━
KEEP STATIC (CRITICAL)
━━━━━━━━━━━━━━━━━━━

You must specify elements that should remain visually stable during motion.

Rules:
- Include stable environment elements
- Include persistent character features if needed
- Keep list concise (2–5 items)

━━━━━━━━━━━━━━━━━━━
CAMERA CONTROL (CRITICAL)
━━━━━━━━━━━━━━━━━━━

You must define camera behavior for each transition.

Structure:

"camera_control": {
  "movement": "",
  "intensity": ""
}

Allowed movement values:
- "static"
- "zoom_in"
- "zoom_out"
- "pan_left"
- "pan_right"
- "follow"

Allowed intensity values:
- "subtle"
- "normal"
- "dramatic"

━━━━━━━━━━━━━━━━━━━
CONSISTENCY RULE
━━━━━━━━━━━━━━━━━━━

Always assume:
- same character identity
- same visual style
- same design consistency

Do NOT introduce new elements.

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━

{
  "video_transitions": [
    {
      "from_shot": 1,
      "to_shot": 2,
      "transition_type": "",
      "motion_intent": "",
      "duration_control": "",
      "keep_static": [],
      "camera_control": {
        "movement": "",
        "intensity": ""
      }
    }
  ]
}

━━━━━━━━━━━━━━━━━━━
STRICT RULES
━━━━━━━━━━━━━━━━━━━

- Output exactly N-1 transitions
- motion_intent must be 8–20 English words
- keep_static must contain 2–5 items
- JSON only
- No markdown
- No explanations
- No extra keys
- Do NOT output any thinking, reasoning, planning, or intermediate text
- Output MUST start with '{' and contain ONLY valid JSON`;

async function callGemini(shots: any[]): Promise<any[]> {
  const userPrompt = `Here is the storyboard JSON. Generate transitions for all ${shots.length} shots (${shots.length - 1} transitions total):\n\n${JSON.stringify({ shots }, null, 2)}`;

  const response = await fetch(
    `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YUNWU_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini API 错误: ${response.status}`);
  const data = await response.json();

  const allParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = allParts.map((p: any) => p.text ?? '').join('').trim();

  console.log('[Step3] Gemini raw text (first 500):', text.slice(0, 500));
  console.log('[Step3] finishReason:', data?.candidates?.[0]?.finishReason);

  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = (mdMatch ? mdMatch[1] : text).trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // 最后尝试提取第一个 { } 块
    const braceMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!braceMatch) throw new Error('无法从响应中提取 JSON');
    parsed = JSON.parse(braceMatch[0]);
  }
  return parsed.video_transitions ?? [];
}

async function callGeminiSegment(shots: any[], fromIdx: number, toIdx: number): Promise<any[]> {
  const segment = shots.slice(fromIdx, toIdx + 1); // inclusive
  return callGemini(segment);
}

function stripMarkdown(raw: string) {
  return raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function tryParse(value: any) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(stripMarkdown(value));
  } catch {
    return value;
  }
}

function extractShotsFromStoryboard(input: any) {
  const data = tryParse(input);
  if (!data) throw new Error('storyboard is empty');

  const result = tryParse(data.result);

  if (Array.isArray(data.shots)) return data.shots;
  if (result && Array.isArray(result.shots)) return result.shots;

  if (Array.isArray(data.storyboard_2x2)) return data.storyboard_2x2;
  if (Array.isArray(data.storyboard_3x3)) return data.storyboard_3x3;
  if (Array.isArray(data.storyboard_5x5)) return data.storyboard_5x5;

  if (result) {
    if (Array.isArray(result.storyboard_2x2)) return result.storyboard_2x2;
    if (Array.isArray(result.storyboard_3x3)) return result.storyboard_3x3;
    if (Array.isArray(result.storyboard_5x5)) return result.storyboard_5x5;
  }

  throw new Error(`Could not extract shots. top-level keys: ${Object.keys(data).join(', ')}`);
}

export async function POST(req: NextRequest) {
  try {
    const { storyboard } = await req.json();
    if (!storyboard) {
      return NextResponse.json({ error: '缺少 storyboard 参数' }, { status: 400 });
    }

    let shots: any[];
    try {
      shots = extractShotsFromStoryboard(storyboard);
    } catch (e: any) {
      return NextResponse.json({ error: `无法解析 storyboard JSON: ${e.message}` }, { status: 400 });
    }

    const shotCount = shots.length;
    if (shotCount < 2) {
      return NextResponse.json({ error: '至少需要 2 个 shots' }, { status: 400 });
    }

    let allTransitions: any[] = [];

    if (shotCount <= 4) {
      // 4格：一次生成全部 3 条
      allTransitions = await callGemini(shots);
    } else {
      // 9格/25格：固定分段，每组最多 3 个 transitions（4个shots）
      const groups: [number, number][] = [];
      for (let i = 0; i < shotCount - 1; i += 3) {
        const start = i;
        const end = Math.min(i + 3, shotCount - 1);
        groups.push([start, end]);
      }
      const results = await Promise.all(
        groups.map(([s, e]) => callGeminiSegment(shots, s, e))
      );
      allTransitions = results.flat();
    }

    // Renumber to ensure correct from_shot/to_shot
    const normalized = allTransitions.map((t, i) => ({
      ...t,
      from_shot: shots[i]?.shot_number ?? i + 1,
      to_shot: shots[i + 1]?.shot_number ?? i + 2,
    }));

    return NextResponse.json({
      result: JSON.stringify({ video_transitions: normalized }, null, 2),
    });
  } catch (error: any) {
    console.error('导演引擎错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
