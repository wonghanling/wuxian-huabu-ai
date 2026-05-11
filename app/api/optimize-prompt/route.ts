import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_VIDEO_SKILL } from './skill-content';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userInput, duration, ratio, uploadedImage } = await request.json();

    if (!userInput) {
      return NextResponse.json({ error: '请提供视频描述' }, { status: 400 });
    }

    const systemPrompt = UNIVERSAL_VIDEO_SKILL;

    let userMessage: any;

    if (uploadedImage) {
      userMessage = [
        {
          type: 'image_url',
          image_url: { url: uploadedImage },
        },
        {
          type: 'text',
          text: `请基于上面的参考图片，为以下视频需求生成专业的提示词：\n\n视频描述：${userInput}\n时长：${duration}\n比例：${ratio}\n\n请分析图片中的人物、场景、构图、光影等元素，结合用户描述生成连贯的视频提示词。请直接输出可用的提示词，不要解释。`,
        },
      ];
    } else {
      userMessage = `请为以下视频需求生成专业的提示词：\n\n视频描述：${userInput}\n时长：${duration}\n比例：${ratio}\n\n请直接输出可用的提示词，不要解释。`;
    }

    const opKeyInfo = await pickKey('n1n');
    let opSuccess = false;
    let opErr: any = null;
    let response: Response;
    try {
      response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${opKeyInfo.keyValue}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
      }),
    });
      opSuccess = response.ok;
    } catch (err) {
      opErr = err;
      throw err;
    } finally {
      await releaseKey(opKeyInfo.keyId, opSuccess, opSuccess ? undefined : categorizeError(opErr));
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('云雾 API 错误:', response.status, errorText);
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ optimizedPrompt });

  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json({ error: '生成失败，请重试' }, { status: 500 });
  }
}
