import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 独家沟通聊天:发消息(校验身份) / 读历史
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user;
}

// 校验:必须已付款进入独家沟通(存在解锁记录)后,该项目的甲方和被选创作者才能聊
// 没付款 → 甲方和创作者都不能发/收消息
async function canChat(projectId: string, uid: string): Promise<boolean> {
  // 该项目必须有一条解锁记录(创作者付款完成),否则谁都不能聊
  const { data: unlock } = await supabaseAdmin
    .from('contact_unlocks')
    .select('creator_id')
    .eq('project_id', projectId)
    .maybeSingle();
  if (!unlock) return false; // 未付款解锁,不能聊

  // 被选创作者本人
  if (unlock.creator_id === uid) return true;
  // 该项目甲方本人
  const { data: proj } = await supabaseAdmin.from('projects').select('client_id').eq('id', projectId).single();
  return proj?.client_id === uid;
}

// GET — 读历史消息
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  if (!(await canChat(projectId, user.id))) return NextResponse.json({ error: '无权查看' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('commission_messages')
    .select('id, sender_id, content, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(500);
  return NextResponse.json({ messages: data ?? [], me: user.id });
}

// POST — 发消息
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (!(await canChat(projectId, user.id))) return NextResponse.json({ error: '无权发送' }, { status: 403 });

    const { content, reservationId } = await req.json();
    if (!content || !content.trim()) return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: '消息过长' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('commission_messages')
      .insert({ project_id: projectId, reservation_id: reservationId || null, sender_id: user.id, content: content.trim() })
      .select('id, sender_id, content, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
