import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = '1825221780@qq.com';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 校验请求头 Bearer token 对应 admin 邮箱
async function requireAdmin(req: NextRequest): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { ok: false, res: NextResponse.json({ error: '未授权' }, { status: 401 }) };
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { ok: false, res: NextResponse.json({ error: '无效认证' }, { status: 401 }) };
  if (user.email !== ADMIN_EMAIL) return { ok: false, res: NextResponse.json({ error: '无权限' }, { status: 403 }) };
  return { ok: true };
}

// 掩码 key：只显示前 4 和后 4
function maskKey(s: string | null | undefined): string {
  if (!s) return '';
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

// GET /api/admin/api-pool/list?provider=fal
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    let query = supabaseAdmin
      .from('api_keys')
      .select('id, provider, key_name, key_value, secondary_value, priority, max_concurrency, current_concurrency, total_calls, success_count, failure_count, last_success_at, last_failure_at, status, notes, created_at, updated_at')
      .order('provider', { ascending: true })
      .order('created_at', { ascending: true });

    if (provider) query = query.eq('provider', provider);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // 掩码 key 值，不把真实 key 发给前端
    const masked = (data || []).map(row => ({
      ...row,
      key_value_mask: maskKey(row.key_value),
      secondary_value_mask: maskKey(row.secondary_value),
      key_value: undefined,
      secondary_value: undefined,
    }));

    return NextResponse.json({ keys: masked });
  } catch (err: any) {
    console.error('[admin/api-pool/list]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
