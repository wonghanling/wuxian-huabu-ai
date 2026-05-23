import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin';

export const maxDuration = 30;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. 校验管理员
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效认证' }, { status: 401 });
    if (!isAdmin(user.email)) return NextResponse.json({ error: '无权限：仅管理员可保存模板' }, { status: 403 });

    // 2. 解析 JSON（前端已直传 Storage，这里只收 URL）
    const body = await req.json();
    const {
      title, description, category, tags: tagsStr,
      coverUrl, videoUrl, snapshot, templateId,
    } = body;

    if (!title) return NextResponse.json({ error: '缺少标题' }, { status: 400 });
    if (!snapshot) return NextResponse.json({ error: '缺少快照' }, { status: 400 });

    const tags = (tagsStr || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    // 3. 插入或更新
    if (templateId) {
      const updateData: any = {
        title, description, category, tags,
        snapshot_json: snapshot,
        updated_at: new Date().toISOString(),
      };
      if (coverUrl) updateData.cover_url = coverUrl;
      if (videoUrl) updateData.preview_video_url = videoUrl;

      const { error } = await supabaseAdmin
        .from('workflow_templates')
        .update(updateData)
        .eq('id', templateId)
        .eq('created_by', user.id);
      if (error) throw new Error('更新失败: ' + error.message);
      return NextResponse.json({ success: true, id: templateId, updated: true });
    } else {
      const { data, error } = await supabaseAdmin
        .from('workflow_templates')
        .insert({
          title,
          description: description || '',
          category: category || '通用',
          tags,
          cover_url: coverUrl || '',
          preview_video_url: videoUrl || '',
          snapshot_json: snapshot,
          created_by: user.id,
          is_public: true,
        })
        .select('id')
        .single();
      if (error) throw new Error('保存失败: ' + error.message);
      return NextResponse.json({ success: true, id: data.id });
    }
  } catch (error: any) {
    console.error('保存模板失败:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
