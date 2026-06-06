import { createClient } from './supabase/client';

// 获取或创建用户的默认画布
export async function getOrCreateCanvas(userId: string): Promise<string> {
  const supabase = createClient();

  // 先查有没有已有画布
  const { data: existing } = await supabase
    .from('canvases')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (existing?.id) return existing.id;

  // 没有就新建
  const { data: created, error } = await supabase
    .from('canvases')
    .insert({ user_id: userId, title: '我的画布' })
    .select('id')
    .single();

  if (error || !created) throw new Error('创建画布失败');
  return created.id;
}

// 列出用户的所有画布(多画布管理)
export async function listCanvases(userId: string): Promise<{ id: string; title: string; updated_at: string }[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('canvases')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  return data ?? [];
}

// 新建一个画布,返回 { id, title }
export async function createCanvas(userId: string, title?: string): Promise<{ id: string; title: string } | null> {
  const supabase = createClient();
  const t = title || `画布 ${new Date().toLocaleDateString('zh-CN')}`;
  const { data } = await supabase
    .from('canvases')
    .insert({ user_id: userId, title: t })
    .select('id, title')
    .single();
  return data ?? null;
}

// 删除画布(及其快照由数据库级联或单独清理)
export async function deleteCanvas(canvasId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('canvas_snapshots').delete().eq('canvas_id', canvasId);
  await supabase.from('canvases').delete().eq('id', canvasId);
}

// 重命名画布
export async function renameCanvas(canvasId: string, title: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('canvases').update({ title }).eq('id', canvasId);
}

// 加载最新快照
export async function loadSnapshot(canvasId: string): Promise<any | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from('canvas_snapshots')
    .select('snapshot')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.snapshot ?? null;
}

// 保存快照（数据库触发器自动保留最新3个）
export async function saveSnapshot(canvasId: string, snapshot: any): Promise<void> {
  const supabase = createClient();

  await supabase.from('canvas_snapshots').insert({ canvas_id: canvasId, snapshot });

  await supabase.from('canvases').update({ updated_at: new Date().toISOString() }).eq('id', canvasId);
}

// 上传资产到 Supabase Storage，返回永久 URL
export async function uploadAsset(
  userId: string,
  blob: Blob,
  ext: 'jpg' | 'mp4' | 'webp' = 'jpg'
): Promise<string> {
  const supabase = createClient();
  const filename = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('assets')
    .upload(filename, blob, { contentType: ext === 'mp4' ? 'video/mp4' : 'image/jpeg', upsert: false });

  if (error) throw new Error(`上传失败: ${error.message}`);

  const { data } = supabase.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

// 把外部 URL 的图片/视频下载后上传到 Storage，返回永久 URL
export async function mirrorUrlToStorage(
  userId: string,
  url: string,
  type: 'image' | 'video'
): Promise<string> {
  // base64 data URL 直接转 blob
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = type === 'video' ? 'mp4' : 'jpg';
    return uploadAsset(userId, blob, ext);
  }

  // 外部 URL 下载
  const res = await fetch(url);
  if (!res.ok) throw new Error('下载资产失败');
  const blob = await res.blob();
  const ext = type === 'video' ? 'mp4' : 'jpg';
  return uploadAsset(userId, blob, ext);
}
