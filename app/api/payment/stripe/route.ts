import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { randomUUID } from 'crypto';
import { findUsdTier, findUsdMembership } from '@/lib/usd-recharge';

// ============================================================
// Stripe 美元充值下单（Checkout Sessions，托管收银台）
//
// 为什么是 Checkout Sessions:
//   Payment Links   无法可靠绑定当前登录用户，自动入账认不出人
//   Elements        要自建支付表单，开发量大得多
//   Billing         面向订阅，这里是一次性充值
//
// 与支付宝并存、互不影响:两者各自建单、各自回调，都往 users.balance 加钱。
// 记账货币只有人民币，美元只是收款单位 —— 库里不存第二个余额字段。
// ============================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 固定 apiVersion:不传的话 SDK 会用账户默认版本，那个版本可能在 Stripe
// 后台被改或随 SDK 升级漂移，导致行为在没改代码的情况下变化。
// 写死则升级由我们主动做、主动测。
const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

export async function POST(req: NextRequest) {
  try {
    // 密钥在请求内检查并初始化 —— 避免模块加载期缺 key 直接把路由拖崩
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const appUrl = process.env.APP_URL;
    if (!secretKey || !appUrl) {
      console.error('[stripe] 缺少 STRIPE_SECRET_KEY 或 APP_URL');
      return NextResponse.json({ error: '支付服务暂不可用' }, { status: 503 });
    }
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });

    // 认证与支付宝一致:从 Bearer token 解出用户，不信请求体里的 userId
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

    // 两类订单:余额充值(传 usd)与会员(传 plan)。
    // 金额一律由服务端按表决定 —— 不接受前端传值，否则可用 $0.01 换 ¥6400。
    const plan: string = body?.plan || 'recharge';

    let orderType: string;
    let usdAmount: number;
    let cnyAmount: number;
    let productName: string;
    let productDesc: string;

    if (plan === 'recharge') {
      const tier = findUsdTier(Number(body?.usd));
      if (!tier) {
        return NextResponse.json({ error: '无效的充值档位' }, { status: 400 });
      }
      orderType = 'recharge';
      usdAmount = tier.usd;
      cnyAmount = tier.cny;
      productName = `Filmavo 余额充值 ¥${tier.cny}`;
      productDesc = tier.bonus > 0
        ? `基础 ¥${tier.base} + 赠送 ¥${tier.bonus}，共到账 ¥${tier.cny}`
        : `支付后账户余额增加 ¥${tier.cny}`;
    } else {
      const m = findUsdMembership(plan);
      if (!m) {
        return NextResponse.json({ error: '无效的套餐' }, { status: 400 });
      }
      orderType = m.plan;
      usdAmount = m.usd;
      cnyAmount = m.cny;
      productName = `Filmavo 会员${m.label}`;
      productDesc = `开通后会员有效期延长 ${m.months} 个月`;
    }

    // randomUUID 而非 Date.now()+Math.random():后者并发下有碰撞可能，
    // 而订单号是 webhook 幂等去重的依据，撞号会导致漏入账。
    const orderId = `USD_${randomUUID()}`;

    // 先建单后下单:webhook 到达时靠 order_no 回查用户、订单类型与金额。
    // 这些值只认库里的，不认 Stripe 回传值。
    const { error: orderError } = await supabaseAdmin
      .from('payment_orders')
      .insert({
        order_no: orderId,
        user_id: user.id,
        order_type: orderType,
        amount_rmb: cnyAmount,
        status: 'pending',
        payment_method: 'stripe',
        // 存下应收的美元金额与币种，webhook 里要拿它核验实付是否相符
        meta: { usd: usdAmount, currency: 'usd' },
      });

    if (orderError) {
      console.error('[stripe] 建单失败:', orderError);
      return NextResponse.json({ error: '创建订单失败' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // 只收卡:其它方式(如银行转账)到账慢，不适合即时充值
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            // Stripe 以最小货币单位计价;$6.5 这类小数要四舍五入到分
            unit_amount: Math.round(usdAmount * 100),
            product_data: { name: productName, description: productDesc },
          },
          quantity: 1,
        },
      ],
      // webhook 的线索来源。两处都放:不同事件类型下 client_reference_id 与
      // metadata 的可得性不同，多一份冗余能少一类查不到单的故障。
      // user_id 用于交叉校验(与库里查出的比对)，挡住订单号被猜到后的越权入账。
      client_reference_id: orderId,
      metadata: { order_no: orderId, user_id: user.id },
      // APP_URL 而非 Host 头 —— Host 可伪造，攻击者能把回跳指向自己的域名
      success_url: `${appUrl}/pricing?paid=1&order=${orderId}&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=1&order=${orderId}`,
    });

    // 回写 session id:对账时用它在 Stripe 后台定位这笔交易
    await supabaseAdmin
      .from('payment_orders')
      .update({
        trade_no: session.id,
        meta: { usd: usdAmount, currency: 'usd', session_id: session.id },
      })
      .eq('order_no', orderId);

    return NextResponse.json({
      success: true,
      orderId,
      checkoutUrl: session.url,
      usd: usdAmount,
      cny: cnyAmount,
    });
  } catch (error: any) {
    // 只回通用文案:Stripe 的原始报错可能含账户配置细节
    console.error('[stripe] 下单异常:', error?.message || error);
    return NextResponse.json({ error: '支付下单失败，请稍后重试' }, { status: 500 });
  }
}
