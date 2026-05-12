import { NextRequest, NextResponse } from 'next/server';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';

// 云雾 API 配置
const YUNWU_BASE_URL = 'https://api.n1n.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 模型配置映射
const MODEL_MAP: Record<string, { yunwuModel: string; tier: 'advanced' | 'basic' }> = {
  'gpt-5.2': { yunwuModel: 'gpt-5.2', tier: 'advanced' },
  'gpt-5.1-2025-11-13': { yunwuModel: 'gpt-5.1-2025-11-13', tier: 'advanced' },
  'gpt-5.1-thinking-all': { yunwuModel: 'gpt-5.1-thinking-all', tier: 'advanced' },
  'gemini-3-pro-preview': { yunwuModel: 'gemini-3-pro-preview', tier: 'advanced' },
  'gemini-3-flash-preview': { yunwuModel: 'gemini-3-flash-preview', tier: 'advanced' },
  'gemini-2.5-flash-all': { yunwuModel: 'gemini-2.5-flash-all', tier: 'advanced' },
  'gemini-2.5-pro-all': { yunwuModel: 'gemini-2.5-pro-all', tier: 'advanced' },
  'claude-3-5-haiku-20241022': { yunwuModel: 'claude-3-5-haiku-20241022', tier: 'advanced' },
  'claude-3-sonnet-all': { yunwuModel: 'claude-3-sonnet-all', tier: 'advanced' },
  'grok-4.1': { yunwuModel: 'grok-4.1', tier: 'advanced' },
  'grok-4': { yunwuModel: 'grok-4', tier: 'advanced' },
  'gpt-5.1-chat': { yunwuModel: 'gpt-5.1-chat', tier: 'advanced' },
  'grok-3-mini': { yunwuModel: 'grok-3-mini', tier: 'basic' },
  'gemini-2.5-flash-lite-preview-06-17': { yunwuModel: 'gemini-2.5-flash-lite-preview-06-17', tier: 'basic' },
  'gpt-4o-mini': { yunwuModel: 'gpt-4o-mini', tier: 'basic' },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, prompt, imageUrl, stream = false } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证模型
    const modelConfig = MODEL_MAP[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 构建消息内容，支持图片
    let messageContent: any = prompt;
    if (imageUrl) {
      messageContent = [
        {
          type: 'image_url',
          image_url: { url: imageUrl }
        },
        {
          type: 'text',
          text: prompt
        }
      ];
    }

    // 调用云雾 API（账号池）
    const keyInfo = await pickKey('n1n');
    let success = false;
    let caught: any = null;
    let response: Response;
    try {
      response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keyInfo.keyValue}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelConfig.yunwuModel,
          messages: [
            {
              role: 'user',
              content: messageContent,
            },
          ],
          stream: stream,
          max_tokens: 4096,
        }),
      });
      success = response.ok;
    } catch (err) {
      caught = err;
      throw err;
    } finally {
      await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('云雾 API 错误:', response.status, errorText);
      return NextResponse.json(
        { error: `API 错误: ${response.status}` },
        { status: 500 }
      );
    }

    if (stream) {
      // 流式响应
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 非流式响应
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return NextResponse.json({
        content: content,
        model: model,
      });
    }
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
