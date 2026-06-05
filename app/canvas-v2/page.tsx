'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  BackgroundVariant,
  type NodeTypes,
  type EdgeTypes,
  type NodeMouseHandler,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCanvasStore, type CardNode } from './store';
import { CardDispatch } from './nodes/CardDispatch';
import { DeletableEdge } from './nodes/DeletableEdge';
import { ImageSplitModal } from './nodes/ImageSplitModal';
import { useCanvasPersistence } from './lib/usePersistence';
import { DEFAULT_TEXT_MODEL } from './models';
import { DEFAULT_IMAGE_MODEL } from './imageModels';
import { DEFAULT_VIDEO_MODEL } from './videoModels';
import { DEFAULT_SEEDANCE_MODEL } from './seedanceConfig';

const nodeTypes: NodeTypes = { card: CardDispatch };
const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

// 全局唯一 ID 生成器 — 防止与「从数据库加载回来的历史卡片」ID 冲突
// (历史卡 id 可能已是 i10/v11 等,若新建卡再用固定 seq 会撞 ID,
//  React 用 id 做 key,撞了会把已生成卡片在渲染上顶掉 → 看起来"消失")
let __uidCounter = 0;
function uid(): string {
  return `${Date.now().toString(36)}${(__uidCounter++).toString(36)}`;
}

function makeTextNode(i: string | number, x: number, y: number): CardNode {
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

function makeImageNode(i: string | number, x: number, y: number): CardNode {
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

function makeVideoNode(i: string | number, x: number, y: number): CardNode {
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

function makeSeedanceNode(i: string | number, x: number, y: number): CardNode {
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

function makeKlingNode(i: string | number, x: number, y: number): CardNode {
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

function makeCharacterNode(i: string | number, x: number, y: number): CardNode {
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

function makeGemNode(i: string | number, x: number, y: number): CardNode {
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

function makeExtendNode(i: string | number, x: number, y: number): CardNode {
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

function makeGem3Node(i: string | number, x: number, y: number): CardNode {
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

function makeGem4Node(i: string | number, x: number, y: number): CardNode {
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

function makeUploadNode(i: string | number, x: number, y: number): CardNode {
  return {
    id: 'u' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'upload',
      status: 'empty',
      outputUrl: null,
      config: { model: '', prompt: '' },
    },
  };
}

function makeAudioNode(i: string | number, x: number, y: number): CardNode {
  return {
    id: 'a' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'audio',
      status: 'empty',
      outputUrl: null,
      config: { model: '', prompt: '', audioMode: 'synthesize', voiceId: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85', speed: 1, vol: 1, pitch: 0, clonedVoices: '[]' } as any,
    },
  };
}

function CanvasV2Inner() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const collapseAll = useCanvasStore((s) => s.collapseAll);

  // 新建卡片的摆放位置计数器(只管错位摆放,不参与 ID 生成 → 不会撞 ID)
  const placeRef = useRef(0);
  // 工具栏分组下拉:当前展开的分组('video' | 'gem' | null)
  const [toolGroup, setToolGroup] = useState<'video' | 'gem' | null>(null);
  // 图片切割弹窗
  const [showSplit, setShowSplit] = useState(false);

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

  // 通用新建:uid() 唯一 ID(不撞历史卡) + placeRef 错位摆放
  const addCard = useCallback((make: (i: string, x: number, y: number) => CardNode) => {
    const c = placeRef.current++;
    const n = make(uid(), 80 + (c % 4) * 380, 120 + Math.floor(c / 4) * 360);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n] }));
  }, []);

  const addImageCard = useCallback(() => addCard(makeImageNode), [addCard]);
  const addTextCard = useCallback(() => addCard(makeTextNode), [addCard]);
  const addVideoCard = useCallback(() => addCard(makeVideoNode), [addCard]);
  const addSeedanceCard = useCallback(() => addCard(makeSeedanceNode), [addCard]);
  const addGem3Card = useCallback(() => addCard(makeGem3Node), [addCard]);
  const addGem4Card = useCallback(() => addCard(makeGem4Node), [addCard]);
  const addExtendCard = useCallback(() => addCard(makeExtendNode), [addCard]);
  const addGemCard = useCallback(() => addCard(makeGemNode), [addCard]);
  const addCharacterCard = useCallback(() => addCard(makeCharacterNode), [addCard]);
  const addKlingCard = useCallback(() => addCard(makeKlingNode), [addCard]);
  const addAudioCard = useCallback(() => addCard(makeAudioNode), [addCard]);

  const onNodeClick: NodeMouseHandler<CardNode> = useCallback(
    (_, node) => setSelected(node.id),
    [setSelected]
  );
  const onPaneClick = useCallback(() => setSelected(null), [setSelected]);

  // ReactFlow 实例(双击空白处用 screenToFlowPosition 拿画布坐标)
  const rfRef = useRef<ReactFlowInstance<CardNode> | null>(null);
  // 双击画布空白 → 创建素材上传卡片(照原网 media-upload-card)
  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const inst = rfRef.current;
    const pos = inst
      ? inst.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      : { x: 200, y: 200 };
    const n = makeUploadNode(uid(), pos.x - 150, pos.y - 150);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n], selectedId: n.id }));
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => { rfRef.current = inst; }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDoubleClick={(e) => {
          // 仅双击画布空白(pane/背景)时创建素材卡;双击节点不触发
          const t = e.target as HTMLElement;
          if (t.classList.contains('react-flow__pane') || t.classList.contains('react-flow__background')) {
            onPaneDoubleClick(e);
          }
        }}
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'deletable', animated: true, style: { stroke: 'rgba(192,192,192,0.7)', strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#27272a" />
        <Controls />

        <Panel position="bottom-left">
          <div style={toolbarV} onMouseLeave={() => setToolGroup(null)}>
            <div style={toolbarTitle}>FILMAVO</div>

            {/* 1 文本 */}
            <button onClick={addTextCard} style={toolBtnV} title="文本生成卡片">文本</button>
            {/* 2 图片 */}
            <button onClick={addImageCard} style={toolBtnV} title="图片生成卡片">图片</button>

            {/* 3 视频分组(视频卡/Kling配音/Seedance2.0) */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setToolGroup(toolGroup === 'video' ? null : 'video')} style={toolBtnV} title="视频类卡片">视频 ▸</button>
              {toolGroup === 'video' && (
                <div style={toolFlyout}>
                  <button onClick={() => { addVideoCard(); setToolGroup(null); }} style={flyItem}>视频卡片</button>
                  <button onClick={() => { addKlingCard(); setToolGroup(null); }} style={flyItem}>Kling 视频配音</button>
                  <button onClick={() => { addSeedanceCard(); setToolGroup(null); }} style={flyItem}>Seedance 2.0</button>
                </div>
              )}
            </div>

            {/* 4 角色设计 */}
            <button onClick={addCharacterCard} style={toolBtnV} title="角色设计卡片">角色</button>

            {/* 5 导演流程时间刻度条(待做) */}
            <button style={toolBtnVDisabled} title="导演流程时间刻度条(开发中)" disabled>刻度条</button>

            {/* 6 电影控制器(待做) */}
            <button style={toolBtnVDisabled} title="电影控制器(开发中)" disabled>控制器</button>

            {/* 8 GEM 分镜 Step2 */}
            <button onClick={addGemCard} style={toolBtnV} title="GEM 分镜设计(Step2)">GEM</button>

            {/* 9 导演引擎分组(全部/单独 Step2/Step3/Step4) */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setToolGroup(toolGroup === 'gem' ? null : 'gem')} style={toolBtnV} title="导演引擎">导演 ▸</button>
              {toolGroup === 'gem' && (
                <div style={toolFlyout}>
                  <button onClick={() => { addGemCard(); addGem3Card(); addGem4Card(); setToolGroup(null); }} style={flyItem}>全部创建</button>
                  <button onClick={() => { addGemCard(); setToolGroup(null); }} style={flyItem}>单独 Step2(分镜)</button>
                  <button onClick={() => { addGem3Card(); setToolGroup(null); }} style={flyItem}>单独 Step3(过渡指令)</button>
                  <button onClick={() => { addGem4Card(); setToolGroup(null); }} style={flyItem}>单独 Step4</button>
                </div>
              )}
            </div>

            {/* 10 语音合成 */}
            <button onClick={addAudioCard} style={toolBtnV} title="语音合成卡片(合成/音色设计/克隆)">语音</button>

            {/* 时空镜头延展(原工具项,保留) */}
            <button onClick={addExtendCard} style={toolBtnV} title="时空镜头延展">延展</button>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

            {/* 11 图片切割(画布功能,弹窗) */}
            <button onClick={() => setShowSplit(true)} style={toolBtnV} title="图片切割(等分/切线/框选)">切割</button>

            {/* 画布放大器:全局收起(−)/展开(+)所有卡片 */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => collapseAll(true)} style={{ ...toolBtnV, flex: 1, fontSize: 18, padding: '4px 0', lineHeight: 1 }} title="所有卡片收起成小卡片">−</button>
              <button onClick={() => collapseAll(false)} style={{ ...toolBtnV, flex: 1, fontSize: 18, padding: '4px 0', lineHeight: 1 }} title="所有卡片全部展开">+</button>
            </div>

            <div style={{ fontSize: 9, color: '#52525b', textAlign: 'center', padding: '2px 0' }}>双击画布<br/>=素材卡</div>
          </div>
        </Panel>
      </ReactFlow>

      {/* 图片切割弹窗 */}
      {showSplit && <ImageSplitModal onClose={() => setShowSplit(false)} />}

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
      `}</style>
    </div>
  );
}

// ReactFlowProvider 包裹:DeletableEdge 的 useReactFlow 需要 Provider 上下文
export default function CanvasV2Page() {
  return (
    <ReactFlowProvider>
      <CanvasV2Inner />
    </ReactFlowProvider>
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
// 画布内左侧竖向工具栏
const toolbarV: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  padding: 8, background: 'rgba(18,18,22,0.92)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.5)', width: 76,
};
const toolbarTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#e4e4e7',
  textAlign: 'center', padding: '2px 0 6px',
};
const toolBtnV: React.CSSProperties = {
  padding: '7px 6px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', fontSize: 12, cursor: 'pointer',
  whiteSpace: 'nowrap', textAlign: 'center',
};
const toolBtnVDisabled: React.CSSProperties = {
  ...toolBtnV, opacity: 0.35, cursor: 'not-allowed', color: '#a1a1aa',
};
const toolFlyout: React.CSSProperties = {
  position: 'absolute', left: 'calc(100% + 8px)', bottom: 0,
  display: 'flex', flexDirection: 'column', gap: 4, width: 168,
  padding: 7, background: 'rgba(28,28,32,0.96)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.14)', borderRadius: 14,
  boxShadow: '0 18px 55px rgba(0,0,0,0.6)', zIndex: 100,
};
const flyItem: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 9, border: 'none',
  background: 'transparent', color: '#e4e4e7', fontSize: 12, cursor: 'pointer', textAlign: 'left',
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
