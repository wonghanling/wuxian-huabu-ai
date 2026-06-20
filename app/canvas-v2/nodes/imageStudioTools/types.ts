'use client';

import type { ReactNode } from 'react';

// ============================================================
// Image Studio 工具插件契约
// 每个工具自包含：在 overlaySlot 渲染图上覆盖层，在 panelSlot 渲染右侧操作面板
// 加新工具 = 新增一个实现 ImageTool 的组件，注册进 TOOLS，不改框架
// ============================================================

export interface ToolContext {
  imageUrl: string;                       // 当前编辑的图（最新版本）
  displaySize: { w: number; h: number };  // 图在编辑区的显示尺寸
  imgNatural: { w: number; h: number } | null; // 图原始像素
  overlaySlot: HTMLElement | null;        // 中间图上覆盖层挂载点（绝对定位覆盖整图）
  panelSlot: HTMLElement | null;          // 右侧操作面板挂载点
  busy: boolean;
  setBusy: (b: boolean) => void;
  pushVersion: (url: string) => void;     // 生成成功 → 推一个新版本
  setError: (msg: string) => void;
}

export interface ImageToolMeta {
  id: string;
  label: string;
  enabled: boolean;        // V1 只有 region-edit 为 true
  hint?: string;           // disabled 时的提示
}

export interface ImageTool extends ImageToolMeta {
  // 工具主体：内部用 createPortal 把 overlay/panel 渲染到 ctx 的 slot
  render: (ctx: ToolContext) => ReactNode;
}
