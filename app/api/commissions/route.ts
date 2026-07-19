import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 委托系统 API(独立于画布)。列表用 anon 读(RLS 放行公开项目);发布需登录。
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 联系方式防绕过检测:禁字母/数字/多个中文数字(与聊天/简介同一规则,彻底防塞联系方式)
function containsContactInfo(text: string): boolean {
  if (!text) return false;
  if (/[a-zA-Z0-9]/.test(text)) return true;
  const cnDigits = text.match(/[一二三四五六七八九十零两壹贰叁肆伍陆柒捌玖拾]/g);
  return !!cnDigits && cnDigits.length >= 3;
}

// GET /api/commissions — 列出开放的委托(支持分类/状态筛选)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status') || 'open';
  const limit = Math.min(Number(searchParams.get('limit') || 60), 100);

  let query = supabaseAdmin
    .from('projects')
    .select('id, client_id, title, description, category, budget_min, budget_max, delivery_days, cover_url, tags, status, application_count, created_at')
    .not('status', 'in', '(draft,cancelled)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category && category !== 'all') query = query.eq('category', category);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

// POST /api/commissions — 发布委托(需登录,联系方式单独存 project_contacts)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: '登录失效' }, { status: 401 });

    const body = await req.json();
    const { title, description, category, budgetMin, budgetMax, deliveryDays, coverUrl, tags,
            referenceFiles } = body;

    if (!title || !title.trim()) return NextResponse.json({ error: '请填写项目标题' }, { status: 400 });

    // 防绕过:标题+描述里不能有联系方式(付款前不能泄露联系方式,否则介绍费模式失效)
    if (containsContactInfo(title) || containsContactInfo(description || '')) {
      return NextResponse.json({ error: '项目标题和描述中不能包含手机号、微信、QQ、链接等联系方式，选择创作者后可在站内沟通' }, { status: 400 });
    }

    // 创建项目(联系方式不再收集,双方选中后站内沟通)
    const { data: proj, error: projErr } = await supabaseAdmin
      .from('projects')
      .insert({
        client_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        category: category || null,
        budget_min: budgetMin ?? null,
        budget_max: budgetMax ?? null,
        delivery_days: deliveryDays ?? null,
        cover_url: coverUrl || null,
        tags: Array.isArray(tags) ? tags : null,
        reference_files: Array.isArray(referenceFiles) ? referenceFiles : null,
        status: 'open',
      })
      .select('id')
      .single();
    if (projErr || !proj) return NextResponse.json({ error: projErr?.message || '创建失败' }, { status: 500 });

    return NextResponse.json({ success: true, projectId: proj.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
