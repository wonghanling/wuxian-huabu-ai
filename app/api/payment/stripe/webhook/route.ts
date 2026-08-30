import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// ============================================================
// Stripe webhook：支付成功后给余额入账
//
// 安全前提（缺一不可）:
//   1. 验签 —— 不验签任何人都能 POST 这个地址给自己充钱
//   2. 金额与用户只认数据库 —— Stripe 回传的 metadata 不可作为入账依据
//   3. 核验币种与实付金额 —— 防止会话被改价后仍按原档位入账
//   4. 幂等 —— Stripe 明确会重复投递，重复入账等于白送钱
//
// 入账走 credit_balance RPC:它在单条 UPDATE 里加钱并按 order_id 去重。
// 现有支付宝回调是「读余额→加→写回」三步，并发下会互相覆盖 —— 那是既有
// 隐患，本文件不沿用那个写法。
// ============================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] 缺少 STRIPE_SECRET_KEY 或 STRIPE_WEBHOOK_SECRET');
    return new NextResponse('service unavailable', { status: 503 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

  // 验签必须用原始 body —— 用 req.json() 解析过再序列化，签名就对不上了
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('missing signature', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    // 验签失败就是伪造或密钥不匹配，直接拒
    console.error('[stripe-webhook] 验签失败:', err?.message);
    return new NextResponse('invalid signature', { status: 400 });
  }

  // 只处理支付完成。其它事件返回 200，否则 Stripe 会一直重试
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    // 订单号:client_reference_id 与 metadata 都取，任一可得即可
    const orderNo = session.client_reference_id || session.metadata?.order_no;
    if (!orderNo) {
      console.error('[stripe-webhook] 事件里没有订单号, session:', session.id);
      return NextResponse.json({ received: true });   // 无从处理，但别让它重投
    }

    // 用户与入账金额一律从库里读，不用 Stripe 回传的值
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('payment_orders')
      .select('order_no, user_id, amount_rmb, status, order_type, meta')
      .eq('order_no', orderNo)
      .single();

    if (orderErr || !order) {
      console.error('[stripe-webhook] 订单不存在:', orderNo);
      return NextResponse.json({ received: true });
    }

    // 交叉校验:下单时存进 metadata 的 user_id 应与库里一致。
    // 不一致说明订单号被冒用，拒绝入账。
    const claimedUserId = session.metadata?.user_id;
    if (claimedUserId && claimedUserId !== order.user_id) {
      console.error('[stripe-webhook] user_id 不匹配, 订单:', orderNo);
      return NextResponse.json({ received: true });
    }

    // 核验币种与实付金额:会话若被改价，实付会与下单时的档位不符。
    // amount_total 以最小货币单位计(美分)。
    const expectedUsd = Number(order.meta?.usd);
    const paidCurrency = session.currency;
    const paidTotal = session.amount_total;

    if (paidCurrency !== 'usd') {
      console.error(`[stripe-webhook] 币种不符: 期望 usd 实为 ${paidCurrency}, 订单 ${orderNo}`);
      return NextResponse.json({ received: true });
    }
    if (!expectedUsd || paidTotal !== Math.round(expectedUsd * 100)) {
      console.error(
        `[stripe-webhook] 金额不符: 期望 ${expectedUsd} USD 实付 ${paidTotal} 分, 订单 ${orderNo}`
      );
      return NextResponse.json({ received: true });
    }

    // 支付状态:未付款的会话不入账
    if (session.payment_status !== 'paid') {
      console.warn(`[stripe-webhook] 会话未付款(${session.payment_status}), 订单 ${orderNo}`);
      return NextResponse.json({ received: true });
    }

    // 原子入账 + 按 order_no 幂等。重复投递时 RPC 直接返回 already_done，
    // 不会二次加钱。
    const { data: credited, error: creditErr } = await supabaseAdmin.rpc('credit_balance', {
      p_user_id: order.user_id,
      p_order_id: order.order_no,
      p_amount_rmb: order.amount_rmb,
      p_channel: 'stripe',
      p_paid_currency: 'usd',
      p_paid_amount: expectedUsd,
      p_meta: { session_id: session.id, payment_intent: session.payment_intent },
    });

    if (creditErr || !credited?.success) {
      // 返回 500 让 Stripe 重投 —— 幂等保证重投不会重复加钱
      console.error('[stripe-webhook] 入账失败:', creditErr?.message || credited?.error);
      return new NextResponse('credit failed', { status: 500 });
    }

    // 订单状态:入账成功后才标 paid
    await supabaseAdmin
      .from('payment_orders')
      .update({
        status: 'paid',
        trade_no: session.id,
        paid_at: new Date().toISOString(),
      })
      .eq('order_no', orderNo);

    if (credited.already_done) {
      console.log(`[stripe-webhook] 重复投递已忽略: ${orderNo}`);
    } else {
      console.log(
        `[stripe-webhook] 入账成功: +¥${order.amount_rmb} (${expectedUsd} USD) ` +
        `user=${order.user_id} 余额=${credited.balance_after}`
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    // 未知异常返回 500 让 Stripe 重投，幂等兜底
    console.error('[stripe-webhook] 处理异常:', error?.message || error);
    return new NextResponse('error', { status: 500 });
  }
}
