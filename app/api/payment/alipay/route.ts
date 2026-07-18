import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AlipaySdk } from 'alipay-sdk';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APP_ID!,
  privateKey: process.env.ALIPAY_PRIVATE_KEY!,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
  gateway: 'https://openapi.alipay.com/gateway.do',
  timeout: 5000,
  camelcase: true,
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '无效的认证令牌' }, { status: 401 });
    }

    const body = await req.json();
    const { plan, amount, reservationId } = body;
    // plan: 'recharge' | 'membership' | 'membership_yearly' | 'membership_2yearly'
    //       | 'commission_intro'(委托介绍费,需带 reservationId)
    const ALLOWED_PLANS = ['recharge', 'membership', 'membership_yearly', 'membership_2yearly', 'commission_intro'];
    if (!plan || !amount || !ALLOWED_PLANS.includes(plan)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 介绍费:金额和归属由服务端按预留校验,不信任前端传的 amount
    let orderAmount = amount;
    let orderMeta: Record<string, unknown> | null = null;
    if (plan === 'commission_intro') {
      if (!reservationId) {
        return NextResponse.json({ error: '缺少预留ID' }, { status: 400 });
      }
      // 校验:该预留存在、属于当前登录创作者、待付款、未过期
      const { data: res } = await supabaseAdmin
        .from('project_reservations')
        .select('id, creator_id, status, amount_cents, pay_deadline')
        .eq('id', reservationId)
        .single();
      if (!res) return NextResponse.json({ error: '预留不存在' }, { status: 404 });
      if (res.creator_id !== user.id) return NextResponse.json({ error: '无权支付该预留' }, { status: 403 });
      if (res.status !== 'awaiting_payment') return NextResponse.json({ error: '该预留不可支付' }, { status: 400 });
      if (res.pay_deadline && new Date(res.pay_deadline) < new Date()) {
        return NextResponse.json({ error: '已超过付款期限' }, { status: 400 });
      }
      // 金额以数据库为准(服务端计算,防前端篡改)
      orderAmount = (res.amount_cents ?? 990) / 100;
      orderMeta = { reservation_id: reservationId };
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        order_no: orderId,
        user_id: user.id,
        order_type: plan,
        amount_rmb: orderAmount,
        status: 'pending',
        payment_method: 'alipay',
        meta: orderMeta,
      });

    if (orderError) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json({ error: '创建订单失败: ' + (orderError.message || '') }, { status: 500 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const SUBJECT_BY_PLAN: Record<string, string> = {
      membership: 'Filmavo 会员月付',
      membership_yearly: 'Filmavo 会员年付',
      membership_2yearly: 'Filmavo 会员两年付',
      recharge: 'Filmavo 余额充值',
      commission_intro: 'Filmavo 项目介绍服务费',
    };
    const subject = SUBJECT_BY_PLAN[plan] ?? 'Filmavo 余额充值';

    const paymentForm = await alipaySdk.pageExec('alipay.trade.page.pay', {
      bizContent: {
        outTradeNo: orderId,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        totalAmount: orderAmount.toFixed(2),
        subject,
      },
      returnUrl: `${baseUrl}/payment/success?orderId=${orderId}`,
      notifyUrl: `${baseUrl}/api/payment/alipay/notify`,
    });

    return NextResponse.json({ success: true, orderId, paymentForm, amount: orderAmount, order_type: plan });
  } catch (error: any) {
    console.error('Payment API error:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

// 同步回调
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => { params[key] = value; });

    const signVerified = alipaySdk.checkNotifySign(params);
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (!signVerified) {
      return NextResponse.redirect(`${baseUrl}/payment/success?status=error`);
    }

    const outTradeNo = params.out_trade_no;
    return NextResponse.redirect(`${baseUrl}/payment/success?orderId=${outTradeNo}`);
  } catch (error: any) {
    console.error('Payment callback error:', error);
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return NextResponse.redirect(`${protocol}://${host}/payment/success?status=error`);
  }
}
