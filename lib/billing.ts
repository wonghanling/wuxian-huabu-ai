import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DeductResult {
  success: boolean;
  error?: string;
  balanceAfter?: number;
}

// 检查用户是否是有效会员
export async function checkMembership(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('is_member, member_expires_at')
    .eq('id', userId)
    .single();

  const result = !!(
    data?.is_member &&
    data?.member_expires_at &&
    new Date(data.member_expires_at) > new Date()
  );
  console.log('[checkMembership]', userId, { is_member: data?.is_member, expires: data?.member_expires_at, error, result });
  return result;
}

// 预扣余额（生成前调用）
// 返回 success=false 表示余额不足
export async function deductBalance(
  userId: string,
  amount: number,
  type: 'image_deduct' | 'video_deduct',
  description: string,
  meta?: Record<string, unknown>,
): Promise<DeductResult> {
  // 用数据库事务保证原子性
  const { data, error } = await supabaseAdmin.rpc('deduct_balance', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_description: description,
    p_meta: meta ?? {},
  });

  if (error) return { success: false, error: error.message };
  if (!data.success) return { success: false, error: data.error };
  return { success: true, balanceAfter: data.balance_after };
}

// 退款（生成失败时调用）
export async function refundBalance(
  userId: string,
  amount: number,
  description: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.rpc('deduct_balance', {
    p_user_id: userId,
    p_amount: -amount, // 负数 = 退款
    p_type: 'refund',
    p_description: description,
    p_meta: meta ?? {},
  });
}

// 获取用户余额
export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single();
  return data?.balance ?? 0;
}

// 会员每日额度检查 + 计数（用于导演引擎、文本、Prompt 优化等会员功能）
export async function requireMemberWithDailyQuota(
  userId: string,
  dailyLimit: number = 100,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!userId) {
    return { ok: false, status: 401, error: '请先登录' };
  }

  const { data: u, error } = await supabaseAdmin
    .from('users')
    .select('is_member, member_expires_at, gem_daily_count, gem_daily_reset_date')
    .eq('id', userId)
    .single();

  if (error) return { ok: false, status: 500, error: '查询用户失败' };

  const isMember = !!(
    u?.is_member &&
    u?.member_expires_at &&
    new Date(u.member_expires_at) > new Date()
  );
  if (!isMember) return { ok: false, status: 402, error: '需要开通会员才能使用此功能' };

  // 每日额度
  const today = new Date().toISOString().slice(0, 10);
  const isNewDay = (u as any)?.gem_daily_reset_date !== today;
  const newCount = isNewDay ? 1 : ((u as any)?.gem_daily_count ?? 0) + 1;
  if (newCount > dailyLimit) {
    return { ok: false, status: 429, error: `已达到每日 ${dailyLimit} 次使用上限，请明天再试` };
  }

  await supabaseAdmin
    .from('users')
    .update({ gem_daily_count: newCount, gem_daily_reset_date: today })
    .eq('id', userId);

  return { ok: true };
}
