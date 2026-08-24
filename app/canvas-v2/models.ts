'use client';

// ============ 文本模型配置 ============
// 来源:app/api/chat/route.ts 的 MODEL_MAP(原项目真实支持的 15 个模型)
// tier: advanced=高级(扣费多) basic=基础

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
  { id: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', group: 'GPT', tier: 'advanced' },
  { id: 'gpt-5.1-chat', label: 'GPT-5.1 Chat', group: 'GPT', tier: 'advanced' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', group: 'GPT', tier: 'basic' },
  // Gemini 系列
  { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', group: 'Gemini', tier: 'advanced' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', group: 'Gemini', tier: 'advanced' },
  { id: 'gemini-2.5-pro-all', label: 'Gemini 2.5 Pro', group: 'Gemini', tier: 'advanced' },
  { id: 'gemini-2.5-flash-all', label: 'Gemini 2.5 Flash', group: 'Gemini', tier: 'advanced' },
  { id: 'gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash Lite', group: 'Gemini', tier: 'basic' },
  // Claude 系列
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', group: 'Claude', tier: 'advanced' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', group: 'Claude', tier: 'advanced' },
  // Grok 系列
  { id: 'grok-4.1', label: 'Grok 4.1', group: 'Grok', tier: 'advanced' },
  { id: 'grok-4', label: 'Grok 4', group: 'Grok', tier: 'advanced' },
  { id: 'grok-3-mini', label: 'Grok 3 mini', group: 'Grok', tier: 'basic' },
];

export const DEFAULT_TEXT_MODEL = 'gpt-5.1-chat';

// 按 group 分组,方便下拉显示
export function groupedTextModels(): Record<string, TextModel[]> {
  const out: Record<string, TextModel[]> = {};
  for (const m of TEXT_MODELS) {
    (out[m.group] ??= []).push(m);
  }
  return out;
}
