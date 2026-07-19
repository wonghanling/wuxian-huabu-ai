import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 任务完成 / 删除(隐藏) — 调对应 RPC
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

    const { action, reservationId } = await req.json();

    // 甲方按项目隐藏(不依赖预留,任何自己的项目都能从列表删除)
    if (action === 'hide_project') {
      const { data: proj } = await supabaseAdmin.from('projects').select('client_id').eq('id', projectId).single();
      if (!proj || proj.client_id !== user.id) return NextResponse.json({ error: '无权操作' }, { status: 403 });
      const { error } = await supabaseAdmin.from('projects').update({ client_hidden: true }).eq('id', projectId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, hidden: true });
    }

    if (!reservationId) return NextResponse.json({ error: '缺少预留ID' }, { status: 400 });

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const rpc = action === 'hide' ? 'hide_reservation' : 'complete_project';
    const { data, error } = await supabaseUser.rpc(rpc, { p_reservation_id: reservationId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.success) return NextResponse.json({ error: data?.error || '操作失败' }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
