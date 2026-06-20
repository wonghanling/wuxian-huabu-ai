'use client';

import { memo, useState, useRef } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { ratioToWH, SIZE_OPTIONS, QUALITY_OPTIONS } from '../imageModels';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { PromptTools } from './PromptTools';
import { generateImage, mirrorOutput, getUserId, softCompressImage } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';
import { useDebouncedField } from '../lib/useDebouncedField';
import { Lightbox, downloadFile } from './Lightbox';

// ============================================================
// 时空镜头延展卡片
// 核心:摄像机控制球(拖动调整俯仰/偏航角度)
// 输入:连接源图 + 角度参数
// 参数:模型 / 比例 / 清晰度
// 输出:图片显示在卡片框
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

const EXTEND_MODELS = [
  { id: 'nano-banana-pro', label: 'Nano Banana 2', price: '2K ¥1.0 / 4K ¥1.2', useSizeNotRatio: false, qualityOptions: [{ value: '2k', label: '2K — ¥1.0/次' }, { value: '4k', label: '4K — ¥1.2/次' }] },
  { id: 'nano-banana', label: 'Nano Banana', price: '¥0.5/次', useSizeNotRatio: false, qualityOptions: null },
  { id: 'gpt-image-2', label: 'GPT Image 2', price: '¥0.5~0.8/次', useSizeNotRatio: true, qualityOptions: null },
  { id: 'flux-kontext', label: 'Flux Kontext', price: '¥0.6/次', useSizeNotRatio: false, qualityOptions: null },
  { id: 'doubao-seedream-4-5-251128', label: '豆包 Seedream', price: '¥0.3/次', useSizeNotRatio: false, qualityOptions: null },
];

const EXTEND_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];

type SubPanel = 'model' | 'ratio' | 'quality' | 'camera' | null;

// 摄像机控制球 — 照搬原网真实 3D 实现(preserve-3d 球体 + 轨道环)
// 关键:onPointerDown e.stopPropagation() 阻止 React Flow 节点拖拽
function CameraController({ vertical, horizontal, onChange }: {
  vertical: number; horizontal: number;
  onChange: (v: number, h: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [rotX, setRotX] = useState(vertical);
  const [rotY, setRotY] = useState(horizontal);
  const lastPos = useRef({ x: 0, y: 0 });

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();  // 阻止 React Flow 拖拽
    e.preventDefault();
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.stopPropagation();
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    // Yaw: 左右拖，顺时针增大，0-360
    const ny = ((rotY + dx * 0.5) % 360 + 360) % 360;
    // Pitch: 上下拖，往上拖增大(朝上看)，0-360
    const nx = ((rotX - dy * 0.5) % 360 + 360) % 360;
    setRotX(nx); setRotY(ny);
    onChange(Math.round(nx), Math.round(ny));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 144, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg, rgba(0,0,0,0.5), rgba(24,24,32,0.5))', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* 拖拽区域 */}
      <div
        className="nodrag"
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isDragging ? 'grabbing' : 'grab', perspective: '800px' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        {/* 3D 球体容器 */}
        <div style={{ width: 110, height: 110, position: 'relative', transformStyle: 'preserve-3d', transform: `rotateX(${-rotX}deg) rotateY(${rotY}deg)` }}>
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
            {/* 垂直轨道环 */}
            {[0, 90].map((r) => (
              <div key={r} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: '100%', height: '100%',
                transform: `translate(-50%, -50%) rotateY(${r}deg)`,
                borderRadius: '50%', border: '2px solid rgba(96,165,250,0.25)',
              }} />
            ))}
            {/* 水平纬线 */}
            {[-60, -30, 30, 60].map((r) => (
              <div key={r} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: `${Math.cos(r * Math.PI / 180) * 100}%`,
                height: `${Math.cos(r * Math.PI / 180) * 100}%`,
                transform: `translate(-50%, -50%) rotateX(${r}deg)`,
                borderRadius: '50%', border: '1px solid rgba(96,165,250,0.15)',
              }} />
            ))}
            {/* 摄像机图标(浮在球体前方) */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) translateZ(55px)' }}>
              <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(59,130,246,0.6)' }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(59,130,246,0.3)', borderRadius: 10, filter: 'blur(8px)', zIndex: -1 }} />
            </div>
          </div>
        </div>
      </div>

      {/* 角度显示 */}
      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: 'none' }}>
        <div style={{ fontSize: 9, fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
          <span style={{ color: '#9ca3af' }}>Yaw </span><span style={{ color: '#60a5fa', fontWeight: 700 }}>{Math.round(rotY)}°</span>
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
          <span style={{ color: '#9ca3af' }}>Pitch </span><span style={{ color: '#60a5fa', fontWeight: 700 }}>{Math.round(rotX)}°</span>
        </div>
      </div>

      {/* 重置按钮 */}
      <button
        className="nodrag"
        style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); setRotX(0); setRotY(0); onChange(0, 0); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </button>

      {/* 提示文字 */}
      {!isDragging && rotX === 0 && rotY === 0 && (
        <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          拖动旋转 · 360° 自由控制
        </div>
      )}
    </div>
  );
}

function ExtendNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasOutput = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [sub, setSub] = useState<SubPanel>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const promptField = useDebouncedField(data.config.prompt ?? '', (v) => updateConfig(id, { prompt: v }));

  const modelId = data.config.model || 'nano-banana-pro';
  const model = EXTEND_MODELS.find((m) => m.id === modelId) ?? EXTEND_MODELS[0];
  const ratio = data.config.ratio ?? '16:9';
  // 连线实时:上游图作源图(本地优先,否则上游)
  const upstreamLive = useUpstream(id);
  const dispSource = data.config.refImages?.[0] || upstreamLive.images[0];
  const cameraV = (data.config as any).cameraVertical ?? 0;
  const cameraH = (data.config as any).cameraHorizontal ?? 0;

  // Yaw 0-360: 0=front, 90=right, 180=back, 270=left
  const getYawDesc = (yaw: number): string => {
    const y = ((yaw % 360) + 360) % 360;
    if (y <= 22.5 || y > 337.5) return 'front view';
    if (y <= 67.5) return 'front-right three-quarter view';
    if (y <= 112.5) return 'right side view';
    if (y <= 157.5) return 'back-right three-quarter view';
    if (y <= 202.5) return 'back view';
    if (y <= 247.5) return 'back-left three-quarter view';
    if (y <= 292.5) return 'left side view';
    return 'front-left three-quarter view';
  };
  // Pitch 0-360: 0=front level, 90=straight up, 180=back level, 270=straight down
  const getPitchDesc = (pitch: number): string => {
    const p = ((pitch % 360) + 360) % 360;
    if (p <= 22.5 || p > 337.5) return 'front level view';
    if (p <= 67.5) return 'front-up view';
    if (p <= 112.5) return 'straight up view';
    if (p <= 157.5) return 'back-up view';
    if (p <= 202.5) return 'back level view';
    if (p <= 247.5) return 'back-down view';
    if (p <= 292.5) return 'straight down view';
    return 'front-down view';
  };
  const yawDesc = getYawDesc(cameraH);
  const pitchDesc = getPitchDesc(cameraV);
  // 'front level view' 是默认平视,只需标 yaw;其他 pitch 都要标
  const angleLabel = pitchDesc === 'front level view'
    ? yawDesc
    : `${yawDesc}, ${pitchDesc}`;
  // 数值(精确) + 语义标签,两者都保留让 AI 能读
  const anglePrompt = `camera: yaw=${Math.round(cameraH)}°, pitch=${Math.round(cameraV)}° | ${angleLabel}`;
  const cameraPrompt = data.config.prompt
    ? `${data.config.prompt}, ${anglePrompt}`
    : anglePrompt;

  const mult = enlarged ? 1.7 : 1;
  const dims = ratioToWH(ratio, 360 * mult);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const handleGenerate = async () => {
    // 源图:优先上游连接的图片(连线传参),其次本地 refImages[0]
    const upstream = getUpstreamOutputs(id);
    const sourceImg = upstream.images[0] || data.config.refImages?.[0];
    if (!sourceImg) { alert('请连接图片卡片作为源图'); return; }
    updateCard(id, { status: 'generating', progress: 10 });
    let p = 10;
    const timer = setInterval(() => { p = Math.min(90, p + 6); updateCard(id, { progress: p }); }, 800);
    try {
      const userId = await getUserId();
      // 源图传 URL(后端自适应);gpt-image-2 等若需 base64,data: 才转
      const imageUrlArray: string[] = [];
      const imageBase64Array: string[] = [];
      if (sourceImg.startsWith('data:')) imageBase64Array.push(await softCompressImage(sourceImg));
      else imageUrlArray.push(sourceImg);

      const imageUrl = await generateImage({
        model: modelId,
        prompt: cameraPrompt,   // 摄像机角度 prompt(含数值+语义)
        aspectRatio: ratio,
        imageQuality: data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'),
        imageUrlArray: imageUrlArray.length > 0 ? imageUrlArray : undefined,
        imageBase64Array: imageBase64Array.length > 0 ? imageBase64Array : undefined,
        userId,
      });
      clearInterval(timer);
      // 立即显示成品(不等大图下载完),宽高异步补上
      updateCard(id, { status: 'done', progress: 100, outputUrl: imageUrl });
      const probe = new Image();
      probe.onload = () => updateCard(id, { aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
      probe.src = imageUrl;
      mirrorOutput(imageUrl, 'image').then((permUrl) => {
        if (permUrl && permUrl !== imageUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert('镜头延展生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>时空镜头延展</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>点击展开</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn}><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      <div style={{
        width: dims.w, height: dims.h,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        transition: 'border-color .25s, box-shadow .25s, width .3s, height .3s',
        position: 'relative',
      }}>
        <button onClick={toggleCollapse} style={floatMinus}><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>镜头延展生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#3b82f6,#93c5fd)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasOutput ? (
            <img src={data.outputUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : dispSource ? (
            // 连接源图实时显示在卡片框(照原网:无上传按钮,纯连线喂源图)
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img src={dispSource} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, color: '#fff', background: 'rgba(82,82,91,0.9)', padding: '2px 8px', borderRadius: 99 }}>来自连接 · 源图</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>• 后退 -5s：前5秒场景</span>
              <span style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 8 }}>• 前进 +5s：后5秒场景</span>
              <span style={{ fontSize: 12, color: '#5a5a5f' }}>连接源图 → 调整摄像机角度 → Generate</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部弹窗(无输出时显示) */}
      <NodeToolbar isVisible={selected && !spawnOpen && !hasOutput} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />

          {/* Prompt 输入(可选) */}
          <textarea
            className="nodrag nopan nowheel cv2-scroll"
            value={promptField.value}
            {...promptField.bind}
            placeholder="补充描述（可选）…"
            rows={2}
            style={promptInput}
          />

          {/* 参数按钮行 */}
          <div style={tagsRow}>
            {/* 摄像机控制球 — ParamTag 弹窗 */}
            <ParamTag
              label={<>摄像机 Yaw={Math.round(cameraH)}° Pitch={Math.round(cameraV)}°</>}
              open={sub === 'camera'}
              onToggle={() => setSub(sub === 'camera' ? null : 'camera')}
              width={320}
            >
              <div style={{ padding: '8px 4px 4px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                  拖动摄像头调整角度，角度自动填入生成指令
                </div>
                <CameraController
                  vertical={cameraV}
                  horizontal={cameraH}
                  onChange={(v, h) => updateConfig(id, { cameraVertical: v, cameraHorizontal: h } as any)}
                />
                {/* 垂直/水平角度数字(照搬原网) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 8 }}>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '7px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Pitch (垂直) </span>
                    <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{Math.round(cameraV)}°</span>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '7px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Yaw (水平) </span>
                    <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>{Math.round(cameraH)}°</span>
                  </div>
                </div>
              </div>
            </ParamTag>
            <ParamTag label={model.label} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')} width={280}>
              {EXTEND_MODELS.map((m) => (
                <SubItem key={m.id} active={m.id === modelId} onClick={() => { updateConfig(id, { model: m.id }); setSub(null); }}>
                  <span>{m.label}</span><span style={subPrice}>{m.price}</span>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={`${model.useSizeNotRatio ? '尺寸' : '比例'} ${ratio}`} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={220}>
              {(model.useSizeNotRatio ? SIZE_OPTIONS : EXTEND_RATIOS.map((r) => ({ value: r, label: r }))).map((opt: any) => (
                <SubItem key={opt.value} active={opt.value === ratio} onClick={() => { updateConfig(id, { ratio: opt.value }); updateCard(id, { aspectW: undefined, aspectH: undefined }); setSub(null); }}>
                  <span>{opt.label}</span>
                  {opt.priceMedium && <span style={subPrice}>{(data.config.imageQuality ?? 'medium') === 'high' ? opt.priceHigh : opt.priceMedium}</span>}
                </SubItem>
              ))}
            </ParamTag>

            {(model.qualityOptions || model.useSizeNotRatio) && (
              <ParamTag label={`清晰度 ${data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k')}`} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={180}>
                {(model.useSizeNotRatio ? QUALITY_OPTIONS : model.qualityOptions!).map((opt) => (
                  <SubItem key={opt.value} active={opt.value === (data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'))} onClick={() => { updateConfig(id, { imageQuality: opt.value }); setSub(null); }}>
                    <span>{opt.label}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
          </div>

          {/* 底行 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>{model.price}</span>
            <button onClick={handleGenerate} disabled={data.status === 'generating'} style={{ ...generateBtn, opacity: data.status === 'generating' ? 0.4 : 1, cursor: data.status === 'generating' ? 'default' : 'pointer' }}>{data.status === 'generating' ? '生成中…' : 'Generate'}</button>
          </div>
        </div>
      </NodeToolbar>

      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !sub && !lightbox} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {hasOutput && (
            <>
              <button onClick={() => setLightbox(true)} style={toolBtnWide} title="查看(放大)">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconExpand size={16} /> 查看</span>
              </button>
              <button onClick={() => downloadFile(data.outputUrl!, `extend-${id}.jpg`)} style={toolBtnWide} title="下载">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>↓ 下载</span>
              </button>
              <button onClick={() => updateCard(id, { status: 'empty', outputUrl: null })} style={toolBtnWide} title="删除图片">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>× 删除</span>
              </button>
            </>
          )}
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
          </button>
        </div>
      </NodeToolbar>
      {lightbox && hasOutput && <Lightbox url={data.outputUrl!} kind="image" onClose={() => setLightbox(false)} />}
    </>
  );

  function Ports() {
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}>
          <span style={portPlusIcon}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
}

// ===== 小组件 =====
function ParamTag({ label, open, onToggle, width = 200, children }: {
  label: React.ReactNode; open: boolean; onToggle: () => void; width?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={onToggle} style={{ ...tagBtn, ...(open ? tagActive : {}) }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
      </button>
      {open && (
        <div style={{ ...popPanel, width }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
function SubItem({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...subItem, ...(active ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>
      {children}
    </button>
  );
}

// ===== 样式 =====
function portCircle(c: string): React.CSSProperties {
  return {
    width: 20, height: 20, minWidth: 20, minHeight: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
    background: 'rgba(24,24,27,0.95)', border: `2px solid ${c}`,
    boxShadow: `0 0 10px ${c}, 0 0 0 4px rgba(0,0,0,0.25)`, color: '#e4e4e7', zIndex: 5,
  };
}
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function collapsedCard(selected: boolean): React.CSSProperties {
  return {
    width: 200, padding: '20px 18px',
    background: GLASS_BG, backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
    border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 18,
    backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
  };
}
const collapsedIconWrap: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(128,128,128,0.10))',
  border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const pillBtn: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#a1a1aa', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 10,
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const promptBar: React.CSSProperties = {
  width: 520, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const promptInput: React.CSSProperties = {
  width: '100%', padding: '36px 12px 8px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
  lineHeight: 1.55, userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 8px 4px' };
const tagBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 8,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 13, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
};
const subPrice: React.CSSProperties = { fontSize: 11, color: '#71717a', flexShrink: 0 };
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const toolRow: React.CSSProperties = { display: 'flex', gap: 8 };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const ExtendNode = memo(ExtendNodeComponent);
