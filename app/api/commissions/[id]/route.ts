import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 单个委托详情(公开可读基本信息;联系方式不在此返回,需付费解锁后单独接口)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/commissions/[id] — 项目详情 + 申请者列表(申请者仅甲方可见完整)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 读当前登录用户(可选,用于判断是否甲方本人)
  let viewerId: string | null = null;
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    viewerId = user?.id ?? null;
  }

  // 项目基本信息
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('id, client_id, title, description, category, budget_min, budget_max, delivery_days, cover_url, tags, reference_files, status, application_count, current_reservation_id, created_at')
    .eq('id', id)
    .single();
  if (error || !project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });

  const isOwner = viewerId != null && viewerId === project.client_id;

  // 申请者列表: 甲方看全部, 其他人看数量+基本(不含联系)
  let applications: unknown[] = [];
  let myApplication: unknown = null;
  if (isOwner) {
    const { data: apps } = await supabaseAdmin
      .from('project_applications')
      .select('id, creator_id, quote_min, quote_max, delivery_days, availability, intro, status, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false });
    applications = apps ?? [];
  } else if (viewerId) {
    // 创作者看自己是否申请过
    const { data: mine } = await supabaseAdmin
      .from('project_applications')
      .select('id, quote_min, quote_max, delivery_days, availability, intro, status, created_at')
      .eq('project_id', id)
      .eq('creator_id', viewerId)
      .maybeSingle();
    myApplication = mine ?? null;
  }

  return NextResponse.json({ project, isOwner, applications, myApplication });
}
