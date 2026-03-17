import { NextRequest, NextResponse } from 'next/server';

const YUNWU_BASE_URL = process.env.YUNWU_BASE_URL || 'https://yunwu.ai';
const YUNWU_API_KEY = process.env.YUNWU_API_KEY!;

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');
  if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

  const res = await fetch(`${YUNWU_BASE_URL}/mj/task/${taskId}/fetch`, {
    headers: { 'Authorization': `Bearer ${YUNWU_API_KEY}` },
  });

  if (!res.ok) return NextResponse.json({ status: 'pending' });

  const data = await res.json();

  if (data.status === 'SUCCESS' && data.imageUrl) {
    return NextResponse.json({ status: 'completed', imageUrl: data.imageUrl });
  } else if (data.status === 'FAILURE') {
    return NextResponse.json({ status: 'failed', error: data.failReason || '生成失败' });
  } else {
    return NextResponse.json({ status: 'pending', progress: data.progress });
  }
}
