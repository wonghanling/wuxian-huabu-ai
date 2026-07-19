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

    // 附上每个申请者的创作者资料(头像/昵称/擅长/简介/历史合作数)
    const creatorIds = [...new Set((apps ?? []).map((a) => a.creator_id))];
    const profileMap = new Map<string, unknown>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('creator_profiles')
        .select('user_id, display_name, avatar_url, specialties, verification_status, completed_count')
        .in('user_id', creatorIds);
      for (const p of profiles ?? []) profileMap.set(p.user_id, p);
    }
    applications = (apps ?? []).map((a) => ({ ...a, creator_profile: profileMap.get(a.creator_id) ?? null }));
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

  // 当前查看者(创作者)在本项目的有效预留(用于付款/解锁界面)
  let myReservation: unknown = null;
  let contact: unknown = null;         // 甲方联系方式(给已付款创作者看)
  let creatorContact: unknown = null;  // 创作者联系方式(给甲方看,双方同时解锁)

  if (isOwner) {
    // 甲方: 当前有效预留(用于标记合作结果/查看被选创作者)
    const { data: res } = await supabaseAdmin
      .from('project_reservations')
      .select('id, creator_id, status, payment_status, amount_cents, pay_deadline, contact_deadline')
      .eq('project_id', id)
      .in('status', ['awaiting_payment', 'active', 'cooperated'])
      .maybeSingle();
    myReservation = res ?? null;

    // 独家沟通中(已付款) → 甲方可看被选创作者联系方式(双方对等解锁)
    if (res && res.status === 'active' && res.payment_status === 'paid') {
      const { data: cc } = await supabaseAdmin
        .from('creator_profiles')
        .select('display_name, bio, contact_type, contact_value')
        .eq('user_id', res.creator_id)
        .maybeSingle();
      creatorContact = cc ?? null;
    }
  } else if (viewerId) {
    // 创作者: 自己的预留
    const { data: res } = await supabaseAdmin
      .from('project_reservations')
      .select('id, creator_id, status, payment_status, amount_cents, pay_deadline, contact_deadline')
      .eq('project_id', id)
      .eq('creator_id', viewerId)
      .in('status', ['awaiting_payment', 'active', 'cooperated'])
      .maybeSingle();
    myReservation = res ?? null;

    // 已解锁(付款成功) → 返回甲方联系方式给该创作者
    if (res && res.status === 'active' && res.payment_status === 'paid') {
      const { data: c } = await supabaseAdmin
        .from('project_contacts')
        .select('contact_name, contact_type, contact_value, supplementary_notes')
        .eq('project_id', id)
        .maybeSingle();
      contact = c ?? null;
    }
  }

  return NextResponse.json({ project, isOwner, applications, myApplication, myReservation, contact, creatorContact });
}
