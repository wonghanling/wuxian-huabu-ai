'use client';

import { useMemo } from 'react';
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
      case 'extend':     // 时空镜头延展 输出图
        if (d.outputUrl) out.images.push(d.outputUrl);
        break;
      case 'gem4':       // 导演引擎Step4:既输出分镜图,也输出文案(result)
        if (d.outputUrl) out.images.push(d.outputUrl);
        if (d.text) out.texts.push(d.text);
        break;
      case 'video':
      case 'seedance':
      case 'kling':
        if (d.outputUrl) out.videos.push(d.outputUrl);
        break;
      case 'upload':     // 素材上传卡:按 mediaType 归类到图/视频
        if (d.outputUrl) {
          if ((d.config as any)?.mediaType === 'video') out.videos.push(d.outputUrl);
          else out.images.push(d.outputUrl);
        }
        break;
      case 'audio':      // 语音合成卡:输出音频 → 连 Seedance/Kling 配音
        if (d.outputUrl) out.audios.push(d.outputUrl);
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

// 响应式 hook:订阅 nodes/edges 变化,连线/上游出图后实时返回上游输出
// 卡片用它做"连上线立即显示上游图/文案"(像原网)
export function useUpstream(nodeId: string): UpstreamOutputs {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  return useMemo(() => {
    const out: UpstreamOutputs = { images: [], videos: [], texts: [], audios: [] };
    const upstreamIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    for (const upId of upstreamIds) {
      const up = nodes.find((n) => n.id === upId);
      if (!up) continue;
      const d = up.data;
      if (d.status !== 'done') continue;
      switch (d.kind) {
        case 'image': case 'character': case 'extend':
          if (d.outputUrl) out.images.push(d.outputUrl);
          break;
        case 'gem4':   // Step4:既出图也出文案
          if (d.outputUrl) out.images.push(d.outputUrl);
          if (d.text) out.texts.push(d.text);
          break;
        case 'video': case 'seedance': case 'kling':
          if (d.outputUrl) out.videos.push(d.outputUrl);
          break;
        case 'upload':   // 素材卡:按 mediaType 归类
          if (d.outputUrl) {
            if ((d.config as any)?.mediaType === 'video') out.videos.push(d.outputUrl);
            else out.images.push(d.outputUrl);
          }
          break;
        case 'audio':    // 语音合成卡:输出音频
          if (d.outputUrl) out.audios.push(d.outputUrl);
          break;
        case 'text': case 'gem': case 'gem3':
          if (d.text) out.texts.push(d.text);
          break;
      }
    }
    return out;
  }, [nodes, edges, nodeId]);
}
