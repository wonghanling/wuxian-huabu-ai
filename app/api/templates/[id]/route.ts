import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .eq('id', id)
      .eq('is_public', true)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: '模板不存在' }, { status: 404 });

    // 异步自增使用次数，不阻塞返回
    supabaseAdmin
      .from('workflow_templates')
      .update({ use_count: (data.use_count || 0) + 1 })
      .eq('id', id)
      .then(() => {});

    return NextResponse.json({ template: data });
  } catch (error: any) {
    console.error('获取模板失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
