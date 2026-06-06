'use client';

import { type NodeProps } from '@xyflow/react';
import { type CardNode } from '../store';
import { TextNode } from './TextNode';
import { ImageNode } from './ImageNode';
import { VideoNode } from './VideoNode';
import { SeedanceNode } from './SeedanceNode';
import { KlingNode } from './KlingNode';
import { CharacterNode } from './CharacterNode';
import { GemNode } from './GemNode';
import { ExtendNode } from './ExtendNode';
import { GemStep3Node } from './GemStep3Node';
import { GemStep4Node } from './GemStep4Node';
import { UploadNode } from './UploadNode';
import { AudioNode } from './AudioNode';
import { ShotNode } from './ShotNode';
import { TimelineNode } from './TimelineNode';

// 调度:按 data.kind 渲染对应卡片(统一 type='card')
// 这样 spawnFrom/splitStory 生成的卡片自动用对的组件
function CardDispatchComponent(props: NodeProps<CardNode>) {
  const kind = props.data.kind;
  if (kind === 'image') return <ImageNode {...props} />;
  if (kind === 'video') return <VideoNode {...props} />;
  if (kind === 'seedance') return <SeedanceNode {...props} />;
  if (kind === 'kling') return <KlingNode {...props} />;
  if (kind === 'character') return <CharacterNode {...props} />;
  if (kind === 'gem') return <GemNode {...props} />;
  if (kind === 'extend') return <ExtendNode {...props} />;
  if (kind === 'gem3') return <GemStep3Node {...props} />;
  if (kind === 'gem4') return <GemStep4Node {...props} />;
  if (kind === 'upload') return <UploadNode {...props} />;
  if (kind === 'audio') return <AudioNode {...props} />;
  if (kind === 'shot') return <ShotNode {...props} />;
  if (kind === 'timeline') return <TimelineNode {...props} />;
  return <TextNode {...props} />;
}

export const CardDispatch = CardDispatchComponent;
