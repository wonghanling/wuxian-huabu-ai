import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 委托沟通聊天:
// - 付款前(预沟通): 甲方和被选创作者各限发1条,消息过滤联系方式
// - 付款后: 无限聊天,不过滤(双方自己在聊天里交换联系方式)
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

// 付款前预沟通:禁止字母/数字/中文数字,彻底防止交换微信/QQ/手机/邮箱/链接
// 中文数字(一二三四五六七八九十零两)也拦(防"我微信一三八...")
function containsContactInfo(text: string): boolean {
  if (/[a-zA-Z0-9]/.test(text || '')) return true;
  // 出现2个以上中文数字视为号码(单独一个"三天"正常放行)
  const cnDigits = (text || '').match(/[一二三四五六七八九十零两壹贰叁肆伍陆柒捌玖拾]/g);
  return !!cnDigits && cnDigits.length >= 3;
}

// 返回:该用户在此项目的沟通身份和阶段
// role: 'client' | 'creator' | null ; paid: 是否已付款(无限聊)
async function chatContext(projectId: string, uid: string): Promise<{ role: 'client' | 'creator' | null; paid: boolean; reservationId: string | null }> {
  // 甲方?
  const { data: proj } = await supabaseAdmin.from('projects').select('client_id').eq('id', projectId).single();
  // 该项目当前有效预留(被选创作者+付款状态)
  const { data: res } = await supabaseAdmin
    .from('project_reservations')
    .select('id, creator_id, status, payment_status')
    .eq('project_id', projectId)
    .in('status', ['awaiting_payment', 'active'])
    .maybeSingle();
  const paid = !!res && res.payment_status === 'paid';
  if (proj?.client_id === uid) return { role: 'client', paid, reservationId: res?.id ?? null };
  if (res && res.creator_id === uid) return { role: 'creator', paid, reservationId: res.id };
  return { role: null, paid: false, reservationId: null };
}

// GET — 读历史消息(选中后甲方/被选创作者可见)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const ctx = await chatContext(projectId, user.id);
  if (!ctx.role) return NextResponse.json({ error: '无权查看' }, { status: 403 });

  const { data } = await supabaseAdmin
    .from('commission_messages')
    .select('id, sender_id, content, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .limit(500);

  // 我方在付款前已发几条(用于前端判断是否该弹付款)
  const myCount = (data ?? []).filter((m) => m.sender_id === user.id).length;
  return NextResponse.json({ messages: data ?? [], me: user.id, paid: ctx.paid, role: ctx.role, myCount });
}

// POST — 发消息
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const ctx = await chatContext(projectId, user.id);
    if (!ctx.role) return NextResponse.json({ error: '无权发送' }, { status: 403 });

    const { content } = await req.json();
    if (!content || !content.trim()) return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: '消息过长' }, { status: 400 });

    // 付款前:限发1条 + 过滤联系方式
    if (!ctx.paid) {
      const { count } = await supabaseAdmin
        .from('commission_messages')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('sender_id', user.id);
      if ((count ?? 0) >= 1) {
        return NextResponse.json({ error: '付款前每人仅可发送1条消息，请完成支付后继续沟通', needPay: ctx.role === 'creator' }, { status: 400 });
      }
      if (containsContactInfo(content)) {
        return NextResponse.json({ error: '付款前不能发送联系方式（手机/微信/QQ/链接等），请先完成介绍费支付' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('commission_messages')
      .insert({ project_id: projectId, reservation_id: ctx.reservationId, sender_id: user.id, content: content.trim() })
      .select('id, sender_id, content, created_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 付款前创作者发完这条 → 提示前端弹付款
    const triggerPay = !ctx.paid && ctx.role === 'creator';
    return NextResponse.json({ success: true, message: data, triggerPay });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
