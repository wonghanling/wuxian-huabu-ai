import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

function buildUserPrompt(shots: any[]): string {
  return `
# Role: Hardened Video Transition Logic API

# Objective
Convert Storyboard JSON into a strict "video_transitions" JSON array.
You are a stateless data transformation function, NOT a conversational AI.

# Output Specification (CRITICAL)
- Output EXACTLY ${shots.length - 1} transition objects
- Transition i connects Shot[i] → Shot[i+1]
- Output MUST be valid JSON
- Output MUST begin with '{'
- Output MUST end with '}'

# Transition Rules

## Transition Type
- "morph_action" → continuous motion
- "cut" → scene/time jump

## Motion Intent
- 8–20 English words
- ONLY describe motion/change
- DO NOT repeat full shot

## Duration
- "slow" | "normal" | "fast"

## Keep Static
- 2–5 stable elements
- Prevent background drift

## Camera Control
movement:
- "static" | "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "follow"

intensity:
- "subtle" | "normal" | "dramatic"

# Formatting Constraints (ABSOLUTE)
- NO markdown
- NO explanation
- NO headings
- NO text outside JSON
- NO "Here is the result"
- NO backticks
- NO trailing commas

# Schema
{
  "video_transitions": [
    {
      "from_shot": 1,
      "to_shot": 2,
      "transition_type": "morph_action",
      "motion_intent": "describe motion",
      "duration_control": "normal",
      "keep_static": ["element1"],
      "camera_control": {
        "movement": "static",
        "intensity": "subtle"
      }
    }
  ]
}

# FINAL WARNING
IF OUTPUT IS NOT VALID JSON, SYSTEM WILL CRASH.
OUTPUT RAW JSON ONLY.

---

Here is the storyboard JSON:
${JSON.stringify(shots)}
`;
}

function cleanResponse(raw: string): string {
  let cleaned = raw.replace(/```json|```/g, '').trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) {
    return cleaned.substring(first, last + 1);
  }
  return cleaned;
}

async function callGemini(shots: any[]): Promise<string> {
  const userPrompt = buildUserPrompt(shots);
  const res = await fetch(
    `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YUNWU_API_KEY}`,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API 错误: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  console.log('[Step3] raw (first 300):', raw.slice(0, 300));
  return raw;
}

async function getTransitions(shots: any[]): Promise<any[]> {
  for (let i = 0; i < 2; i++) {
    const raw = await callGemini(shots);
    try {
      const parsed = JSON.parse(cleanResponse(raw));
      if (parsed.video_transitions && parsed.video_transitions.length === shots.length - 1) {
        return parsed.video_transitions;
      }
      console.log('[Step3] wrong count, retry', i + 1);
    } catch (e) {
      console.log('[Step3] parse failed, retry', i + 1);
    }
  }
  throw new Error('Step3 failed: Gemini did not return valid JSON');
}

function stripMarkdown(raw: string) {
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
}

function tryParse(value: any) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(stripMarkdown(value)); } catch { return value; }
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

    if (shots.length < 2) {
      return NextResponse.json({ error: '至少需要 2 个 shots' }, { status: 400 });
    }

    const shotCount = shots.length;
    let allTransitions: any[] = [];

    if (shotCount <= 4) {
      allTransitions = await getTransitions(shots);
    } else {
      const groups: [number, number][] = [];
      for (let i = 0; i < shotCount - 1; i += 3) {
        groups.push([i, Math.min(i + 3, shotCount - 1)]);
      }
      const results = await Promise.all(
        groups.map(([s, e]) => getTransitions(shots.slice(s, e + 1)))
      );
      allTransitions = results.flat();
    }

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
