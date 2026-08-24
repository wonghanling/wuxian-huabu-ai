import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL || 'https://llm-api.net';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `You are a high-precision visual feature extraction engine.

Your task is to analyze multiple uploaded reference images and produce ONE unified visual profile for downstream storyboard generation.

This is NOT a storytelling task.
This is NOT a storyboard task.
This is a visual consolidation task.

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━

{
  "visual_tags": {
    "character": "",
    "outfit": "",
    "cybernetic_parts": "",
    "monster": "",
    "environment": "",
    "style_tags": []
  },
  "visual_bible": ""
}

━━━━━━━━━━━━━━━━━━━
CORE OBJECTIVE
━━━━━━━━━━━━━━━━━━━

You must merge all uploaded images into ONE consistent visual profile.

The goal is to preserve the most stable and reusable visual traits across multiple reference images.

━━━━━━━━━━━━━━━━━━━
MULTI-IMAGE FUSION RULES
━━━━━━━━━━━━━━━━━━━

1. CONSISTENCY PRIORITY
- Keep ONLY features that appear consistently across multiple images
- Ignore any detail that appears in only one image
- Focus on dominant and repeated visual traits

2. CONFLICT RESOLUTION
- If images conflict, choose the MOST COMMON visual pattern
- If no clear majority exists, simplify instead of guessing

3. NOISE REDUCTION
- Ignore minor variations caused by angle, pose, crop, lighting, or background clutter
- Ignore accidental or non-essential details unless visually dominant

4. NO HALLUCINATION
- Do NOT invent missing details
- If something is unclear, leave it minimal

━━━━━━━━━━━━━━━━━━━
FIELD DEFINITIONS
━━━━━━━━━━━━━━━━━━━

visual_tags.character - Core identity traits, gender, hair, face, body type. Short keyword phrases only.
visual_tags.outfit - Clothing, armor, materials, silhouette. Stable recurring traits only.
visual_tags.cybernetic_parts - Mechanical limbs, implants, glowing tech. If none, return "".
visual_tags.monster - Creature type, skeletal structure, iconic traits. If none, return "".
visual_tags.environment - Dominant setting and lighting atmosphere.
visual_tags.style_tags - 3 to 6 concise style tags only.

━━━━━━━━━━━━━━━━━━━
VISUAL_BIBLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━

80 to 180 English words. One paragraph. No plot. No storyboard instructions. No camera shots.

━━━━━━━━━━━━━━━━━━━
STRICT OUTPUT RULES
━━━━━━━━━━━━━━━━━━━

- English ONLY
- JSON ONLY — no markdown, no explanations, no extra keys
- style_tags must contain 3 to 6 items
- Output ONLY the JSON object. No text before or after.`;

export async function POST(req: NextRequest) {
  try {
    const { images, userId } = await req.json();

    // 守卫：会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '请上传至少一张图片' }, { status: 400 });
    }

    const parts: any[] = [];
    for (const img of images) {
      const m = img.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
      if (m) parts.push({ inline_data: { mime_type: `image/${m[1]}`, data: m[2] } });
    }
    parts.push({ text: 'Analyze these reference images and output the unified visual profile JSON.' });

    const keyInfo = await pickKey('n1n');
    let success = false;
    let caught: any = null;
    let response: Response;
    try {
      response = await fetch(
        `${YUNWU_BASE_URL}/v1beta/models/gemini-3-flash-preview:generateContent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${keyInfo.keyValue}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.2 },
          }),
        }
      );
      success = response.ok;
    } catch (err) {
      caught = err;
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 错误: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const allParts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = allParts.map((p: any) => p.text ?? '').join('').trim();

    if (!text) throw new Error('API 未返回内容');

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
    console.error('GEM analyze error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
