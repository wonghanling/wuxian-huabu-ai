import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 我的工作台统计(甲方/创作者两套真实数字)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    // 未登录返回全 0
    return NextResponse.json({ client: { recruiting: 0, producing: 0, completed: 0 }, creator: { todo: 0, ongoing: 0, completed: 0 } });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ client: { recruiting: 0, producing: 0, completed: 0 }, creator: { todo: 0, ongoing: 0, completed: 0 } });
  }
  const uid = user.id;

  // 甲方: 我发布的项目按状态统计
  const { data: myProjects } = await supabaseAdmin
    .from('projects')
    .select('status')
    .eq('client_id', uid);
  const client = { recruiting: 0, producing: 0, completed: 0 };
  for (const p of myProjects ?? []) {
    if (p.status === 'open' || p.status === 'reserved') client.recruiting += 1;
    else if (p.status === 'exclusive_contact') client.producing += 1;
    else if (p.status === 'cooperated') client.completed += 1;
  }

  // 创作者: 我的预留按状态统计
  const { data: myRes } = await supabaseAdmin
    .from('project_reservations')
    .select('status, payment_status')
    .eq('creator_id', uid);
  const creator = { todo: 0, ongoing: 0, completed: 0 };
  for (const r of myRes ?? []) {
    if (r.status === 'awaiting_payment') creator.todo += 1;          // 待我处理(待付款)
    else if (r.status === 'active') creator.ongoing += 1;            // 进行中(独家沟通)
    else if (r.status === 'cooperated') creator.completed += 1;      // 已完成
  }

  return NextResponse.json({ client, creator });
}
