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
export type NodeKind = 'image' | 'video' | 'text' | 'seedance' | 'kling' | 'character' | 'gem' | 'extend' | 'gem3' | 'gem4' | 'upload' | 'audio' | 'shot' | 'timeline' | 'tryon';
export type NodeStatus = 'empty' | 'generating' | 'done' | 'error';

// 端口加号菜单功能(照原网"继续创建下游卡片")
export type SpawnAction =
  | 'image'        // 图片生成
  | 'video'        // 视频生成
  | 'seedance'     // Seedance 视频(图生/多模态)
  | 'seedanceMM'   // Seedance 多模态(视频输出连接用)
  | 'kling'        // Kling 视频配音(视频输出连接用)
  | 'character'    // 角色设计
  | 'gem'          // GEM 分镜设计
  | 'extend';      // 时空镜头延展

// 单个菜单项定义
export interface SpawnItem { action: SpawnAction; label: string; kind: NodeKind; icon: string }

// 全量菜单项(供规则表引用)
const SPAWN_ITEMS: Record<SpawnAction, SpawnItem> = {
  image:     { action: 'image',     label: '图片生成',      kind: 'image',     icon: 'image' },
  video:     { action: 'video',     label: '视频生成',      kind: 'video',     icon: 'video' },
  seedance:  { action: 'seedance',  label: 'Seedance 视频', kind: 'seedance',  icon: 'video' },
  seedanceMM:{ action: 'seedanceMM',label: 'Seedance 多模态',kind: 'seedance', icon: 'video' },
  kling:     { action: 'kling',     label: 'Kling 视频配音', kind: 'kling',     icon: 'video' },
  character: { action: 'character', label: '角色设计',      kind: 'character', icon: 'image' },
  gem:       { action: 'gem',       label: 'GEM 分镜设计',  kind: 'gem',       icon: 'split' },
  extend:    { action: 'extend',    label: '时空镜头延展',  kind: 'extend',    icon: 'image' },
};

// 连接规则表(照原网"+"号菜单,按源卡片类型决定可创建的下游):
// - 图片类(图片/角色/时空延展/Step4):6 项(图/视频/Seedance/角色/GEM/时空延展)
// - 视频类(视频/Seedance/Kling):2 项(Seedance 多模态 / Kling 配音)
// - Step2(gem):仅图片生成卡片
// - Step3/文本(gem3/text):原网无"+"号菜单 → 空(不显示加号)
const IMAGE_OUTPUT_ACTIONS: SpawnAction[] = ['image', 'video', 'seedance', 'character', 'gem', 'extend'];
const VIDEO_OUTPUT_ACTIONS: SpawnAction[] = ['seedanceMM', 'kling'];
const SPAWN_RULES: Record<NodeKind, SpawnAction[]> = {
  image:     IMAGE_OUTPUT_ACTIONS,
  character: IMAGE_OUTPUT_ACTIONS,
  tryon:     IMAGE_OUTPUT_ACTIONS,   // 虚拟试衣输出图→图片卡菜单
  extend:    IMAGE_OUTPUT_ACTIONS,
  upload:    IMAGE_OUTPUT_ACTIONS,   // 素材上传卡=图片卡菜单(照原网 mediaUploadCardOptions)
  video:     VIDEO_OUTPUT_ACTIONS,
  seedance:  VIDEO_OUTPUT_ACTIONS,
  kling:     VIDEO_OUTPUT_ACTIONS,
  gem:       ['image'],              // Step2 仅连图片生成卡片
  gem3:      [],                     // Step3 原网无加号
  gem4:      IMAGE_OUTPUT_ACTIONS, // Step4 输出分镜图→可建 Seedance/视频/Step2 等下游
  text:      [],                     // 文本卡原网无加号
  audio:     VIDEO_OUTPUT_ACTIONS,   // 语音卡输出音频→连 Seedance/Kling 配音
  shot:      VIDEO_OUTPUT_ACTIONS,   // 电影控制器输出指令→连视频/Seedance/Kling(照原网连视频卡)
  timeline:  [],                     // 时间刻度条:形式上的,无下游菜单(仅手动拖线)
};

// 取某源卡片类型可创建的下游菜单项(空数组 = 不显示加号)
export function getSpawnItems(kind: NodeKind): SpawnItem[] {
  return (SPAWN_RULES[kind] ?? []).map((a) => SPAWN_ITEMS[a]);
}

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
    refVoices?: string[];       // wan2.7-r2v 音色:按参考素材顺序(图先视频后)依次分配,本地上传优先,连线语音补空缺
    controlJson?: string;       // 图片卡 JSON 控制(用户自填,生成时作系统级前缀注入 prompt)
    clothingImage?: string;     // 虚拟试衣:衣服图 URL(人物图复用 refImages[0])
    preservePose?: boolean;     // 虚拟试衣:保留人物姿势
    // 视频卡片专用
    audio?: boolean;            // 音频开关(生成视频是否带音频)
    firstFrame?: string;        // 首帧图 URL
    lastFrame?: string;         // 尾帧图 URL(首尾帧模式)
    // Seedance 多模态专用
    refVideos?: string[];       // 参考视频 URL 数组(最多 3 个)
    refVideoNames?: string[];   // 参考视频名数组
    refAudio?: string;          // 参考音频 URL
    refAudioName?: string;      // 参考音频名
    editVideo?: string;         // wan2.7/happyhorse 视频编辑:待编辑视频 URL
    // 文本卡提示词优化专用
    textDuration?: string;      // 优化时长(4-8秒/9-12秒/13-15秒/>15秒)
    // 视频剪辑(方案A:区间标记,播放只循环此段,下载按段录制)
    trimStart?: number;         // 剪辑起点(秒)
    trimEnd?: number;           // 剪辑终点(秒)
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
  // 一键收起/展开所有卡片
  collapseAll: (collapsed: boolean) => void;
  // 剧情分段：基于某文本卡的故事，新建一个自动连接的下游文本卡
  splitStory: (sourceId: string) => void;
  // 端口加号菜单：从某节点引用生成下游卡片
  spawnFrom: (sourceId: string, action: SpawnAction) => void;
  // 剧本工作室"发送到画布"：在画布上新建一张预填内容的卡片(不自动连线/生成)
  // 返回新卡 id;多张连续发送时按 index 错位铺开
  addCardFromStudio: (kind: 'text' | 'character' | 'image', prefillText: string, index?: number) => string;
  // 涂鸦编辑:用涂鸦图当参考图新建图片卡,返回新卡 id
  addImageCardWithRef: (refUrl: string, prompt: string, model: string) => string;
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

  // 一键收起/展开所有卡片(画布放大器:全部缩成小卡片)
  collapseAll: (collapsed) => {
    set({
      nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, collapsed } })),
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

  // 端口加号菜单:从某节点引用生成下游卡片(按 SPAWN_RULES 分类型)
  // 输出卡片类型由 action 决定,自动连线
  spawnFrom: (sourceId, action) => {
    const src = get().nodes.find((n) => n.id === sourceId);
    if (!src) return;
    const menu = SPAWN_ITEMS[action];
    if (!menu) return;
    const newId = `${menu.kind[0]}${Date.now()}`;
    const modelMap: Record<SpawnAction, string> = {
      image: 'nano-banana-pro',
      video: 'jimeng-i2v',
      seedance: 'doubao-seedance-2-0-260128',
      seedanceMM: 'doubao-seedance-2-0-260128',
      kling: '',
      character: 'nano-banana-pro',
      gem: 'nano-banana-pro',
      extend: 'nano-banana-pro',
    };
    // 各类型卡片的初始 config(Seedance 多模态预设 multimodal 模式)
    const baseConfig: any = { model: modelMap[action], prompt: '' };
    if (action === 'seedance') baseConfig.preset = 't2v';
    if (action === 'seedanceMM') baseConfig.preset = 'multimodal';
    if (menu.kind === 'kling') { baseConfig.refVideos = []; baseConfig.refVideoNames = []; }
    if (menu.kind !== 'text' && menu.kind !== 'kling') baseConfig.ratio = '1:1';
    const newNode: CardNode = {
      id: newId,
      type: 'card',
      position: { x: src.position.x + 340, y: src.position.y + 40 },
      data: {
        kind: menu.kind,
        status: 'empty',
        outputUrl: null,
        text: '',
        config: baseConfig,
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

  // 剧本工作室"发送到画布":新建一张预填内容的卡片(不连线、不自动生成)
  // text: 内容填进 text 字段、done 态(像已生成的文本卡)
  // character/image: 内容填进 config.prompt、empty 态(用户自己点生成)
  addCardFromStudio: (kind, prefillText, index = 0) => {
    const newId = `${kind[0]}${Date.now()}${index}`;
    // 在现有节点附近错位铺开:基准点取已有节点的右侧,多张按 index 排列
    const nodes = get().nodes;
    const baseX = nodes.length ? Math.max(...nodes.map((n) => n.position.x)) + 380 : 120;
    const baseY = 120;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const position = { x: baseX + col * 360, y: baseY + row * 340 };

    const isText = kind === 'text';
    const baseConfig: any = {
      model: kind === 'text' ? '' : 'nano-banana-pro',
      prompt: isText ? '' : prefillText,
    };
    if (!isText) { baseConfig.ratio = '1:1'; baseConfig.imageQuality = '2k'; baseConfig.refImages = []; }

    const newNode: CardNode = {
      id: newId,
      type: 'card',
      position,
      data: {
        kind,
        status: isText ? 'done' : 'empty',
        outputUrl: null,
        text: isText ? prefillText : '',
        config: baseConfig,
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedId: newId });
    return newId;
  },

  // 涂鸦编辑:把涂鸦合成图作为新图片卡的成品显示(done态),同时存进 refImages 供连线给生成卡当参考
  addImageCardWithRef: (refUrl, prompt, model) => {
    const newId = `i${Date.now()}`;
    const src = get().nodes.find((n) => n.id === get().selectedId);
    const baseX = src ? src.position.x + 360 : (get().nodes.length ? Math.max(...get().nodes.map((n) => n.position.x)) + 380 : 120);
    const baseY = src ? src.position.y + 40 : 120;
    const newNode: CardNode = {
      id: newId,
      type: 'card',
      position: { x: baseX, y: baseY },
      data: {
        kind: 'image',
        status: 'done',           // 涂鸦图本身即成品,卡面直接显示
        outputUrl: refUrl,        // 卡面显示涂鸦后的图
        text: '',
        config: { model: model || 'nano-banana-pro', prompt: prompt || '', ratio: '1:1', imageQuality: '2k', refImages: [refUrl] },
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedId: newId });
    return newId;
  },
}));
