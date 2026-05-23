import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { ok: false, res: NextResponse.json({ error: '未授权' }, { status: 401 }) };
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { ok: false, res: NextResponse.json({ error: '无效认证' }, { status: 401 }) };
  if (!isAdmin(user.email)) return { ok: false, res: NextResponse.json({ error: '无权限' }, { status: 403 }) };
  return { ok: true as const };
}

// GET /api/admin/api-pool/stats?range=1h|24h|7d
// 返回：
//   总览: 过去时间段内各 provider 的总调用、成功率、平均耗时
//   每个 key 在时间段内的调用次数、成功率
//   最近 50 条错误日志（error_type + error_msg）
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '24h';

    const hoursMap: Record<string, number> = { '1h': 1, '24h': 24, '7d': 168 };
    const hours = hoursMap[range] ?? 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // 1. 所有 key（用于统计每个 key）
    const { data: keys } = await supabaseAdmin
      .from('api_keys')
      .select('id, provider, key_name, key_value, status, current_concurrency, max_concurrency, total_calls, success_count, failure_count, last_success_at, last_failure_at')
      .order('provider', { ascending: true });

    // 2. 在时间范围内的日志按 provider 分组聚合
    const { data: logs, error: logsErr } = await supabaseAdmin
      .from('api_call_logs')
      .select('id, provider, key_id, duration_ms, success, error_type, error_msg, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000);

    if (logsErr) throw new Error(logsErr.message);

    // 按 provider 统计
    const byProvider: Record<string, { total: number; success: number; failure: number; avgMs: number; totalMs: number }> = {};
    const byKey: Record<string, { total: number; success: number; failure: number; totalMs: number }> = {};
    const errorTypeCount: Record<string, number> = {};

    for (const log of logs || []) {
      const p = log.provider;
      if (!byProvider[p]) byProvider[p] = { total: 0, success: 0, failure: 0, avgMs: 0, totalMs: 0 };
      byProvider[p].total += 1;
      if (log.success) byProvider[p].success += 1;
      else byProvider[p].failure += 1;
      if (log.duration_ms) byProvider[p].totalMs += log.duration_ms;

      if (log.key_id) {
        if (!byKey[log.key_id]) byKey[log.key_id] = { total: 0, success: 0, failure: 0, totalMs: 0 };
        byKey[log.key_id].total += 1;
        if (log.success) byKey[log.key_id].success += 1;
        else byKey[log.key_id].failure += 1;
        if (log.duration_ms) byKey[log.key_id].totalMs += log.duration_ms;
      }

      if (!log.success && log.error_type) {
        errorTypeCount[log.error_type] = (errorTypeCount[log.error_type] || 0) + 1;
      }
    }

    for (const p in byProvider) {
      const s = byProvider[p];
      s.avgMs = s.total > 0 ? Math.round(s.totalMs / s.total) : 0;
    }

    // 最近错误列表（最多 30 条）
    const recentErrors = (logs || [])
      .filter(l => !l.success)
      .slice(0, 30)
      .map(l => ({
        created_at: l.created_at,
        provider: l.provider,
        key_id: l.key_id,
        error_type: l.error_type,
        error_msg: l.error_msg,
        duration_ms: l.duration_ms,
      }));

    return NextResponse.json({
      range,
      since,
      providerStats: byProvider,
      keyStats: byKey,
      errorTypeCount,
      recentErrors,
      keys: (keys || []).map(k => ({ ...k, key_value: undefined })), // 不暴露明文
    });
  } catch (err: any) {
    console.error('[admin/api-pool/stats]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
