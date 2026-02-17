import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_VIDEO_SKILL } from './skill-content';

export async function POST(request: NextRequest) {
  try {
    const { userInput, duration, ratio, uploadedImage } = await request.json();

    if (!userInput) {
      return NextResponse.json(
        { error: '请提供视频描述' },
        { status: 400 }
      );
    }

    // 使用通用视频提示词 Skill 作为系统提示词
    const systemPrompt = UNIVERSAL_VIDEO_SKILL;

    // 构建用户消息
    let userMessage;

    if (uploadedImage) {
      // 如果有图片，使用多模态格式
      userMessage = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: uploadedImage.split(',')[1], // 移除 data:image/jpeg;base64, 前缀
          },
        },
        {
          type: 'text',
          text: `请基于上面的参考图片，为以下视频需求生成专业的提示词：

视频描述：${userInput}
时长：${duration}
比例：${ratio}

请分析图片中的人物、场景、构图、光影等元素，结合用户描述生成连贯的视频提示词。
请直接输出可用的提示词，不要解释。`,
        },
      ];
    } else {
      // 纯文本模式
      userMessage = `请为以下视频需求生成专业的提示词：

视频描述：${userInput}
时长：${duration}
比例：${ratio}

请直接输出可用的提示词，不要解释。`;
    }

    // TODO: 调用第三方聚合API（等待用户提供API配置）
    // 需要在 .env.local 中配置：
    // API_ENDPOINT=你的API地址
    // API_KEY=你的API密钥
    // MODEL_NAME=claude-3-5-sonnet-20241022

    // 暂时返回模拟数据
    const mockPrompt = `【基于 Seedance 2.0 Skill 的专业提示词】

${uploadedImage ? '✓ 已分析参考图片' : ''}
视频主题：${userInput}
时长：${duration}
比例：${ratio}

${duration === '13-15秒' || duration === '>15秒' ? `0-3秒：镜头从远处缓缓推进，展现整体场景氛围，光线柔和，色调温暖
4-8秒：特写主体细节，镜头平稳跟随，突出关键元素
9-12秒：环绕镜头展示全貌，动作流畅自然
13-15秒：镜头拉远定格，余韵悠长` : `镜头从远处缓缓推进，展现整体场景氛围，特写主体细节，镜头平稳跟随，突出关键元素`}

禁止：
- 任何字幕、LOGO或水印
- 画面全部片段都不要出现文字

---
注：当前返回模拟数据。
Skill 已内置（${systemPrompt.length} 字符）。
${uploadedImage ? '图片已接收，' : ''}配置 API 后将使用 Claude 生成专业提示词。`;

    return NextResponse.json({
      optimizedPrompt: mockPrompt,
    });

    /*
    // 真实API调用代码（配置好 .env.local 后取消注释）
    const apiEndpoint = process.env.API_ENDPOINT; // 如: https://api.openrouter.ai/api/v1/chat/completions
    const apiKey = process.env.API_KEY;
    const modelName = process.env.MODEL_NAME || 'claude-3-5-sonnet-20241022';

    if (!apiEndpoint || !apiKey) {
      throw new Error('API 配置缺失，请检查 .env.local 文件');
    }

    const messages: any[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ];

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API 调用失败:', errorData);
      throw new Error(`API 调用失败: ${response.status}`);
    }

    const data = await response.json();
    const optimizedPrompt = data.choices[0].message.content;

    return NextResponse.json({
      optimizedPrompt,
    });
    */
  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json(
      { error: '生成失败，请重试' },
      { status: 500 }
    );
  }
}
