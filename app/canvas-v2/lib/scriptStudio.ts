'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// 剧本工作室数据层
// 双存:localStorage 即时草稿(防刷新/崩溃白写) + Supabase 云端永久(跨设备)
// 不碰扣费/支付,纯数据 CRUD + 调生成接口
// 第一期:单草稿(Supabase 取最近一条)
// ============================================================

export const PHASE_LABELS = [
  '小说', 'Beat Sheet', '人物设计', '场景设计', '道具设计', '正式剧本', '拍摄剧本',
];

export interface ScriptProject {
  id: string | null;          // Supabase 行 id(本地草稿为 null)
  title: string;
  phases: string[];           // 长度 7,各阶段生成结果
  inputs: string[];           // 长度 7,各阶段输入框内容
}

const LS_KEY = 'script_studio_draft';

export function emptyProject(): ScriptProject {
  return { id: null, title: '未命名剧本', phases: Array(7).fill(''), inputs: Array(7).fill('') };
}

// ---------- localStorage 即时草稿 ----------
export function saveDraftLocal(p: ScriptProject) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

export function loadDraftLocal(): ScriptProject | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return {
      id: o.id ?? null,
      title: o.title ?? '未命名剧本',
      phases: Array.isArray(o.phases) ? padTo7(o.phases) : Array(7).fill(''),
      inputs: Array.isArray(o.inputs) ? padTo7(o.inputs) : Array(7).fill(''),
    };
  } catch { return null; }
}

function padTo7(arr: any[]): string[] {
  const out = Array(7).fill('');
  for (let i = 0; i < 7; i++) out[i] = typeof arr[i] === 'string' ? arr[i] : '';
  return out;
}

// ---------- Supabase 云端永久 ----------
// 取当前用户最近一条剧本(第一期单草稿)
export async function loadProject(): Promise<ScriptProject | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('script_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error || !data || !data.length) return null;
    const r = data[0];
    const inputsObj = (r.inputs && typeof r.inputs === 'object') ? r.inputs : {};
    return {
      id: r.id,
      title: r.title ?? '未命名剧本',
      phases: [r.phase_1, r.phase_2, r.phase_3, r.phase_4, r.phase_5, r.phase_6, r.phase_7].map((s: any) => s ?? ''),
      inputs: Array.from({ length: 7 }, (_, i) => (inputsObj[String(i)] ?? inputsObj[i] ?? '')),
    };
  } catch { return null; }
}

// 保存到云端(有 id 则 update,无则 insert),返回行 id
export async function saveProject(p: ScriptProject): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const inputsObj: Record<string, string> = {};
    p.inputs.forEach((v, i) => { if (v) inputsObj[String(i)] = v; });
    const row: any = {
      user_id: user.id,
      title: p.title || '未命名剧本',
      phase_1: p.phases[0] ?? '', phase_2: p.phases[1] ?? '', phase_3: p.phases[2] ?? '',
      phase_4: p.phases[3] ?? '', phase_5: p.phases[4] ?? '', phase_6: p.phases[5] ?? '',
      phase_7: p.phases[6] ?? '',
      inputs: inputsObj,
      updated_at: new Date().toISOString(),
    };
    if (p.id) {
      const { error } = await supabase.from('script_projects').update(row).eq('id', p.id).eq('user_id', user.id);
      if (error) { console.warn('保存剧本失败:', error.message); return null; }
      return p.id;
    } else {
      const { data, error } = await supabase.from('script_projects').insert(row).select('id').single();
      if (error || !data) { console.warn('新建剧本失败:', error?.message); return null; }
      return data.id;
    }
  } catch (e) {
    console.warn('保存剧本异常:', e);
    return null;
  }
}

// ---------- 生成某阶段(依赖链:前端把已生成的前置阶段内容一起传来) ----------
// prev: { 阶段号(1基): 内容 },后端按依赖规则取用
//   ②←① ③←①② ④⑤⑥←③ ⑦←③④⑤⑥
export async function generatePhase(
  phase: number,
  input: string,
  prev: Record<number, string>,
  userId?: string,
): Promise<string> {
  const res = await fetch('/api/gem/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phase, input, prev, userId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `生成失败(${res.status})`);
  return data.result || '';
}
