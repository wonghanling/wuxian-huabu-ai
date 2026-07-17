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

// 记录待审核退款(生成失败但可能需退款,人工核对上游是否扣费后再退)
// failType: 'server_error'(500,可自动退) | 'pre_submit'(未提交上游,可自动退)
//           | 'content_policy'(审核不过,建议不退) | 'no_media'(未产出,建议退) | 'other'
// 返回是否已自动退款(server_error/pre_submit 会顺带自动退)
export async function recordRefundReview(params: {
  userId: string;
  amount: number;
  model?: string;
  failType: 'server_error' | 'pre_submit' | 'content_policy' | 'no_media' | 'other';
  failReason?: string;
  meta?: Record<string, unknown>;
  description?: string;
}): Promise<{ autoRefunded: boolean }> {
  const { userId, amount, model, failType, failReason, meta } = params;
  // 确定处理建议:500/未提交 → 自动退(上游未收费);审核不过 → 建议不退;未产出 → 建议退
  const autoRefund = failType === 'server_error' || failType === 'pre_submit';
  const suggested = autoRefund ? 'auto_refunded'
    : failType === 'no_media' ? 'suggest_refund'
    : failType === 'content_policy' ? 'suggest_reject'
    : 'review';
  const refundStatus = autoRefund ? 'refunded' : 'pending';
  try {
    // 自动退的先退款
    if (autoRefund && amount > 0) {
      await refundBalance(userId, amount, params.description || `生成失败自动退款(${failType})`, { model, failType, ...meta });
    }
    // 记一条待审核/已退记录
    await supabaseAdmin.from('refund_reviews').insert({
      user_id: userId,
      amount,
      model: model ?? null,
      fail_type: failType,
      fail_reason: failReason ?? null,
      suggested,
      upstream_charged: autoRefund ? false : null,
      refund_status: refundStatus,
      meta: meta ?? {},
    });
  } catch (e) {
    // 记账失败不影响主流程(旁路)
    console.error('[recordRefundReview] 记录失败:', e);
  }
  return { autoRefunded: autoRefund };
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
