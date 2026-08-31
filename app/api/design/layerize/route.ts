import { NextRequest, NextResponse } from 'next/server';
import { fal as falSingleton, createFalClient } from '@fal-ai/client';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { deductBalance, refundBalance } from '@/lib/billing';

export const maxDuration = 300;

falSingleton.config({ credentials: process.env.FAL_KEY! });

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRICE = 0.7;

// 把背景图转存到 Supabase，返回永久 URL
async function mirrorBackground(sourceUrl: string, userId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载背景图失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `design/${userId}/${Date.now()}-bg.png`;
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
    const { imageUrl, userId, prompt } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: '缺少图片' }, { status: 400 });
    }

    // 扣费
    if (userId) {
      const deduct = await deductBalance(
        userId, PRICE, 'image_deduct', '海报文字编辑', { model: 'layerize-text' }
      );
      if (!deduct.success) {
        return NextResponse.json({ error: deduct.error || '余额不足' }, { status: 402 });
      }
    }

    // 提交 fal-ai/ideogram/v3/layerize-text
    const keyInfo = await pickKey('fal');
    const fal = createFalClient({ credentials: keyInfo.keyValue });
    let falSuccess = false;
    let falErr: any = null;
    try {
      const input: Record<string, unknown> = { image_url: imageUrl };
      if (prompt) input.prompt = prompt;

      const submitted = await fal.queue.submit('fal-ai/ideogram/v3/layerize-text', { input });
      const requestId = submitted.request_id;
      if (!requestId) throw new Error('fal 未返回 requestId');
      falSuccess = true;
      return NextResponse.json({
        success: true,
        pending: true,
        requestId,
        endpoint: 'fal-ai/ideogram/v3/layerize-text',
      });
    } catch (e) {
      falErr = e;
      throw e;
    } finally {
      await releaseKey(keyInfo.keyId, falSuccess, falSuccess ? undefined : categorizeError(falErr));
    }
  } catch (error: any) {
    console.error('[design/layerize] error:', error);
    if (body?.userId) {
      await refundBalance(body.userId, PRICE, '海报文字编辑失败退款', { model: 'layerize-text' });
    }
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
