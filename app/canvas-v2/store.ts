'use client';

import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

// ============ 节点数据模型 ============
export type NodeKind = 'image' | 'video' | 'text' | 'seedance' | 'kling' | 'character' | 'gem' | 'extend' | 'gem3' | 'gem4' | 'gem3';
export type NodeStatus = 'empty' | 'generating' | 'done' | 'error';

// 端口加号菜单的 6 项功能（我们自己的功能，非 TapNow）
export type SpawnAction =
  | 'image'        // 图片生成
  | 'video'        // 视频生成
  | 'seedance'     // Seedance 视频
  | 'character'    // 角色设计
  | 'gem'          // GEM 分镜设计
  | 'extend';      // 时空镜头延展

// 每项菜单 → 输出哪种卡片 + 该卡的预设模型/模式
export const SPAWN_MENU: { action: SpawnAction; label: string; kind: NodeKind; icon: string }[] = [
  { action: 'image', label: '图片生成', kind: 'image', icon: 'image' },
  { action: 'video', label: '视频生成', kind: 'video', icon: 'video' },
  { action: 'seedance', label: 'Seedance 视频', kind: 'video', icon: 'video' },
  { action: 'character', label: '角色设计', kind: 'character', icon: 'image' },
  { action: 'gem', label: 'GEM 分镜设计', kind: 'gem', icon: 'split' },
  { action: 'extend', label: '时空镜头延展', kind: 'extend', icon: 'image' },
];

export interface CardData extends Record<string, unknown> {
  kind: NodeKind;
  status: NodeStatus;
  // 收起/展开（独有特点：右上角 − 收起 / + 展开）
  collapsed?: boolean;
  // 就地按比例放大
  enlarged?: boolean;
  // 成品内容
  outputUrl: string | null;
  // 文本节点内容
  text?: string;
  // 进度（generating 时）
  progress?: number;
  // 隐藏参数（点击卡片才在弹窗显示）
  config: {
    model: string;
    prompt: string;
    ratio?: string;
    resolution?: string;
    duration?: number;
    // 图片卡片专用
    imageQuality?: string;      // 清晰度/画质 2k|4k|medium|high
    preset?: string;            // 预设参数(风格)
    refImages?: string[];       // 参考图 URL 数组
    // 视频卡片专用
    audio?: boolean;            // 音频开关(生成视频是否带音频)
    firstFrame?: string;        // 首帧图 URL
    lastFrame?: string;         // 尾帧图 URL(首尾帧模式)
    // Seedance 多模态专用
    refVideos?: string[];       // 参考视频 URL 数组(最多 3 个)
    refVideoNames?: string[];   // 参考视频名数组
    refAudio?: string;          // 参考音频 URL
    refAudioName?: string;      // 参考音频名
    // 文本卡提示词优化专用
    textDuration?: string;      // 优化时长(4-8秒/9-12秒/13-15秒/>15秒)
  };
  // 输出图片真实宽高(按原图比例显示卡片用)
  aspectW?: number;
  aspectH?: number;
}

export type CardNode = Node<CardData>;

interface CanvasState {
  nodes: CardNode[];
  edges: Edge[];
  selectedId: string | null;

  onNodesChange: OnNodesChange<CardNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  setSelected: (id: string | null) => void;
  updateConfig: (id: string, patch: Partial<CardData['config']>) => void;
  updateCard: (id: string, patch: Partial<CardData>) => void;
  // 剧情分段：基于某文本卡的故事，新建一个自动连接的下游文本卡
  splitStory: (sourceId: string) => void;
  // 端口加号菜单：从某节点引用生成下游卡片
  spawnFrom: (sourceId: string, action: SpawnAction) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    set({ edges: addEdge({ ...connection, animated: true }, get().edges) });
  },

  setSelected: (id) => set({ selectedId: id }),

  updateConfig: (id, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } }
          : n
      ),
    });
  },

  updateCard: (id, patch) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    });
  },

  // 剧情分段：调用专门模型（此处模拟），新建下游文本卡并自动连线
  // 输出载体仍是文本卡 —— 新卡点击照样有弹窗、还能再分段
  splitStory: (sourceId) => {
    const src = get().nodes.find((n) => n.id === sourceId);
    if (!src) return;
    const newId = `t${Date.now()}`;
    const newNode: CardNode = {
      id: newId,
      type: 'card',
      position: { x: src.position.x + 360, y: src.position.y },
      data: {
        kind: 'text',
        status: 'done',
        outputUrl: null,
        // 模拟分段输出（真实环境调剧情分段模型）
        text: `【剧情分段结果】\n\n${
          (src.data.text || src.data.config.prompt || '（空）')
            .split(/[。！？\n]/)
            .filter(Boolean)
            .map((s, i) => `第${i + 1}段：${s.trim()}`)
            .join('\n')
        }`,
        config: { model: src.data.config.model, prompt: '' },
      },
    };
    set({
      nodes: [...get().nodes, newNode],
      edges: addEdge(
        { id: `e${sourceId}-${newId}`, source: sourceId, target: newId, animated: true },
        get().edges
      ),
      selectedId: newId,
    });
  },

  // 端口加号菜单：从某节点引用生成下游卡片（6 项功能）
  // 输出卡片类型由 SPAWN_MENU 决定，自动连线
  spawnFrom: (sourceId, action) => {
    const src = get().nodes.find((n) => n.id === sourceId);
    if (!src) return;
    const menu = SPAWN_MENU.find((m) => m.action === action);
    if (!menu) return;
    const newId = `${menu.kind[0]}${Date.now()}`;
    const modelMap: Record<SpawnAction, string> = {
      image: 'nano-banana-pro',
      video: 'jimeng-i2v',
      seedance: 'doubao-seedance-2-0-260128',
      character: 'nano-banana-pro',
      gem: 'nano-banana-pro',
      extend: 'nano-banana-pro',
    };
    const newNode: CardNode = {
      id: newId,
      type: 'card',
      position: { x: src.position.x + 340, y: src.position.y + 40 },
      data: {
        kind: menu.kind,
        status: 'empty',
        outputUrl: null,
        text: '',
        config: {
          model: modelMap[action],
          prompt: '',
          ...(menu.kind !== 'text' ? { ratio: '1:1' } : {}),
        },
      },
    };
    set({
      nodes: [...get().nodes, newNode],
      edges: addEdge(
        { id: `e${sourceId}-${newId}`, source: sourceId, target: newId, animated: true },
        get().edges
      ),
      selectedId: newId,
    });
  },
}));
