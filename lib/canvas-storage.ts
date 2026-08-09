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

/**
 * 校验某个画布是否属于该用户。
 * 从项目页带 ?canvas=<id> 进画布时必须先验归属 ——
 * 否则改 URL 就能读别人的画布。
 */
export async function canvasBelongsTo(canvasId: string, userId: string): Promise<boolean> {
  if (!canvasId || !userId) return false;
  const supabase = createClient();
  const { data } = await supabase
    .from('canvases')
    .select('id')
    .eq('id', canvasId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data?.id;
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

export interface CanvasWithCover {
  id: string;
  title: string;
  updated_at: string;
  /** 封面:取最新快照里第一张图片产出;没有则为 null(前端显示空白卡) */
  cover: string | null;
  /** 节点数,列表上显示"N 个卡片" */
  nodeCount: number;
}

/**
 * 项目列表(带封面)。
 * 从最新快照的 JSON 里挑第一张图片产出当封面 —— 不额外截图、不占存储,
 * 空项目自然没有封面,前端渲染成空白卡。
 */
export async function listCanvasesWithCover(userId: string): Promise<CanvasWithCover[]> {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from('canvases')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (!rows || rows.length === 0) return [];

  const list = rows as { id: string; title: string; updated_at: string }[];
  const ids = list.map((r) => r.id);
  const { data: snaps } = await supabase
    .from('canvas_snapshots')
    .select('canvas_id, snapshot, created_at')
    .in('canvas_id', ids)
    .order('created_at', { ascending: false });

  // 每个画布可能有多条快照,按时间倒序后第一条即最新
  const latestByCanvas = new Map<string, any>();
  for (const s of snaps ?? []) {
    if (!latestByCanvas.has(s.canvas_id)) latestByCanvas.set(s.canvas_id, s.snapshot);
  }

  return list.map((r) => {
    const snap = latestByCanvas.get(r.id);
    const nodes: any[] = Array.isArray(snap?.nodes) ? snap.nodes : [];
    // 只认图片(视频 URL 放 <img> 里显示不出来)
    const imageNode = nodes.find((n) => {
      const url = n?.data?.outputUrl;
      return typeof url === 'string' && /\.(png|jpe?g|webp)(\?|$)/i.test(url);
    });
    return {
      id: r.id,
      title: r.title,
      updated_at: r.updated_at,
      cover: imageNode?.data?.outputUrl ?? null,
      nodeCount: nodes.length,
    };
  });
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
