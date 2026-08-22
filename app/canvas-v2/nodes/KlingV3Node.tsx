'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import {
  KLING_V3_MODELS, DEFAULT_KLING_V3_MODEL, KLING_V3_MODES, klingV3Durations,
  klingV3FrameNeed, klingV3Price,
  KLING_V3_MAX_ELEMENTS, KLING_V3_MAX_REF_PER_ELEMENT,
  type KlingV3Mode, type KlingV3Model, type KlingV3Element,
} from '../klingV3Config';
import { ratioToWH } from '../imageModels';
import { IconVideo, IconModel, IconExpand, IconShrink, IconMinus, IconPlus, IconUpload, IconScissors } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { RefThumb, HoverZoomImg } from './RefThumb';
import { PromptTools } from './PromptTools';
import { PromptArea } from './PromptArea';
import { Lightbox, downloadFile } from './Lightbox';
import { VideoTrimBar } from './VideoTrimBar';
import { uploadImageToStorage, uploadFileToStorage, generateKlingV3, mirrorOutput, getUserId } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';

// ============================================================
// Kling v3 视频卡 · 矩形框(独立，不与 Seedance 共享)
// 四模式:文生 / 图生-首帧 / 首尾帧 / 多模态
// 多模态 = 场景帧(start/end) + 角色元素(最多3角色,每角色1正面图+最多3参考图)
//   → Kling elements,prompt 用 @图片N(=@ElementN) 引用；理论最多 1+1+3×4=14 张
// 按秒计费(有无音频不同价)，不接语言控制
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type SubPanel = 'mode' | 'model' | 'ratio' | 'duration' | 'quality' | 'ref' | null;

function KlingV3NodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasVideo = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [editing, setEditing] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<SubPanel>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)
  const [lightbox, setLightbox] = useState(false);      // 画布内查看放大
  const [trimming, setTrimming] = useState(false);      // 剪辑条开关
  const [exporting, setExporting] = useState(false);    // 导出片段中
  const [capturing, setCapturing] = useState(false);    // 捕捉帧模式:开启才显示controls+nodrag,否则可拖卡片
  const editRef = useRef<HTMLTextAreaElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);       // 成品视频(捕捉帧抓当前帧)

  // 取消选中卡片时,关闭剪辑条
  useEffect(() => { if (!selected) { if (trimming) setTrimming(false); if (capturing) setCapturing(false); } }, [selected, trimming, capturing]);

  const model = KLING_V3_MODELS.find((m) => m.id === data.config.model) ?? KLING_V3_MODELS[0];
  const mode = (data.config.preset as KlingV3Mode) ?? 't2v';   // 用 preset 字段存模式
  const ratio = data.config.ratio ?? '16:9';
  const duration = String(data.config.duration ?? '5');
  const resolution = data.config.resolution ?? '720p';  // Kling 无清晰度档，占位
  const need = klingV3FrameNeed(mode);
  const genAudio = !!data.config.audio;
  // 价格(Kling 按秒 × 有无音频；会员/普通在前端按未登录估普通价，实际以后端为准)
  const priceSeconds = Number(duration) || 5;
  const price = klingV3Price(model.id, genAudio, priceSeconds, false);

  // 连线实时:上游图→首/尾帧(i2v/首尾帧模式用;多模态场景帧不走连线,保持简单)
  const upstreamLive = useUpstream(id);
  const dispFirst = data.config.firstFrame || upstreamLive.images[0];
  const dispLast = data.config.lastFrame || upstreamLive.images[1];
  const firstFromConn = !data.config.firstFrame && !!upstreamLive.images[0];
  const lastFromConn = !data.config.lastFrame && !!upstreamLive.images[1];
  const connectedTexts = upstreamLive.texts;   // 来自连接的文案(实时,自动拼入生成)
  // 多模态:场景帧(firstFrame/lastFrame)+ 角色元素(elements)。
  // elements 存在 config.elements,store 类型未含该字段,本文件内用 cast 读写。
  const elements: KlingV3Element[] = ((data.config as any).elements as KlingV3Element[]) ?? [];

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
  // ── 多模态角色元素管理(elements 存 config.elements,本文件内 cast 读写)──
  const setElements = (next: KlingV3Element[]) =>
    updateConfig(id, { elements: next } as any);
  // 读取最新 elements(异步上传后避免闭包旧值)
  const latestElements = (): KlingV3Element[] =>
    ((useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config as any)?.elements as KlingV3Element[]) ?? [];
  // 添加一个空角色(最多 KLING_V3_MAX_ELEMENTS)
  const addElement = () => {
    if (elements.length >= KLING_V3_MAX_ELEMENTS) return;
    setElements([...elements, { frontal: '', references: [] }]);
  };
  const removeElement = (idx: number) => {
    const next = [...latestElements()];
    next.splice(idx, 1);
    setElements(next);
  };
  // 上传/替换某角色的正面图
  const uploadElementFrontal = async (idx: number, fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(f);
      if (url) {
        const next = [...latestElements()];
        if (next[idx]) { next[idx] = { ...next[idx], frontal: url }; setElements(next); }
      }
    } finally {
      setUploading(false);
    }
  };
  // 给某角色添加参考图(每角色最多 KLING_V3_MAX_REF_PER_ELEMENT)
  const addElementRefs = async (idx: number, fileList: FileList | null) => {
    if (!fileList) return;
    const cur = elements[idx];
    if (!cur) return;
    const room = KLING_V3_MAX_REF_PER_ELEMENT - cur.references.length;
    if (room <= 0) return;
    const files = Array.from(fileList).slice(0, room);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const url = await uploadImageToStorage(f);
        if (url) {
          const next = [...latestElements()];
          if (next[idx]) {
            next[idx] = { ...next[idx], references: [...next[idx].references, url] };
            setElements(next);
          }
        }
      }
    } finally {
      setUploading(false);
    }
  };
  const removeElementRef = (idx: number, refIdx: number) => {
    const next = [...latestElements()];
    if (!next[idx]) return;
    const refs = [...next[idx].references];
    refs.splice(refIdx, 1);
    next[idx] = { ...next[idx], references: refs };
    setElements(next);
  };
  const clearElementFrontal = (idx: number) => {
    const next = [...latestElements()];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], frontal: '' };
    setElements(next);
  };

  const uploadVideo = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'video');
      if (url) updateCard(id, { status: 'done', outputUrl: url });
    } finally {
      setUploading(false);
    }
  };

  // 捕捉画面帧:抓卡片内视频「当前帧」(暂停/拖到哪一帧就抓哪帧,照视频卡)→ 上传 Supabase → 新建图片卡
  const captureFrame = async () => {
    const v = videoEl.current;
    if (!v || !v.videoWidth) { alert('请先等视频加载出来再捕捉'); return; }
    setUploading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92));
      if (!blob) throw new Error('生成帧失败');
      const file = new File([blob], `frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadImageToStorage(file);
      if (!url) throw new Error('上传帧失败');
      const newId = `i${Date.now()}`;
      const newNode: CardNode = {
        id: newId, type: 'card',
        position: { x: 0, y: 0 },
        data: { kind: 'image', status: 'done', outputUrl: url, aspectW: v.videoWidth, aspectH: v.videoHeight,
          config: { model: 'nano-banana-pro', prompt: '', ratio: '1:1' } } as any,
      };
      const cur = useCanvasStore.getState().nodes.find((n) => n.id === id);
      if (cur) { newNode.position = { x: cur.position.x + 440, y: cur.position.y }; }
      useCanvasStore.setState((s) => ({
        nodes: [...s.nodes, newNode],
        edges: [...s.edges, { id: `e${id}-${newId}`, source: id, target: newId, type: 'deletable', animated: true }],
        selectedId: newId,
      }));
      (window as any).saveCanvasV2Now?.();
    } catch (err: any) {
      alert('捕捉画面帧失败: ' + (err?.message || err) + '\n(可能是视频跨域限制)');
    } finally {
      setUploading(false);
    }
  };

  // 剪辑:开启剪辑条(初始区间=整段)
  const openTrim = () => {
    const v = videoEl.current;
    const dur = v?.duration || data.config.duration || 5;
    if (data.config.trimStart == null || data.config.trimEnd == null) {
      updateConfig(id, { trimStart: 0, trimEnd: +dur.toFixed(2) });
    }
    setTrimming(true);
  };

  // 导出剪辑片段:调后端 fal 裁切(真mp4,不崩;避开Chromium captureStream崩溃bug)
  const exportSegment = async () => {
    if (!data.outputUrl) return;
    const ts = data.config.trimStart ?? 0;
    const te = data.config.trimEnd ?? (videoEl.current?.duration || 5);
    if (te - ts < 0.1) { alert('请先拖把手选择一段区间'); return; }
    setExporting(true);
    try {
      const userId = await getUserId();
      const res = await fetch('/api/video/trim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: data.outputUrl, start: ts, end: te, userId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '裁切失败');
      const url = d.videoUrl;
      const newId = `v${Date.now()}`;
      const cur = useCanvasStore.getState().nodes.find((n) => n.id === id);
      const newNode: CardNode = {
        id: newId, type: 'card',
        position: cur ? { x: cur.position.x, y: cur.position.y + 420 } : { x: 0, y: 0 },
        data: { kind: 'video', status: 'done', outputUrl: url,
          config: { model: 'veo3.1-t2v', prompt: '' } } as any,
      };
      useCanvasStore.setState((s) => ({
        nodes: [...s.nodes, newNode],
        edges: [...s.edges, { id: `e${id}-${newId}`, source: id, target: newId, type: 'deletable', animated: true }],
        selectedId: newId,
      }));
      (window as any).saveCanvasV2Now?.();
      setTrimming(false);
    } catch (err: any) {
      alert('导出片段失败: ' + (err?.message || err));
    } finally {
      setExporting(false);
    }
  };

  const handleGenerate = async () => {
    // 连线传参:上游图→首帧/参考图,上游视频→refVideo,上游文案→prompt前缀
    const upstream = getUpstreamOutputs(id);
    // 界面用 @图片N(直观),Kling API 需要 @ElementN,发给后端时转换
    const rawPrompt = (data.config.prompt ?? '').replace(/@图片(\d+)/g, '@Element$1');
    const effPrompt = upstream.texts.length > 0
      ? `${upstream.texts.join('\n')}\n${rawPrompt}`.trim()
      : rawPrompt;
    const effFirst = data.config.firstFrame || upstream.images[0];
    const effLast = data.config.lastFrame || upstream.images[1];
    // 多模态:场景起始帧(必填)+ 场景结束帧(可选)+ 角色元素(只取有正面图的)
    const mmElements = mode === 'multimodal'
      ? elements.filter((el) => !!el.frontal)
      : undefined;
    // 校验
    if (mode === 't2v' && !effPrompt.trim()) return;
    if ((mode === 'i2v' || mode === 'first-last') && !effFirst) return;
    if (mode === 'first-last' && !effLast) return;
    if (mode === 'multimodal' && !data.config.firstFrame) return;
    updateCard(id, { status: 'generating', progress: 12 });
    try {
      const userId = await getUserId();
      const videoUrl = await generateKlingV3(
        {
          tier: model.tier,
          mode,
          prompt: effPrompt,
          duration: Number(duration) || 5,
          generateAudio: !!data.config.audio,
          firstFrameImage: mode === 'multimodal' ? data.config.firstFrame : effFirst,
          lastFrameImage: mode === 'multimodal' ? data.config.lastFrame : effLast,
          elements: mmElements,
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
      alert('Kling v3 生成失败: ' + (err?.message || err));
    }
  };

  const setMode = (m: KlingV3Mode) => updateConfig(id, { preset: m });

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}><span style={{ color: '#d4d4d8', display: 'flex' }}><IconVideo size={18} /></span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>Kling v3</div>
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
            <video
              ref={videoEl}
              className={(capturing || trimming) ? 'nodrag' : undefined}
              src={data.outputUrl!}
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
              loop playsInline preload="metadata"
              muted={!selected}
              controls={capturing || trimming}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget as HTMLVideoElement;
                if (v.videoWidth && v.videoHeight && ((data as any).aspectW !== v.videoWidth || (data as any).aspectH !== v.videoHeight)) {
                  updateCard(id, { aspectW: v.videoWidth, aspectH: v.videoHeight });
                }
              }}
              onTimeUpdate={(e) => {
                if (!trimming) return;
                const v = e.currentTarget as HTMLVideoElement;
                const ts = data.config.trimStart ?? 0;
                const te = data.config.trimEnd ?? v.duration;
                if (v.currentTime >= te || v.currentTime < ts) v.currentTime = ts;
              }}
              onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
              onMouseLeave={(e) => { if (!selected) { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; } }}
            />
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
                {KLING_V3_MODES.find((m) => m.key === mode)?.label ?? '文生视频'} ▾
              </button>
              {sub === 'mode' && (
                <div style={{ ...popPanel, width: 240 }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
                  {KLING_V3_MODES.map((m) => (
                    <SubItem key={m.key} active={m.key === mode} onClick={() => { setMode(m.key); setSub(null); }}>
                      <span>{m.label}</span>
                      <span style={subHint}>
                        {m.key === 't2v' ? '纯文字' : m.key === 'i2v' ? '1张首帧' : m.key === 'first-last' ? '首帧+尾帧' : '场景帧+角色(最多3)'}
                      </span>
                    </SubItem>
                  ))}
                </div>
              )}
            </div>
          </div>

          <PromptArea
            connectedText={connectedTexts.length > 0 ? connectedTexts.join('\n') : undefined}
            value={data.config.prompt}
            onChange={(v) => updateConfig(id, { prompt: v })}
            onGenerate={handleGenerate}
            placeholder={mode === 't2v' ? '描述视频内容…（必填）' : '描述视频内容…（输入 @ 引用参考图）'}
            style={promptInput}
            mentionItems={mode === 'multimodal'
              ? elements.map((el, i) => ({ label: `角色${i + 1}`, ref: `@图片${i + 1}`, thumb: el.frontal }))
              : undefined}
          />

          {/* 参数标签行(每个按钮各自弹窗,从按钮正上方弹出) */}
          <div style={tagsRow}>
            <ParamTag label={<><IconModel size={12} /> {model.label}</>} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')}>
              {KLING_V3_MODELS.map((m: KlingV3Model) => (
                <SubItem key={m.id} active={m.id === data.config.model} onClick={() => {
                  // 切换后若当前时长不在该 tier 支持范围，重置为 5 秒
                  const durs = klingV3Durations(m.tier);
                  updateConfig(id, { model: m.id, duration: durs.includes(duration) ? Number(duration) : 5 });
                  setSub(null);
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
                    <span style={{ fontWeight: 600 }}>{m.label}</span>
                    <span style={priceLine}>
                      无音频 ¥{m.priceMemberNoAudio.toFixed(1)} 每秒
                    </span>
                    <span style={priceLine}>
                      有音频 ¥{m.priceMemberAudio.toFixed(1)} 每秒
                    </span>
                  </div>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={<>时长 {duration}s</>} open={sub === 'duration'} onToggle={() => setSub(sub === 'duration' ? null : 'duration')} width={160}>
              {klingV3Durations(model.tier).map((d) => (
                <SubItem key={d} active={d === duration} onClick={() => { updateConfig(id, { duration: Number(d) }); setSub(null); }}>
                  <span>{d} 秒</span>
                </SubItem>
              ))}
            </ParamTag>

            <ParamTag label={<>音频 {genAudio ? '开' : '关'}</>} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={220}>
              {[{ v: false, label: '无音频' }, { v: true, label: '生成音频' }].map((o) => (
                <SubItem key={String(o.v)} active={genAudio === o.v} onClick={() => { updateConfig(id, { audio: o.v }); setSub(null); }}>
                  <span>{o.label}</span>
                  <span style={subHint}>¥{(o.v ? model.priceMemberAudio : model.priceMemberNoAudio).toFixed(1)}/秒</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 参考内容按钮(i2v/first-last/multimodal 三模式都显示,内容按模式区分) */}
            {(mode === 'i2v' || mode === 'first-last' || mode === 'multimodal') && (() => {
              const hasRef = mode === 'multimodal'
                ? (!!data.config.firstFrame || !!data.config.lastFrame || elements.length > 0)
                : (!!data.config.firstFrame || (mode === 'first-last' && !!data.config.lastFrame));
              const refLabel = mode === 'multimodal' ? `场景/角色 ${elements.length}/${KLING_V3_MAX_ELEMENTS}` : '参考图';
              return (
                <ParamTag
                  label={<>{refLabel}{hasRef && <span style={greenDot} />}</>}
                  open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')}
                  width={mode === 'multimodal' ? 340 : 200}
                >
                  {mode === 'multimodal' ? (
                    <RefPanel
                      firstFrame={data.config.firstFrame} lastFrame={data.config.lastFrame}
                      elements={elements} uploading={uploading}
                      onUploadFrame={uploadFrame}
                      onClearFirst={() => updateConfig(id, { firstFrame: undefined })}
                      onClearLast={() => updateConfig(id, { lastFrame: undefined })}
                      onAddElement={addElement} onRemoveElement={removeElement}
                      onUploadFrontal={uploadElementFrontal} onClearFrontal={clearElementFrontal}
                      onAddRefs={addElementRefs} onRemoveRef={removeElementRef}
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

          </div>

          {/* 底行:实时价格(会员/普通) + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 4px', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#e4e4e7' }}>
              <b style={{ color: '#fff' }}>¥{klingV3Price(model.id, genAudio, priceSeconds, true).toFixed(2)}</b>
            </span>
            <span style={{ fontSize: 10, color: '#52525b' }}>{duration}s · {genAudio ? '有音频' : '无音频'}</span>
            <button onClick={handleGenerate} disabled={data.status === 'generating'} style={{ ...generateBtn, opacity: data.status === 'generating' ? 0.4 : 1, cursor: data.status === 'generating' ? 'default' : 'pointer' }}>{data.status === 'generating' ? '生成中…' : 'Generate'}</button>
          </div>
        </div>
      </NodeToolbar>

      {/* ===== 顶部工具栏(有成品:查看/下载/捕捉帧/删除;无成品:上传/剪辑/放大;弹窗打开时隐藏避免遮挡) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !lightbox && (!sub || hasVideo)} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {hasVideo ? (
            <>
              <button onClick={() => setLightbox(true)} style={toolBtnWide} title="查看(放大)">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconExpand size={16} /> 查看</span>
              </button>
              <button onClick={() => downloadFile(data.outputUrl!, `klingv3-${id}.mp4`)} style={toolBtnWide} title="下载">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>↓ 下载</span>
              </button>
              {capturing ? (
                <>
                  <button onClick={async () => { await captureFrame(); setCapturing(false); }} style={{ ...toolBtnWide, background: 'rgba(96,165,250,0.3)' }} title="抓取当前画面为图片">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconScissors size={16} /> 确认捕捉</span>
                  </button>
                  <button onClick={() => setCapturing(false)} style={toolBtnWide} title="退出捕捉">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>取消</span>
                  </button>
                </>
              ) : (
                <button onClick={() => { setCapturing(true); setTrimming(false); }} style={toolBtnWide} title="捕捉画面帧(拖进度条选帧)">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconScissors size={16} /> 捕捉帧</span>
                </button>
              )}
              <button onClick={openTrim} style={{ ...toolBtnWide, ...(trimming ? { background: 'rgba(96,165,250,0.25)' } : {}) }} title="剪辑(截取片段)">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconScissors size={16} /> 剪辑</span>
              </button>
              <button onClick={() => updateCard(id, { status: 'empty', outputUrl: null })} style={toolBtnWide} title="删除视频">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>× 删除</span>
              </button>
            </>
          ) : (
            <>
              <label style={toolBtnWide} title="上传视频">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconUpload size={16} /> 上传</span>
                <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => uploadVideo(e.target.files)} />
              </label>
              <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide} title={enlarged ? '还原' : '放大卡片'}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
                  {enlarged ? '还原' : '放大'}
                </span>
              </button>
            </>
          )}
        </div>
      </NodeToolbar>
      {/* 剪辑条(底部弹出) */}
      {trimming && hasVideo && (
        <NodeToolbar isVisible position={Position.Bottom} offset={12}>
          <VideoTrimBar
            videoEl={videoEl.current}
            duration={videoEl.current?.duration || data.config.duration || 5}
            trimStart={data.config.trimStart ?? 0}
            trimEnd={data.config.trimEnd ?? (videoEl.current?.duration || 5)}
            onChange={(s, e) => updateConfig(id, { trimStart: s, trimEnd: e })}
            onExport={exportSegment}
            exporting={exporting}
          />
        </NodeToolbar>
      )}
      {lightbox && hasVideo && <Lightbox url={data.outputUrl!} kind="video" onClose={() => setLightbox(false)} />}
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

// ===== 多模态参考面板(Kling v3:场景帧 + 角色槽) =====
// 顶部:场景起始帧(必填)+ 场景结束帧(可选)
// 下方:角色列表(每个 = 正面图 + 最多 3 参考图 + 删除),底部"+ 添加角色"
function RefPanel({
  firstFrame, lastFrame, elements, uploading,
  onUploadFrame, onClearFirst, onClearLast,
  onAddElement, onRemoveElement, onUploadFrontal, onClearFrontal, onAddRefs, onRemoveRef,
}: {
  firstFrame?: string; lastFrame?: string;
  elements: KlingV3Element[];
  uploading?: boolean;
  onUploadFrame: (which: 'firstFrame' | 'lastFrame', fl: FileList | null) => void;
  onClearFirst: () => void; onClearLast: () => void;
  onAddElement: () => void; onRemoveElement: (idx: number) => void;
  onUploadFrontal: (idx: number, fl: FileList | null) => void; onClearFrontal: (idx: number) => void;
  onAddRefs: (idx: number, fl: FileList | null) => void; onRemoveRef: (idx: number, refIdx: number) => void;
}) {
  return (
    <div style={{ padding: 4 }}>
      {/* 场景帧 */}
      <div style={{ fontSize: 10, color: '#a1a1aa', margin: '2px 0 6px' }}>场景帧</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <FrameSlot label="起始帧(必填)" url={firstFrame} uploading={uploading}
          onUpload={(fl) => onUploadFrame('firstFrame', fl)} onClear={onClearFirst} />
        <FrameSlot label="结束帧(可选)" url={lastFrame} uploading={uploading}
          onUpload={(fl) => onUploadFrame('lastFrame', fl)} onClear={onClearLast} />
      </div>

      {/* 角色元素 */}
      <div style={{ fontSize: 10, color: '#a1a1aa', margin: '2px 0 6px' }}>
        角色元素(@图片N 引用) · {elements.length}/{KLING_V3_MAX_ELEMENTS}
      </div>
      {elements.map((el, idx) => (
        <div key={idx} style={elementBlock}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: '#e4e4e7', fontWeight: 600 }}>角色{idx + 1}</span>
            <span style={{ fontSize: 10, color: '#71717a' }}>@图片{idx + 1}</span>
            <button style={{ ...refFileDel, marginLeft: 'auto', fontSize: 11 }} onClick={() => onRemoveElement(idx)}>删除</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {/* 正面图槽 */}
            <FrameSlot label="正面图" url={el.frontal || undefined} uploading={uploading}
              onUpload={(fl) => onUploadFrontal(idx, fl)} onClear={() => onClearFrontal(idx)} />
            {/* 参考图区(最多 3) */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#71717a', marginBottom: 4 }}>
                参考图 {el.references.length}/{KLING_V3_MAX_REF_PER_ELEMENT}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {el.references.map((r, ri) => (
                  <RefThumb key={ri} url={r} index={ri} onRemove={() => onRemoveRef(idx, ri)} />
                ))}
                {el.references.length < KLING_V3_MAX_REF_PER_ELEMENT && (
                  <label style={{ ...refAddThumb, ...(uploading ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}>
                    <IconPlus size={14} />
                    <input type="file" accept="image/*" multiple disabled={uploading} style={{ display: 'none' }}
                      onChange={(e) => { onAddRefs(idx, e.target.files); e.currentTarget.value = ''; }} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 添加角色 */}
      <label
        style={{ ...refUploadBtn, display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
          opacity: elements.length >= KLING_V3_MAX_ELEMENTS ? 0.4 : 1,
          pointerEvents: elements.length >= KLING_V3_MAX_ELEMENTS ? 'none' : 'auto', cursor: 'pointer' }}
        onClick={onAddElement}
      >
        <IconPlus size={13} /> 添加角色
      </label>
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
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#e4e4e7', display: 'inline-block', marginLeft: 4 };
const priceLine: React.CSSProperties = { fontSize: 10, color: '#a1a1aa', whiteSpace: 'nowrap' };
const refUploadBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const refGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 };
const elementBlock: React.CSSProperties = {
  padding: 8, marginBottom: 8, borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
};
const refAddThumb: React.CSSProperties = {
  width: 56, height: 56, borderRadius: 8, flexShrink: 0,
  border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', cursor: 'pointer',
};
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

export const KlingV3Node = memo(KlingV3NodeComponent);
