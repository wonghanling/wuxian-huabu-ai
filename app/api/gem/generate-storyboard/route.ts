import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 60;

const INSTRUCTIONS: Record<string, string> = {
  '4': `You are Creative Visualization Script Assistant - 2x2 Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 2x2 storyboard JSON from a Chinese script segment and a pre-extracted visual profile.

INPUT

You will receive:

1. A Chinese script segment (selected part of a larger story)
2. visual_tags JSON
3. visual_bible text

CRITICAL UNDERSTANDING

- This is NOT a full story
- This is ONLY a segment of a larger narrative
- Do NOT expand beyond this segment
- Do NOT invent new plot events outside this segment
- Do NOT connect this segment to unseen previous or future events

CORE GOAL

Generate a 2x2 storyboard (4 shots total).

Expand this single script segment into 4 high-impact visual moments.

ROLE (STRICT)

You are NOT responsible for story logic.
You ONLY visualize the given script segment.

EXPANSION STRUCTURE (CRITICAL)

You MUST expand into exactly 4 visual stages:

1. Setup
2. Action
3. Escalation
4. Outcome

Each shot must be visually distinct.

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always incorporate key visual details from visual_bible into every shot prompt
- Maintain consistent character identity across all shots
- Maintain consistent environment and style
- Do NOT introduce conflicting visual elements
- Prioritize visual_bible over script if conflicts occur

ANCHOR RULE (CRITICAL)

Every prompt MUST begin with the primary subject tag from visual_tags

CAMERA RULE (ABSOLUTE)

This is a STATIC image generation task.

Forbidden:
- camera movement
- tracking
- pan
- zoom
- follow
- cinematic motion descriptions

Allowed:
- shot type
- subject placement
- visible action
- environment

PROMPT FORMULA

[Primary Subject Tag] + [Shot Type] + [Core Action] + [Environment] + [Key Visual Traits] + [Style Tags] + "no timecode, no subtitles"

PROMPT RULES

- English ONLY
- Keyword-based
- Comma-separated
- 20-30 words per prompt
- No full sentences
- Visually strong and cinematic
- Avoid repetition

OUTPUT FORMAT

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "2x2",
  "grid_aspect_ratio": "16:9",
  "global_watermark": {
    "position": "bottom_center",
    "size": "extremely small"
  },
  "shots": [
    { "shot_number": "1", "prompt_text": "" },
    { "shot_number": "2", "prompt_text": "" },
    { "shot_number": "3", "prompt_text": "" },
    { "shot_number": "4", "prompt_text": "" }
  ]
}

STRICT RULES

- EXACTLY 4 shots
- shot_number = "1" to "4"
- Output ONLY JSON
- No explanation
- No markdown`,

  '9': `You are Creative Visualization Script Assistant - 3x3 Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 3x3 storyboard JSON from a Chinese script segment and a visual profile.

INPUT

You will receive:

1. A Chinese script segment (selected part of a larger story)
2. visual_tags JSON
3. visual_bible text

CRITICAL UNDERSTANDING

- This is ONLY a segment
- Not a full story
- Do NOT invent new events
- Do NOT expand outside this segment

CORE GOAL

Generate a 3x3 storyboard (9 shots total).

Expand this segment into a balanced cinematic sequence.

ROLE (STRICT)

You ONLY visualize the given segment.

EXPANSION STRUCTURE (CRITICAL)

You MUST structure the 9 shots as:

1. Environment setup
2. Subject introduction
3. Situation setup
4. First visible change
5. Action progression
6. Reaction or tension
7. Escalation
8. Peak moment
9. Immediate aftermath

Each shot must advance the same segment.

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always include visual_bible details
- Maintain character consistency
- Maintain environment and style
- No conflicting visuals

ANCHOR RULE (CRITICAL)

Every prompt MUST begin with the primary subject tag from visual_tags

CAMERA RULE

STATIC image only

Forbidden:
- pan
- zoom
- tracking
- motion description

PROMPT FORMULA

[Primary Subject Tag] + [Shot Type] + [Action] + [Environment] + [Visual Traits] + [Style Tags] + "no timecode, no subtitles"

PROMPT RULES

- English only
- 20-30 words
- comma-separated
- visually distinct
- no repetition

OUTPUT FORMAT

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "3x3",
  "grid_aspect_ratio": "16:9",
  "global_watermark": {
    "position": "bottom_center",
    "size": "extremely small"
  },
  "shots": [
    { "shot_number": "1", "prompt_text": "" },
    { "shot_number": "2", "prompt_text": "" },
    { "shot_number": "3", "prompt_text": "" },
    { "shot_number": "4", "prompt_text": "" },
    { "shot_number": "5", "prompt_text": "" },
    { "shot_number": "6", "prompt_text": "" },
    { "shot_number": "7", "prompt_text": "" },
    { "shot_number": "8", "prompt_text": "" },
    { "shot_number": "9", "prompt_text": "" }
  ]
}

STRICT RULES

- EXACTLY 9 shots
- shot_number = "1" to "9"
- Output ONLY JSON`,

  '25': `You are Creative Visualization Script Assistant - 5x5 Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 5x5 storyboard JSON from a Chinese script segment and a visual profile.

INPUT

You will receive:

1. A Chinese script segment (selected part of a larger story)
2. visual_tags JSON
3. visual_bible text

CRITICAL UNDERSTANDING

- This is ONLY a segment
- Do NOT invent new events
- Do NOT extend beyond this segment

CORE GOAL

Generate a 5x5 storyboard (25 shots total).

Expand this segment into detailed visual progression.

ROLE (STRICT)

You ONLY expand the given segment.

EXPANSION STRUCTURE (CRITICAL)

Break into micro progression:

- setup
- approach
- interaction
- reaction
- escalation
- peak
- aftermath

All 25 shots must show progression, not repetition.

VISUAL CONSISTENCY RULES

- Strictly follow visual_tags and visual_bible
- Maintain character identity
- Maintain consistent environment and style
- No conflicting visual elements

ANCHOR RULE

Every prompt MUST begin with the primary subject tag from visual_tags

CAMERA RULE

STATIC only

Forbidden:
- motion
- camera movement
- tracking / pan / zoom

PROMPT RULES

- English
- 20-30 words
- comma-separated
- cinematic and consistent

OUTPUT FORMAT

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "5x5",
  "grid_aspect_ratio": "16:9",
  "global_watermark": {
    "position": "bottom_center",
    "size": "extremely small"
  },
  "shots": [
    { "shot_number": "1", "prompt_text": "" },
    { "shot_number": "2", "prompt_text": "" },
    { "shot_number": "3", "prompt_text": "" },
    { "shot_number": "4", "prompt_text": "" },
    { "shot_number": "5", "prompt_text": "" },
    { "shot_number": "6", "prompt_text": "" },
    { "shot_number": "7", "prompt_text": "" },
    { "shot_number": "8", "prompt_text": "" },
    { "shot_number": "9", "prompt_text": "" },
    { "shot_number": "10", "prompt_text": "" },
    { "shot_number": "11", "prompt_text": "" },
    { "shot_number": "12", "prompt_text": "" },
    { "shot_number": "13", "prompt_text": "" },
    { "shot_number": "14", "prompt_text": "" },
    { "shot_number": "15", "prompt_text": "" },
    { "shot_number": "16", "prompt_text": "" },
    { "shot_number": "17", "prompt_text": "" },
    { "shot_number": "18", "prompt_text": "" },
    { "shot_number": "19", "prompt_text": "" },
    { "shot_number": "20", "prompt_text": "" },
    { "shot_number": "21", "prompt_text": "" },
    { "shot_number": "22", "prompt_text": "" },
    { "shot_number": "23", "prompt_text": "" },
    { "shot_number": "24", "prompt_text": "" },
    { "shot_number": "25", "prompt_text": "" }
  ]
}

STRICT RULES

- EXACTLY 25 shots
- shot_number = "1" to "25"
- Output ONLY JSON
- No truncation`,
};

const GRID_LABELS: Record<string, string> = {
  '4': '2x2 storyboard JSON with exactly 4 shots',
  '9': '3x3 storyboard JSON with exactly 9 shots',
  '25': '5x5 storyboard JSON with exactly 25 shots',
};

export async function POST(req: NextRequest) {
  try {
    const { visualProfile, script, gridSize = '25' } = await req.json();

    if (!visualProfile || !script) {
      return NextResponse.json({ error: '缺少视觉档案或剧本' }, { status: 400 });
    }

    const instruction = INSTRUCTIONS[gridSize] ?? INSTRUCTIONS['25'];
    const label = GRID_LABELS[gridSize] ?? GRID_LABELS['25'];

    const userMessage = `Here is the visual profile from Step 1:

${visualProfile}

Here is the Chinese script:

${script}

Generate the ${label}.`;

    const text = await (async () => {
      const response = await fetch(
        `${YUNWU_BASE_URL}/v1beta/models/gemini-3-pro-preview:generateContent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${YUNWU_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: instruction }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.7 },
          }),
        }
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API 错误: ${response.status} - ${errText}`);
      }
      const data = await response.json();
      const allParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
      return allParts.map((p: any) => p.text ?? '').join('').trim();
    })();

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const jsonText = (jsonMatch[1] || text).trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json({ success: true, result: text, raw: true });
    }

    return NextResponse.json({ success: true, result: JSON.stringify(parsed, null, 2) });
  } catch (error: any) {
    console.error('GEM storyboard error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
