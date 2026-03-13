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
    const { plan, amount } = body;
    // plan: 'recharge'（余额充值）| 'membership'（会员）
    if (!plan || !amount) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        order_no: orderId,
        user_id: user.id,
        order_type: plan,
        amount_rmb: amount,
        status: 'pending',
        payment_method: 'alipay',
      });

    if (orderError) {
      console.error('Failed to create order:', orderError);
      return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const subject = plan === 'membership' ? 'Aura Canvas 会员月付' : 'Aura Canvas 余额充值';

    const paymentForm = await alipaySdk.pageExec('alipay.trade.page.pay', {
      bizContent: {
        outTradeNo: orderId,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        totalAmount: amount.toFixed(2),
        subject,
      },
      returnUrl: `${baseUrl}/payment/success`,
      notifyUrl: `${baseUrl}/api/payment/alipay/notify`,
    });

    return NextResponse.json({ success: true, orderId, paymentForm, amount, order_type: plan });
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
