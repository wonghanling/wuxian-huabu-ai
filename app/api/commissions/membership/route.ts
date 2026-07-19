import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 我的接单会员状态
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ active: false, expiresAt: null });
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ active: false, expiresAt: null });

  const { data } = await supabaseAdmin
    .from('creator_profiles')
    .select('membership_expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const expiresAt = data?.membership_expires_at ?? null;
  const active = !!expiresAt && new Date(expiresAt) > new Date();
  return NextResponse.json({ active, expiresAt });
}
