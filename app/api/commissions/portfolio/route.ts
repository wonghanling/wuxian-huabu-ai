import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 作品集(创作者自己的已有作品)
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

// GET ?creatorId= — 读某创作者的作品集(公开,用于甲方查看);无参则读自己的
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let creatorId = searchParams.get('creatorId');
  if (!creatorId) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ items: [] });
    creatorId = user.id;
  }
  const { data } = await supabaseAdmin
    .from('portfolio_items')
    .select('id, title, media_type, media_url, cover_url, sort_order, created_at')
    .eq('creator_id', creatorId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  return NextResponse.json({ items: data ?? [] });
}

// POST — 新增作品
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const { title, mediaType, mediaUrl, coverUrl } = await req.json();
    if (!mediaUrl) return NextResponse.json({ error: '缺少作品文件' }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from('portfolio_items')
      .insert({ creator_id: user.id, title: title || null, media_type: mediaType || 'image', media_url: mediaUrl, cover_url: coverUrl || null })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}

// DELETE ?id= — 删除自己的作品
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('id');
  if (!itemId) return NextResponse.json({ error: '缺少作品ID' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('portfolio_items')
    .delete()
    .eq('id', itemId)
    .eq('creator_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
