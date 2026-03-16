import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { canvasId, snapshot } = await req.json();
    if (!canvasId || !snapshot) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    await supabaseAdmin.from('canvas_snapshots').insert({ canvas_id: canvasId, snapshot });

    // 只保留最新5个
    const { data: all } = await supabaseAdmin
      .from('canvas_snapshots')
      .select('id, created_at')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false });

    if (all && all.length > 5) {
      const toDelete = all.slice(5).map((r: any) => r.id);
      await supabaseAdmin.from('canvas_snapshots').delete().in('id', toDelete);
    }

    await supabaseAdmin
      .from('canvases')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', canvasId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('保存画布失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
