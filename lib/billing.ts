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
  const { data } = await supabaseAdmin
    .from('users')
    .select('is_member, member_expires_at')
    .eq('id', userId)
    .single();

  return !!(
    data?.is_member &&
    data?.member_expires_at &&
    new Date(data.member_expires_at) > new Date()
  );
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
