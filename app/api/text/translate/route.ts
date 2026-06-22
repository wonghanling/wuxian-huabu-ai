import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 批量翻译文字数组，目标语言默认中文
export async function POST(req: NextRequest) {
  try {
    const { texts, targetLang = 'zh' } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: '缺少 texts 数组' }, { status: 400 });
    }

    const langName = targetLang === 'zh' ? '简体中文' : targetLang;

    // 把所有文字拼成一个 JSON 数组交给模型，避免多次调用
    const res = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${YUNWU_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是专业翻译，把用户提供的 JSON 字符串数组翻译成${langName}。
要求：
1. 保持数组长度和顺序不变
2. 保留换行符 \\n
3. 只输出翻译后的 JSON 数组，不要任何其他文字
4. 如果某项已是目标语言则保持原文
示例输入：["Hello World", "Buy Now"]
示例输出：["你好世界", "立即购买"]`,
          },
          { role: 'user', content: JSON.stringify(texts) },
        ],
        max_tokens: 2000,
      }),
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('翻译接口未返回内容');

    // 解析返回的 JSON 数组
    const translated = JSON.parse(content);
    if (!Array.isArray(translated)) throw new Error('翻译结果格式错误');

    return NextResponse.json({ texts: translated });
  } catch (error: any) {
    console.error('[text/translate] error:', error);
    return NextResponse.json({ error: error.message || '翻译失败' }, { status: 500 });
  }
}
