import { NextRequest, NextResponse } from 'next/server';
import { refundBalance } from '@/lib/billing';
import { calcImagePrice } from '@/lib/pricing';

export async function POST(req: NextRequest) {
  try {
    const { userId, model, imageQuality } = await req.json();
    if (!userId || !model) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    const refundKey = model === 'nano-banana-pro'
      ? (imageQuality === '4k' ? 'nano-banana-pro-4k' : 'nano-banana-pro-2k')
      : model === 'nano-banana-pro-multi'
      ? (imageQuality === '4k' ? 'nano-banana-pro-multi-4k' : 'nano-banana-pro-multi-2k')
      : model;

    const price = calcImagePrice(refundKey);
    await refundBalance(userId, price, `图片生成失败退款 - ${model}`, { model });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '退款失败' }, { status: 500 });
  }
}
