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
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });

    console.log('Alipay notify params:', params);

    const signVerified = alipaySdk.checkNotifySign(params);
    if (!signVerified) {
      console.error('Alipay signature verification failed');
      return new NextResponse('fail', { status: 400 });
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const tradeStatus = params.trade_status;

    if (!outTradeNo) {
      return new NextResponse('fail', { status: 400 });
    }

    const { data: orderData } = await supabaseAdmin
      .from('payment_orders')
      .select('*')
      .eq('order_no', outTradeNo)
      .single();

    if (!orderData) {
      console.error('Order not found:', outTradeNo);
      return new NextResponse('fail', { status: 404 });
    }

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 更新订单状态
      await supabaseAdmin
        .from('payment_orders')
        .update({ status: 'paid', trade_no: tradeNo, paid_at: new Date().toISOString() })
        .eq('order_no', outTradeNo);

      if (orderData.user_id) {
        if (
          orderData.order_type === 'membership' ||
          orderData.order_type === 'membership_yearly' ||
          orderData.order_type === 'membership_2yearly'
        ) {
          // 开通/续费会员：按套餐加对应月数
          const MONTHS_BY_PLAN: Record<string, number> = {
            membership: 1,
            membership_yearly: 12,
            membership_2yearly: 24,
          };
          const addMonths = MONTHS_BY_PLAN[orderData.order_type] ?? 1;

          // 读取现有到期时间，若仍在有效期内则叠加，否则从当前时间算起
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('member_expires_at')
            .eq('id', orderData.user_id)
            .single();

          const now = new Date();
          const currentExpires = userData?.member_expires_at
            ? new Date(userData.member_expires_at)
            : null;
          const base = currentExpires && currentExpires > now ? currentExpires : now;
          const expiresAt = new Date(base);
          expiresAt.setMonth(expiresAt.getMonth() + addMonths);

          await supabaseAdmin
            .from('users')
            .update({
              is_member: true,
              member_expires_at: expiresAt.toISOString(),
            })
            .eq('id', orderData.user_id);

          console.log(`Membership activated (${orderData.order_type}, +${addMonths}mo) for user ${orderData.user_id}, expires ${expiresAt.toISOString()}`);
        } else if (orderData.order_type === 'recharge') {
          // 余额充值：增加 balance
          const { data: userData } = await supabaseAdmin
            .from('users')
            .select('balance')
            .eq('id', orderData.user_id)
            .single();

          const currentBalance = userData?.balance || 0;
          await supabaseAdmin
            .from('users')
            .update({ balance: currentBalance + orderData.amount_rmb })
            .eq('id', orderData.user_id);

          console.log(`Balance recharged: +${orderData.amount_rmb} for user ${orderData.user_id}`);
        } else if (orderData.order_type === 'commission_intro') {
          // 委托介绍费:支付成功 → 调服务端 RPC 解锁联系方式(原子事务,幂等)
          const reservationId = orderData.meta?.reservation_id;
          if (reservationId) {
            const { data: unlockRes, error: unlockErr } = await supabaseAdmin
              .rpc('unlock_contact_after_payment', { p_reservation_id: reservationId });
            if (unlockErr) {
              console.error('[commission_intro] 解锁失败:', unlockErr, 'reservation:', reservationId);
            } else {
              console.log('[commission_intro] 解锁结果:', JSON.stringify(unlockRes), 'reservation:', reservationId);
            }
          } else {
            console.error('[commission_intro] 订单缺 reservation_id, order:', orderData.order_no);
          }
        }
      }
    }

    return new NextResponse('success');
  } catch (error: any) {
    console.error('Alipay notify error:', error);
    return new NextResponse('fail', { status: 500 });
  }
}
