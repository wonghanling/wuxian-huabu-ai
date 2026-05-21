import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: '请输入优惠码' }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 查询优惠码
    const { data: promo, error: promoError } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (promoError || !promo) {
      return NextResponse.json({ error: '优惠码不存在或已失效' }, { status: 400 });
    }

    if (promo.used_by_user_id) {
      return NextResponse.json({ error: '该优惠码已被使用' }, { status: 400 });
    }

    if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
      return NextResponse.json({ error: '优惠码已过期' }, { status: 400 });
    }

    // 查询当前用户会员状态
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('is_member, member_expires_at')
      .eq('id', user.id)
      .single();

    // 计算新的到期时间（在现有到期时间基础上延长，或从现在开始）
    const now = new Date();
    const currentExpiry = userData?.is_member && userData?.member_expires_at && new Date(userData.member_expires_at) > now
      ? new Date(userData.member_expires_at)
      : now;
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + (promo.days ?? 30));

    // 标记优惠码已使用
    await supabaseAdmin
      .from('promo_codes')
      .update({ used_by_user_id: user.id, used_at: now.toISOString() })
      .eq('id', promo.id);

    // 激活会员
    await supabaseAdmin
      .from('users')
      .update({ is_member: true, member_expires_at: newExpiry.toISOString(), updated_at: now.toISOString() })
      .eq('id', user.id);

    // 写流水记录
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'promo',
        amount: 0,
        balance_after: userData ? (userData as any).balance ?? 0 : 0,
        description: `兑换优惠码 ${normalizedCode}，激活${promo.days ?? 30}天会员`,
        meta: { code: normalizedCode, promo_id: promo.id },
      });

    return NextResponse.json({
      message: `兑换成功！已激活 ${promo.days ?? 30} 天会员，有效期至 ${newExpiry.toLocaleDateString('zh-CN')}`,
    });
  } catch (err) {
    console.error('promo redeem error:', err);
    return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 });
  }
}
