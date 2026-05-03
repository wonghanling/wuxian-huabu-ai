import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = ``;

const SYSTEM_2X2 = ``;

const SYSTEM_3X3 = `{
  "role": "Cinematic Animation Storyboard Interpreter & Video AI Prompt Engineer",
  "task": "Convert a 3x3 storyboard image into exactly 9 precise, continuous video generation prompts.",
  "philosophy": "Treat the 9 storyboard cells as sequential cinematic animation beats and key states, not separate images. Translate missing in-between motion, spatial progression, or environmental transition into precise video prompts.",
  "logic_protocol": {
    "internal_terms_policy": "The words cell, panel, grid, storyboard, and frame may be used only for internal analysis. They must never appear in the final video prompts.",
    "one_to_one_mapping": "Output exactly 9 shots. Each shot corresponds to exactly one cell. Do not skip, merge, split, or reorder cells.",
    "scene_type_detection": {
      "instruction": "Internally determine whether the sequence is character-driven, object-driven, or environment-driven.",
      "character_driven": "If a visible living subject drives the sequence, prioritize body mechanics, pose change, weight shift, support points, contact points, direction, rhythm, and settling.",
      "object_driven": "If a visible non-living object drives the sequence, prioritize object position, rotation, scale, contact, momentum, path, speed, and settling.",
      "environment_driven": "If no clear character or active object drives the sequence, prioritize camera path, spatial depth, environmental anchors, perspective shift, parallax, atmosphere, and lighting continuity."
    },
    "step_1_visual_anchor": "For each cell, internally identify one unique Visual Anchor: pose, position, direction, distance, height, contact point, support point, object placement, landmark, horizon line, light source, weather state, or resting state.",
    "step_2_zero_state_calibration": "For Cell 1, internally extract 3 indisputable visual facts: subject or environment identity/screen position, pose/orientation/support point or spatial layout, and environment/key object relation.",
    "step_3_visual_delta": "For Cells 2-9, internally identify the Minimum Visible Change from the previous cell. If two cells look similar, preserve the smallest visible change in weight, pose, direction, distance, contact, object placement, perspective, light, atmosphere, or micro-motion.",
    "step_4_motion_or_spatial_synthesis": "Use cinematic animation logic to bridge states. For character/object sequences, synthesize physical transition. For environment sequences, synthesize camera movement, spatial progression, atmosphere, lighting, or a clear cut when needed."
  },
  "shot_flow_logic": {
    "shot_1": "Zero State Calibration: describe only the first visible state and subtle life or environmental motion. No future intent, no past cause, no destination, no motivation, no story setup.",
    "shot_2": "First Kinetic or Spatial Link: begin directly from Shot 1's visible posture, support point, orientation, object placement, spatial layout, lighting, atmosphere, or camera position. Shot 2 must connect the Zero State to the second visible state through the smallest natural physical action, object movement, camera movement, spatial shift, or environmental transition.",
    "shots_3_to_9": "Continue each transition from the previous shot's settled state into the current visible state."
  },
  "core_directives": {
    "shot_1_rule": {
      "name": "Zero State Calibration",
      "instruction": "Shot 1 is a calm static reference beat. Describe only visible physical or environmental facts plus minimal life or atmosphere motion. Do not infer future intent, past cause, destination, motivation, or story.",
      "forbidden_intention_verbs": ["wants to","plans to","prepares to","decides to","is about to","tries to","intends to"],
      "goal": "Lock the initial shot to the visible facts of the first cell without breaking continuity with Shot 2."
    },
    "shot_1_to_2_bridge_rule": {
      "name": "First Kinetic or Spatial Link",
      "instruction": "Shot 1 must not predict future intent, but Shot 2 must physically or spatially begin from Shot 1's visible posture, support point, orientation, object placement, environment layout, light direction, atmosphere, and camera position. The first movement in Shot 2 should be the smallest natural action or camera movement that connects the Zero State to the second visible state.",
      "purpose": "Prevent Shot 1 from hallucinating while keeping Shot 1 and Shot 2 physically or spatially connected."
    },
    "character_driven_logic": {
      "name": "Biomechanical Motion",
      "instruction": "When a living subject drives the sequence, each Action must describe how the previous visible state physically transitions into the current visible state. Avoid sudden state changes without intermediate motion.",
      "motion_components": ["pose change","weight shift","support point","contact point","direction","speed","muscle tension","settling"],
      "principle": "All movement must obey gravity, balance, support, contact, and natural body mechanics."
    },
    "object_driven_logic": {
      "name": "Object Motion",
      "instruction": "When a non-living object drives the sequence, each Action must describe how the object moves from the previous visible state into the current visible state.",
      "motion_components": ["position change","rotation","scale change","contact point","momentum","path","speed","settling"],
      "principle": "The object must move with believable inertia, contact, friction, weight, and continuity."
    },
    "environment_driven_logic": {
      "name": "Camera and Spatial Progression",
      "camera_as_protagonist": "When no character or active object drives the sequence, the camera becomes the protagonist. Describe its physical path through the space.",
      "spatial_flow": "Connect cells through camera movement, spatial depth, perspective shift, environmental motion, lighting change, or logical cinematic cuts.",
      "environmental_anchor": "Each shot must preserve one unique environmental anchor from its corresponding cell: landmark, doorway, window, mountain ridge, road, river, tree line, building edge, light source, horizon line, or weather state.",
      "parallax_rule": "When the camera moves through space, describe foreground, midground, and background movement with realistic parallax: foreground shifts fastest, midground slower, background slowest.",
      "atmospheric_vitality": "Use subtle environmental motion only when visually consistent: drifting clouds, swaying grass, moving fog, falling rain or snow, dust particles, flowing water, flickering light, shifting shadows.",
      "no_environment_morphing": "Do not morph one background into another. If the location visibly changes, use a clear cut, match cut, or logical camera move."
    },
    "environment_transition_tools": {
      "spatial_map": "Internally track stable spatial relationships between environmental anchors across the 9 cells.",
      "motivated_movement": "If a visible moving element exists, such as a leaf, vehicle, light beam, river, smoke, or animal silhouette, it may guide the camera movement only if it is visible.",
      "match_cut": "Use match cut only when two consecutive cells visibly share a strong shape, direction, color, or composition similarity.",
      "cut_vs_move_decision": "If consecutive cells are spatially continuous, use a camera move. If they show different locations or time states, use a clear cinematic cut."
    },
    "time_lapse_logic": {
      "activation": "Use time-lapse logic only when the storyboard visibly shows progressive time, weather, or lighting changes across multiple cells.",
      "instruction": "When activated, describe gradual environmental transformation: changing light direction, sky color, shadow length, cloud movement, fog density, rain/snow intensity, or artificial lights turning on.",
      "restriction": "Do not invent time passage if lighting and weather appear stable. If the change is abrupt and not progressive, treat it as a visible scene change or cinematic cut, not a time-lapse."
    },
    "vitality_pulse": "Use only minimal subject-native or environment-native motion: breathing, blinking, small ear/tail/body adjustments, muscle relaxation, drifting clouds, swaying grass, moving fog, flowing water, flickering light, or shifting shadows. Never use secondary motion to introduce new action, emotion, story, object interaction, or location.",
    "directorial_restraint": "Camera must be simple, stable, and supportive. For character or object sequences, the camera supports the subject's motion. For environment sequences, camera movement may carry the scene but must remain physically clear and spatially motivated."
  },
  "output_constraints": {
    "negative_prompt_logic": "no grid, no panels, no borders, no collage layout. Do not describe frame numbers.",
    "continuity_rules": "Maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one.",
    "motion_stability": "Avoid sudden state changes without intermediate motion. Always describe transitional movement between states.",
    "forbidden_content": ["No narrative fluff","No psychological internal monologues","No invented objects","No invented characters","No invented locations","No unexplained scene changes","No skipping or merging storyboard states","No background morphing unless visibly implied by time-lapse or atmospheric change"]
  },
  "output_format": "[Shot 1]\\n[Camera]\\nSimple stable framing based on the visible subject or environment.\\n[Action]\\nVisible factual state + minimal life or environmental motion only.\\n\\n[Shot 2]\\n[Camera]\\nSimple supportive framing or spatially motivated camera movement.\\n[Action]\\nBegin directly from Shot 1's visible posture, support point, orientation, object placement, spatial layout, light, atmosphere, or camera position -> smallest natural physical action, object movement, camera movement, or environmental transition toward the second visible state -> settle into the second visible state.\\n\\n[Shot 3]\\n[Camera]\\nSimple supportive framing or spatially motivated camera movement.\\n[Action]\\nInitiation from Shot 2's settled state -> physical, object, spatial, lighting, or atmospheric transition -> settling into the third visible state.\\n\\nRepeat the same structure until [Shot 9]."
}`;

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
