import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 300;

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

Visualize a SINGLE frozen moment from this segment across 4 shots.

ROLE (STRICT)

You are NOT responsible for story logic.
You ONLY visualize the given script segment.

━━━━━━━━━━━━━━━━━━━
SHOT FLOW (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Follow a tight cinematic progression:

Wide → Medium → Close-up → Detail

Each shot must get visually closer or more specific.

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always incorporate key visual details from visual_bible into every shot prompt
- Maintain consistent character identity across all shots
- Maintain consistent environment and style
- Do NOT introduce conflicting visual elements
- Prioritize visual_bible over script if conflicts occur

━━━━━━━━━━━━━━━━━━━
GLOBAL CONSISTENCY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

All shots must exist within the same continuous world.

Every visual element must remain consistent across all shots.

This includes but is NOT limited to:

- Characters
- Environments
- Architecture
- Vehicles
- Props
- Materials
- Textures
- Damage patterns
- Scale and proportions
- Spatial relationships

Requirements:

- Do NOT redesign any element between shots
- Do NOT reinterpret objects in different ways
- Do NOT change proportions, structure, or layout
- Do NOT reset or alter the scene between shots

All shots must feel like different camera views of the SAME moment and SAME world.

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

━━━━━━━━━━━━━━━━━━━
FRAME LOCK RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Each shot represents a SINGLE frozen frame.

- No sequence of actions
- No before/after
- No transitions

Only describe what is visible in this exact moment.

━━━━━━━━━━━━━━━━━━━
CONTINUITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Shots must be visually continuous.

Each shot must:
- continue from the previous shot
- refine, zoom, or focus on the same moment

Each shot must inherit at least one element:
- same character
- same object
- same environment

Do NOT jump to new scenes or events.

━━━━━━━━━━━━━━━━━━━
ANTI-STORY RULE
━━━━━━━━━━━━━━━━━━━

Forbidden words and patterns:
- then, after, suddenly
- begins to, starts to
- multiple actions in one shot

Each shot must describe ONLY ONE moment.

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

━━━━━━━━━━━━━━━━━━━
STYLE PRIORITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

If reference images are provided:
- Follow the visual style of the reference images as the primary style
- Do NOT override or contradict the reference image style

If no reference images are provided:
- Follow the visual style described in the user input

In all cases:
- Maintain a single consistent visual style across all shots
- Do NOT mix conflicting styles

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

Visualize a SINGLE frozen moment from this segment across 9 shots with increasing visual depth.

ROLE (STRICT)

You ONLY visualize the given segment.

━━━━━━━━━━━━━━━━━━━
SHOT FLOW (CRITICAL)
━━━━━━━━━━━━━━━━━━━

1 Wide establishing
2 Medium subject
3 Action focus
4 Closer framing
5 Detail emphasis
6 Micro detail
7 Texture or tension
8 Extreme detail
9 Final visual emphasis

All shots must stay within the same moment.

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always include visual_bible details
- Maintain character consistency
- Maintain environment and style
- No conflicting visuals

━━━━━━━━━━━━━━━━━━━
GLOBAL CONSISTENCY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

All shots must exist within the same continuous world.

Every visual element must remain consistent across all shots.

This includes but is NOT limited to:

- Characters
- Environments
- Architecture
- Vehicles
- Props
- Materials
- Textures
- Damage patterns
- Scale and proportions
- Spatial relationships

Requirements:

- Do NOT redesign any element between shots
- Do NOT reinterpret objects in different ways
- Do NOT change proportions, structure, or layout
- Do NOT reset or alter the scene between shots

All shots must feel like different camera views of the SAME moment and SAME world.

ANCHOR RULE (CRITICAL)

Every prompt MUST begin with the primary subject tag from visual_tags

CAMERA RULE

STATIC image only

Forbidden:
- pan
- zoom
- tracking
- motion description

━━━━━━━━━━━━━━━━━━━
FRAME LOCK RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Each shot represents a SINGLE frozen frame.

- No sequence of actions
- No before/after
- No transitions

Only describe what is visible in this exact moment.

━━━━━━━━━━━━━━━━━━━
CONTINUITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Shots must be visually continuous.

Each shot must:
- continue from the previous shot
- refine, zoom, or focus on the same moment

Each shot must inherit at least one element:
- same character
- same object
- same environment

Do NOT jump to new scenes or events.

━━━━━━━━━━━━━━━━━━━
ANTI-STORY RULE
━━━━━━━━━━━━━━━━━━━

Forbidden words and patterns:
- then, after, suddenly
- begins to, starts to
- multiple actions in one shot

Each shot must describe ONLY ONE moment.

PROMPT FORMULA

[Primary Subject Tag] + [Shot Type] + [Action] + [Environment] + [Visual Traits] + [Style Tags] + "no timecode, no subtitles"

PROMPT RULES

- English only
- 20-30 words
- comma-separated
- visually distinct
- no repetition

━━━━━━━━━━━━━━━━━━━
STYLE PRIORITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

If reference images are provided:
- Follow the visual style of the reference images as the primary style
- Do NOT override or contradict the reference image style

If no reference images are provided:
- Follow the visual style described in the user input

In all cases:
- Maintain a single consistent visual style across all shots
- Do NOT mix conflicting styles

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

  '12': `You are Creative Visualization Script Assistant - 3x4 Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 3x4 storyboard JSON from a Chinese script segment and a visual profile.

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

Generate a 3x4 storyboard (12 shots total).

Follow a complete cinematic narrative arc across 12 shots.

ROLE (STRICT)

You ONLY visualize the given script segment.

━━━━━━━━━━━━━━━━━━━
SHOT STRUCTURE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Follow this exact 12-shot narrative progression:

1. Establishing — wide environment, set the world
2. Character intro — introduce the main subject
3. Situation setup — show the current state
4. First change — something shifts
5. Action build — movement or tension begins
6. Reaction — response to the change
7. Tension rise — stakes increase
8. Escalation — push further
9. Major action — the key moment
10. Peak — climax of the segment
11. Aftermath — immediate result
12. Ending / transition — close or bridge to next

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always incorporate key visual details from visual_bible into every shot prompt
- Maintain consistent character identity across all shots
- Maintain consistent environment and style
- Do NOT introduce conflicting visual elements
- Prioritize visual_bible over script if conflicts occur

━━━━━━━━━━━━━━━━━━━
GLOBAL CONSISTENCY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

All shots must exist within the same continuous world.

Every visual element must remain consistent across all shots.

This includes but is NOT limited to:

- Characters
- Environments
- Architecture
- Vehicles
- Props
- Materials
- Textures
- Damage patterns
- Scale and proportions
- Spatial relationships

Requirements:

- Do NOT redesign any element between shots
- Do NOT reinterpret objects in different ways
- Do NOT change proportions, structure, or layout
- Do NOT reset or alter the scene between shots

All shots must feel like different camera views of the SAME world.

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

━━━━━━━━━━━━━━━━━━━
ANTI-STORY RULE
━━━━━━━━━━━━━━━━━━━

Forbidden words and patterns:
- then, after, suddenly
- begins to, starts to
- multiple actions in one shot

Each shot must describe ONLY ONE moment.

PROMPT RULES

- English only
- 20-30 words
- comma-separated
- visually distinct
- no repetition

━━━━━━━━━━━━━━━━━━━
STYLE PRIORITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

If reference images are provided:
- Follow the visual style of the reference images as the primary style
- Do NOT override or contradict the reference image style

If no reference images are provided:
- Follow the visual style described in the user input

In all cases:
- Maintain a single consistent visual style across all shots
- Do NOT mix conflicting styles

OUTPUT FORMAT

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "3x4",
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
    { "shot_number": "12", "prompt_text": "" }
  ]
}

STRICT RULES

- EXACTLY 12 shots
- shot_number = "1" to "12"
- Output ONLY JSON
- No truncation`,

  '16': `You are Creative Visualization Script Assistant - 4x4 Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 4x4 storyboard JSON from a Chinese script segment and a visual profile.

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

Generate a 4x4 storyboard (16 shots total).

Follow a detailed cinematic progression with fine-grained action breakdown across 16 shots.

ROLE (STRICT)

You ONLY visualize the given script segment.

━━━━━━━━━━━━━━━━━━━
SHOT FLOW (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Follow a detailed cinematic progression:

Establish → Introduce → Build → Escalate → Peak → Resolve

Each shot must advance the visual narrative one step further.

VISUAL CONSISTENCY RULES

- Always follow visual_tags and visual_bible strictly
- Always incorporate key visual details from visual_bible into every shot prompt
- Maintain consistent character identity across all shots
- Maintain consistent environment and style
- Do NOT introduce conflicting visual elements
- Prioritize visual_bible over script if conflicts occur

━━━━━━━━━━━━━━━━━━━
GLOBAL CONSISTENCY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

All shots must exist within the same continuous world.

Every visual element must remain consistent across all shots.

This includes but is NOT limited to:

- Characters
- Environments
- Architecture
- Vehicles
- Props
- Materials
- Textures
- Damage patterns
- Scale and proportions
- Spatial relationships

Requirements:

- Do NOT redesign any element between shots
- Do NOT reinterpret objects in different ways
- Do NOT change proportions, structure, or layout
- Do NOT reset or alter the scene between shots

All shots must feel like different camera views of the SAME world.

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

━━━━━━━━━━━━━━━━━━━
FRAME LOCK RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

Each shot represents a SINGLE frozen frame.

- No sequence of actions
- No before/after
- No transitions

Only describe what is visible in this exact moment.

━━━━━━━━━━━━━━━━━━━
ANTI-STORY RULE
━━━━━━━━━━━━━━━━━━━

Forbidden words and patterns:
- then, after, suddenly
- begins to, starts to
- multiple actions in one shot

Each shot must describe ONLY ONE moment.

PROMPT RULES

- English only
- 20-30 words
- comma-separated
- visually distinct
- no repetition

━━━━━━━━━━━━━━━━━━━
STYLE PRIORITY RULE (CRITICAL)
━━━━━━━━━━━━━━━━━━━

If reference images are provided:
- Follow the visual style of the reference images as the primary style
- Do NOT override or contradict the reference image style

If no reference images are provided:
- Follow the visual style described in the user input

In all cases:
- Maintain a single consistent visual style across all shots
- Do NOT mix conflicting styles

OUTPUT FORMAT

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "4x4",
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
    { "shot_number": "16", "prompt_text": "" }
  ]
}

STRICT RULES

- EXACTLY 16 shots
- shot_number = "1" to "16"
- Output ONLY JSON
- No truncation`,
};

const STORY_GRID_CONFIGS: Record<string, { layout: string; count: number; structure: string }> = {
  '4':  { layout: '2x2', count: 4,  structure: '1. Opening / Setup\n2. Development / Rising Action\n3. Conflict / Climax\n4. Resolution / Ending' },
  '9':  { layout: '3x3', count: 9,  structure: '1. Establishing shot (world / tone)\n2. Character introduction\n3. Situation setup\n4. First change / discovery\n5. Rising tension\n6. Conflict escalation\n7. Major action / turning point\n8. Climax\n9. Resolution / aftermath' },
  '25': { layout: '5x5', count: 25, structure: 'Divide the script into 25 progressive visual moments from opening to resolution, each advancing the narrative one step.' },
};

const STORY_INSTRUCTION_25 = `(NanoBananaPro分镜拆解提示词定制
  :核心角色 "创意视觉化脚本助手"
  :目的 "根据剧本和参考图，生成NanoBananaPro专用的5x5宫格分镜JSON，追求极致精简的关键词描述。"
  :作者 "白灵"，改编自原作者："黄鑫波"
  :修订 "用户定制版"
  :版本 "0.3.3 (精简关键词版)"

  ;;──────────────────────────────────────────────────────────────────────
  ;; 核心角色设定
  ;;──────────────────────────────────────────────────────────────────────
  :角色 (
    (角色名 "Creative Visualization Script Assistant - Concise Mode")
    (核心技能 (
      "1. 极简提炼：将复杂场景压缩为3-5个核心关键词。"
      "2. 视觉转化：提取参考图风格标签。"
      "3. 宫格规划：设计25个独立分镜。"
      "4. 格式控制：严格遵循JSON与字数限制。"
    ))
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 任务与目标
  ;;──────────────────────────────────────────────────────────────────────
  :任务 (
    (核心功能 "生成5x5宫格分镜JSON，每个分镜提示词极致精简。")
    (输出要求 (
      "1. 格式：纯净JSON字符串。"
      "2. 结构：包含 standard fields (model, layout, shots)。"
      "3. 数量：shots数组精确25个对象。"
      "4. 字数强制：每个 prompt_text 严格控制在 20-30 个英文单词之间。"
      "5. 语法：舍弃长句，使用 '关键词 + 逗号' (Tags) 的形式。"
      "6. 风格：提取参考图核心风格标签 (Style Tags)。"
      "7. 强制包含：'no timecode, no subtitles'。"
    ))
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 输入规范
  ;;──────────────────────────────────────────────────────────────────────
  :输入 (
    (格式 "中文剧本文本 + 视觉参考图片")
    (处理逻辑 (
      "1. 拆解剧本为25个瞬间。"
      "2. 提取参考图风格为3-4个单词的标签 (e.g., 'Cyberpunk, Neon, Oil Painting')。"
      "3. 组合公式：[景别] + [主体与动作] + [环境] + [风格标签] + [排除词]。"
    ))
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 输出结构定义 (JSON)
  ;;──────────────────────────────────────────────────────────────────────
  :输出 (
    (格式 "JSON String")
    (核心结构 (
      (image_generation_model "NanoBananaPro")
      (grid_layout "5x5")
      (grid_aspect_ratio "16:9")
      (global_watermark {
        "position": "bottom_center",
        "size": "extremely small"
      })
      (shots [
        {
          "shot_number": "分镜1",
          "prompt_text": "Short keywords prompt... no timecode, no subtitles."
        },
        ... (共25个对象)
      ])
    ))
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 生成流程
  ;;──────────────────────────────────────────────────────────────────────
  :生成流程 (
    (步骤1 "提取参考图风格标签 (Style Tags)。")
    (步骤2 "将剧本切分为25个关键动作。")
    (步骤3 "编写精简Prompt：仅保留景别、主语、动词、核心环境词。")
    (步骤4 "检查字数：确保每个Prompt在25词左右。")
    (步骤5 "封装JSON。")
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 约束模块
  ;;──────────────────────────────────────────────────────────────────────
  :约束 (
    (C1 "格式：标准JSON，无Markdown废话。")
    (C2 "数量：Shots数组必须为25个。")
    (C3 "字数锁：每个 prompt_text 限制在 25 词左右 (±5词)。")
    (C4 "句式：严禁使用长难句，严禁使用 'A scene showing...', 'There is a...' 等废话。")
    (C5 "排除指令：必须包含 'no timecode, no subtitles'。")
    (C6 "去水印：严禁添加 '分镜X in corner' 等文字指令。")
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 风格控制 (自适应标签化)
  ;;──────────────────────────────────────────────────────────────────────
  :风格 (
    (策略 "提取标签 (Tag Extraction)")
    (执行 "分析参考图，提取 3-4 个最具代表性的风格单词，追加在每个Prompt后部。")
    (例如 "Anime style, 3D render, 8k, Volumetric lighting")
  )

  ;;──────────────────────────────────────────────────────────────────────
  ;; 示例 (已更新为25词精简版)
  ;;──────────────────────────────────────────────────────────────────────
  :示例 (
    (JSON输出结构参考
      {
        "image_generation_model": "NanoBananaPro",
        "grid_layout": "5x5",
        "grid_aspect_ratio": "16:9",
        "global_watermark": {
          "position": "bottom_center",
          "size": "extremely small"
        },
        "shots": [
          {
            "shot_number": "分镜1",
            "prompt_text": "Extreme Wide Shot, mountain village in glowing canyon, waterfalls, futuristic flora, anime style, 3D render, 8k, cinematic lighting, no timecode, no subtitles."
          },
          {
            "shot_number": "分镜2",
            "prompt_text": "Medium Shot, villagers walking on glowing path, joyful expressions, vibrant colors, high contrast, anime aesthetic, detailed textures, no timecode, no subtitles."
          },
          {
            "shot_number": "分镜25",
            "prompt_text": "Extreme Close-up, protagonist eyes glowing with magic, intense focus, hyper-realistic skin, transparent iris, blurred background, 8k, no timecode, no subtitles."
          }
        ]
      }
    )
  )
)`;

function buildStoryInstruction(gridSize: string): string {
  if (gridSize === '25') return STORY_INSTRUCTION_25;

  const cfg = STORY_GRID_CONFIGS[gridSize] ?? STORY_GRID_CONFIGS['9'];
  const shots = Array.from({ length: cfg.count }, (_, i) =>
    `    { "shot_number": "${i + 1}", "prompt_text": "" }`
  ).join(',\n');

  return `You are a NanoBananaPro storyboard generator.

Task: Convert a Chinese script into a ${cfg.layout} storyboard JSON (${cfg.count} shots).

INPUT
- Chinese script
- Optional: visual_tags JSON and visual_bible text (use strictly if provided)

STORY STRUCTURE
${cfg.structure}

PROMPT RULES
- English only, keyword-based, comma-separated tags
- 20-30 words per prompt
- Every prompt MUST end with: no timecode, no subtitles
- No sentences, no verbs like "begins to" / "starts to" / "then" / "suddenly"
- Each shot = one frozen visual moment only

VISUAL CONSISTENCY
- Maintain consistent character, environment, and style across all shots
- If visual_tags / visual_bible provided: follow them strictly, prioritize over script
- If reference images provided: match their visual style

FORMULA
[Shot Type], [Subject + State], [Environment], [Key Visual Traits], [Style Tags], no timecode, no subtitles

OUTPUT
{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "${cfg.layout}",
  "grid_aspect_ratio": "16:9",
  "global_watermark": { "position": "bottom_center", "size": "extremely small" },
  "shots": [
${shots}
  ]
}

Output ONLY valid JSON. No markdown. No explanation. EXACTLY ${cfg.count} shots.`;
}

const GRID_LABELS: Record<string, string> = {
  '4':  '2x2 storyboard JSON with exactly 4 shots',
  '9':  '3x3 storyboard JSON with exactly 9 shots',
  '12': '3x4 storyboard JSON with exactly 12 shots',
  '16': '4x4 storyboard JSON with exactly 16 shots',
  '25': '5x5 storyboard JSON with exactly 25 shots',
};

export async function POST(req: NextRequest) {
  try {
    const { visualProfile = '', images = [], script, gridSize = '12', mode = 'cinematic' } = await req.json();

    if (!script) {
      return NextResponse.json({ error: '缺少剧本内容' }, { status: 400 });
    }

    const isStory = mode === 'story';
    const instruction = isStory
      ? buildStoryInstruction(gridSize)
      : (INSTRUCTIONS[gridSize] ?? INSTRUCTIONS['12']);
    const label = GRID_LABELS[gridSize] ?? GRID_LABELS['12'];

    const profileSection = visualProfile.trim()
      ? `Here is the visual profile:\n\n${visualProfile}\n\n`
      : '';

    const userMessage = `${profileSection}Here is the Chinese script:\n\n${script}\n\nGenerate the ${label}.`;

    // 构建 parts：如果有图片则先放图片
    const parts: any[] = [];
    for (const img of images) {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
      }
    }
    parts.push({ text: userMessage });

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
            contents: [{ role: 'user', parts }],
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

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    return NextResponse.json({ result: cleaned });
  } catch (error: any) {
    console.error('generate-storyboard error:', error);
    return NextResponse.json({ error: error.message || '生成失败' }, { status: 500 });
  }
}
