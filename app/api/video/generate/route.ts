import { NextRequest, NextResponse } from 'next/server';

const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      model,
      aspectRatio,
      duration,
      startFrameImage,
      endFrameImage,
      negativePrompt
    } = body;

    if (!prompt || !model) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const images = [];
    if (startFrameImage) images.push(startFrameImage);
    if (endFrameImage) images.push(endFrameImage);

    const videoRequest: any = {
      prompt: prompt,
      model: model,
      images: images
    };

    // 根据不同模型添加特定参数
    if (model.includes('sora')) {
      videoRequest.orientation = aspectRatio === '9:16' ? 'portrait' : 'landscape';
      videoRequest.size = 'large';
      videoRequest.duration = duration || 15;
      videoRequest.watermark = false;
      videoRequest.private = true;
    } else if (model.includes('veo')) {
      videoRequest.aspect_ratio = aspectRatio || '16:9';
      videoRequest.enable_upsample = true;
      videoRequest.enhance_prompt = true;
    } else if (model.includes('runway')) {
      videoRequest.promptImage = startFrameImage;
      videoRequest.promptText = prompt;
      videoRequest.watermark = false;
      videoRequest.duration = duration || 10;
      videoRequest.ratio = aspectRatio === '16:9' ? '1280:768' : '768:1280';
    }

    const apiUrl = model.includes('runway')
      ? 'https://allapi.store/runwayml/v1/image_to_video'
      : model.includes('luma')
      ? 'https://allapi.store/luma/generations'
      : 'https://allapi.store/v1/video/create';

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${YUNWU_API_KEY}`
      },
      body: JSON.stringify(videoRequest)
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('云雾API错误:', errorData);
      return NextResponse.json({
        error: '视频生成请求失败',
        details: errorData
      }, { status: 500 });
    }

    const taskData = await apiResponse.json();
    console.log('视频任务创建成功:', JSON.stringify(taskData, null, 2));

    return NextResponse.json({
      success: true,
      taskId: taskData.id,
      status: taskData.status || 'pending',
    });

  } catch (error: any) {
    console.error('视频生成错误:', error);
    return NextResponse.json({
      error: '服务器错误',
      details: error.message
    }, { status: 500 });
  }
}
