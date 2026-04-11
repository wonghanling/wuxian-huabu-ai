import { NextRequest, NextResponse } from 'next/server';

const FAL_KEY = process.env.FAL_KEY!;

async function handler(req: NextRequest) {
  try {
    const targetUrl = req.headers.get('x-fal-target-url');
    if (!targetUrl) {
      return NextResponse.json({ error: '缺少 x-fal-target-url' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'Authorization': `Key ${FAL_KEY}`,
    };
    const contentType = req.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;

    const body = req.method !== 'GET' ? await req.arrayBuffer() : undefined;

    const falRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const resContentType = falRes.headers.get('content-type') || '';
    if (resContentType.includes('application/json')) {
      const data = await falRes.json();
      return NextResponse.json(data, { status: falRes.status });
    }
    const data = await falRes.arrayBuffer();
    return new NextResponse(data, {
      status: falRes.status,
      headers: { 'Content-Type': resContentType },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
