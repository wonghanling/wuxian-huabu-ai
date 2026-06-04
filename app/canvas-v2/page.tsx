'use client';

import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  BackgroundVariant,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, type CardNode } from './store';
import { CardDispatch } from './nodes/CardDispatch';
import { useCanvasPersistence } from './lib/usePersistence';
import { DEFAULT_TEXT_MODEL } from './models';
import { DEFAULT_IMAGE_MODEL } from './imageModels';
import { DEFAULT_VIDEO_MODEL } from './videoModels';
import { DEFAULT_SEEDANCE_MODEL } from './seedanceConfig';

const nodeTypes: NodeTypes = { card: CardDispatch };

function makeTextNode(i: number, x: number, y: number): CardNode {
  return {
    id: `t${i}`,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'text',
      status: 'empty',
      outputUrl: null,
      text: '',
      config: { model: DEFAULT_TEXT_MODEL, prompt: '' },
    },
  };
}

function makeImageNode(i: number, x: number, y: number): CardNode {
  return {
    id: `i${i}`,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'image',
      status: 'empty',
      outputUrl: null,
      config: { model: DEFAULT_IMAGE_MODEL, prompt: '', ratio: '1:1', imageQuality: '2k' },
    },
  };
}

function makeVideoNode(i: number, x: number, y: number): CardNode {
  return {
    id: `v${i}`,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'video',
      status: 'empty',
      outputUrl: null,
      config: { model: DEFAULT_VIDEO_MODEL, prompt: '', ratio: '16:9', duration: 5, resolution: '720p', audio: false },
    },
  };
}

function makeSeedanceNode(i: number, x: number, y: number): CardNode {
  return {
    id: `s${i}`,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'seedance',
      status: 'empty',
      outputUrl: null,
      // preset 字段存 Seedance 模式(t2v/i2v/first-last/multimodal)
      config: { model: DEFAULT_SEEDANCE_MODEL, prompt: '', preset: 't2v', ratio: '16:9', duration: 5, resolution: '720p', audio: true, refImages: [], refVideos: [] },
    },
  };
}

function makeKlingNode(i: number, x: number, y: number): CardNode {
  return {
    id: `k${i}`,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'kling',
      status: 'empty',
      outputUrl: null,
      config: { model: '', prompt: '', refVideos: [], refVideoNames: [] },
    },
  };
}

function makeCharacterNode(i: number, x: number, y: number): CardNode {
  return {
    id: 'ch' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'character',
      status: 'empty',
      outputUrl: null,
      config: { model: 'nano-banana-pro', prompt: '', ratio: '1:1', imageQuality: '2k', refImages: [] },
    },
  };
}

function makeGemNode(i: number, x: number, y: number): CardNode {
  return {
    id: 'g' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'gem',
      status: 'empty',
      outputUrl: null,
      text: '',
      config: { model: '', prompt: '', preset: 'story', textDuration: '9', ratio: '', refImages: [] },
    },
  };
}

function makeExtendNode(i: number, x: number, y: number): CardNode {
  return {
    id: 'ex' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'extend',
      status: 'empty',
      outputUrl: null,
      config: { model: 'nano-banana-pro', prompt: '', ratio: '16:9', imageQuality: '2k' },
    },
  };
}

function makeGem3Node(i: number, x: number, y: number): CardNode {
  return {
    id: 'g3' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'gem3',
      status: 'empty',
      outputUrl: null,
      text: '',
      config: { model: '', prompt: '', ratio: '', preset: '', refImages: [] },
    },
  };
}

function makeGem4Node(i: number, x: number, y: number): CardNode {
  return {
    id: 'g4' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'gem4',
      status: 'empty',
      outputUrl: null,
      config: { model: '', prompt: '', ratio: '16:9', duration: 5, imageQuality: 'normal', textDuration: 'single', refImages: [] },
    },
  };
}

export default function CanvasV2Page() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setSelected = useCanvasStore((s) => s.setSelected);

  const [seq, setSeq] = useState(10);

  // 画布持久化:加载历史快照 / 自动保存 / 空画布保护(完整复刻原网)
  const { status: saveStatus, loading: canvasLoading } = useCanvasPersistence();

  // 加载完成后,若画布为空(无历史)才放演示卡;有历史则不动
  useEffect(() => {
    if (canvasLoading) return;
    const cur = useCanvasStore.getState().nodes;
    if (cur.length === 0) {
      useCanvasStore.setState({
        nodes: [
          makeSeedanceNode(0, 80, 120),
          makeVideoNode(1, 600, 120),
        ],
        edges: [],
        selectedId: null,
      });
    }
  }, [canvasLoading]);

  // 节点/连线变化 → 触发节流保存(加载完成后才生效,空画布保护在 hook 内)
  useEffect(() => {
    if (canvasLoading) return;
    (window as any).saveCanvasV2Now?.();
  }, [nodes, edges, canvasLoading]);

  const addImageCard = useCallback(() => {
    const n = makeImageNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addTextCard = useCallback(() => {
    const n = makeTextNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addVideoCard = useCallback(() => {
    const n = makeVideoNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addSeedanceCard = useCallback(() => {
    const n = makeSeedanceNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addGem3Card = useCallback(() => {
    const n = makeGem3Node(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addGem4Card = useCallback(() => {
    const n = makeGem4Node(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);
  const addExtendCard = useCallback(() => {
    const n = makeExtendNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addGemCard = useCallback(() => {
    const n = makeGemNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addCharacterCard = useCallback(() => {
    const n = makeCharacterNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const addKlingCard = useCallback(() => {
    const n = makeKlingNode(seq, 80 + (seq % 4) * 380, 120 + Math.floor(seq / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
    setSeq((v) => v + 1);
  }, [seq]);

  const onNodeClick: NodeMouseHandler<CardNode> = useCallback(
    (_, node) => setSelected(node.id),
    [setSelected]
  );
  const onPaneClick = useCallback(() => setSelected(null), [setSelected]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onlyRenderVisibleElements
        minZoom={0.2}
        maxZoom={2}
        nodeDragThreshold={2}
        elevateNodesOnSelect
        connectionRadius={48}
        deleteKeyCode={null}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        panOnScroll
        zoomActivationKeyCode={null}
        defaultViewport={{ x: 60, y: 60, zoom: 0.9 }}
        defaultEdgeOptions={{ animated: true, style: { stroke: 'rgba(192,192,192,0.7)', strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#27272a" />
        <Controls />

        <Panel position="top-left">
          <div style={topBar}>
            <span style={{ fontWeight: 600, letterSpacing: '0.1em' }}>FILMAVO · v2</span>
            <span style={{ color: '#71717a' }}>|</span>
            <button onClick={addSeedanceCard} style={addBtn}>+ Seedance</button>
            <button onClick={addKlingCard} style={addBtnGhost}>+ Kling 对口型</button>
            <button onClick={addGem3Card} style={addBtnGhost}>+ 导演引擎 Step3</button>
            <button onClick={addGem4Card} style={addBtnGhost}>+ 导演引擎 Step4</button>
            <button onClick={addExtendCard} style={addBtnGhost}>+ 时空镜头延展</button>
            <button onClick={addGemCard} style={addBtnGhost}>+ GEM 分镜</button>
            <button onClick={addCharacterCard} style={addBtnGhost}>+ 角色设计</button>
            <button onClick={addVideoCard} style={addBtnGhost}>+ 视频卡片</button>
            <button onClick={addImageCard} style={addBtnGhost}>+ 图片卡片</button>
            <button onClick={addTextCard} style={addBtnGhost}>+ 文本卡片</button>
          </div>
        </Panel>
      </ReactFlow>

      {/* 端口 hover 显隐 + 吸附高亮(市面标准交互) */}
      <style>{`
        /* 端口默认隐藏,鼠标靠近卡片才浮现,与卡片有空隙 */
        .react-flow__node .rf-port {
          opacity: 0;
          transition: opacity .18s ease, transform .15s ease;
        }
        .react-flow__node:hover .rf-port,
        .react-flow__node.selected .rf-port {
          opacity: 1;
        }
        /* 端口 hover 放大(吸附手感) */
        .react-flow__handle.rf-port:hover {
          transform: scale(1.2);
        }
        /* 连接时高亮可连端口 */
        .react-flow__handle.connectingto {
          box-shadow: 0 0 0 7px rgba(192,192,192,0.3) !important;
          transform: scale(1.25);
        }
        /* 修复:React Flow 全局 user-select:none 会禁掉输入框选字。
           强制 textarea/input 可选可拖选(底部 prompt、双击编辑都生效) */
        .react-flow textarea,
        .react-flow input,
        .react-flow .nodrag {
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          cursor: text;
        }
        /* NodeToolbar 可能 portal 到 .react-flow 外,补一条不限父级的规则 */
        .react-flow__node-toolbar textarea,
        .react-flow__node-toolbar input {
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          cursor: text;
        }
        /* 弹窗滚动条:极细、半透明、悬停才明显(优雅隐藏) */
        .cv2-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        .cv2-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .cv2-scroll::-webkit-scrollbar-track { background: transparent; }
        .cv2-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 99px;
        }
        .cv2-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.28);
        }
      `}</style>
    </div>
  );
}

const topBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  background: 'rgba(18,18,22,0.9)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 999,
  color: '#e4e4e7',
  fontSize: 12,
};
const addBtn: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 999,
  border: 'none',
  background: '#fff',
  color: '#000',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};
const addBtnGhost: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: '#e4e4e7',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};
