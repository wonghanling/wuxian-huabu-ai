'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { VIDEO_MODELS, DEFAULT_VIDEO_MODEL, frameNeed, videoPrice, type VideoModel } from '../videoModels';
import { ratioToWH } from '../imageModels';
import { IconVideo, IconModel, IconExpand, IconShrink, IconMinus, IconPlus, IconUpload, IconScissors } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { HoverZoomImg } from './RefThumb';
import { PromptTools } from './PromptTools';
import { PromptArea } from './PromptArea';
import { Lightbox, downloadFile } from './Lightbox';
import { VideoTrimBar } from './VideoTrimBar';
import { uploadImageToStorage, uploadFileToStorage, generateVideo, mirrorOutput, getUserId } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';

// ============================================================
// 视频卡片 · 矩形框(默认 16:9)
// 底部一体式 prompt 栏:模型 / 比例 / 时长 / 清晰度 / 音频开关
// 文生=无参考图;首帧=上传1张;首尾帧=上传2张(首+尾)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type SubPanel = 'model' | 'ratio' | 'duration' | 'quality' | 'ref' | 'refContent' | 'editVid' | null;

function VideoNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
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
  const videoEl = useRef<HTMLVideoElement>(null);       // 卡片内成品视频(捕捉帧抓当前帧)

  // 取消选中卡片时,关闭剪辑条(点画布空白处即收起)
  useEffect(() => { if (!selected) { if (trimming) setTrimming(false); if (capturing) setCapturing(false); } }, [selected, trimming, capturing]);

  const model = VIDEO_MODELS.find((m) => m.id === data.config.model) ?? VIDEO_MODELS[0];
  const ratio = data.config.ratio ?? (model.aspectRatios[0] ?? '16:9');
  const duration = data.config.duration ?? model.durations[0] ?? 5;
  const resolution = data.config.resolution ?? model.defaultResolution;
  // 连线实时:上游图作首帧/尾帧显示(本地优先,否则用上游)
  const upstreamLive = useUpstream(id);
  const dispFirst = data.config.firstFrame || upstreamLive.images[0];
  const dispLast = data.config.lastFrame || upstreamLive.images[1];
  const connectedTexts = upstreamLive.texts;   // 来自连接的文案(实时,自动拼入生成)
  const need = frameNeed(model.mode);
  // 实时价格(会员/普通总价 = 单价 × 时长,复用原网 calcVideoPrice)
  const price = videoPrice(model.id, resolution, duration, !!data.config.audio);

  // 卡片框比例规则(照用户三条):
  //  1) 成品已生成→按视频真实尺寸(aspectW/H,最准,三种情况都覆盖)
  //  2) 未生成 + 模型有比例选项→按所选比例(文生视频 / veo 图生等)
  //  3) 未生成 + 模型无比例选项→跟随参考图比例(即梦/万相 图生、首尾帧)
  const mult = enlarged ? 1.7 : 1;
  const baseLong = 360 * mult;
  const aw = (data as any).aspectW as number | undefined;
  const ah = (data as any).aspectH as number | undefined;
  const whFromRatio = (r: number): { w: number; h: number } =>
    r >= 1 ? { w: baseLong, h: Math.round(baseLong / r) } : { w: Math.round(baseLong * r), h: baseLong };

  // 模型无比例选项时,探测参考图真实比例
  const followsRefImage = model.aspectRatios.length === 0;
  const [refDims, setRefDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!followsRefImage || !dispFirst) { setRefDims(null); return; }
    const probe = new Image();
    probe.onload = () => setRefDims({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = dispFirst;
  }, [followsRefImage, dispFirst]);

  let dims: { w: number; h: number };
  if (aw && ah && aw > 0 && ah > 0) {
    dims = whFromRatio(aw / ah);                          // ① 成品真实比例
  } else if (model.aspectRatios.length > 0) {
    dims = ratioToWH(ratio || '16:9', baseLong);          // ② 按所选比例
  } else if (refDims) {
    dims = whFromRatio(refDims.w / refDims.h);             // ③ 跟随参考图
  } else {
    dims = ratioToWH('16:9', baseLong);                   // 兜底
  }
  // 卡片框只显示成品(outputUrl);首帧/参考图绝不进卡片框

  useEffect(() => { if (editing && editRef.current) editRef.current.focus(); }, [editing]);

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

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

  // r2v 参考内容:加参考图(本地+连线总≤5)
  const addRefImage = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const cur = data.config.refImages ?? [];
    const connCount = upstreamLive.images.length + upstreamLive.videos.length;
    const room = Math.max(0, 5 - cur.length - (data.config.refVideos?.length ?? 0) - connCount);
    if (room <= 0) return;
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const url = await uploadImageToStorage(f);
        if (url) {
          const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config.refImages ?? [];
          updateConfig(id, { refImages: [...latest, url] });
        }
      }
    } finally { setUploading(false); }
  };
  const removeRefImage = (i: number) => {
    const cur = [...(data.config.refImages ?? [])];
    cur.splice(i, 1);
    updateConfig(id, { refImages: cur });
  };
  // r2v:加参考视频
  const addRefVideo = async (fileList: FileList | null) => {
    const f = fileList?.[0]; if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'video');
      if (url) {
        const cur = data.config.refVideos ?? [];
        const curN = data.config.refVideoNames ?? [];
        updateConfig(id, { refVideos: [...cur, url], refVideoNames: [...curN, f.name] });
      }
    } finally { setUploading(false); }
  };
  const removeRefVideo = (i: number) => {
    const cur = [...(data.config.refVideos ?? [])];
    const curN = [...(data.config.refVideoNames ?? [])];
    cur.splice(i, 1); curN.splice(i, 1);
    updateConfig(id, { refVideos: cur, refVideoNames: curN });
  };
  // videoedit:上传待编辑视频
  const uploadEditVideo = async (fileList: FileList | null) => {
    const f = fileList?.[0]; if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'video');
      if (url) updateConfig(id, { editVideo: url });
    } finally { setUploading(false); }
  };

  // 剪辑:开启剪辑条(初始化区间为整段)
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
          config: { ...data.config, trimStart: undefined, trimEnd: undefined } } as any,
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

  // 捕捉画面帧:抓卡片内正在播放的视频「当前帧」(暂停/拖到哪一帧就抓哪帧,照原网 captureCurrentFrame)
  // → 上传 Supabase 拿持久 URL → 新建图片卡显示(URL,非base64)
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
      // 上传拿持久 URL(全站 URL 化契约)
      const url = await uploadImageToStorage(file);
      if (!url) throw new Error('上传帧失败');
      // 新建图片卡显示该帧,放在本卡右侧并自动连线
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

  // 上传视频:真实上传 Supabase 拿持久 URL(blob URL 刷新即失效)
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

  const handleGenerate = async () => {
    // 连线传参:上游图片→首帧/尾帧,上游文案→prompt 前缀
    const upstream = getUpstreamOutputs(id);
    const effFirst = need.first ? (data.config.firstFrame || upstream.images[0]) : undefined;
    const effLast = need.last ? (data.config.lastFrame || upstream.images[1] || upstream.images[0]) : undefined;
    const effPrompt = upstream.texts.length > 0
      ? `${upstream.texts.join('\n')}\n${data.config.prompt}`.trim()
      : data.config.prompt;

    // r2v 参考内容:本地参考图/视频 + 上游连线图/视频(去重)
    let effRefImages: string[] | undefined;
    let effRefVideos: string[] | undefined;
    let effEditVideo: string | undefined;
    if (model.mode === 'r2v') {
      const localImgs = data.config.refImages ?? [];
      const localVids = data.config.refVideos ?? [];
      effRefImages = [...localImgs, ...upstream.images.filter((u) => !localImgs.includes(u))];
      effRefVideos = [...localVids, ...upstream.videos.filter((u) => !localVids.includes(u))];
      if (effRefImages.length === 0 && effRefVideos.length === 0) return;
    } else if (model.mode === 'videoedit') {
      effEditVideo = data.config.editVideo || upstream.videos[0];
      if (!effEditVideo) return;
    } else {
      if (!effPrompt.trim() && need.first && !effFirst) return;
    }

    updateCard(id, { status: 'generating', progress: 12 });
    try {
      const userId = await getUserId();
      const videoUrl = await generateVideo(
        {
          prompt: effPrompt,
          model: model.id,
          aspectRatio: ratio,
          duration,
          resolution,
          generateAudio: !!data.config.audio,
          startFrameImage: effFirst,
          endFrameImage: effLast,
          refImages: effRefImages,
          refVideos: effRefVideos,
          editVideo: effEditVideo,
          userId,
        },
        (progress) => updateCard(id, { progress }),
      );
      updateCard(id, { status: 'done', progress: 100, outputUrl: videoUrl });
      // 后台 mirror 成永久 URL,完成后保存
      mirrorOutput(videoUrl, 'video').then((permUrl) => {
        if (permUrl && permUrl !== videoUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      updateCard(id, { status: 'error', progress: 0 });
      alert('视频生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}><span style={{ color: '#d4d4d8', display: 'flex' }}><IconVideo size={18} /></span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>视频生成</div>
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
        {/* 收起按钮:浮右上角 */}
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        {/* 视频区(铺满) */}
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
                // 探测成品真实尺寸 → 卡片按真实比例显示(三种情况都覆盖)
                if (v.videoWidth && v.videoHeight && (aw !== v.videoWidth || ah !== v.videoHeight)) {
                  updateCard(id, { aspectW: v.videoWidth, aspectH: v.videoHeight });
                }
              }}
              onTimeUpdate={(e) => {
                // 剪辑开启时:播放只在 [trimStart, trimEnd] 区间内循环
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
          <PromptArea
            connectedText={connectedTexts.length > 0 ? connectedTexts.join('\n') : undefined}
            value={data.config.prompt}
            onChange={(v) => updateConfig(id, { prompt: v })}
            onGenerate={handleGenerate}
            placeholder="描述你想要的视频画面…"
            style={promptInput}
          />

          {/* 参数标签行(每个按钮各自弹窗,从按钮正上方弹出) */}
          <div style={tagsRow}>
            <ParamTag label={<><IconModel size={12} /> {model.label}</>} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')} width={300}>
              {VIDEO_MODELS.map((m: VideoModel) => {
                const noAudio = videoPrice(m.id, m.defaultResolution, 1, false);
                const withAudio = m.supportsAudio ? videoPrice(m.id, m.defaultResolution, 1, true) : null;
                return (
                  <SubItem key={m.id} active={m.id === data.config.model} onClick={() => {
                    updateConfig(id, { model: m.id, ratio: m.aspectRatios[0] ?? '', duration: m.durations[0] ?? 5, resolution: m.defaultResolution });
                    setSub(null);
                  }}>
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <span style={priceCol}>
                      {withAudio ? (
                        <>
                          <span style={priceLine}>无声 会员¥{noAudio.member.toFixed(2)}/普通¥{noAudio.normal.toFixed(2)}</span>
                          <span style={priceLine}>有声 会员¥{withAudio.member.toFixed(2)}/普通¥{withAudio.normal.toFixed(2)}</span>
                        </>
                      ) : (
                        <span style={priceLine}>会员¥{noAudio.member.toFixed(2)}/普通¥{noAudio.normal.toFixed(2)}/秒</span>
                      )}
                    </span>
                  </SubItem>
                );
              })}
            </ParamTag>

            {/* 参考图(首帧/尾帧)弹窗:i2v 首帧, firstLastFrame 首帧+尾帧;连线上游图实时显示 */}
            {(need.first || need.last) && (() => {
              const hasRef = !!dispFirst || (need.last && !!dispLast);
              return (
                <ParamTag label={<>参考图{hasRef && <span style={greenDot} />}</>} open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')} width={need.last ? 200 : 120}>
                  <div style={{ display: 'flex', gap: 8, padding: 4 }}>
                    {need.first && (
                      <FrameSlot label={need.last ? '首帧' : '参考图'} url={dispFirst} uploading={uploading}
                        onUpload={(fl) => uploadFrame('firstFrame', fl)} onClear={() => updateConfig(id, { firstFrame: undefined })} />
                    )}
                    {need.last && (
                      <FrameSlot label="尾帧" url={dispLast} uploading={uploading}
                        onUpload={(fl) => uploadFrame('lastFrame', fl)} onClear={() => updateConfig(id, { lastFrame: undefined })} />
                    )}
                  </div>
                </ParamTag>
              );
            })()}

            {/* r2v 参考内容:参考图(≤5)+参考视频,上传+连线 */}
            {model.mode === 'r2v' && (() => {
              const imgs = data.config.refImages ?? [];
              const vids = data.config.refVideos ?? [];
              const vNames = data.config.refVideoNames ?? [];
              const connImgs = upstreamLive.images.filter((u) => !imgs.includes(u));
              const connVids = upstreamLive.videos.filter((u) => !vids.includes(u));
              const total = imgs.length + vids.length + connImgs.length + connVids.length;
              const has = total > 0;
              return (
                <ParamTag label={<>参考内容 {total}/5{has && <span style={greenDot} />}</>} open={sub === 'refContent'} onToggle={() => setSub(sub === 'refContent' ? null : 'refContent')} width={300}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', padding: '4px 6px 6px' }}>参考图/视频共 ≤5;prompt 里用"图1/视频1"指代</div>
                  {/* 参考图 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 6px 6px' }}>
                    {imgs.map((u, i) => (
                      <div key={`ri${i}`} style={{ position: 'relative' }}>
                        <HoverZoomImg url={u} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                        <button onClick={() => removeRefImage(i)} style={refRm}>✕</button>
                      </div>
                    ))}
                    {connImgs.map((u, i) => (
                      <div key={`ci${i}`} style={{ position: 'relative' }} title="来自连接">
                        <HoverZoomImg url={u} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, opacity: 0.85 }} />
                      </div>
                    ))}
                    {total < 5 && (
                      <label style={refAddBtn}>
                        <IconPlus size={14} />
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => addRefImage(e.target.files)} />
                      </label>
                    )}
                  </div>
                  {/* 参考视频 */}
                  <div style={{ padding: '0 6px 6px' }}>
                    {vids.map((u, i) => (
                      <div key={`rv${i}`} style={refVidRow}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎬 {vNames[i] || `视频${i + 1}`}</span>
                        <button onClick={() => removeRefVideo(i)} style={{ ...refRm, position: 'static' }}>✕</button>
                      </div>
                    ))}
                    {connVids.map((_, i) => (
                      <div key={`cv${i}`} style={{ ...refVidRow, opacity: 0.85 }}>🎬 连接视频{i + 1}</div>
                    ))}
                    {total < 5 && (
                      <label style={{ ...refVidRow, cursor: 'pointer', justifyContent: 'center', color: '#a1a1aa' }}>
                        {uploading ? '上传中…' : '+ 上传参考视频'}
                        <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => addRefVideo(e.target.files)} />
                      </label>
                    )}
                  </div>
                </ParamTag>
              );
            })()}

            {/* videoedit 待编辑视频:上传+连线 */}
            {model.mode === 'videoedit' && (() => {
              const editV = data.config.editVideo || upstreamLive.videos[0];
              return (
                <ParamTag label={<>待编辑视频{editV && <span style={greenDot} />}</>} open={sub === 'editVid'} onToggle={() => setSub(sub === 'editVid' ? null : 'editVid')} width={240}>
                  <div style={{ padding: 6 }}>
                    {editV ? (
                      <div style={refVidRow}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎬 {data.config.editVideo ? '已上传待编辑视频' : '来自连接的视频'}</span>
                        {data.config.editVideo && <button onClick={() => updateConfig(id, { editVideo: undefined })} style={{ ...refRm, position: 'static' }}>✕</button>}
                      </div>
                    ) : (
                      <label style={{ ...refVidRow, cursor: 'pointer', justifyContent: 'center', color: '#a1a1aa' }}>
                        {uploading ? '上传中…' : '+ 上传待编辑视频'}
                        <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => uploadEditVideo(e.target.files)} />
                      </label>
                    )}
                  </div>
                </ParamTag>
              );
            })()}

            {model.aspectRatios.length > 0 && (
              <ParamTag label={<>比例 {ratio}</>} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={200}>
                {model.aspectRatios.map((r) => (
                  <SubItem key={r} active={r === ratio} onClick={() => { updateConfig(id, { ratio: r }); setSub(null); }}>
                    <span>{r}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
            {model.durations.length > 0 && (
              <ParamTag label={<>时长 {duration}s</>} open={sub === 'duration'} onToggle={() => setSub(sub === 'duration' ? null : 'duration')} width={160}>
                {model.durations.map((d) => (
                  <SubItem key={d} active={d === duration} onClick={() => { updateConfig(id, { duration: d }); setSub(null); }}>
                    <span>{d} 秒</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
            {model.resolutions.length > 0 && (
              <ParamTag label={<>清晰度 {resolution}</>} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={160}>
                {model.resolutions.map((r) => (
                  <SubItem key={r} active={r === resolution} onClick={() => { updateConfig(id, { resolution: r }); setSub(null); }}>
                    <span>{r}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
            {/* 音频开关 */}
            {model.supportsAudio && (
              <button
                onClick={() => updateConfig(id, { audio: !data.config.audio })}
                style={{ ...tagBtn, ...(data.config.audio ? tagActive : {}) }}
                title="生成视频是否带音频"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  音频 {data.config.audio ? '开' : '关'}
                </span>
              </button>
            )}
          </div>

          {/* 底行:实时价格(会员/普通) + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 4px', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#e4e4e7' }}>
              会员 <b style={{ color: '#fff' }}>¥{price.member.toFixed(2)}</b>
              <span style={{ color: '#71717a' }}> / 普通 ¥{price.normal.toFixed(2)}</span>
            </span>
            <span style={{ fontSize: 10, color: '#52525b' }}>{duration}s · {resolution}{data.config.audio ? ' · 有声' : ''}</span>
            <button onClick={handleGenerate} disabled={data.status === 'generating'} style={{ ...generateBtn, opacity: data.status === 'generating' ? 0.4 : 1, cursor: data.status === 'generating' ? 'default' : 'pointer' }}>{data.status === 'generating' ? '生成中…' : 'Generate'}</button>
          </div>
        </div>
      </NodeToolbar>

      {/* ===== 顶部工具栏(上传视频 + 剪辑 + 放大) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !lightbox && (!sub || hasVideo)} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {hasVideo ? (
            <>
              {/* 有成品视频:查看/下载/捕捉帧/删除(照源网) */}
              <button onClick={() => setLightbox(true)} style={toolBtnWide} title="查看(放大)">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconExpand size={16} /> 查看</span>
              </button>
              <button onClick={() => downloadFile(data.outputUrl!, `video-${id}.mp4`)} style={toolBtnWide} title="下载">
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
              {/* 无成品视频:上传 + 放大卡片 */}
              <label style={toolBtnWide} title="上传视频">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconUpload size={16} /> 上传</span>
                <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => uploadVideo(e.target.files)} />
              </label>
              <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide} title={enlarged ? '还原' : '放大卡片'}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}{enlarged ? '还原' : '放大'}</span>
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
        <Handle
          type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}
        >
          <span style={portPlusIcon}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
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
// 参数按钮 + 从按钮正上方弹出的二级弹窗
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
  position: 'absolute', bottom: '108%', left: 6, width: 280, maxHeight: 300, overflowY: 'auto',
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
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#e4e4e7', display: 'inline-block', marginLeft: 4 };
const refRm: React.CSSProperties = { position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 5, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 9, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const refAddBtn: React.CSSProperties = { width: 56, height: 56, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const refVidRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginBottom: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', fontSize: 11.5, color: '#d4d4d8' };
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '8px 11px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
};
const subPrice: React.CSSProperties = { fontSize: 10.5, color: '#71717a', flexShrink: 0 };
const priceCol: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0,
};
const priceLine: React.CSSProperties = { fontSize: 10, color: '#a1a1aa', whiteSpace: 'nowrap' };
const toolRow: React.CSSProperties = { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const VideoNode = memo(VideoNodeComponent);
