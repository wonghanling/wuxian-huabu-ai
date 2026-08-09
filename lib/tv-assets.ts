import { createClient } from '@/lib/supabase/client';

// ============================================================
// Filmavo TV 素材 — 前台读取
// ============================================================
// 走 RLS 的 public read 策略（只读 visible=true），未登录用户也能看。
// 后台写入走 /api/admin/tv-assets。
// ============================================================

export type TvCategory = 'showcase' | 'skill';

export interface TvAsset {
  id: string;
  category: TvCategory;
  title: string;
  description: string | null;
  kind: 'video' | 'image';
  src: string;
  poster: string | null;
  model: string | null;
  href: string | null;
  sort_order: number;
}

/** 取某分区的已上架素材，按 sort_order 升序、同序按创建时间倒序 */
export async function listTvAssets(category: TvCategory): Promise<TvAsset[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tv_assets')
      .select('id, category, title, description, kind, src, poster, model, href, sort_order')
      .eq('category', category)
      .eq('visible', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as TvAsset[];
  } catch {
    // 表还没建或网络异常时返回空数组，页面显示占位而不是报错
    return [];
  }
}
