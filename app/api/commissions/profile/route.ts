import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创作者资料(读/存自己的 creator_profiles)
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

// GET — 读自己的创作者资料
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const { data } = await supabaseAdmin
    .from('creator_profiles')
    .select('user_id, display_name, avatar_url, specialties, bio, contact_type, contact_value, verification_status, completed_count')
    .eq('user_id', user.id)
    .maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

// POST — 保存(upsert)自己的创作者资料
export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const body = await req.json();
    const { displayName, avatarUrl, specialties, bio, contactType, contactValue } = body;

    const { error } = await supabaseAdmin
      .from('creator_profiles')
      .upsert({
        user_id: user.id,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
        specialties: Array.isArray(specialties) ? specialties : null,
        bio: bio || null,
        contact_type: contactType || null,
        contact_value: contactValue || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '服务器错误' }, { status: 500 });
  }
}
