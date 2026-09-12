import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// ============================================================
// AI 生图板块的历史记录
//
// GET    列出当前用户的生成历史（倒序分页）
// POST   写入一条（生成成功后由前端调用）
// DELETE 删除一条
//
// 与画布完全独立 —— 画布是整体快照存储，没有行级记录，所以这里单独一张表。
// 图片文件本身在 Azure，这里只存元数据。
//
// 写入放在后端而不给前端直写权限：user_id 一律从 token 解出，不信前端传的值，
// 否则可伪造成别人的记录。
// ============================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 从 Bearer token 解出用户，失败返回 null */
async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(auth.slice(7));
  return user ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') || 40), 100);
  const before = searchParams.get('before');   // 上一页最后一条的 created_at

  let q = supabaseAdmin
    .from('studio_generations')
    .select('id, model, prompt, image_url, aspect_ratio, quality, ref_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  // 游标分页而非 offset —— 边生成边翻页时 offset 会漏记录或重复
  if (before) q = q.lt('created_at', before);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const imageUrl = String(body?.imageUrl || '');
  const model = String(body?.model || '');
  if (!imageUrl || !model) {
    return NextResponse.json({ error: '缺少 imageUrl 或 model' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('studio_generations')
    .insert({
      user_id: user.id,          // 用 token 解出的，不信前端传的
      model,
      prompt: body?.prompt ? String(body.prompt).slice(0, 4000) : null,
      image_url: imageUrl,
      aspect_ratio: body?.aspectRatio ? String(body.aspectRatio) : null,
      quality: body?.quality ? String(body.quality) : null,
      ref_count: Number(body?.refCount) || 0,
    })
    .select('id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ...data });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  // 带 user_id 条件 —— 否则能删别人的记录
  const { error } = await supabaseAdmin
    .from('studio_generations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
