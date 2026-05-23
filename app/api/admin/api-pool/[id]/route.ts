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

// PATCH /api/admin/api-pool/[id]
// Body: { key_name?, priority?, max_concurrency?, notes?, status? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: any = { updated_at: new Date().toISOString() };
    if ('key_name' in body) updateData.key_name = body.key_name || null;
    if ('priority' in body && typeof body.priority === 'number') updateData.priority = body.priority;
    if ('max_concurrency' in body && typeof body.max_concurrency === 'number' && body.max_concurrency > 0) {
      updateData.max_concurrency = body.max_concurrency;
    }
    if ('notes' in body) updateData.notes = body.notes || null;
    if ('status' in body && ['active', 'cooldown', 'disabled'].includes(body.status)) {
      updateData.status = body.status;
      // 重新启用时清零失败计数
      if (body.status === 'active') {
        updateData.failure_count = 0;
      }
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .update(updateData)
      .eq('id', id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/api-pool/[id] PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/api-pool/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.res;

  try {
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[admin/api-pool/[id] DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
