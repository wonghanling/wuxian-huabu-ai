'use client';
import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T } from 'tldraw';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// 下载文件（fetch blob，不打开新标签页）
const downloadFile = async (url: string, filename: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl; link.download = filename; link.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
  }
};

type SeedanceCardShape = any;

export class SeedanceCardUtil extends BaseBoxShapeUtil<SeedanceCardShape> {
  static override type = 'seedance-card' as const;

  static override props: RecordProps<SeedanceCardShape> = {
    w: T.number,
    h: T.number,
    mode: T.string.optional(),
    model: T.string.optional(),
    prompt: T.string.optional(),
    ratio: T.string.optional(),
    duration: T.string.optional(),
    resolution: T.string.optional(),
    generateAudio: T.boolean.optional(),
    firstFrameImage: T.string.optional(),
    lastFrameImage: T.string.optional(),
    refImages: T.string.optional(),
    refVideoUrl: T.string.optional(),
    refVideoName: T.string.optional(),
    refAudioBase64: T.string.optional(),
    refAudioName: T.string.optional(),
    generatedVideo: T.string.optional(),
    capturedFrame: T.string.optional(),
    isGenerating: T.boolean.optional(),
    generationProgress: T.number.optional(),
    generationStatus: T.string.optional(),
    showSettings: T.boolean.optional(),
    isMinimized: T.boolean.optional(),
  };

  getDefaultProps() {
    return {
      w: 420, h: 560,
      mode: 't2v', model: 'doubao-seedance-2-0-260128',
      prompt: '', ratio: '16:9', duration: '5',
      resolution: '720p', generateAudio: true,
      firstFrameImage: '', lastFrameImage: '',
      refImages: '[]', refVideoUrl: '', refVideoName: '',
      refAudioBase64: '', refAudioName: '',
      generatedVideo: '', capturedFrame: '', isGenerating: false,
      generationProgress: 0, generationStatus: '',
      showSettings: false, isMinimized: false,
    };
  }

  component(shape: SeedanceCardShape) {
    const { w, h, mode, model, prompt, ratio, duration, resolution, generateAudio,
      firstFrameImage, lastFrameImage, refImages, refVideoUrl, refVideoName, refAudioBase64, refAudioName,
      generatedVideo, capturedFrame, isGenerating, generationProgress, generationStatus, showSettings, isMinimized,
    } = shape.props;

    const editor = (this as any).editor;
    const up = (props: any) => editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...shape.props, ...props } });
    const parsedRefImages: string[] = (() => { try { return JSON.parse(refImages || '[]'); } catch { return []; } })();
    // scale 只在展开状态下生效，缩小时固定为1
    const scale = isMinimized ? 1 : Math.min(w / 420, h / 560);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
    const [showVideoOutput, setShowVideoOutput] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: { data: any }) => setUserId(data.user?.id ?? null));
    }, []);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const handler = (e: WheelEvent) => e.stopPropagation();
      el.addEventListener('wheel', handler, { passive: false });
      return () => el.removeEventListener('wheel', handler);
    }, []);
      const video = videoRef.current;
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const frameImage = canvas.toDataURL('image/png');
      const ls = editor.getShape(shape.id);
      const lp = ls ? (ls as any).props : shape.props;
      editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, capturedFrame: frameImage } });
    }, [editor, shape.id]);

    // 读取连接到当前卡片的上游数据，按模式填充对应字段
    const getConnectedInputs = () => {
      const allBindings = editor.getBindingsToShape(shape.id, 'connection');
      const imageUrls: string[] = [];
      let audioBase64: string | null = null;
      let videoUrl: string | null = null;

      for (const binding of allBindings) {
        if (binding.props.terminal !== 'end') continue;
        const connection = editor.getShape(binding.fromId);
        if (!connection) continue;
        const otherBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const ob of otherBindings) {
          if ((ob as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((ob as any).toId);
          if (!src) continue;
          const sp = (src as any).props;
          const srcType = (src as any).type;

          if (srcType === 'custom-card') {
            // 图片卡片：取生成的图片
            if (sp.generatedImage) imageUrls.push(sp.generatedImage);
            // 视频卡片：取生成的视频
            if (sp.generatedVideo && !sp.generatedImage) videoUrl = sp.generatedVideo;
            // Kling 视频卡片
            if (sp.klingGeneratedVideo) videoUrl = sp.klingGeneratedVideo;
          } else if (srcType === 'seedance-card') {
            // Seedance 输出的视频
            if (sp.generatedVideo) videoUrl = sp.generatedVideo;
            // Seedance 保存的帧图片
            if (sp.capturedFrame) imageUrls.push(sp.capturedFrame);
          } else if (srcType === 'audio-card') {
            // 音频卡片：取生成的音频 URL
            if (sp.audioUrl && !audioBase64) audioBase64 = sp.audioUrl;
          }
        }
      }

      return { imageUrls, audioBase64, videoUrl };
    };

    const handleGenerate = async () => {
      // 读取上游连接数据，按模式自动填充
      const connected = getConnectedInputs();
      let effectiveFirstFrame = firstFrameImage;
      let effectiveLastFrame = lastFrameImage;
      let effectiveRefImages = parsedRefImages;
      let effectiveRefVideoUrl = refVideoUrl;
      let effectiveRefAudio = refAudioBase64;

      if (connected.imageUrls.length > 0) {
        if (mode === 'i2v') {
          if (!effectiveFirstFrame) effectiveFirstFrame = connected.imageUrls[0];
        } else if (mode === 'first-last') {
          if (!effectiveFirstFrame) effectiveFirstFrame = connected.imageUrls[0];
          if (!effectiveLastFrame && connected.imageUrls.length >= 2) effectiveLastFrame = connected.imageUrls[1];
          if (connected.imageUrls.length > 2) {
            alert(`首尾帧模式只支持2张图片，已自动取前两张（共连接了 ${connected.imageUrls.length} 张）`);
          }
        } else if (mode === 'multimodal') {
          const merged = [...effectiveRefImages];
          for (const img of connected.imageUrls) {
            if (merged.length >= 9) break;
            if (!merged.includes(img)) merged.push(img);
          }
          effectiveRefImages = merged;
        }
      }
      if (connected.videoUrl && mode === 'multimodal' && !effectiveRefVideoUrl) {
        effectiveRefVideoUrl = connected.videoUrl;
      }
      // 音频卡片连接：自动填充参考音频（multimodal 模式）
      if (connected.audioBase64 && mode === 'multimodal' && !effectiveRefAudio) {
        effectiveRefAudio = connected.audioBase64;
      }

      if (!prompt && mode === 't2v') { alert('请输入提示词'); return; }
      if ((mode === 'i2v' || mode === 'first-last') && !effectiveFirstFrame) { alert('请上传首帧图片，或连接一张图片卡片'); return; }
      if (mode === 'first-last' && !effectiveLastFrame) { alert('请上传尾帧图片，或连接第二张图片卡片'); return; }
      if (mode === 'multimodal' && effectiveRefImages.length === 0 && !effectiveRefVideoUrl) { alert('请至少上传一张参考图或视频URL，或连接图片/视频卡片'); return; }
      up({ isGenerating: true, generationStatus: '提交中...', generationProgress: 5, generatedVideo: '' });
      try {
        // 压缩图片到 1.5MB 以内
        const compressImage = (base64: string | null | undefined, maxBytes = 1.5 * 1024 * 1024): Promise<string | null | undefined> => {
          if (!base64 || !base64.startsWith('data:')) return Promise.resolve(base64);
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              let w = img.naturalWidth;
              let h = img.naturalHeight;
              let quality = 0.85;
              const canvas = document.createElement('canvas');
              const tryCompress = () => {
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                const result = canvas.toDataURL('image/jpeg', quality);
                const bytes = (result.length - result.indexOf(',') - 1) * 0.75;
                if (bytes <= maxBytes || quality <= 0.3) { resolve(result); } else { quality -= 0.1; tryCompress(); }
              };
              tryCompress();
            };
            img.src = base64;
          });
        };

        const [compFirst, compLast] = await Promise.all([
          effectiveFirstFrame ? compressImage(effectiveFirstFrame) : Promise.resolve(undefined),
          effectiveLastFrame ? compressImage(effectiveLastFrame) : Promise.resolve(undefined),
        ]);
        const compRefImages = effectiveRefImages.length > 0
          ? await Promise.all(effectiveRefImages.map((img: string) => compressImage(img)))
          : undefined;

        const res = await fetch('/api/seedance/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode, model, prompt, ratio,
            duration: duration === '-1' ? -1 : parseInt(duration || '5'),
            resolution, generateAudio,
            firstFrameImage: compFirst || undefined,
            lastFrameImage: compLast || undefined,
            refImages: compRefImages || undefined,
            refVideoUrl: effectiveRefVideoUrl || undefined,
            refAudioBase64: effectiveRefAudio || undefined,
            userId: userId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '提交失败');
        const taskId = data.taskId;
        let attempts = 0;
        const poll = async () => {
          attempts++;
          const qRes = await fetch('/api/seedance/query?taskId=' + taskId);
          const qData = await qRes.json();
          const ls = editor.getShape(shape.id);
          const lp = ls ? (ls as any).props : shape.props;
          if (qData.status === 'completed' && qData.videoUrl) {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generatedVideo: qData.videoUrl, generationProgress: 100, generationStatus: '完成' } });
          } else if (qData.status === 'failed') {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '失败: ' + (qData.error || '') } });
          } else if (attempts < 120) {
            const prog = qData.status === 'queued' ? 10 : Math.min(90, 10 + attempts * 1.5);
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, generationProgress: prog, generationStatus: qData.status === 'queued' ? '排队中...' : '生成中...' } });
            setTimeout(poll, 5000);
          } else {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '超时' } });
          }
        };
        setTimeout(poll, 5000);
      } catch (err: any) {
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: err?.message || '失败' } });
      }
    };

    const addRefImage = (base64: string) => {
      if (parsedRefImages.length >= 9) { alert('最多9张参考图'); return; }
      up({ refImages: JSON.stringify([...parsedRefImages, base64]) });
    };
    const removeRefImage = (idx: number) => {
      const arr = [...parsedRefImages]; arr.splice(idx, 1);
      up({ refImages: JSON.stringify(arr) });
    };

    const handleRefVideoUpload = async (file: File) => {
      if (file.size > 50 * 1024 * 1024) { alert('视频文件不能超过 50MB'); return; }
      up({ refVideoName: '上传中...', refVideoUrl: '' });
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/video/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data?.url) throw new Error(data?.error || '上传失败');
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, refVideoUrl: data.url, refVideoName: file.name } });
      } catch (err: any) {
        alert(err?.message || '视频上传失败');
        up({ refVideoName: '', refVideoUrl: '' });
      }
    };

    const MODES = [
      { key: 't2v', label: '文生视频' },
      { key: 'i2v', label: '图生-首帧' },
      { key: 'first-last', label: '首尾帧' },
      { key: 'multimodal', label: '多模态' },
    ];

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>

        {/* lightbox */}
        {lightboxVideo && (
          <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center"
            onClick={() => setLightboxVideo(null)} onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative" style={{ maxWidth: '70vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
              {lightboxVideo.includes('.mp4') || lightboxVideo.includes('video') ? (
                <video src={lightboxVideo} controls autoPlay className="rounded-xl" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              ) : (
                <img src={lightboxVideo} alt="大图" className="rounded-xl object-contain" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              )}
              <button className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightboxVideo(null)} onPointerDown={(e) => e.stopPropagation()}>✕</button>
            </div>
          </div>
        )}

        {/* 输出端口 - Right */}
        <div className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ right: '-6px', zIndex: 101, pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            editor.setCurrentTool('port', { shapeId: shape.id, portId: 'output', terminal: 'start' });
          }}>
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.8)', pointerEvents: 'none' }} />
        </div>

        {/* 输入端口 - Left */}
        <div className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ left: '-6px', zIndex: 101, pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            editor.setCurrentTool('port', { shapeId: shape.id, portId: 'input', terminal: 'end' });
          }}>
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.8)', pointerEvents: 'none' }} />
        </div>

        {/* 卡片主体 */}
        <div
          className="w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg,rgba(192,192,192,0.15) 0%,rgba(169,169,169,0.12) 50%,rgba(128,128,128,0.08) 100%)',
            border: '1px solid rgba(192,192,192,0.3)',
            boxShadow: '0 0 40px rgba(192,192,192,0.15)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
            transition: 'all 0.2s ease',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMinimized = !isMinimized;
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...shape.props, isMinimized: newMinimized, w: newMinimized ? 150 : 420, h: newMinimized ? 80 : 560 } });
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg z-10"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center' }}
          >{isMinimized ? '+' : '−'}</button>

          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">Seedance 2.0</div>
                <div className="text-gray-400 text-xs mt-1">视频生成</div>
                <div className="text-gray-500 text-[10px] mt-2">点击+展开</div>
              </div>
            </div>
          ) : (
            <div ref={scrollContainerRef} className="p-4 h-full flex flex-col overflow-y-auto">

              {/* 标题 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400/20 to-gray-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">Seedance 2.0</h3>
                  <p className="text-gray-400 text-xs">视频生成</p>
                </div>
              </div>

              {/* 模式切换 */}
              <div className="flex gap-1 bg-black/20 rounded-lg p-1 mb-2">
                {MODES.map((m) => (
                  <button key={m.key}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${(mode || 't2v') === m.key ? 'bg-gray-600/80 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={(e) => { e.stopPropagation(); up({ mode: m.key }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{m.label}</button>
                ))}
              </div>

              {/* 模型 */}
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">模型</label>
                <select
                  className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all"
                  value={model || 'doubao-seedance-2-0-260128'}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => up({ model: e.target.value })}
                >
                  <option value="doubao-seedance-2-0-260128">Seedance 2.0 (480p无声0.7/有声1.0，720p无声1.5/有声1.9 元/秒)</option>
                  <option value="doubao-seedance-2-0-fast-260128">Seedance 2.0 Fast (480p无声0.75/有声0.9，720p无声1.3/有声1.7 元/秒)</option>
                </select>
              </div>

              {/* 提示词 */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 text-xs">提示词{mode === 't2v' ? '（必填）' : '（可选）'}</label>
                  <button className="text-[10px] text-gray-400 hover:text-gray-300"
                    onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) up({ prompt: (prompt ? prompt + '\n' : '') + t }); } catch {} }}
                    onPointerDown={(e) => e.stopPropagation()}>粘贴</button>
                </div>
                <textarea
                  className="w-full h-16 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                  placeholder="描述视频内容..." value={prompt || ''}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => up({ prompt: e.target.value })}
                />
              </div>

              {/* 首帧 */}
              {(mode === 'i2v' || mode === 'first-last') && (
                <div className="mb-2">
                  <label className="text-gray-400 text-xs mb-1 block">首帧图片（必填）</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ firstFrameImage: ev.target?.result as string }); r.readAsDataURL(f); e.target.value = ''; }}
                  />
                  {firstFrameImage && (
                    <div className="mt-1 relative w-full h-14 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={firstFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); up({ firstFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                    </div>
                  )}
                </div>
              )}

              {/* 尾帧 */}
              {mode === 'first-last' && (
                <div className="mb-2">
                  <label className="text-gray-400 text-xs mb-1 block">尾帧图片（必填）</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ lastFrameImage: ev.target?.result as string }); r.readAsDataURL(f); e.target.value = ''; }}
                  />
                  {lastFrameImage && (
                    <div className="mt-1 relative w-full h-14 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={lastFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); up({ lastFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                    </div>
                  )}
                </div>
              )}

              {/* 多模态 */}
              {mode === 'multimodal' && (
                <div className="mb-2 space-y-2">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考图片（最多9张）</label>
                    <input type="file" accept="image/*" multiple
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => { Array.from(e.target.files || []).forEach(f => { const r = new FileReader(); r.onload = (ev) => addRefImage(ev.target?.result as string); r.readAsDataURL(f); }); e.target.value = ''; }}
                    />
                    {parsedRefImages.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {parsedRefImages.map((img: string, i: number) => (
                          <div key={i} className="relative w-12 h-12 bg-black/30 rounded overflow-hidden group">
                            <img src={img} className="w-full h-full object-cover" />
                            <button className="absolute top-0 right-0 w-4 h-4 bg-black/60 hover:bg-red-500/80 rounded text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); removeRefImage(i); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                            <span className="absolute bottom-0 left-0 text-[8px] text-white bg-black/50 px-0.5">[{i + 1}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考视频（可选，mp4/mov ≤50MB）</label>
                    <input type="file" accept="video/mp4,video/quicktime"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; await handleRefVideoUpload(f); e.target.value = ''; }}
                    />
                    {refVideoName && refVideoName !== '上传中...' && (
                      <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                        <span className="text-gray-300 text-xs truncate flex-1">{refVideoName}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs"
                          onClick={(e) => { e.stopPropagation(); up({ refVideoUrl: '', refVideoName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                      </div>
                    )}
                    {refVideoName === '上传中...' && (
                      <div className="mt-1 text-gray-400 text-xs">上传中...</div>
                    )}
                    {!refVideoName && (
                      <div className="mt-1">
                        <input
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                          placeholder="或直接填写视频 URL https://..."
                          value={refVideoUrl && !refVideoName ? refVideoUrl : ''}
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => up({ refVideoUrl: e.target.value, refVideoName: '' })}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考音频（可选，wav/mp3）</label>
                    <input type="file" accept="audio/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ refAudioBase64: ev.target?.result as string, refAudioName: f.name }); r.readAsDataURL(f); e.target.value = ''; }}
                    />
                    {refAudioBase64 && (
                      <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                        <span className="text-gray-300 text-xs truncate flex-1">{refAudioName || '已上传'}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs"
                          onClick={(e) => { e.stopPropagation(); up({ refAudioBase64: '', refAudioName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 比例 */}
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">比例</label>
                <div className="flex gap-1 flex-wrap">
                  {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'].map((r) => (
                    <button key={r}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${(ratio || '16:9') === r ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                      onClick={(e) => { e.stopPropagation(); up({ ratio: r }); }} onPointerDown={(e) => e.stopPropagation()}
                    >{r}</button>
                  ))}
                </div>
              </div>

              {/* 参数设置折叠 */}
              <button
                className="w-full py-1.5 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => { e.stopPropagation(); up({ showSettings: !showSettings }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{showSettings ? '收起参数设置 ▲' : '展开参数设置 ▼'}</button>

              {showSettings && (
                <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">时长（秒）</label>
                    <div className="flex gap-1 flex-wrap">
                      {['4', '5', '6', '8', '10', '12', '15', '-1'].map((d) => (
                        <button key={d}
                          className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${(duration || '5') === d ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); up({ duration: d }); }} onPointerDown={(e) => e.stopPropagation()}
                        >{d === '-1' ? '智能' : d + 's'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">分辨率</label>
                    <div className="flex gap-1">
                      {['480p', '720p'].map((r) => (
                        <button key={r}
                          className={`px-3 py-1 rounded-lg border text-[10px] font-medium transition-all ${(resolution || '720p') === r ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); up({ resolution: r }); }} onPointerDown={(e) => e.stopPropagation()}
                        >{r.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">有声视频</label>
                    <button
                      className={`relative w-10 h-5 rounded-full transition-colors ${generateAudio ? 'bg-blue-500' : 'bg-white/10'}`}
                      onClick={(e) => { e.stopPropagation(); up({ generateAudio: !generateAudio }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${generateAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Generate */}
              <button
                className={`w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600 hover:scale-[1.02] active:scale-[0.98]'}`}
                disabled={isGenerating}
                onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{isGenerating ? (generationStatus || '生成中...') : 'Generate'}</button>

              {isGenerating && (
                <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                  <div className="bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${generationProgress || 0}%` }} />
                </div>
              )}

              {generatedVideo && (
                  <button
                    className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-yellow-400/80 to-yellow-500/80 hover:from-yellow-400 hover:to-yellow-500"
                    onClick={(e) => { e.stopPropagation(); setShowVideoOutput(!showVideoOutput); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{showVideoOutput ? '隐藏视频' : '查看生成视频'}</button>
              )}

              {/* 视频输出面板 - 卡片内部，overflow-visible 溢出显示，跟通用视频一样 */}
              {generatedVideo && showVideoOutput && (
                <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                  <div className="relative group" style={{ minHeight: '180px' }}>
                    <video
                      ref={videoRef}
                      src={generatedVideo}
                      controls
                      crossOrigin="anonymous"
                      className="w-full bg-black"
                      style={{ minHeight: '180px', maxHeight: '250px' }}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="保存当前帧"
                        onClick={(e) => { e.stopPropagation(); captureCurrentFrame(); }} onPointerDown={(e) => e.stopPropagation()}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="放大播放"
                        onClick={(e) => { e.stopPropagation(); setLightboxVideo(generatedVideo); }} onPointerDown={(e) => e.stopPropagation()}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </button>
                      <button className="p-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white transition-all" title="下载视频"
                        onClick={(e) => { e.stopPropagation(); downloadFile(generatedVideo, 'seedance-video.mp4'); }} onPointerDown={(e) => e.stopPropagation()}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="删除视频"
                        onClick={(e) => { e.stopPropagation(); up({ generatedVideo: '' }); }} onPointerDown={(e) => e.stopPropagation()}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                      <p className="text-white text-[10px] truncate">生成成功 · Seedance 视频</p>
                    </div>
                  </div>
                  {capturedFrame && (
                    <div className="mt-2 bg-black/40 border border-purple-500/30 rounded-lg overflow-hidden">
                      <div className="p-2 bg-purple-500/10 border-b border-purple-500/20">
                        <p className="text-purple-400 text-[10px] font-semibold">捕获的视频帧</p>
                      </div>
                      <div className="relative group">
                        <img src={capturedFrame} alt="Captured Frame" className="w-full h-auto max-h-[200px] object-contain bg-black/20" onClick={(e) => e.stopPropagation()} />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition-all"
                            onClick={(e) => { e.stopPropagation(); setLightboxVideo(capturedFrame); }} onPointerDown={(e) => e.stopPropagation()}>查看</button>
                          <button className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold transition-all"
                            onClick={(e) => { e.stopPropagation(); downloadFile(capturedFrame, `seedance-frame-${Date.now()}.png`); }} onPointerDown={(e) => e.stopPropagation()}>下载</button>
                          <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition-all"
                            onClick={(e) => { e.stopPropagation(); up({ capturedFrame: '' }); }} onPointerDown={(e) => e.stopPropagation()}>删除</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </HTMLContainer>
    );
  }

  indicator(shape: SeedanceCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
