import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const MINIMAX_BASE_URL = 'https://api.n1n.ai/minimax/v1';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body;

    if (mode === 'synthesize') {
      // 同步语音合成
      const { text, voiceId, speed = 1, vol = 1, pitch = 0 } = body;
      if (!text || !voiceId) {
        return NextResponse.json({ error: '缺少 text 或 voiceId' }, { status: 400 });
      }

      const res = await fetch(`${MINIMAX_BASE_URL}/t2a_v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'speech-02-hd',
          text,
          voice_setting: { voice_id: voiceId, speed, vol, pitch },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`语音合成失败: ${res.status} ${err}`);
      }

      const data = await res.json();
      const audioUrl = data?.audio_file || data?.data?.audio_file || data?.file_url || data?.url;
      if (!audioUrl) throw new Error(`未获取到音频 URL: ${JSON.stringify(data).slice(0, 200)}`);

      return NextResponse.json({ success: true, audioUrl });

    } else if (mode === 'design') {
      // 音色设计
      const { prompt, previewText, voiceId } = body;
      if (!prompt || !voiceId) {
        return NextResponse.json({ error: '缺少 prompt 或 voiceId' }, { status: 400 });
      }

      const res = await fetch(`${MINIMAX_BASE_URL}/voice_design`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          preview_text: previewText || '你好，这是音色预览。',
          voice_id: voiceId,
          aigc_watermark: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`音色设计失败: ${res.status} ${err}`);
      }

      const data = await res.json();
      return NextResponse.json({ success: true, result: data });

    } else if (mode === 'clone') {
      // 音色快速复刻
      const { fileId, voiceId, text } = body;
      if (!fileId || !voiceId) {
        return NextResponse.json({ error: '缺少 fileId 或 voiceId' }, { status: 400 });
      }

      const res = await fetch(`${MINIMAX_BASE_URL}/voice_clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${YUNWU_API_KEY}`,
        },
        body: JSON.stringify({
          file_id: fileId,
          voice_id: voiceId,
          text: text || '你好，这是音色复刻预览。',
          model: 'speech-02-hd',
          need_noise_reduction: true,
          need_volume_normalization: true,
          aigc_watermark: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`音色复刻失败: ${res.status} ${err}`);
      }

      const data = await res.json();
      return NextResponse.json({ success: true, result: data });

    } else {
      return NextResponse.json({ error: '无效的 mode' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('音频生成错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
