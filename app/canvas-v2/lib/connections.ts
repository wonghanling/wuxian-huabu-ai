'use client';

import { useCanvasStore, type CardNode } from '../store';

// ============================================================
// 连线传参 — React Flow edges 版(复刻原网 tldraw binding 的"下游拉上游输出")
// 原网:下游遍历"连到我的边"→找上游→读上游输出字段→填到自己输入
// React Flow:edges 是 {source, target} 数组,直接找 target===我 的边,source 就是上游
// ============================================================

export interface UpstreamOutputs {
  images: string[];   // 上游输出的图片 URL(图片卡/角色设计/Step4/时空镜头延展的成品图)
  videos: string[];   // 上游输出的视频 URL(视频卡/Seedance/Kling)
  texts: string[];    // 上游输出的文案(文本卡/GEM分镜/导演引擎Step3)
  audios: string[];   // 上游音频 URL
}

// 读取连到指定节点的所有上游节点的输出
export function getUpstreamOutputs(nodeId: string): UpstreamOutputs {
  const { nodes, edges } = useCanvasStore.getState();
  const out: UpstreamOutputs = { images: [], videos: [], texts: [], audios: [] };

  // 找所有 target === nodeId 的边,它们的 source 是上游
  const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
  for (const upId of upstreamIds) {
    const up = nodes.find((n) => n.id === upId) as CardNode | undefined;
    if (!up) continue;
    const d = up.data;
    if (d.status !== 'done') continue;  // 上游没出结果就跳过

    switch (d.kind) {
      case 'image':
      case 'character':
      case 'gem4':       // 导演引擎Step4 输出分镜图
      case 'extend':     // 时空镜头延展 输出图
        if (d.outputUrl) out.images.push(d.outputUrl);
        break;
      case 'video':
      case 'seedance':
      case 'kling':
        if (d.outputUrl) out.videos.push(d.outputUrl);
        break;
      case 'text':
      case 'gem':        // GEM分镜 输出文案
      case 'gem3':       // 导演引擎Step3 输出过渡指令
        if (d.text) out.texts.push(d.text);
        break;
    }
  }
  return out;
}

// 是否有任意上游连接
export function hasUpstream(nodeId: string): boolean {
  const { edges } = useCanvasStore.getState();
  return edges.some((e) => e.target === nodeId);
}
