import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效认证' }, { status: 401 });

    const { title, snapshot } = await req.json();
    if (!title || !snapshot) return NextResponse.json({ error: '缺少参数' }, { status: 400 });

    // 1. 创建新画布
    const { data: canvas, error: canvasErr } = await supabaseAdmin
      .from('canvases')
      .insert({ user_id: user.id, title })
      .select('id')
      .single();
    if (canvasErr) throw new Error('创建画布失败: ' + canvasErr.message);

    // 2. 写入首次快照
    const { error: snapErr } = await supabaseAdmin
      .from('canvas_snapshots')
      .insert({ canvas_id: canvas.id, snapshot });
    if (snapErr) throw new Error('写入快照失败: ' + snapErr.message);

    return NextResponse.json({ success: true, canvasId: canvas.id });
  } catch (error: any) {
    console.error('从模板创建画布失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
