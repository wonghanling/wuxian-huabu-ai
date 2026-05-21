import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(): string {
  return 'AURA-' + randomBytes(3).toString('hex').toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }

    // 检查该用户是否已经领取过注册礼包
    const { data: existing } = await supabaseAdmin
      .from('promo_codes')
      .select('id, used_by_user_id')
      .eq('created_for_user_id', user.id)
      .single();

    if (existing) {
      if (existing.used_by_user_id) {
        return NextResponse.json({ error: '您已领取并使用过注册礼包' }, { status: 400 });
      }
      // 已生成但未使用，直接激活
      return await activateMembership(user.id, existing.id, 30);
    }

    // 生成唯一码
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { data: conflict } = await supabaseAdmin
        .from('promo_codes')
        .select('id')
        .eq('code', code)
        .single();
      if (!conflict) break;
      code = generateCode();
      attempts++;
    }

    // 创建优惠码记录
    const { data: promo, error: insertError } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        code,
        type: 'membership',
        days: 30,
        created_for_user_id: user.id,
      })
      .select()
      .single();

    if (insertError || !promo) {
      return NextResponse.json({ error: '领取失败，请重试' }, { status: 500 });
    }

    return await activateMembership(user.id, promo.id, 30);
  } catch (err) {
    console.error('promo claim error:', err);
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 });
  }
}

async function activateMembership(userId: string, promoId: string, days: number) {
  const now = new Date();

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('is_member, member_expires_at, balance')
    .eq('id', userId)
    .single();

  const currentExpiry = userData?.is_member && userData?.member_expires_at && new Date(userData.member_expires_at) > now
    ? new Date(userData.member_expires_at)
    : now;
  const newExpiry = new Date(currentExpiry);
  newExpiry.setDate(newExpiry.getDate() + days);

  await supabaseAdmin
    .from('promo_codes')
    .update({ used_by_user_id: userId, used_at: now.toISOString() })
    .eq('id', promoId);

  await supabaseAdmin
    .from('users')
    .update({ is_member: true, member_expires_at: newExpiry.toISOString(), updated_at: now.toISOString() })
    .eq('id', userId);

  await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'promo',
      amount: 0,
      balance_after: (userData as any)?.balance ?? 0,
      description: `注册礼包：激活${days}天会员`,
      meta: { promo_id: promoId, source: 'signup_gift' },
    });

  return NextResponse.json({
    message: `🎉 已激活 ${days} 天会员，有效期至 ${newExpiry.toLocaleDateString('zh-CN')}`,
    expiresAt: newExpiry.toISOString(),
  });
}
