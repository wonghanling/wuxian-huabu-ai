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

/** 非会员使用文本类功能的单次价格（元）。文本调用的上游成本只有几分钱，
 *  这个数主要是防滥用，不指望靠它赚钱 —— 目标是让人先用上。 */
export const TEXT_FEATURE_PRICE = 0.1;

// 文本类功能的准入（导演引擎、文本卡、Prompt 优化等）
//
// 原先是"必须开会员"，非会员直接 402 挡掉。问题是这挡掉的正是"只想试一次"
// 的人 —— 而文本调用成本极低，为它设会员门槛不划算。
//
// 现在改成两条路：
//   会员    免费，仍受每日额度限制（防脚本滥用）
//   非会员  从余额扣 TEXT_FEATURE_PRICE 元／次，不限每日次数
//           （已按次付费，再限次数没道理）
//
// 9 个调用方（chat、gem/* 七个、optimize-prompt）都不必改 —— 函数签名与
// 返回结构未变，只是非会员这条分支从"拒绝"变成"扣费放行"。
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

  // 非会员:按次扣余额。走与图片/视频同一个 deduct_balance 事务，
  // 余额不足时的提示也一致，用户不必理解"会员"这个概念就能用。
  if (!isMember) {
    const deduct = await deductBalance(
      userId,
      TEXT_FEATURE_PRICE,
      'image_deduct',            // 复用现有的账目类型，避免改数据库枚举
      `文本功能 ¥${TEXT_FEATURE_PRICE}`,
      { kind: 'text_feature' },  // 靠 meta 区分，日后对账能筛出来
    );
    if (!deduct.success) {
      return {
        ok: false,
        status: 402,
        error: deduct.error || `余额不足，本次需 ¥${TEXT_FEATURE_PRICE}`,
      };
    }
    // 已付费就不再限每日次数
    return { ok: true };
  }

  // 会员:免费，但保留每日额度作为滥用保护
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
