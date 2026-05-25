import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 100);

    let query = supabaseAdmin
      .from('workflow_templates')
      .select('id, title, description, cover_url, preview_video_url, category, tags, is_featured, use_count, created_at')
      .eq('is_public', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ templates: data || [] });
  } catch (error: any) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json({ error: error.message, templates: [] }, { status: 500 });
  }
}
