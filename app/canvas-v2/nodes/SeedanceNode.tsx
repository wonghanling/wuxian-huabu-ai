'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import {
  SEEDANCE_MODELS, DEFAULT_SEEDANCE_MODEL, SEEDANCE_MODES, SEEDANCE_RATIOS, SEEDANCE_DURATIONS,
  GRID4_PROMPT, GRID9_PROMPT, seedanceFrameNeed, multimodalCount,
  MULTIMODAL_MAX_IMAGES, MULTIMODAL_MAX_VIDEOS, MULTIMODAL_MAX_TOTAL,
  type SeedanceMode, type SeedanceModel,
} from '../seedanceConfig';
import { ratioToWH } from '../imageModels';
import { videoPrice } from '../videoModels';
import { IconVideo, IconModel, IconExpand, IconShrink, IconMinus, IconPlus, IconUpload, IconScissors } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { RefThumb, HoverZoomImg } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, uploadFileToStorage, generateSeedance, mirrorOutput, getUserId } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';

// ============================================================
// Seedance 2.0 卡片 · 矩形框
// 四模式:文生 / 图生-首帧 / 首尾帧 / 多模态(9图+3视频+音频,总12上限)
// 宫格快捷按钮、三种参考弹窗、比例/时长/分辨率/音频
// Seedance 自带音频,无价格区别
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type SubPanel = 'mode' | 'model' | 'ratio' | 'duration' | 'quality' | 'ref' | null;

function SeedanceNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasVideo = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [editing, setEditing] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<SubPanel>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)
  const editRef = useRef<HTMLTextAreaElement>(null);

  const model = SEEDANCE_MODELS.find((m) => m.id === data.config.model) ?? SEEDANCE_MODELS[0];
  const mode = (data.config.preset as SeedanceMode) ?? 't2v';   // 用 preset 字段存模式
  const ratio = data.config.ratio ?? '16:9';
  const duration = String(data.config.duration ?? '5');
  const resolution = data.config.resolution ?? '720p';
  const need = seedanceFrameNeed(mode);
  // 价格(Seedance 自带音频,有声无声同价 → hasAudio 传 false 即可)
  // 智能时长(-1)按 5 秒估算
  const priceSeconds = duration === '-1' ? 5 : Number(duration);
  const price = videoPrice(model.id, resolution, priceSeconds, false);

  const refImages = data.config.refImages ?? [];
  const refVideos = data.config.refVideos ?? [];
  const audioCount = data.config.refAudio ? 1 : 0;
  const counts = multimodalCount(refImages.length, refVideos.length, audioCount);
  // 连线实时:上游图→首/尾帧/参考图(照原网渲染时实时读)
  const upstreamLive = useUpstream(id);
  const dispFirst = data.config.firstFrame || upstreamLive.images[0];
  const dispLast = data.config.lastFrame || upstreamLive.images[1];
  const firstFromConn = !data.config.firstFrame && !!upstreamLive.images[0];
  const lastFromConn = !data.config.lastFrame && !!upstreamLive.images[1];
  // 多模态:本地参考图之外,连接进来的图(去重)
  const connImages = upstreamLive.images.filter((u) => !refImages.includes(u));
  const connectedTexts = upstreamLive.texts;   // 来自连接的文案(实时,自动拼入生成)

  // 卡片框:矩形,按比例(adaptive 用 16:9)
  // 卡片框只显示成品(outputUrl);参考图/首帧绝不进卡片框
  const mult = enlarged ? 1.7 : 1;
  const baseLong = 360 * mult;
  const dims = ratioToWH(ratio === 'adaptive' ? '16:9' : ratio, baseLong);

  useEffect(() => { if (editing && editRef.current) editRef.current.focus(); }, [editing]);

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 上传首帧/尾帧(真实上传到 storage)
  const uploadFrame = async (which: 'firstFrame' | 'lastFrame', fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(f);
      if (url) updateConfig(id, { [which]: url } as any);
    } finally {
      setUploading(false);
    }
  };
  // 多模态:加参考图(尊重 9 张 + 总 12 上限,真实上传)
  const addRefImages = async (fileList: FileList | null) => {
    if (!fileList) return;
    const cur = data.config.refImages ?? [];
    const room = Math.min(MULTIMODAL_MAX_IMAGES - cur.length, MULTIMODAL_MAX_TOTAL - counts.total);
    if (room <= 0) return;
    const files = Array.from(fileList).slice(0, room);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const url = await uploadImageToStorage(f);
        if (url) {
          const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config.refImages ?? [];
          updateConfig(id, { refImages: [...latest, url] });
        }
      }
    } finally {
      setUploading(false);
    }
  };
  const removeRefImage = (i: number) => {
    const cur = [...(data.config.refImages ?? [])];
    cur.splice(i, 1);
    updateConfig(id, { refImages: cur });
  };
  // 多模态:加参考视频(尊重 3 个 + 总 12 上限,真实上传)
  const addRefVideo = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f || !counts.canAddVideo) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'video');
      if (url) {
        const curV = data.config.refVideos ?? [];
        const curN = data.config.refVideoNames ?? [];
        updateConfig(id, { refVideos: [...curV, url], refVideoNames: [...curN, f.name] });
      }
    } finally {
      setUploading(false);
    }
  };
  const removeRefVideo = (i: number) => {
    const curV = [...(data.config.refVideos ?? [])];
    const curN = [...(data.config.refVideoNames ?? [])];
    curV.splice(i, 1); curN.splice(i, 1);
    updateConfig(id, { refVideos: curV, refVideoNames: curN });
  };
  // 多模态:加参考音频(总 12 上限,单个,真实上传)
  const addRefAudio = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f || !counts.canAddAudio) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'audio');
      if (url) updateConfig(id, { refAudio: url, refAudioName: f.name });
    } finally {
      setUploading(false);
    }
  };

  const uploadVideo = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    updateCard(id, { status: 'done', outputUrl: URL.createObjectURL(f) });
  };

  const handleGenerate = async () => {
    // 连线传参:上游图→首帧/参考图,上游视频→refVideo,上游文案→prompt前缀
    const upstream = getUpstreamOutputs(id);
    const effPrompt = upstream.texts.length > 0
      ? `${upstream.texts.join('\n')}\n${data.config.prompt}`.trim()
      : data.config.prompt;
    const effFirst = data.config.firstFrame || upstream.images[0];
    const effLast = data.config.lastFrame || upstream.images[1];
    const effRefImages = mode === 'multimodal'
      ? [...refImages, ...upstream.images.filter((u) => !refImages.includes(u))]
      : undefined;
    const effRefVideo = mode === 'multimodal' ? (data.config.refVideos?.[0] || upstream.videos[0]) : undefined;
    const effRefAudio = mode === 'multimodal' ? (data.config.refAudio || upstream.audios[0]) : undefined;
    // 校验(照搬原网规则)
    if (mode === 't2v' && !effPrompt.trim()) return;
    if ((mode === 'i2v' || mode === 'first-last') && !effFirst) return;
    if (mode === 'first-last' && !effLast) return;
    if (mode === 'multimodal' && (effRefImages?.length ?? 0) === 0 && !effRefVideo) return;
    updateCard(id, { status: 'generating', progress: 12 });
    try {
      const userId = await getUserId();
      const videoUrl = await generateSeedance(
        {
          mode,
          model: model.id,
          prompt: effPrompt,
          ratio,
          duration: duration === '-1' ? -1 : Number(duration),
          resolution,
          generateAudio: !!data.config.audio,
          firstFrameImage: effFirst,
          lastFrameImage: effLast,
          refImages: effRefImages,
          refVideoUrl: effRefVideo,
          refAudioUrl: effRefAudio,
          userId,
        },
        (progress) => updateCard(id, { progress }),
      );
      updateCard(id, { status: 'done', progress: 100, outputUrl: videoUrl });
      mirrorOutput(videoUrl, 'video').then((permUrl) => {
        if (permUrl && permUrl !== videoUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      updateCard(id, { status: 'error', progress: 0 });
      alert('Seedance 生成失败: ' + (err?.message || err));
    }
  };

  const setMode = (m: SeedanceMode) => updateConfig(id, { preset: m });

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}><span style={{ color: '#d4d4d8', display: 'flex' }}><IconVideo size={18} /></span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>Seedance 2.0</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>点击展开</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn} title="展开"><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      <div
        style={{
          width: dims.w, height: dims.h,
          background: GLASS_BG,
          backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
          border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
          borderRadius: 20, overflow: 'hidden',
          backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
          transition: 'border-color .25s, box-shadow .25s, width .3s cubic-bezier(.34,1.2,.4,1), height .3s cubic-bezier(.34,1.2,.4,1)',
          position: 'relative',
        }}
      >
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasVideo ? (
            <>
              <img src={data.outputUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={playBadge}>▶</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>点击选中 · 下方描述视频</span>
          )}
        </div>
      </div>

      {/* ===== 底部一体式 prompt 栏 ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !hasVideo} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />

          {/* 模式选择(从按钮正上方弹出)+ 宫格快捷按钮 同一行 */}
          <div style={topRow}>
            <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
              <button onClick={() => setSub(sub === 'mode' ? null : 'mode')}
                style={{ ...miniTag, ...(sub === 'mode' ? miniActive : {}), flex: 1 }}>
                {SEEDANCE_MODES.find((m) => m.key === mode)?.label ?? '文生视频'} ▾
              </button>
              {sub === 'mode' && (
                <div style={{ ...popPanel, width: 240 }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
                  {SEEDANCE_MODES.map((m) => (
                    <SubItem key={m.key} active={m.key === mode} onClick={() => { setMode(m.key); setSub(null); }}>
                      <span>{m.label}</span>
                      <span style={subHint}>
                        {m.key === 't2v' ? '纯文字' : m.key === 'i2v' ? '1张首帧' : m.key === 'first-last' ? '首帧+尾帧' : '9图+3视频+音频'}
                      </span>
                    </SubItem>
                  ))}
                </div>
              )}
            </div>
            <button style={miniTag} onClick={() => updateConfig(id, { prompt: GRID4_PROMPT })}>4宫格</button>
            <button style={miniTag} onClick={() => updateConfig(id, { prompt: GRID9_PROMPT })}>9宫格</button>
          </div>

          <textarea
            className="nodrag nopan nowheel"
            value={connectedTexts.length > 0 ? `${connectedTexts.join('\n')}${data.config.prompt ? '\n' + data.config.prompt : ''}` : data.config.prompt}
            onChange={(e) => {
              const prefix = connectedTexts.length > 0 ? `${connectedTexts.join('\n')}\n` : '';
              const v = e.target.value;
              updateConfig(id, { prompt: prefix && v.startsWith(prefix) ? v.slice(prefix.length) : v });
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
            placeholder={mode === 't2v' ? '描述视频内容…（必填）' : '描述视频内容…（可选）'}
            rows={5}
            style={promptInput}
          />

          {/* 参数标签行(每个按钮各自弹窗,从按钮正上方弹出) */}
          <div style={tagsRow}>
            <ParamTag label={<><IconModel size={12} /> {model.label}</>} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')}>
              {SEEDANCE_MODELS.map((m: SeedanceModel) => (
                <SubItem key={m.id} active={m.id === data.config.model} onClick={() => {
                  updateConfig(id, { model: m.id, resolution: m.resolutions.includes(resolution) ? resolution : m.resolutions[m.resolutions.length - 1] });
                  setSub(null);
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                    <span style={{ fontWeight: 600 }}>{m.label}</span>
                    {m.resolutions.map((r) => {
                      const pp = videoPrice(m.id, r, 1, false);
                      return <span key={r} style={priceLine}>{r.toUpperCase()} 会员¥{pp.member.toFixed(2)}/普通¥{pp.normal.toFixed(2)} 每秒</span>;
                    })}
                  </div>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={<>比例 {ratio}</>} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={200}>
              {SEEDANCE_RATIOS.map((r) => (
                <SubItem key={r} active={r === ratio} onClick={() => { updateConfig(id, { ratio: r }); setSub(null); }}>
                  <span>{r === 'adaptive' ? 'adaptive 自适应' : r}</span>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={<>时长 {duration === '-1' ? '智能' : duration + 's'}</>} open={sub === 'duration'} onToggle={() => setSub(sub === 'duration' ? null : 'duration')} width={160}>
              {SEEDANCE_DURATIONS.map((d) => (
                <SubItem key={d} active={d === duration} onClick={() => { updateConfig(id, { duration: Number(d) }); setSub(null); }}>
                  <span>{d === '-1' ? '智能' : d + ' 秒'}</span>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={<>清晰度 {resolution.toUpperCase()}</>} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={260}>
              {model.resolutions.map((r) => {
                const pp = videoPrice(model.id, r, 1, false);
                return (
                  <SubItem key={r} active={r === resolution} onClick={() => { updateConfig(id, { resolution: r }); setSub(null); }}>
                    <span>{r.toUpperCase()}</span>
                    <span style={subHint}>会员¥{pp.member.toFixed(2)}/普通¥{pp.normal.toFixed(2)} 每秒</span>
                  </SubItem>
                );
              })}
            </ParamTag>

            {/* 参考内容按钮(i2v/first-last/multimodal 三模式都显示,内容按模式区分) */}
            {(mode === 'i2v' || mode === 'first-last' || mode === 'multimodal') && (() => {
              const hasRef = mode === 'multimodal'
                ? (refImages.length > 0 || refVideos.length > 0 || !!data.config.refAudio)
                : (!!data.config.firstFrame || (mode === 'first-last' && !!data.config.lastFrame));
              const refLabel = mode === 'multimodal' ? `参考内容 ${counts.total}/${MULTIMODAL_MAX_TOTAL}` : '参考图';
              return (
                <ParamTag
                  label={<>{refLabel}{hasRef && <span style={greenDot} />}</>}
                  open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')}
                  width={mode === 'multimodal' ? 320 : 200}
                >
                  {mode === 'multimodal' ? (
                    <RefPanel
                      images={refImages} videos={refVideos} videoNames={data.config.refVideoNames ?? []}
                      audioName={data.config.refAudioName} counts={counts} uploading={uploading}
                      connImages={connImages}
                      onAddImages={addRefImages} onRemoveImage={removeRefImage}
                      onAddVideo={addRefVideo} onRemoveVideo={removeRefVideo}
                      onAddAudio={addRefAudio} onRemoveAudio={() => updateConfig(id, { refAudio: undefined, refAudioName: undefined })}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: 8, padding: 4 }}>
                      <FrameSlot label={firstFromConn ? (mode === 'first-last' ? '首帧·连接' : '参考图·连接') : (mode === 'first-last' ? '首帧' : '参考图')} url={dispFirst} uploading={uploading}
                        onUpload={(fl) => uploadFrame('firstFrame', fl)} onClear={() => updateConfig(id, { firstFrame: undefined })} />
                      {mode === 'first-last' && (
                        <FrameSlot label={lastFromConn ? '尾帧·连接' : '尾帧'} url={dispLast} uploading={uploading}
                          onUpload={(fl) => uploadFrame('lastFrame', fl)} onClear={() => updateConfig(id, { lastFrame: undefined })} />
                      )}
                    </div>
                  )}
                </ParamTag>
              );
            })()}

            {/* 音频开关(自带音频,无价格区别) */}
            <button onClick={() => updateConfig(id, { audio: !data.config.audio })}
              style={{ ...tagBtn, ...(data.config.audio ? tagActive : {}) }} title="生成视频是否带音频(自带,无额外费用)">
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>音频 {data.config.audio ? '开' : '关'}</span>
            </button>
          </div>

          {/* 底行:实时价格(会员/普通) + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 4px', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#e4e4e7' }}>
              会员 <b style={{ color: '#fff' }}>¥{price.member.toFixed(2)}</b>
              <span style={{ color: '#71717a' }}> / 普通 ¥{price.normal.toFixed(2)}</span>
            </span>
            <span style={{ fontSize: 10, color: '#52525b' }}>{duration === '-1' ? '智能~5s' : duration + 's'} · {resolution.toUpperCase()} · 自带音频</span>
            <button onClick={handleGenerate} style={generateBtn}>Generate</button>
          </div>
        </div>
      </NodeToolbar>

      {/* ===== 顶部工具栏(上传视频 + 剪辑 + 放大;弹窗打开时隐藏避免遮挡) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !sub} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <label style={toolBtnWide} title="上传视频">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconUpload size={16} /> 上传</span>
            <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => uploadVideo(e.target.files)} />
          </label>
          <button onClick={() => alert('剪辑功能开发中')} style={toolBtnWide} title="剪辑(开发中)">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconScissors size={16} /> 剪辑</span>
          </button>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide} title={enlarged ? '还原' : '放大卡片'}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
          </button>
        </div>
      </NodeToolbar>
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

// ===== 参考内容面板(多模态:图/视频/音频,总12上限) =====
function RefPanel({ images, videos, videoNames, audioName, counts, uploading, connImages, onAddImages, onRemoveImage, onAddVideo, onRemoveVideo, onAddAudio, onRemoveAudio }: {
  images: string[]; videos: string[]; videoNames: string[]; audioName?: string;
  counts: ReturnType<typeof multimodalCount>;
  uploading?: boolean;
  connImages?: string[];
  onAddImages: (fl: FileList | null) => void; onRemoveImage: (i: number) => void;
  onAddVideo: (fl: FileList | null) => void; onRemoveVideo: (i: number) => void;
  onAddAudio: (fl: FileList | null) => void; onRemoveAudio: () => void;
}) {
  return (
    <div style={{ padding: 4 }}>
      {/* 上传按钮区 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <label style={{ ...refUploadBtn, opacity: (counts.canAddImage && !uploading) ? 1 : 0.4, pointerEvents: (counts.canAddImage && !uploading) ? 'auto' : 'none' }}>
          {uploading ? '上传中…' : '+ 图片'}
          <input type="file" accept="image/*" multiple disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onAddImages(e.target.files); e.currentTarget.value = ''; }} />
        </label>
        <label style={{ ...refUploadBtn, opacity: (counts.canAddVideo && !uploading) ? 1 : 0.4, pointerEvents: (counts.canAddVideo && !uploading) ? 'auto' : 'none' }}>
          {uploading ? '上传中…' : '+ 视频'}
          <input type="file" accept="video/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onAddVideo(e.target.files); e.currentTarget.value = ''; }} />
        </label>
        <label style={{ ...refUploadBtn, opacity: (counts.canAddAudio && !audioName && !uploading) ? 1 : 0.4, pointerEvents: (counts.canAddAudio && !audioName && !uploading) ? 'auto' : 'none' }}>
          {uploading ? '上传中…' : '+ 音频'}
          <input type="file" accept="audio/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onAddAudio(e.target.files); e.currentTarget.value = ''; }} />
        </label>
      </div>
      <div style={{ fontSize: 10, color: '#71717a', marginBottom: 6 }}>
        图片 {images.length}/{MULTIMODAL_MAX_IMAGES} · 视频 {videos.length}/{MULTIMODAL_MAX_VIDEOS} · 总 {counts.total}/{MULTIMODAL_MAX_TOTAL}
      </div>

      {/* 参考图缩略 */}
      {images.length > 0 && (
        <div style={refGrid}>
          {images.map((img, i) => (
            <RefThumb key={i} url={img} index={i} onRemove={() => onRemoveImage(i)} />
          ))}
        </div>
      )}
      {/* 来自连接的图(实时,照原网"来自连接";连线动态来,不可删) */}
      {connImages && connImages.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#a78bfa', margin: '6px 0 4px' }}>来自连接 · {connImages.length} 张</div>
          <div style={refGrid}>
            {connImages.map((img, i) => (
              <RefThumb key={`c${i}`} url={img} index={i} onRemove={() => {}} />
            ))}
          </div>
        </>
      )}
      {/* 参考视频列表 */}
      {videos.map((_, i) => (
        <div key={i} style={refFileRow}>
          <IconVideo size={13} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{videoNames[i] || `视频 ${i + 1}`}</span>
          <button style={refFileDel} onClick={() => onRemoveVideo(i)}>×</button>
        </div>
      ))}
      {/* 参考音频 */}
      {audioName && (
        <div style={refFileRow}>
          <span style={{ display: 'flex' }}>♪</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioName}</span>
          <button style={refFileDel} onClick={onRemoveAudio}>×</button>
        </div>
      )}
    </div>
  );
}

// ===== 小组件 =====
function FrameSlot({ label, url, onUpload, onClear, uploading }: { label: string; url?: string; onUpload: (fl: FileList | null) => void; onClear: () => void; uploading?: boolean }) {
  return (
    <div style={frameSlot}>
      {url ? (
        <>
          <HoverZoomImg url={url} />
          <button style={frameDel} onClick={onClear}>×</button>
          <span style={frameLabel}>{label}</span>
        </>
      ) : (
        <label style={{ ...frameUpload, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
          <IconPlus size={14} />
          <span style={{ fontSize: 10, marginTop: 2 }}>{uploading ? '上传中…' : label}</span>
          <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => onUpload(e.target.files)} />
        </label>
      )}
    </div>
  );
}
function Tag({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...tagBtn, ...(active ? tagActive : {}) }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{children}</span></button>;
}
// 参数按钮 + 从按钮正上方弹出的二级弹窗(各自独立定位,不再统一从卡片左上角弹)
function ParamTag({ label, open, onToggle, width = 240, children }: {
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
  return <button onClick={onClick} style={{ ...subItem, ...(active ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>{children}</button>;
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
    boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 14px 40px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transform: 'translateZ(0)',
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
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const modelBadge: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, zIndex: 10,
  padding: '3px 9px', borderRadius: 8, fontSize: 10, color: '#e4e4e7',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.12)',
};
const playBadge: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18,
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const promptBar: React.CSSProperties = {
  width: 680, minHeight: 340, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
// 顶部行(模式选择 + 宫格);右侧留 64px 给复制/粘贴按钮,避免重合
const topRow: React.CSSProperties = { display: 'flex', gap: 5, padding: '6px 70px 4px 6px', alignItems: 'center' };
const miniTag: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const miniActive: React.CSSProperties = { background: 'rgba(192,192,192,0.2)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const promptInput: React.CSSProperties = {
  width: '100%', padding: '18px 16px 10px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 15, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.65, minHeight: 200,
  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const frameRow: React.CSSProperties = { display: 'flex', gap: 8, padding: '4px 6px 8px' };
const frameSlot: React.CSSProperties = {
  position: 'relative', width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', flexShrink: 0,
};
const frameUpload: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  color: '#a1a1aa', cursor: 'pointer',
};
const frameDel: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const frameLabel: React.CSSProperties = {
  position: 'absolute', left: 0, bottom: 0, width: '100%', textAlign: 'center',
  fontSize: 9, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 0',
};
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 6px 6px' };
const tagBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const subPanel: React.CSSProperties = {
  position: 'absolute', bottom: '108%', left: 6, width: 300, maxHeight: 320, overflowY: 'auto',
  background: 'rgba(28,28,32,0.97)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
// 从参数按钮正上方弹出(各按钮独立定位)
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '8px 11px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
};
const subHint: React.CSSProperties = { fontSize: 10, color: '#71717a', flexShrink: 0 };
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', marginLeft: 4 };
const priceLine: React.CSSProperties = { fontSize: 10, color: '#a1a1aa', whiteSpace: 'nowrap' };
const refUploadBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const refGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 };
const refThumb: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', cursor: 'zoom-in' };
const refDel: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const refIdx: React.CSSProperties = {
  position: 'absolute', bottom: 2, left: 2, fontSize: 9, color: '#fff',
  background: 'rgba(0,0,0,0.7)', padding: '0 4px', borderRadius: 4,
};
const refFileRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', marginBottom: 4,
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
  color: '#d4d4d8', fontSize: 11.5,
};
const refFileDel: React.CSSProperties = {
  border: 'none', background: 'transparent', color: '#71717a', fontSize: 14, cursor: 'pointer', flexShrink: 0,
};
const toolRow: React.CSSProperties = { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const SeedanceNode = memo(SeedanceNodeComponent);
