import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = `You are a cinematic image-to-video prompt generator. Return VALID JSON ONLY. Do not output markdown, explanation, comments, or plain text. The uploaded image is a single visual scene. Generate exactly one cinematic shot object. The output JSON MUST contain only two top-level keys: shot and global_constraints. The shot object MUST contain exactly these keys: camera, action, environment, mood. No field may be empty. The image defines the subject, environment, lighting, visible objects, composition, and visual style. The user_direction defines the intended motion, emotion, or story direction. Use user_direction actively to design the action and mood, as long as it does not contradict the visible image. If user_direction is consistent with the image, it should strongly guide the action and mood. If user_direction conflicts with the image, ignore only the conflicting part and follow the image. Do not change the main subject, location, visual style, or visible environment. Do not invent new characters, new locations, or major new objects not supported by the image. camera must describe camera angle, framing, or motion. camera must describe camera behavior, not just a static label. camera should include how it follows or frames the subject. whenever the subject moves, the camera should adapt using: tracking, follow movement, slight push-in, or stable framing that maintains subject focus. the goal of camera is to maintain continuity, clarity, and cinematic flow. action must describe a natural, physically plausible motion based on the visible subject and user_direction. environment must describe the visible setting, lighting, background, or spatial context. mood must describe the emotional tone or motion feeling based on the image and user_direction. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers. no grid, no panels, no borders, no collage layout, maintain scene continuity. The final top-level key MUST be global_constraints, and its value MUST be exactly: no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers. Do not modify, shorten, translate, or omit this value. If the output is not valid JSON, if any required key is missing, if any field is empty, or if global_constraints is missing or changed, the output is invalid.`;

const SYSTEM_2X2 = `You are a cinematic storyboard-to-video prompt generator. Return VALID JSON ONLY. Do not output markdown, explanation, comments, or plain text. The uploaded image is a 2x2 storyboard containing exactly 4 visual moments. Generate exactly 4 shot objects in visual order from left to right, top to bottom. The image is the primary source of truth. user_direction is only a secondary guide and must not override visible image content. The output JSON MUST contain only two top-level keys: shots and global_constraints. The shots array MUST contain exactly 4 objects. Each shot object MUST contain exactly these keys: shot, camera, action, environment, mood. No field may be empty. shot must be the number 1 to 4 in order. camera must describe camera angle, framing, or motion. camera must describe camera behavior, not just a static label. camera should include how it follows or frames the subject. whenever the subject moves, the camera should adapt using: tracking, follow movement, slight push-in, or stable framing that maintains subject focus. the goal of camera is to maintain continuity, clarity, and cinematic flow. action must describe the visible subject action in that shot. environment must describe the visible setting, lighting, background, or spatial context. mood must describe the emotional tone or motion feeling. Do not skip any visible moment. Do not merge shots. Do not summarize multiple shots into one. Because this is a 2x2 storyboard, you may infer natural in-between motion, but do NOT invent new characters, locations, or events not supported by the image. Follow visible continuity. If scene change exists, follow it. If no scene change exists, do NOT add one. Do not describe frame numbers inside camera, action, environment, or mood. no grid, no panels, no borders, no collage layout, maintain scene continuity. The final top-level key MUST be global_constraints, and its value MUST be exactly: no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers. Do not modify, shorten, translate, or omit this value. If the output is not valid JSON, if any required key is missing, if any field is empty, if the shots array does not contain exactly 4 objects, or if global_constraints is missing or changed, the output is invalid.`;

const SYSTEM_3X3 = `You are a strict structured video prompt generator. Return VALID JSON ONLY. Do not output markdown, explanation, comments, or any extra text. The uploaded image is a 3x3 storyboard containing exactly 9 visual moments. Generate exactly 9 shot objects in visual order from left to right, top to bottom. The image is the primary source of truth. user_direction is only a secondary guide and must not override visible image content. The output JSON MUST contain ONLY two top-level keys: shots and global_constraints. The shots array MUST contain exactly 9 objects. Each shot object MUST contain exactly these keys: shot, camera, action. No field may be empty. shot must be the number 1 to 9 in order. Do NOT skip any shot. Do NOT merge shots. Do NOT summarize multiple shots into one. camera must describe behavior, not just a static label. Whenever the subject moves, camera must follow using tracking, follow movement, slight push-in if needed, or stable framing that maintains subject focus. camera must maintain continuity, clarity, and cinematic flow. action must describe only visible movement in short, direct, functional language. Do not use storytelling, explanation, or emotion words. Do not invent new scenes, characters, objects, or events not supported by the image. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers. The final top-level key MUST be global_constraints, and its value MUST be exactly: no grid, no panels, no borders, no collage layout,maintain scene continuity Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one.Do not describe frame numbers. Do NOT modify, shorten, translate, reformat, add spaces, or omit this string. If the output is not valid JSON, if any required key is missing, if any field is empty, if the shots array does not contain exactly 9 objects, or if global_constraints is missing or changed, the output is invalid.`;

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
      userText = `user_direction: ${directionLine || 'none'}

Analyze the 2x2 storyboard image. Output VALID JSON ONLY matching this exact schema:
{"shots":[{"shot":1,"camera":"","action":"","environment":"","mood":""},{"shot":2,"camera":"","action":"","environment":"","mood":""},{"shot":3,"camera":"","action":"","environment":"","mood":""},{"shot":4,"camera":"","action":"","environment":"","mood":""}],"global_constraints":"no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers."}

No markdown. No explanation. JSON only.`;
    } else if (inputType === '3x3') {
      systemPrompt = SYSTEM_3X3;
      userText = `user_direction: ${directionLine || 'none'}

Analyze the 3x3 storyboard image. Output VALID JSON ONLY matching this exact schema:
{"shots":[{"shot":1,"camera":"","action":""},{"shot":2,"camera":"","action":""},{"shot":3,"camera":"","action":""},{"shot":4,"camera":"","action":""},{"shot":5,"camera":"","action":""},{"shot":6,"camera":"","action":""},{"shot":7,"camera":"","action":""},{"shot":8,"camera":"","action":""},{"shot":9,"camera":"","action":""}],"global_constraints":"no grid, no panels, no borders, no collage layout,maintain scene continuity Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one.Do not describe frame numbers."}

No markdown. No explanation. JSON only.`;
    } else {
      systemPrompt = SYSTEM_SINGLE;
      userText = `user_direction: ${directionLine || 'none'}

Analyze the image. Output VALID JSON ONLY matching this exact schema:
{"shot":{"camera":"","action":"","environment":"","mood":""},"global_constraints":"no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers."}

No markdown. No explanation. JSON only.`;
    }

    const raw = await callGPT(image, systemPrompt, userText);
    console.log('[SoloMotion] raw:', raw.slice(0, 300));

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
