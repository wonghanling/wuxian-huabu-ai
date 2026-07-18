import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 标记合作结果(已合作/未合作) 或 创作者放弃预留
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params; // 项目id在body里的reservationId定位,这里仅占位
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: '登录失效' }, { status: 401 });

    const { action, reservationId, result, reason } = await req.json();
    if (!reservationId) return NextResponse.json({ error: '缺少预留ID' }, { status: 400 });

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    if (action === 'decline') {
      // 创作者放弃(待付款阶段)
      const { data, error } = await supabaseUser.rpc('decline_reservation', { p_reservation_id: reservationId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.success) return NextResponse.json({ error: data?.error || '操作失败' }, { status: 400 });
      return NextResponse.json(data);
    }

    // 标记合作结果
    if (result !== 'cooperated' && result !== 'not_cooperated') {
      return NextResponse.json({ error: '无效的结果类型' }, { status: 400 });
    }
    const { data, error } = await supabaseUser.rpc('finalize_project_outcome', {
      p_reservation_id: reservationId,
      p_result: result,
      p_reason: reason || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.success) return NextResponse.json({ error: data?.error || '操作失败' }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
