import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

const SYSTEM_SINGLE = `You are a cinematic image-to-video prompt generator. The uploaded image is a single visual scene, not a storyboard. Generate one cinematic video prompt based on the visible subject, environment, lighting, and the user's optional direction. The image is the primary source of truth. The user_direction is only a secondary guide. Use user_direction only if it is consistent with the image and does not contradict visible content. Create natural, physically plausible motion that fits the image. Do not invent new characters, new locations, or major new objects that are not supported by the image. Keep the subject consistent, maintain the environment, and preserve the original visual style. Output camera, action, timing, narrative emotion, and constraints. no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers.`;

const SYSTEM_2X2 = `You are a cinematic storyboard-to-video prompt generator. The uploaded image is a 2x2 storyboard containing exactly 4 visual moments. Treat each visual moment as one shot. Generate exactly 4 separate shot-level video prompts. Follow the visual order from left to right, top to bottom. The image is the primary source of truth. The user_direction is only a secondary guide. Use user_direction only if it is consistent with the image and does not contradict visible content. Because a 2x2 storyboard has fewer key moments, infer natural in-between motion inside each shot, but do not invent new characters, new locations, or new events not supported by the image. Do not merge the shots into one paragraph. Do not skip any visible moment. For each shot, output camera and action only. no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers.`;

const SYSTEM_3X3 = `You are a cinematic storyboard-to-video prompt generator. The uploaded image is a 3x3 storyboard containing exactly 9 visual moments. Treat each visual moment as one shot. Generate exactly 9 separate shot-level video prompts. Follow the visual order from left to right, top to bottom. The image is the primary source of truth. The user_direction is only a secondary guide. Use user_direction only if it is consistent with the image and does not contradict visible content. Each shot must describe only what is happening in that specific visual moment while preserving continuity with the previous and next shots. Do not merge the shots into one paragraph. Do not skip any visible moment. For each shot, output camera and action only. no grid, no panels, no borders, no collage layout, maintain scene continuity. Follow visible continuity. If scene change exists follow it. If no scene change do NOT add one. Do not describe frame numbers.`;

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
      userText = `${userDirection}

Analyze the 2x2 storyboard image and output exactly 4 shots in this JSON format:
{"shots":[{"shot":1,"camera":"","action":""},{"shot":2,"camera":"","action":""},{"shot":3,"camera":"","action":""},{"shot":4,"camera":"","action":""}]}

Output JSON only. No extra text.`;
    } else if (inputType === '3x3') {
      systemPrompt = SYSTEM_3X3;
      userText = `${userDirection}

Analyze the 3x3 storyboard image and output exactly 9 shots in this JSON format:
{"shots":[{"shot":1,"camera":"","action":""},{"shot":2,"camera":"","action":""},{"shot":3,"camera":"","action":""},{"shot":4,"camera":"","action":""},{"shot":5,"camera":"","action":""},{"shot":6,"camera":"","action":""},{"shot":7,"camera":"","action":""},{"shot":8,"camera":"","action":""},{"shot":9,"camera":"","action":""}]}

Output JSON only. No extra text.`;
    } else {
      systemPrompt = SYSTEM_SINGLE;
      userText = `${userDirection}

Analyze the image and output a video prompt in this JSON format:
{"camera":"","action":"","timing":"","narrative_emotion":"","constraints":"no grid, no panels, no borders, no collage layout, maintain scene continuity, follow visible continuity, smooth cinematic motion"}

Output JSON only. No extra text.`;
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
          // 多镜头：每个 shot 拼成一行
          finalPrompt = parsed.shots
            .map((s: any) => `Shot ${s.shot}: ${s.camera}, ${s.action}`)
            .join('\n');
        } else {
          // 单图：拼成一段
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
