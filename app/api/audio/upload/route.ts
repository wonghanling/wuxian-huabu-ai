import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const MINIMAX_BASE_URL = 'https://api.n1n.ai/minimax/v1';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const purpose = formData.get('purpose') as string; // 'voice_clone' 或 'prompt_audio'

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    // 创建新的 FormData 发送给 MiniMax
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('purpose', purpose || 'voice_clone');

    const res = await fetch(`${MINIMAX_BASE_URL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YUNWU_API_KEY}`,
      },
      body: uploadFormData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`文件上传失败: ${res.status} ${err}`);
    }

    const data = await res.json();
    const fileId = data?.file?.file_id;
    if (!fileId) throw new Error(`未获取到 file_id: ${JSON.stringify(data).slice(0, 200)}`);

    return NextResponse.json({ success: true, fileId, data });

  } catch (error: any) {
    console.error('音频上传错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
