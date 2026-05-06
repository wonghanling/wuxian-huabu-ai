import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const ADMIN_EMAIL = '1825221780@qq.com';

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
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: '无权限：仅管理员可保存模板' }, { status: 403 });

    // 2. 解析 FormData
    const form = await req.formData();
    const title = form.get('title') as string;
    const description = (form.get('description') as string) || '';
    const category = (form.get('category') as string) || '通用';
    const tagsStr = (form.get('tags') as string) || '';
    const coverBase64 = form.get('coverBase64') as string;
    const snapshotStr = form.get('snapshot') as string;
    const previewVideo = form.get('previewVideo') as File | null;
    const templateId = form.get('templateId') as string | null;

    if (!title) return NextResponse.json({ error: '缺少标题' }, { status: 400 });
    if (!snapshotStr) return NextResponse.json({ error: '缺少快照' }, { status: 400 });

    const snapshot = JSON.parse(snapshotStr);
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);

    // 3. 上传封面图
    let cover_url = '';
    if (coverBase64) {
      const base64Data = coverBase64.replace(/^data:image\/\w+;base64,/, '');
      const coverBuffer = Buffer.from(base64Data, 'base64');
      const coverPath = `templates/covers/${Date.now()}.jpg`;
      const { error: coverErr } = await supabaseAdmin.storage
        .from('assets')
        .upload(coverPath, coverBuffer, { contentType: 'image/jpeg', upsert: false });
      if (coverErr) throw new Error('封面上传失败: ' + coverErr.message);
      cover_url = supabaseAdmin.storage.from('assets').getPublicUrl(coverPath).data.publicUrl;
    }

    // 4. 上传预览视频
    let preview_video_url = '';
    if (previewVideo && previewVideo.size > 0) {
      const videoBuffer = Buffer.from(await previewVideo.arrayBuffer());
      const videoPath = `templates/videos/${Date.now()}.mp4`;
      const { error: videoErr } = await supabaseAdmin.storage
        .from('assets')
        .upload(videoPath, videoBuffer, { contentType: 'video/mp4', upsert: false });
      if (videoErr) throw new Error('视频上传失败: ' + videoErr.message);
      preview_video_url = supabaseAdmin.storage.from('assets').getPublicUrl(videoPath).data.publicUrl;
    }

    // 5. 插入或更新
    if (templateId) {
      // 覆盖旧模板
      const updateData: any = {
        title, description, category, tags, snapshot_json: snapshot,
        updated_at: new Date().toISOString(),
      };
      if (cover_url) updateData.cover_url = cover_url;
      if (preview_video_url) updateData.preview_video_url = preview_video_url;

      const { error } = await supabaseAdmin
        .from('workflow_templates')
        .update(updateData)
        .eq('id', templateId)
        .eq('created_by', user.id);
      if (error) throw new Error('更新失败: ' + error.message);
      return NextResponse.json({ success: true, id: templateId, updated: true });
    } else {
      // 新建
      const { data, error } = await supabaseAdmin
        .from('workflow_templates')
        .insert({
          title, description, category, tags,
          cover_url, preview_video_url,
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
