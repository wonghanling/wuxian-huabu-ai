import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

export const maxDuration = 30;

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { visualJson, userId } = await req.json();
    if (!visualJson) return NextResponse.json({ error: '缺少 visualJson' }, { status: 400 });

    // 守卫：会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    const userPrompt = `From the following visual profile JSON, extract a single concise character_hint string.

Rules:
- Output ONLY a plain English string, no JSON, no markdown
- Format: "Character reference: [key visual traits]"
- Include: hair color/style, distinctive body parts, eye color, clothing style, cybernetic features if any
- Max 20 words after "Character reference:"
- Example: "Character reference: silver-white hair, mechanical right arm, cyan glowing eye, cyberpunk style"

Visual Profile JSON:
${typeof visualJson === 'string' ? visualJson : JSON.stringify(visualJson)}`;

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
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
    const hint = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    if (!hint) throw new Error('未能提取 character hint');

    return NextResponse.json({ hint });
  } catch (error: any) {
    console.error('extract-character-hint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
