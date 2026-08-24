'use client';

// ============ 文本模型配置 ============
// 来源:app/api/chat/route.ts 的 MODEL_MAP,两边必须同步
// tier: advanced=高级(扣费多) basic=基础
//
// 只保留实测能真正调通的模型。n1n 上游大改版后,"在 /v1/models 清单里"
// 不等于"能调用" —— 下架的 7 个里有 3 个仍在清单中却持续报"上游负载
// 已饱和",grok-4.1 更是 88 个分组全部"无可用渠道"。
// 所以增删模型前要实发一次 chat 请求验证,不能只看清单。

export interface TextModel {
  id: string;       // 传给 /api/chat 的 model 值
  label: string;    // 显示名
  group: string;    // 分组(下拉里归类)
  tier: 'advanced' | 'basic';
}

export const TEXT_MODELS: TextModel[] = [
  // GPT 系列
  { id: 'gpt-5.2', label: 'GPT-5.2', group: 'GPT', tier: 'advanced' },
  { id: 'gpt-5.1-2025-11-13', label: 'GPT-5.1', group: 'GPT', tier: 'advanced' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', group: 'GPT', tier: 'basic' },
  // Gemini 系列
  { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', group: 'Gemini', tier: 'advanced' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', group: 'Gemini', tier: 'advanced' },
  // Claude 系列
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', group: 'Claude', tier: 'advanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', group: 'Claude', tier: 'advanced' },
  // Grok 系列
  { id: 'grok-4', label: 'Grok 4', group: 'Grok', tier: 'advanced' },
];

// 原默认 gpt-5.1-chat 已下架(上游负载持续饱和),换成实测稳定的 gpt-5.2
export const DEFAULT_TEXT_MODEL = 'gpt-5.2';

// 按 group 分组,方便下拉显示
export function groupedTextModels(): Record<string, TextModel[]> {
  const out: Record<string, TextModel[]> = {};
  for (const m of TEXT_MODELS) {
    (out[m.group] ??= []).push(m);
  }
  return out;
}
