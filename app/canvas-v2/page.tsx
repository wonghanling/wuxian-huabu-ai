'use client';

import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
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
import { CanvasLoader } from './nodes/CanvasLoader';
import { ZoomControls } from './nodes/ZoomControls';
import { TopBar } from './nodes/TopBar';
import { TbText, TbImage, TbVideo, TbCharacter, TbTimeline, TbController, TbGem, TbDirector, TbAudio, TbExtend, TbScissors, TbChevron } from './nodes/ToolIcons';
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

function makeTryOnNode(i: string | number, x: number, y: number): CardNode {
  return {
    id: 'to' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'tryon',
      status: 'empty',
      outputUrl: null,
      config: { model: 'virtual-try-on', prompt: '', refImages: [], preservePose: true },
    },
  };
}

function makeGemNode(i: string | number, x: number, y: number): CardNode {
  return {    id: 'g' + i,
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

function makeShotNode(i: string | number, x: number, y: number): CardNode {
  return {
    id: 'sh' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'shot',
      status: 'empty',
      outputUrl: null,
      text: '',
      config: { model: '', prompt: '', shotType: '全景', cameraMovement: 'Follow/Tracking' } as any,
    },
  };
}

function makeTimelineNode(i: string | number, x: number, y: number): CardNode {
  return {
    id: 'tl' + i,
    type: 'card',
    position: { x, y },
    data: {
      kind: 'timeline',
      status: 'empty',
      outputUrl: null,
      config: { model: '', prompt: '', duration: 60 } as any,
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
  const [toolGroup, setToolGroup] = useState<'video' | 'gem' | 'audio' | null>(null);
  // 图片切割弹窗
  const [showSplit, setShowSplit] = useState(false);
  // 工具栏展开/折叠(照原网抽屉式)
  const [toolExpanded, setToolExpanded] = useState(true);

  // 画布持久化:加载历史快照 / 自动保存 / 空画布保护(完整复刻原网)
  const { status: saveStatus, loading: canvasLoading, switchCanvas, getCurrentCanvasId } = useCanvasPersistence();

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

  // 节点/连线变化 → 触发节流保存
  // 指纹只算"内容"(kind/输出/文本/配置),不含 position 和 progress/status 等瞬态:
  //  - progress 进度条跳动 → 不该触发保存
  //  - position 拖动连续变 → 拖动过程不存,改由 onNodeDragStop 拖完存一次
  // 这样打字(防抖存)、拖动(拖完存)都能持久化,但不会疯狂高频写库。
  const contentFingerprint = useMemo(() => {
    const n = nodes.map((x) => {
      const d: any = x.data || {};
      const persist = { kind: d.kind, outputUrl: d.outputUrl, text: d.text, config: d.config, aspectW: d.aspectW, aspectH: d.aspectH };
      return `${x.id}:${JSON.stringify(persist)}`;
    }).join('|');
    const e = edges.map((x) => `${x.id}:${x.source}>${x.target}`).join('|');
    return n + '#' + e;
  }, [nodes, edges]);

  useEffect(() => {
    if (canvasLoading) return;
    (window as any).saveCanvasV2Now?.();
  }, [contentFingerprint, canvasLoading]);

  // 拖动卡片:过程中不存,拖完才存一次(保住新位置,又不疯狂写库)
  const onNodeDragStop = useCallback(() => {
    if (canvasLoading) return;
    (window as any).saveCanvasV2Now?.();
  }, [canvasLoading]);

  // 通用新建:uid() 唯一 ID + 落在当前视野中心(用户不用拖画布去找)
  const addCard = useCallback((make: (i: string, x: number, y: number) => CardNode) => {
    const c = placeRef.current++;
    const inst = rfRef.current;
    let x = 80 + (c % 4) * 380, y = 120 + Math.floor(c / 4) * 360;
    if (inst) {
      // 屏幕中心换算成画布坐标,多张时小幅错位避免完全重叠
      const center = inst.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      x = center.x - 160 + (c % 3) * 30;
      y = center.y - 120 + (c % 3) * 30;
    }
    const n = make(uid(), x, y);
    useCanvasStore.setState((s) => ({ nodes: [...s.nodes, n], selectedId: n.id }));
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
  const addTryOnCard = useCallback(() => addCard(makeTryOnNode), [addCard]);
  const addKlingCard = useCallback(() => addCard(makeKlingNode), [addCard]);
  const addAudioCard = useCallback(() => addCard(makeAudioNode), [addCard]);
  const addShotCard = useCallback(() => addCard(makeShotNode), [addCard]);
  const addTimelineCard = useCallback(() => addCard(makeTimelineNode), [addCard]);

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
    <div style={{ width: '100vw', height: '100vh', background: '#000' }} onContextMenu={(e) => e.preventDefault()}>
      <CanvasLoader loading={canvasLoading} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(inst) => { rfRef.current = inst; }}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
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
        nodeDragThreshold={4}
        elevateNodesOnSelect
        connectionRadius={48}
        deleteKeyCode={['Delete']}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        panOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        zoomActivationKeyCode={null}
        defaultViewport={{ x: 60, y: 60, zoom: 0.9 }}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'deletable', animated: true, style: { stroke: 'rgba(192,192,192,0.7)', strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#27272a" />

        <Panel position="top-left" style={{ top: '50%', transform: 'translateY(-50%)', margin: 0, left: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onMouseLeave={() => setToolGroup(null)}>
            {/* 工具栏主体(可折叠) */}
            {toolExpanded && (
              <div style={toolbarV}>
                <div style={toolbarTitle}>FILMAVO</div>
                {/* 1 文本 */}
                <button onClick={addTextCard} style={toolIconBtn} title="文本生成卡片"><TbText size={18} /></button>
                {/* 2 图片 */}
                <button onClick={addImageCard} style={toolIconBtn} title="图片生成卡片"><TbImage size={18} /></button>
                {/* 3 视频分组 */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setToolGroup(toolGroup === 'video' ? null : 'video')} style={{ ...toolIconBtn, ...(toolGroup === 'video' ? toolIconActive : {}) }} title="视频类(视频/Kling/Seedance)"><TbVideo size={18} /></button>
                  {toolGroup === 'video' && (
                    <div style={toolFlyout}>
                      <button onClick={() => { addVideoCard(); setToolGroup(null); }} style={flyItem}>视频卡片</button>
                      <button onClick={() => { addSeedanceCard(); setToolGroup(null); }} style={flyItem}>Seedance 2.0</button>
                    </div>
                  )}
                </div>
                {/* 4 角色设计 */}
                <button onClick={addCharacterCard} style={toolIconBtn} title="角色设计卡片"><TbCharacter size={18} /></button>
                {/* 4.5 虚拟试衣 */}
                <button onClick={addTryOnCard} style={toolIconBtn} title="虚拟试衣(人物+衣服→试穿)">
                  <span style={{ fontSize: 17, lineHeight: 1 }}>👕</span>
                </button>
                {/* 5 导演流程时间刻度条 */}
                <button onClick={addTimelineCard} style={toolIconBtn} title="导演流程时间刻度条"><TbTimeline size={18} /></button>
                {/* 6 电影控制器 */}
                <button onClick={addShotCard} style={toolIconBtn} title="电影控制器"><TbController size={18} /></button>
                {/* 8 GEM 分镜 Step2 */}
                <button onClick={addGemCard} style={toolIconBtn} title="GEM 分镜设计"><TbGem size={18} /></button>
                {/* 9 导演引擎分组 */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setToolGroup(toolGroup === 'gem' ? null : 'gem')} style={{ ...toolIconBtn, ...(toolGroup === 'gem' ? toolIconActive : {}) }} title="导演引擎"><TbDirector size={18} /></button>
                  {toolGroup === 'gem' && (
                    <div style={toolFlyout}>
                      <button onClick={() => { addGemCard(); addGem3Card(); addGem4Card(); setToolGroup(null); }} style={flyItem}>全部创建</button>
                      <button onClick={() => { addGemCard(); setToolGroup(null); }} style={flyItem}>单独 Step2(分镜)</button>
                      <button onClick={() => { addGem3Card(); setToolGroup(null); }} style={flyItem}>单独 Step3(过渡指令)</button>
                      <button onClick={() => { addGem4Card(); setToolGroup(null); }} style={flyItem}>单独 Step4</button>
                    </div>
                  )}
                </div>
                {/* 10 语音分组(语音合成 / Kling配音) */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setToolGroup(toolGroup === 'audio' ? null : 'audio')} style={{ ...toolIconBtn, ...(toolGroup === 'audio' ? toolIconActive : {}) }} title="语音类(语音合成/Kling配音)"><TbAudio size={18} /></button>
                  {toolGroup === 'audio' && (
                    <div style={toolFlyout}>
                      <button onClick={() => { addAudioCard(); setToolGroup(null); }} style={flyItem}>语音合成</button>
                      <button onClick={() => { addKlingCard(); setToolGroup(null); }} style={flyItem}>King 配音</button>
                    </div>
                  )}
                </div>
                {/* 时空镜头延展 */}
                <button onClick={addExtendCard} style={toolIconBtn} title="时空镜头延展"><TbExtend size={18} /></button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />
                {/* 11 图片切割 */}
                <button onClick={() => setShowSplit(true)} style={toolIconBtn} title="图片切割(等分/切线/框选)"><TbScissors size={18} /></button>
              </div>
            )}

            {/* 折叠手柄 + 画布缩放器(左下角,与折叠在一起) */}
            {/* 折叠手柄(只留这个,缩放器独立放底部中间,不再被挡) */}
            <button onClick={() => setToolExpanded((v) => !v)} style={toolHandle} title={toolExpanded ? '收起工具栏' : '展开工具栏'}>
              <TbChevron size={16} open={!toolExpanded} />
            </button>
          </div>
        </Panel>

        {/* 画布缩放器(照原网左下角胶囊条) */}
        <Panel position="bottom-left">
          <ZoomControls />
        </Panel>

        {/* 右上角状态栏:余额/会员/保存/主页 */}
        <Panel position="top-right">
          <TopBar saveStatus={saveStatus} switchCanvas={switchCanvas} getCurrentCanvasId={getCurrentCanvasId} />
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
// 图标按钮(照原网:正方形图标按钮,hover 浅底)
const toolIconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12, border: 'none',
  background: 'transparent', color: '#9ca3af', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background .15s, color .15s',
};
const toolIconActive: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', color: '#fff' };
const toolIconBtnDisabled: React.CSSProperties = { ...toolIconBtn, opacity: 0.3, cursor: 'not-allowed' };
const toolHandle: React.CSSProperties = {
  width: 40, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(18,18,22,0.92)', color: '#9ca3af', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)',
};
const zoomBox: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(18,18,22,0.92)', backdropFilter: 'blur(20px)',
};
const zoomBtn: React.CSSProperties = {
  width: 40, height: 32, border: 'none', background: 'transparent', color: '#9ca3af',
  cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const toolFlyout: React.CSSProperties = {
  position: 'absolute', left: 'calc(100% + 8px)', top: 0,
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
