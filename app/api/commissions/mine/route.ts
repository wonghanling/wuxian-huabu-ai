import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 我的接单/我的发布(登录用户视角)
// role=creator: 我申请/被选中的项目; role=client: 我发布的项目
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role') || 'creator';

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ items: [] });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ items: [] });
  const uid = user.id;

  if (role === 'client') {
    // 我发布的项目
    const { data } = await supabaseAdmin
      .from('projects')
      .select('id, title, description, category, budget_min, budget_max, delivery_days, cover_url, status, application_count, created_at')
      .eq('client_id', uid)
      .order('created_at', { ascending: false });
    return NextResponse.json({ items: data ?? [] });
  }

  // 创作者: 我申请过的项目(带我的申请状态和预留状态)
  const { data: apps } = await supabaseAdmin
    .from('project_applications')
    .select('id, project_id, status, quote_min, quote_max, created_at')
    .eq('creator_id', uid)
    .order('created_at', { ascending: false });

  if (!apps || apps.length === 0) return NextResponse.json({ items: [] });

  const projectIds = apps.map((a) => a.project_id);
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, title, description, category, budget_min, budget_max, delivery_days, cover_url, status, created_at')
    .in('id', projectIds);

  // 我在这些项目的预留(待付款/独家沟通)
  const { data: reservations } = await supabaseAdmin
    .from('project_reservations')
    .select('id, project_id, status, payment_status, amount_cents, pay_deadline')
    .eq('creator_id', uid)
    .in('project_id', projectIds);

  const projMap = new Map((projects ?? []).map((p) => [p.id, p]));
  const resMap = new Map((reservations ?? []).map((r) => [r.project_id, r]));

  const items = apps.map((a) => ({
    application: a,
    project: projMap.get(a.project_id) ?? null,
    reservation: resMap.get(a.project_id) ?? null,
  })).filter((it) => it.project != null);

  return NextResponse.json({ items });
}
