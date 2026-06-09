'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// 语音 ID 库 — 读写 voice_library 表(按 user_id 隔离,RLS 保护)
// 存:语音设计生成的 / 复刻出来的 / 手动收藏的 voice_id
// 不碰扣费/支付,纯数据 CRUD
// ============================================================

export interface VoiceEntry {
  id: string;
  voiceId: string;
  name: string;
  description: string;
  source: 'design' | 'clone' | 'manual';
  voiceType: 'human' | 'scene';   // 人声 / 场景声
  createdAt: string;
}

// 读取当前用户的全部语音(可按 voiceType 过滤)
export async function loadVoices(voiceType?: 'human' | 'scene'): Promise<VoiceEntry[]> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    let q = supabase.from('voice_library').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (voiceType) q = q.eq('voice_type', voiceType);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r: any) => ({
      id: r.id, voiceId: r.voice_id, name: r.name ?? '', description: r.description ?? '',
      source: r.source, voiceType: r.voice_type, createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

// 新增/更新一个语音(同 user+voice_id 已存在则更新名称/描述)
export async function saveVoice(v: {
  voiceId: string; name?: string; description?: string;
  source?: 'design' | 'clone' | 'manual'; voiceType?: 'human' | 'scene';
}): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('请先登录'); return false; }
    const { error } = await supabase.from('voice_library').upsert({
      user_id: user.id,
      voice_id: v.voiceId,
      name: v.name ?? '',
      description: v.description ?? '',
      source: v.source ?? 'manual',
      voice_type: v.voiceType ?? 'human',
    }, { onConflict: 'user_id,voice_id' });
    if (error) { console.warn('保存音色失败:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('保存音色异常:', e);
    return false;
  }
}

// 删除一个语音
export async function deleteVoice(voiceId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('voice_library').delete().eq('user_id', user.id).eq('voice_id', voiceId);
    return !error;
  } catch {
    return false;
  }
}

// 改名/改描述
export async function renameVoice(voiceId: string, name: string, description?: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const patch: any = { name };
    if (description !== undefined) patch.description = description;
    const { error } = await supabase.from('voice_library').update(patch).eq('user_id', user.id).eq('voice_id', voiceId);
    return !error;
  } catch {
    return false;
  }
}
