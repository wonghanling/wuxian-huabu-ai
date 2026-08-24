import { NextRequest, NextResponse } from 'next/server';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL || 'https://llm-api.net';

// 提示词翻译:中→英(或任意语言→英),走 n1n 账号池
// 通用工具,不挂会员/额度(免费用户也要能在图片卡用)
export async function POST(request: NextRequest) {
  try {
    const { text, target } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: '请提供要翻译的文本' }, { status: 400 });
    }

    const targetLang = target === 'zh' ? '中文' : '英文';
    const systemPrompt =
      `你是一个 AI 绘画/视频提示词翻译助手。把用户输入翻译成${targetLang}。` +
      `只返回翻译后的文本本身,不要任何解释、引号或额外说明。` +
      `保留提示词中的专有名词、模型语法(如 --ar 16:9)、@引用、数字和标点原样不译。`;

    const keyInfo = await pickKey('n1n');
    let ok = false;
    let err: any = null;
    let response: Response;
    try {
      response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyInfo.keyValue}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });
      ok = response.ok;
    } catch (e) {
      err = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, ok, ok ? undefined : categorizeError(err));
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('翻译 API 错误:', response.status, errorText);
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    const translated = (data.choices?.[0]?.message?.content || '').trim();

    return NextResponse.json({ translated });
  } catch (error: any) {
    console.error('翻译失败:', error);
    return NextResponse.json({ error: '翻译失败,请重试' }, { status: 500 });
  }
}
