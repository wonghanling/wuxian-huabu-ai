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

/** 重试包装:网络抖动、上游限流都是瞬时的，重试一次往往就过了 */
async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries) {
        // 退避:0.5s、1.5s —— 上游限流时立刻重试只会再撞一次
        await new Promise((r) => setTimeout(r, i * 500 + 500));
      }
    }
  }
  throw new Error(`${label}（已重试 ${tries} 次）: ${lastErr?.message || lastErr}`);
}

// 上传资产到 Supabase Storage，返回永久 URL
export async function uploadAsset(
  userId: string,
  blob: Blob,
  ext: 'jpg' | 'mp4' | 'webp' = 'jpg'
): Promise<string> {
  // 走后端 /api/storage/put —— 前端不再直连存储。
  // 顺带修掉一个老问题:原先路径是 `${userId}/...`，文件落在 assets 根目录下的
  // 用户 UUID 目录，与后端的 assets/videos/{userId}/、assets/images/{userId}/
  // 不一致，日后难以区分归属。现在由后端按 kind 统一决定前缀。
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('未登录，无法保存');

  const kind = ext === 'mp4' ? 'video' : 'image';
  const mime = ext === 'mp4' ? 'video/mp4' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  return withRetry(async () => {
    const form = new FormData();
    form.append('file', new File([blob], `asset.${ext}`, { type: mime }));
    form.append('kind', kind);

    const res = await fetch('/api/storage/put', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
    return data.url as string;
  }, '上传失败');
}

// 把外部 URL 的图片/视频下载后上传到 Storage，返回永久 URL
//
// 为什么必须成功:上游(火山引擎等)给的是带签名的临时地址，7 天后失效。
// 这一步失败而调用方又静默保留原 URL 的话，用户当时看图正常，
// 一周后打开画布就是 "Request has expired" —— 作品实际没保存下来。
export async function mirrorUrlToStorage(
  userId: string,
  url: string,
  type: 'image' | 'video'
): Promise<string> {
  const ext = type === 'video' ? 'mp4' : 'jpg';

  // base64 data URL 直接转 blob（本地数据，不会失败，无需重试）
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    const blob = await res.blob();
    return uploadAsset(userId, blob, ext);
  }

  // 外部 URL:下载这一步最容易断（文件可能几 MB，上游也可能限流）
  const blob = await withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b = await res.blob();
    if (b.size === 0) throw new Error('下载到空文件');
    return b;
  }, '下载资产失败');

  return uploadAsset(userId, blob, ext);
}
