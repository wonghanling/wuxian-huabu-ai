import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const maxDuration = 300;

falSingleton.config({ credentials: process.env.FAL_KEY! });

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 下载透明 PNG 并转存 Supabase（保留 alpha 通道，存 png）
async function mirrorPng(sourceUrl: string, userId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `design/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  const { error } = await supabaseAdmin.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(`转存失败: ${error.message}`);
  const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: '缺少图片' }, { status: 400 });
    }

    // 免费功能，不扣费

    // fal-ai/birefnet/v2：异步提交
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let falSuccess = false;
    let falErr: any = null;
    try {
      const submitted = await fal.queue.submit('fal-ai/birefnet/v2', {
        input: { image_url: imageUrl },
      });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal 未返回 requestId');
      falSuccess = true;
      return NextResponse.json({ success: true, pending: true, requestId, endpoint: 'fal-ai/birefnet/v2' });
    } catch (e) {
      falErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
    }
  } catch (error: any) {
    console.error('[design/extract] error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
