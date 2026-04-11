import { NextRequest, NextResponse } from 'next/server';

const FAL_KEY = process.env.FAL_KEY!;
const FAL_REST = 'https://rest.fal.ai';

async function handler(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // fal client 会把路径拼在 proxyUrl 后面
    const targetPath = url.pathname.replace('/api/fal/proxy', '') + url.search;
    const targetUrl = `${FAL_REST}${targetPath}`;

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
