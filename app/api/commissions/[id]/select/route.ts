import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 甲方选择创作者独家沟通 → 调原子 RPC select_creator_for_project
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

    const { applicationId } = await req.json();
    if (!applicationId) return NextResponse.json({ error: '缺少申请ID' }, { status: 400 });

    // 用户身份的客户端(auth.uid() 生效),调 RPC
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error } = await supabaseUser.rpc('select_creator_for_project', {
      p_project_id: projectId,
      p_application_id: applicationId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.success) return NextResponse.json({ error: data?.error || '选择失败' }, { status: 400 });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
