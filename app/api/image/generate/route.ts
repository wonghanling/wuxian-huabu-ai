import { NextRequest, NextResponse } from 'next/server';

// 云雾 API 配置
const YUNWU_BASE_URL = 'https://allapi.store';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

// 图片模型配置
const IMAGE_MODELS: Record<string, {
  yunwuModel: string;
  apiType: 'chat' | 'midjourney' | 'replicate' | 'image-generation';
  requiresImage?: boolean;
  supportsImage?: boolean;
}> = {
  'stability-ai/sdxl': {
    yunwuModel: 'stability-ai/stable-diffusion-img2img',
    apiType: 'replicate',
    requiresImage: true,
  },
  'mj_imagine': {
    yunwuModel: 'midjourney',
    apiType: 'midjourney',
  },
  'flux.1.1-pro': {
    yunwuModel: 'flux.1.1-pro',
    apiType: 'chat',
  },
  'flux-pro': {
    yunwuModel: 'flux-pro',
    apiType: 'chat',
  },
  'flux-schnell': {
    yunwuModel: 'flux-schnell',
    apiType: 'chat',
  },
  'doubao-seedream-4-5-251128': {
    yunwuModel: 'doubao-seedream-4-5-251128',
    apiType: 'image-generation',
    supportsImage: true,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      model,
      prompt,
      aspectRatio = '1:1',
      imageBase64,
    } = body;

    if (!model || !prompt) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证模型
    const modelConfig = IMAGE_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json({ error: '无效的模型' }, { status: 400 });
    }

    // 检查图生图模型是否提供了图片
    if (modelConfig.requiresImage && !imageBase64) {
      return NextResponse.json({ error: '该模型需要上传一张图片' }, { status: 400 });
    }

    let imageUrl = '';

    // 根据 API 类型选择不同的调用方式
    if (modelConfig.apiType === 'midjourney') {
      // Midjourney 专用接口
      const response = await fetch(`${YUNWU_BASE_URL}/mj/submit/imagine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botType: 'MID_JOURNEY',
          prompt: prompt,
          base64Array: [],
          notifyHook: '',
          state: '',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Midjourney API 错误:', response.status, errorText);
        throw new Error(`API 错误: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 1) {
        throw new Error(data.description || '生成失败');
      }

      const taskId = data.result;

      // 轮询获取结果（最多等待 60 秒）
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`${YUNWU_BASE_URL}/mj/task/${taskId}/fetch`, {
          headers: {
            'Authorization': `Bearer ${YUNWU_API_KEY}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          if (statusData.status === 'SUCCESS' && statusData.imageUrl) {
            imageUrl = statusData.imageUrl;
            break;
          } else if (statusData.status === 'FAILURE') {
            throw new Error('图片生成失败');
          }
        }

        attempts++;
      }

      if (!imageUrl) {
        throw new Error('图片生成超时，请稍后重试');
      }

    } else if (modelConfig.apiType === 'replicate') {
      // Replicate 异步接口（用于 SDXL 等模型）
      const requestBody: any = {
        model: modelConfig.yunwuModel,
        input: {
          prompt: prompt,
        },
      };

      if (modelConfig.requiresImage && imageBase64) {
        requestBody.input.image = imageBase64;
        requestBody.input.prompt_strength = 0.8;
      }

      const response = await fetch(`${YUNWU_BASE_URL}/replicate/v1/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Replicate API 错误:', response.status, errorText);
        throw new Error(`API 错误: ${response.status}`);
      }

      const data = await response.json();
      const predictionId = data.id;

      // 轮询获取结果
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`${YUNWU_BASE_URL}/replicate/v1/predictions/${predictionId}`, {
          headers: {
            'Authorization': `Bearer ${YUNWU_API_KEY}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();

          if (statusData.status === 'succeeded' && statusData.output) {
            if (Array.isArray(statusData.output) && statusData.output.length > 0) {
              imageUrl = statusData.output[0];
            } else if (typeof statusData.output === 'string') {
              imageUrl = statusData.output;
            }
            break;
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.error || '图片生成失败');
          }
        }

        attempts++;
      }

      if (!imageUrl) {
        throw new Error('图片生成超时，请稍后重试');
      }

    } else if (modelConfig.apiType === 'image-generation') {
      // 豆包等模型使用 image generations 接口
      const requestBody: any = {
        model: modelConfig.yunwuModel,
        prompt: prompt,
        n: 1,
        size: aspectRatio || '1:1',
      };

      if ((modelConfig.requiresImage || modelConfig.supportsImage) && imageBase64) {
        requestBody.image = imageBase64;
      }

      const response = await fetch(`${YUNWU_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Image Generation API 错误:', response.status, errorText);
        throw new Error(`API 错误: ${response.status}`);
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        imageUrl = data.data[0].url || data.data[0].b64_json;
        if (data.data[0].b64_json && !imageUrl) {
          imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
        }
      }

      if (!imageUrl) {
        throw new Error('无法解析图片 URL');
      }

    } else {
      // 其他模型使用 chat completions 接口
      const fullPrompt = aspectRatio && aspectRatio !== '1:1'
        ? `${prompt}, aspect ratio ${aspectRatio}`
        : prompt;

      const response = await fetch(`${YUNWU_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelConfig.yunwuModel,
          messages: [
            {
              role: 'user',
              content: fullPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('云雾 API 错误:', response.status, errorText);
        throw new Error(`API 错误: ${response.status}`);
      }

      const data = await response.json();
      const messageContent = data.choices?.[0]?.message?.content;

      if (!messageContent) {
        throw new Error('未能生成图片');
      }

      // 解析图片 URL
      if (typeof messageContent === 'string') {
        const markdownMatch = messageContent.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
        if (markdownMatch) {
          imageUrl = markdownMatch[1];
        } else if (messageContent.startsWith('http://') || messageContent.startsWith('https://')) {
          imageUrl = messageContent;
        } else if (messageContent.startsWith('data:image/')) {
          imageUrl = messageContent;
        } else {
          const urlMatch = messageContent.match(/https?:\/\/[^\s)]+/);
          if (urlMatch) {
            imageUrl = urlMatch[0];
          }
        }
      }

      if (!imageUrl) {
        throw new Error('无法解析图片 URL');
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      model: model,
      prompt: prompt,
    });
  } catch (error: any) {
    console.error('Image API error:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}
