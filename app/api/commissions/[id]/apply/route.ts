import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创作者申请项目。只允许填已有信息(报价/工期/档期/介绍),禁止上传定制试稿。
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: '登录失效' }, { status: 401 });

    const body = await req.json();
    const { quoteMin, quoteMax, deliveryDays, availability, intro } = body;

    // 200字介绍上限
    if (intro && intro.length > 200) return NextResponse.json({ error: '自我介绍不能超过200字' }, { status: 400 });

    // 校验项目状态: 只有 open 才能申请
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, client_id, status')
      .eq('id', projectId)
      .single();
    if (!project) return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    if (project.status !== 'open') return NextResponse.json({ error: '该项目当前不接受申请' }, { status: 400 });
    if (project.client_id === user.id) return NextResponse.json({ error: '不能申请自己发布的项目' }, { status: 400 });

    // 会员校验:必须有有效接单会员才能申请
    const { data: cp } = await supabaseAdmin
      .from('creator_profiles')
      .select('membership_expires_at')
      .eq('user_id', user.id)
      .maybeSingle();
    const hasMembership = cp?.membership_expires_at && new Date(cp.membership_expires_at) > new Date();
    if (!hasMembership) {
      return NextResponse.json({ error: '需要开通接单会员', needMembership: true }, { status: 403 });
    }

    // 插入申请(UNIQUE(project_id,creator_id) 保证不重复)
    const { error: insErr } = await supabaseAdmin
      .from('project_applications')
      .insert({
        project_id: projectId,
        creator_id: user.id,
        quote_min: quoteMin ?? null,
        quote_max: quoteMax ?? null,
        delivery_days: deliveryDays ?? null,
        availability: availability || null,
        intro: intro || null,
        status: 'pending',
      });
    if (insErr) {
      if (insErr.code === '23505') return NextResponse.json({ error: '你已经申请过该项目' }, { status: 400 });
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // 申请数同步为真实数量
    const { count } = await supabaseAdmin
      .from('project_applications')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);
    await supabaseAdmin
      .from('projects')
      .update({ application_count: count ?? 0 })
      .eq('id', projectId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
