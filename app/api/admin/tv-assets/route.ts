import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin';

// ============================================================================
// Filmavo TV 素材管理（仅管理员）
// ============================================================================
// GET    ?category=showcase|skill|all   列出素材（含下架的，后台要能看到）
// POST   新增一条
// PATCH  改一条（标题/排序/可见性等）
// DELETE ?id=xxx  删除一条
//
// 鉴权照 /api/admin/api-pool 的写法：Bearer token 解出用户，再过邮箱白名单。
// 前台读取走 RLS 的 public read 策略，不经这个接口。
// ============================================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 校验管理员身份；通过返回 null，否则返回要直接抛给前端的响应 */
async function guard(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: '登录已失效' }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

const CATEGORIES = ['showcase', 'skill'] as const;
const KINDS = ['video', 'image'] as const;

// ============================================================================
// GET：列表（后台用，包含 visible=false 的）
// ============================================================================
export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  const category = req.nextUrl.searchParams.get('category') || 'all';
  let q = supabaseAdmin
    .from('tv_assets')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (category !== 'all') {
    if (!CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: '分区参数错误' }, { status: 400 });
    }
    q = q.eq('category', category);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, items: data ?? [] });
}

// ============================================================================
// POST：新增
// body: { category, title, description?, kind, src, poster?, model?, href?, sort_order? }
// ============================================================================
export async function POST(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { category, title, description, kind, src, poster, model, href, sort_order } = body;

  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: '分区必须是 showcase 或 skill' }, { status: 400 });
  }
  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
  }
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: '类型必须是 video 或 image' }, { status: 400 });
  }
  if (typeof src !== 'string' || !/^https?:\/\//.test(src)) {
    return NextResponse.json({ error: '素材地址必须是 http(s) 链接' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tv_assets')
    .insert({
      category,
      title: title.trim(),
      description: description?.trim() || null,
      kind,
      src: src.trim(),
      poster: poster?.trim() || null,
      model: model?.trim() || null,
      href: href?.trim() || null,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 100,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

// ============================================================================
// PATCH：修改
// body: { id, ...要改的字段 }
// ============================================================================
export async function PATCH(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  // 只允许改这些字段，防止误改 id/created_at
  const allowed = ['category', 'title', 'description', 'kind', 'src', 'poster', 'model', 'href', 'sort_order', 'visible'];
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) {
    if (k in rest) patch[k] = rest[k];
  }
  if (patch.category && !CATEGORIES.includes(patch.category as any)) {
    return NextResponse.json({ error: '分区参数错误' }, { status: 400 });
  }
  if (patch.kind && !KINDS.includes(patch.kind as any)) {
    return NextResponse.json({ error: '类型参数错误' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tv_assets')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}

// ============================================================================
// DELETE：删除 ?id=xxx
// ============================================================================
export async function DELETE(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const { error } = await supabaseAdmin.from('tv_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
