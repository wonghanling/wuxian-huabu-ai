'use client';

import { createClient } from '@/lib/supabase/client';

// ============================================================
// 剧本工作室数据层
// 双存:localStorage 即时草稿(防刷新/崩溃白写) + Supabase 云端永久(跨设备)
// 不碰扣费/支付,纯数据 CRUD + 调生成接口
// 第一期:单草稿(Supabase 取最近一条)
// 6 阶段:Novel Bible / Beat Sheet / Character Bible / Environment Bible / Screenplay / Shooting Script
// Asset Bible 按需钻取,存于 assetBibles(key=资产标识,value=Asset Bible 文本)
// ============================================================

export const PHASE_LABELS = [
  'Novel Bible', 'Beat Sheet', 'Character Bible', 'Environment Bible', 'Screenplay', 'Shooting Script',
];
export const PHASE_LABELS_CN = [
  '小说', '节拍表', '人物设定', '场景世界', '正式剧本', '拍摄剧本',
];

const N = 6;

export interface ScriptProject {
  id: string | null;          // Supabase 行 id(本地草稿为 null)
  title: string;
  phases: string[];           // 长度 6,各阶段生成结果
  inputs: string[];           // 长度 6,各阶段输入框内容
  assetBibles: Record<string, string>; // Asset Bible:key=资产标识(编号|名称),value=bible 文本
}

const LS_KEY = 'script_studio_draft';

export function emptyProject(): ScriptProject {
  return { id: null, title: '未命名剧本', phases: Array(N).fill(''), inputs: Array(N).fill(''), assetBibles: {} };
}

function padToN(arr: any[]): string[] {
  const out = Array(N).fill('');
  for (let i = 0; i < N; i++) out[i] = typeof arr[i] === 'string' ? arr[i] : '';
  return out;
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
      phases: Array.isArray(o.phases) ? padToN(o.phases) : Array(N).fill(''),
      inputs: Array.isArray(o.inputs) ? padToN(o.inputs) : Array(N).fill(''),
      assetBibles: (o.assetBibles && typeof o.assetBibles === 'object') ? o.assetBibles : {},
    };
  } catch { return null; }
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
    const assetObj = (r.asset_bibles && typeof r.asset_bibles === 'object') ? r.asset_bibles : {};
    return {
      id: r.id,
      title: r.title ?? '未命名剧本',
      // 6 阶段对应 phase_1..phase_6(旧库 phase_7 忽略)
      phases: [r.phase_1, r.phase_2, r.phase_3, r.phase_4, r.phase_5, r.phase_6].map((s: any) => s ?? ''),
      inputs: Array.from({ length: N }, (_, i) => (inputsObj[String(i)] ?? inputsObj[i] ?? '')),
      assetBibles: assetObj,
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
      inputs: inputsObj,
      asset_bibles: p.assetBibles || {},
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
// prev: { 阶段号(1基): 内容 }
//   ②←① ③④←① ⑤←①②③④ ⑥←①②⑤③④
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

// ---------- Asset Bible 按需钻取 ----------
// assetName: 资产标识(编号 + 名称),envBible: ④Environment Bible 全文上下文
export async function generateAssetBible(
  assetName: string,
  envBible: string,
  input: string,
  userId?: string,
): Promise<string> {
  const res = await fetch('/api/gem/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'asset', assetName, envBible, input, userId }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `生成失败(${res.status})`);
  return data.result || '';
}

// ---------- 从 Environment Bible 文本解析资产清单 ----------
// 匹配格式 "- 编号 | 资产名 | 一句话",同时识别 4 个分类标题
export interface ParsedAsset {
  id: string;        // 资产编号(如 WT001),无编号则用名称
  name: string;      // 资产名
  note: string;      // 一句话说明
  category: string;  // Structures / Props / Natural Elements / Background Elements
}

export function parseAssets(envBible: string): ParsedAsset[] {
  if (!envBible) return [];
  const lines = envBible.split('\n');
  const out: ParsedAsset[] = [];
  let category = '其他';
  const catMap: { kw: string; label: string }[] = [
    { kw: 'Structures', label: 'Structures 建筑/结构' },
    { kw: 'Props', label: 'Props 道具' },
    { kw: 'Natural', label: 'Natural Elements 自然元素' },
    { kw: 'Background', label: 'Background Elements 背景元素' },
  ];
  for (const raw of lines) {
    const line = raw.trim();
    // 分类标题行
    const cat = catMap.find((c) => line.includes(c.kw) && (line.includes(':') || line.includes('：') || line.endsWith(c.kw) || /[一-龥]/.test(line)));
    if (cat && !line.startsWith('-')) { category = cat.label; continue; }
    // 资产行:- 编号 | 名称 | 说明  或  - 名称 | 说明
    if (line.startsWith('-')) {
      const body = line.replace(/^[-•·]\s*/, '');
      const parts = body.split(/\s*\|\s*/);
      if (parts.length >= 2) {
        // 判断第一段是不是编号(字母+数字)
        const first = parts[0].trim();
        const isId = /^[A-Za-z]{1,4}\d{2,4}$/.test(first);
        if (isId && parts.length >= 2) {
          out.push({ id: first, name: (parts[1] || '').trim(), note: (parts[2] || '').trim(), category });
        } else {
          out.push({ id: first, name: first, note: (parts[1] || '').trim(), category });
        }
      }
    }
  }
  return out;
}
