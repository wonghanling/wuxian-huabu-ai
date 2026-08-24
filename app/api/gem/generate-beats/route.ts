import { NextRequest, NextResponse } from 'next/server';
import { requireMemberWithDailyQuota } from '@/lib/billing';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL || 'https://llm-api.net';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export const maxDuration = 300;

const SYSTEM_INSTRUCTION = `你是剧情分析助手。

任务：分析用户提供的中文故事片段，输出结构化的剧情分段分析。

输入：
- 中文故事文本（最多 800 字）

输出要求：
1. 用中文输出
2. 自然语言描述，不要输出 JSON
3. 按照以下结构组织：

【剧情分段】
根据故事内容，将其分为 3-6 个关键节拍（beats），每个节拍用一句话概括：

1. [节拍类型] 描述
2. [节拍类型] 描述
...

可用的节拍类型：
- 建立（世界观/场景）
- 触发（引发事件）
- 发展（情节推进）
- 升级（张力增强）
- 高潮（关键动作）
- 结局（收尾/余波）

【视觉化建议】
简要说明这个故事适合用什么视觉风格呈现（2-3 句话）

规则：
- 只分析给定的片段，不要扩展或编造
- 每个节拍一句话，10-25 字
- 聚焦可视化的动作和场景，避免抽象情绪
- 根据实际内容密度决定节拍数量，不要强行凑满 6 个`;


export async function POST(req: NextRequest) {
  try {
    const { story, userId } = await req.json();

    // 守卫：会员 + 每日额度
    const guard = await requireMemberWithDailyQuota(userId, 100);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

    if (!story || !story.trim()) {
      return NextResponse.json({ error: '缺少故事文本' }, { status: 400 });
    }

    const userMessage = `以下是中文故事文本：\n\n${story}\n\n请分析并输出剧情分段。`;

    const keyInfo = await pickKey('n1n');
    let success = false;
    let caught: any = null;
    let response: Response;
    try {
      response = await fetch(
        `${YUNWU_BASE_URL}/v1beta/models/gemini-3-pro-preview-thinking:generateContent`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${keyInfo.keyValue}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { temperature: 0.5 },
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

    return NextResponse.json({ success: true, result: text });
  } catch (error: any) {
    console.error('GEM beats error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
