'use client';
import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T, usePassThroughWheelEvents, useEditor, useValue } from 'tldraw';
import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
    showPromptPanel: T.boolean.optional(),
    showRefContentPanel: T.boolean.optional(),
    isCollapsed: T.boolean.optional(),
  };

  getDefaultProps() {
    return {
      w: 420, h: 380,
      mode: 't2v', model: 'doubao-seedance-2-0-260128',
      prompt: '', ratio: '16:9', duration: '5',
      resolution: '720p', generateAudio: true,
      firstFrameImage: '', lastFrameImage: '',
      refImages: '[]', refVideoUrl: '', refVideoName: '',
      refAudioBase64: '', refAudioName: '',
      generatedVideo: '', capturedFrame: '', isGenerating: false,
      generationProgress: 0, generationStatus: '',
      showSettings: false, isMinimized: false,
      showPromptPanel: false,
      showRefContentPanel: false,
      isCollapsed: false,
    };
  }

  component(shape: SeedanceCardShape) {
    const { w, h, mode, model, prompt, ratio, duration, resolution, generateAudio,
      firstFrameImage, lastFrameImage, refImages, refVideoUrl, refVideoName, refAudioBase64, refAudioName,
      generatedVideo, capturedFrame, isGenerating, generationProgress, generationStatus, showSettings, isMinimized, showPromptPanel, showRefContentPanel, isCollapsed,
    } = shape.props;

    const editor = (this as any).editor;
    const up = (props: any) => editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...shape.props, ...props } });
    const parsedRefImages: string[] = (() => { try { return JSON.parse(refImages || '[]'); } catch { return []; } })();
    const scale = (isMinimized || isCollapsed) ? 1 : Math.min(w / 420, h / 560);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
    const [showVideoOutput, setShowVideoOutput] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: { data: any }) => setUserId(data.user?.id ?? null));
    }, []);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    usePassThroughWheelEvents(scrollContainerRef);

    // 视口检测（所有 hooks 之后）
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isInViewport = useValue('inViewport', () => {
      const vp = editor.getViewportPageBounds();
      const sb = editor.getShapePageBounds(shape.id);
      if (!sb) return true;
      return !(sb.maxX < vp.minX || sb.minX > vp.maxX || sb.maxY < vp.minY || sb.minY > vp.maxY);
    }, [editor, shape.id]);
    const hasActiveTask = !!(isGenerating || showPromptPanel || showRefContentPanel || showSettings);
    if (!isInViewport && !hasActiveTask) {
      return <HTMLContainer><div style={{ width: w, height: h, background: '#18181b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Seedance 视频</span></div></HTMLContainer>;
    }

    const captureCurrentFrame = useCallback(async () => {
      const video = videoRef.current;
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      // 转 JPEG Blob 上传到 Supabase Storage 拿 URL（避免 base64 占 snapshot）
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
      });
      if (!blob) return;
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert('请先登录');
          return;
        }
        const filename = `videos/${user.id}/frame-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from('assets').upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw new Error(`上传失败: ${error.message}`);
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, capturedFrame: urlData.publicUrl } });
      } catch (err: any) {
        alert('截帧上传失败: ' + (err?.message || err));
      }
    }, [editor, shape.id]);

    // 读取连接到当前卡片的上游数据，按模式填充对应字段
    const getConnectedInputs = () => {
      const allBindings = editor.getBindingsToShape(shape.id, 'connection');
      const imageUrls: string[] = [];
      let audioBase64: string | null = null;
      let videoUrl: string | null = null;
      let textPrompt: string | null = null;

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
            // 角色卡：优先用三视角输出，否则用通用 generatedImage
            if (sp.cardType === 'character' && sp.characterGeneratedImage) imageUrls.push(sp.characterGeneratedImage);
            else if (sp.generatedImage) imageUrls.push(sp.generatedImage);
            if (sp.generatedVideo) videoUrl = sp.generatedVideo;
            if (sp.klingGeneratedVideo) videoUrl = sp.klingGeneratedVideo;
            if (sp.capturedFrame) imageUrls.push(sp.capturedFrame);
            // 文本卡片输出
            if (sp.cardType === 'text' && sp.textOutput) textPrompt = sp.textOutput;
          } else if (srcType === 'camera-control-card') {
            if (sp.generatedImage) imageUrls.push(sp.generatedImage);
          } else if (srcType === 'seedance-card') {
            if (sp.generatedVideo) videoUrl = sp.generatedVideo;
            if (sp.capturedFrame) imageUrls.push(sp.capturedFrame);
          } else if (srcType === 'media-upload-card') {
            if (sp.mediaType === 'image' && sp.imageData) imageUrls.push(sp.imageData);
            if (sp.mediaType === 'video' && sp.videoUrl) videoUrl = sp.videoUrl;
          } else if (srcType === 'audio-card') {
            if (sp.audioUrl && !audioBase64) audioBase64 = sp.audioUrl;
          } else if (srcType === 'gem-step2-card' && sp.result) {
            textPrompt = sp.result;
          } else if (srcType === 'gem-step3-card' && sp.result) {
            textPrompt = sp.result;
          } else if (srcType === 'gem-step4-card') {
            if (sp.generatedImage) imageUrls.push(sp.generatedImage);
            if (sp.result) textPrompt = sp.result + '\nAvoid sudden state changes without intermediate motion. Always describe transitional movement between states.\nno grid, no panels, no borders, no collage layout, maintain scene continuity, follow visible continuity, if scene change exists follow it, if no scene change do not add one, do not describe frame numbers.';
          } else if (srcType === 'prompt-optimizer-card' && sp.optimizedPrompt) {
            textPrompt = sp.optimizedPrompt;
          }
        }
      }

      return { imageUrls, audioBase64, videoUrl, textPrompt };
    };

    // 实时读取连接的图片用于 UI 显示
    const connectedInputs = useValue('seedance-connections', () => getConnectedInputs(), [editor, shape.id]);
    const connFirstFrame = connectedInputs.imageUrls[0] || '';
    const connLastFrame = connectedInputs.imageUrls[1] || '';

    const handleGenerate = async () => {
      const connected = getConnectedInputs();

      // 连接的文字 prompt 优先填入
      const effectivePrompt = connected.textPrompt || prompt;

      // 按模式分别处理，避免跨模式污染
      let effectiveFirstFrame  = firstFrameImage;
      let effectiveLastFrame   = lastFrameImage;
      let effectiveRefVideoUrl = connected.videoUrl    || refVideoUrl;
      let effectiveRefAudio    = connected.audioBase64 || refAudioBase64;
      let effectiveRefImages: string[];

      if (mode === 'i2v') {
        // 单图：只取第一张连接，连接为空才用本地
        effectiveFirstFrame = connected.imageUrls[0] || firstFrameImage;
        effectiveRefImages  = parsedRefImages;

      } else if (mode === 'first-last') {
        // 首尾帧：最多2张，连接[0]=首帧，连接[1]=尾帧，连接为空才用本地
        effectiveFirstFrame = connected.imageUrls[0] || firstFrameImage;
        effectiveLastFrame  = connected.imageUrls[1] || lastFrameImage;
        if (connected.imageUrls.length > 2) {
          alert(`首尾帧模式只支持2张图片，已自动取前两张（共连接了 ${connected.imageUrls.length} 张）`);
        }
        effectiveRefImages = parsedRefImages;

      } else if (mode === 'multimodal') {
        // 多模态：连接图片在前，本地上传在后，去重，上限9张
        const merged: string[] = [];
        for (const img of connected.imageUrls) {
          if (merged.length >= 9) break;
          if (!merged.includes(img)) merged.push(img);
        }
        for (const img of parsedRefImages) {
          if (merged.length >= 9) break;
          if (!merged.includes(img)) merged.push(img);
        }
        effectiveRefImages = merged;

      } else {
        // t2v 及其他：不读连接图片
        effectiveRefImages = parsedRefImages;
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
            mode, model, prompt: effectivePrompt, ratio,
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
        const arkKeyId = data.arkKeyId || '';
        let attempts = 0;
        const poll = async () => {
          attempts++;
          if (!editor.getShape(shape.id)) return;
          try {
            const qRes = await fetch('/api/seedance/query?taskId=' + taskId + (arkKeyId ? '&arkKeyId=' + arkKeyId : ''));
            const qData = await qRes.json();
            const ls = editor.getShape(shape.id);
            const lp = ls ? (ls as any).props : shape.props;
            if (qData.status === 'completed' && qData.videoUrl) {
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generatedVideo: qData.videoUrl, generationProgress: 100, generationStatus: '完成' } });
              (window as any).saveCanvasNow?.();
              (window as any).refreshBalance?.();
            } else if (qData.status === 'failed') {
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '失败: ' + (qData.error || '') } });
            } else if (attempts < 120) {
              const prog = qData.status === 'queued' ? 10 : Math.min(90, 10 + attempts * 1.5);
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, generationProgress: prog, generationStatus: qData.status === 'queued' ? '排队中...' : '生成中...' } });
              setTimeout(poll, 5000);
            } else {
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '超时' } });
            }
          } catch (e) {
            // 网络错误（ERR_CONNECTION_CLOSED 等）继续重试，不中断轮询
            if (attempts < 120) {
              const ls = editor.getShape(shape.id);
              const lp = ls ? (ls as any).props : shape.props;
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, generationStatus: '网络重试中...' } });
              setTimeout(poll, 8000);
            }
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

    // 上传图片到 Supabase Storage 返回 URL（强制转 JPEG 避免格式问题）
    const uploadImageToStorage = async (file: File): Promise<string> => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录');

      // 统一转 JPEG：用 canvas 重绘，避免 HEIC / BMP 等格式被 fal 拒绝
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas 初始化失败')); return; }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('转 JPEG 失败'));
          }, 'image/jpeg', 0.92);
        };
        img.onerror = () => reject(new Error('图片加载失败，可能是格式不支持'));
        img.src = URL.createObjectURL(file);
      });

      const filename = `images/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from('assets').upload(filename, jpegBlob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(`上传失败: ${error.message}`);
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
      return urlData.publicUrl;
    };

    const addRefImageByFile = async (file: File) => {
      if (parsedRefImages.length >= 9) { alert('最多9张参考图'); return; }
      try {
        const url = await uploadImageToStorage(file);
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        const existing: string[] = (() => { try { return JSON.parse(lp.refImages || '[]'); } catch { return []; } })();
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, refImages: JSON.stringify([...existing, url]) } });
      } catch (err: any) {
        alert(err?.message || '图片上传失败');
      }
    };

    const handleRefVideoUpload = async (file: File) => {
      if (file.size > 500 * 1024 * 1024) { alert('视频文件不能超过 500MB'); return; }
      up({ refVideoName: '上传中...', refVideoUrl: '' });
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('请先登录');
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.endsWith('.mov') ? '.mov' : '.mp4';
        const contentType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
        const filename = `videos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const { error } = await supabase.storage.from('assets').upload(filename, file, { contentType, upsert: false });
        if (error) throw new Error(`上传失败: ${error.message}`);
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, refVideoUrl: urlData.publicUrl, refVideoName: file.name } });
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

        {/* 右侧浮板：提示词编辑 */}
        {showPromptPanel && !isMinimized && (
          <div
            className="absolute rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col"
            style={{
              left: 'auto', right: '100%', marginRight: '8px', top: 0, width: 340, maxHeight: h,
              zIndex: 200, pointerEvents: 'all',
              background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(100,100,100,0.1) 100%)',
              border: '1px solid rgba(192,192,192,0.3)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
              <span className="text-xs text-gray-300 font-semibold">
                提示词{mode === 't2v' ? '（必填）' : '（可选）'}
                {connectedInputs.textPrompt && <span className="text-emerald-400 ml-1 text-[10px]">·来自连接</span>}
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="text-[10px] text-gray-400 hover:text-gray-300"
                  onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) up({ prompt: (prompt ? prompt + '\n' : '') + t }); } catch {} }}
                  onPointerDown={(e) => e.stopPropagation()}
                >粘贴</button>
                <button
                  className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                  onClick={(e) => { e.stopPropagation(); up({ showPromptPanel: false }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >✕</button>
              </div>
            </div>
            <div className="p-3 flex-1 flex flex-col min-h-0">
              {/* 常用提示词快捷按钮 */}
              <div className="flex gap-1.5 mb-2 flex-shrink-0">
                <button
                  className="flex-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-200 text-[10px] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const grid4 = '根据这张4宫格分解表和一张人物设计图生成一段视频。没有网格，没有面板，没有边框，没有拼贴布局，保持场景连续性，遵循可见的连续性，如果场景变化存在，遵循它，如果没有场景变化，不要添加一个，不要描述帧号。\n避免没有中间运动的突然状态变化。总是描述状态之间的过渡性移动。';
                    up({ prompt: grid4 });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >4 宫格</button>
                <button
                  className="flex-1 px-2 py-1 rounded bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-200 text-[10px] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    const grid9 = '根据这张9宫格分解表和一张人物设计图生成一段视频。没有网格，没有面板，没有边框，没有拼贴布局，保持场景连续性，遵循可见的连续性，如果场景变化存在，遵循它，如果没有场景变化，不要添加一个，不要描述帧号。\n避免没有中间运动的突然状态变化。总是描述状态之间的过渡性移动。';
                    up({ prompt: grid9 });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >9 宫格</button>
              </div>
              <textarea
                className="flex-1 w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                style={{ minHeight: 200 }}
                placeholder="描述视频内容..."
                value={connectedInputs.textPrompt ? `${connectedInputs.textPrompt}${prompt ? '\n' + prompt : ''}` : prompt || ''}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const full = e.target.value;
                  const prefix = connectedInputs.textPrompt ? connectedInputs.textPrompt + '\n' : '';
                  const userInput = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : (connectedInputs.textPrompt && full.startsWith(connectedInputs.textPrompt) ? full.slice(connectedInputs.textPrompt.length) : full);
                  up({ prompt: userInput });
                }}
              />
            </div>
          </div>
        )}

        {/* lightbox */}
        {lightboxVideo && (
          <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center"
            onClick={() => setLightboxVideo(null)} onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative" style={{ maxWidth: '70vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
              {lightboxVideo.includes('.mp4') || lightboxVideo.includes('video') ? (
                <video src={lightboxVideo} controls autoPlay className="rounded-xl" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              ) : (
                <img src={lightboxVideo} alt="大图" className="rounded-xl object-contain" style={{ maxWidth: '70vw', maxHeight: '70vh', imageRendering: 'high-quality' as any }} />
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
          className="relative w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg,rgba(192,192,192,0.15) 0%,rgba(169,169,169,0.12) 50%,rgba(128,128,128,0.08) 100%)',
            border: '1px solid rgba(192,192,192,0.3)',
            boxShadow: '0 0 40px rgba(192,192,192,0.15)',
            ...(scale !== 1 ? {
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `${100 / scale}%`,
              height: `${100 / scale}%`,
            } : {}),
            transition: 'all 0.2s ease',
          }}
        >
          {/* 缩小按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const newMinimized = !isMinimized;
              editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...shape.props, isMinimized: newMinimized, w: newMinimized ? 150 : 380, h: newMinimized ? 80 : 380 } });
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg z-10"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center' }}
          >{isMinimized ? '+' : '−'}</button>

          {/* 折叠按钮（缩小按钮左边） */}
          {!isMinimized && (
            <button
              onClick={(e) => { e.stopPropagation(); up({ isCollapsed: !isCollapsed, w: isCollapsed ? 380 : 150, h: isCollapsed ? 380 : 80 }); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-2 right-11 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-xs z-10"
              style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center' }}
              title={isCollapsed ? '展开卡片' : '折叠卡片'}
            >{isCollapsed ? '▼' : '▲'}</button>
          )}

          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">Seedance 2.0</div>
                <div className="text-gray-400 text-xs mt-1">视频生成</div>
                <div className="text-gray-500 text-[10px] mt-2">点击+展开</div>
              </div>
            </div>
          ) : isCollapsed ? (
            <div className="p-3 h-full flex items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-gray-400/20 to-gray-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div className="min-w-0">
                  <div className="text-white text-xs font-semibold truncate">Seedance 2.0</div>
                  <div className="text-gray-500 text-[10px] truncate">{mode || 't2v'} · ▼展开</div>
                </div>
              </div>
            </div>
          ) : (
            <div ref={scrollContainerRef} className="p-4 flex flex-col" style={{ display: isCollapsed ? 'none' : undefined }}>

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
                  <option value="doubao-seedance-2-0-260128">Seedance 2.0 — 480P 会员¥0.71/普通¥0.91，720P 会员¥1.29/普通¥1.49，1080P 会员¥2.81/普通¥3.01</option>
                  <option value="doubao-seedance-2-0-fast-260128">Seedance 2.0 Fast — 480P 会员¥0.60/普通¥0.80，720P 会员¥1.06/普通¥1.26</option>
                </select>
              </div>

              {/* 提示词 */}
              <div className="mb-2">
                <button
                  onClick={(e) => { e.stopPropagation(); up({ showPromptPanel: !showPromptPanel }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full py-2 rounded-lg text-xs font-medium transition-all border bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 flex items-center justify-between px-3"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    提示词{mode === 't2v' ? '（必填）' : '（可选）'}
                    {connectedInputs.textPrompt && <span className="text-emerald-400 text-[10px]">·来自连接</span>}
                    {prompt && !connectedInputs.textPrompt && <span className="text-gray-500 text-[10px]">已填写</span>}
                  </span>
                  <span className="text-[10px] text-gray-500">{showPromptPanel ? '收起 ▶' : '◀ 编辑'}</span>
                </button>
              </div>

              {/* 参考内容触发按钮（i2v/first-last/multimodal 模式才显示） */}
              {(mode === 'i2v' || mode === 'first-last' || mode === 'multimodal') && (
                <div className="mb-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); up({ showRefContentPanel: !showRefContentPanel }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="w-full py-2 rounded-lg text-xs font-medium transition-all border bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 flex items-center justify-between px-3"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      参考内容
                      {/* 有内容时显示绿点 */}
                      {((mode === 'i2v' || mode === 'first-last') && (connFirstFrame || firstFrameImage)) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      )}
                      {(mode === 'first-last' && (connLastFrame || lastFrameImage)) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      )}
                      {(mode === 'multimodal' && (parsedRefImages.length > 0 || connectedInputs.imageUrls.length > 0 || refVideoUrl || refAudioBase64)) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                      )}
                    </span>
                    <span className="text-[10px] text-gray-500">{showRefContentPanel ? '收起 ▶' : '◀ 编辑'}</span>
                  </button>
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

              {/* 参数设置折叠按钮 */}
              <button
                className="w-full py-1.5 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => { e.stopPropagation(); up({ showSettings: !showSettings }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{showSettings ? '收起参数设置 ▲' : '展开参数设置 ▼'}</button>


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

            </div>
          )}

          {/* 参数设置面板 - absolute 浮在右边 */}
          {showSettings && !isMinimized && (
            <div className="absolute top-0 p-3 backdrop-blur-xl rounded-2xl shadow-2xl space-y-3"
              style={{
                left: '100%', marginLeft: '8px', width: '260px', zIndex: 200,
                background: 'linear-gradient(135deg,rgba(192,192,192,0.15) 0%,rgba(169,169,169,0.12) 50%,rgba(128,128,128,0.08) 100%)',
                border: '1px solid rgba(192,192,192,0.3)',
                boxShadow: '0 0 40px rgba(192,192,192,0.15)',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="text-gray-300 text-xs font-semibold">参数设置</div>
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
                  {(model === 'doubao-seedance-2-0-260128' ? ['480p', '720p', '1080p'] : ['480p', '720p']).map((r) => (
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
        </div>

        {/* 视频输出面板 - 顶层，折叠时也显示 */}
        {generatedVideo && showVideoOutput && (!isMinimized || isCollapsed) && (
          <div className="absolute backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden"
            style={{
              left: '100%', marginLeft: '8px',
              top: 0,
              width: '320px', zIndex: 200,
              background: 'linear-gradient(135deg,rgba(192,192,192,0.15) 0%,rgba(169,169,169,0.12) 50%,rgba(128,128,128,0.08) 100%)',
              border: '1px solid rgba(192,192,192,0.3)',
              boxShadow: '0 0 40px rgba(192,192,192,0.15)',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 text-white text-base flex items-center justify-center transition-all"
              onClick={(e) => { e.stopPropagation(); (window as any).openOutputMenu?.(shape.id, e.clientX, e.clientY, 'video-output'); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="继续创建下游卡片"
            >+</button>
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
                <button className="p-2 bg-red-500/90 hover:bg-red-600 rounded-lg text-white transition-all" title="删除视频"
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
                    <button className="px-3 py-2 bg-red-500/90 hover:bg-red-600 rounded-lg text-white text-xs font-semibold transition-all"
                      onClick={(e) => { e.stopPropagation(); up({ capturedFrame: '' }); }} onPointerDown={(e) => e.stopPropagation()}>删除</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 左侧参考内容浮板 */}
        {(!isMinimized || isCollapsed) && showRefContentPanel && (mode === 'i2v' || mode === 'first-last' || mode === 'multimodal') && (
          <div
            className="absolute rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col"
            style={{
              right: '100%', marginRight: '8px', top: 0, width: 320, maxHeight: h,
              zIndex: 200, pointerEvents: 'all',
              background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(100,100,100,0.1) 100%)',
              border: '1px solid rgba(192,192,192,0.3)',
              overflow: 'visible',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
              <span className="text-xs text-gray-300 font-semibold">参考内容</span>
              <button
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                onClick={(e) => { e.stopPropagation(); up({ showRefContentPanel: false }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >✕</button>
            </div>
            <div className="p-3 space-y-3">

              {/* 首帧 */}
              {(mode === 'i2v' || mode === 'first-last') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs">首帧图片（必填）{connFirstFrame && <span className="text-blue-400 ml-1">·来自连接</span>}</label>
                    {!connFirstFrame && (
                      <label className="text-[10px] px-2 py-0.5 rounded bg-gray-600/50 text-white hover:bg-gray-600/70 cursor-pointer">
                        上传
                        <input type="file" accept="image/*" className="hidden"
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImageToStorage(f); if (url) up({ firstFrameImage: url }); e.target.value = ''; }}
                        />
                      </label>
                    )}
                  </div>
                  {(connFirstFrame || firstFrameImage) && (
                    <div className="flex flex-col items-center">
                      <div className="relative bg-black/30 rounded-lg group" style={{ maxWidth: 280 }}>
                        <img src={connFirstFrame || firstFrameImage} className="h-auto block rounded-lg" style={{ maxWidth: 280 }} />
                        {!connFirstFrame && (
                          <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); up({ firstFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 尾帧 */}
              {mode === 'first-last' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs">尾帧图片（必填）{connLastFrame && <span className="text-blue-400 ml-1">·来自连接</span>}</label>
                    {!connLastFrame && (
                      <label className="text-[10px] px-2 py-0.5 rounded bg-gray-600/50 text-white hover:bg-gray-600/70 cursor-pointer">
                        上传
                        <input type="file" accept="image/*" className="hidden"
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await uploadImageToStorage(f); if (url) up({ lastFrameImage: url }); e.target.value = ''; }}
                        />
                      </label>
                    )}
                  </div>
                  {(connLastFrame || lastFrameImage) && (
                    <div className="flex flex-col items-center">
                      <div className="relative bg-black/30 rounded-lg group" style={{ maxWidth: 280 }}>
                        <img src={connLastFrame || lastFrameImage} className="h-auto block rounded-lg" style={{ maxWidth: 280 }} />
                        {!connLastFrame && (
                          <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); up({ lastFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 多模态 */}
              {mode === 'multimodal' && (
                <>
                  {/* 上传按钮区 - 全部在顶部 */}
                  <div className="flex gap-2 flex-wrap">
                    <label className="text-[10px] px-2 py-1 rounded bg-gray-600/50 text-white hover:bg-gray-600/70 cursor-pointer flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                      上传图片
                      <input type="file" accept="image/*" multiple className="hidden"
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={async (e) => { const files = Array.from(e.target.files || []); for (const f of files) { await addRefImageByFile(f); } e.target.value = ''; }}
                      />
                    </label>
                    {!connectedInputs.videoUrl && (
                      <label className="text-[10px] px-2 py-1 rounded bg-gray-600/50 text-white hover:bg-gray-600/70 cursor-pointer flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        上传视频
                        <input type="file" accept="video/mp4,video/quicktime" className="hidden"
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; await handleRefVideoUpload(f); e.target.value = ''; }}
                        />
                      </label>
                    )}
                    <label className="text-[10px] px-2 py-1 rounded bg-gray-600/50 text-white hover:bg-gray-600/70 cursor-pointer flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                      上传音频
                      <input type="file" accept="audio/*" className="hidden"
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          up({ refAudioName: '上传中...' });
                          try {
                            const supabase = createClient();
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) { alert('请先登录'); up({ refAudioName: '' }); return; }
                            const ext = f.name.split('.').pop()?.toLowerCase() || 'mp3';
                            const filename = `audio/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                            const { error } = await supabase.storage.from('assets').upload(filename, f, { contentType: f.type || 'audio/mpeg', upsert: false });
                            if (error) throw new Error(error.message);
                            const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
                            up({ refAudioBase64: urlData.publicUrl, refAudioName: f.name });
                          } catch (err: any) {
                            alert('音频上传失败: ' + (err?.message || err));
                            up({ refAudioName: '' });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {!refVideoName && !connectedInputs.videoUrl && (
                      <input
                        className="flex-1 min-w-[120px] bg-black/30 border border-white/8 rounded px-2 py-1 text-white text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-500"
                        placeholder="视频 URL https://..."
                        value={refVideoUrl && !refVideoName ? refVideoUrl : ''}
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => up({ refVideoUrl: e.target.value, refVideoName: '' })}
                      />
                    )}
                  </div>

                  {/* 已上传内容展示区 */}
                  <div className="space-y-2">
                    {/* 参考图片 */}
                    {(connectedInputs.imageUrls.length > 0 || parsedRefImages.length > 0) && (
                      <div>
                        <div className="text-[10px] text-gray-500 mb-1">参考图片（{connectedInputs.imageUrls.length + parsedRefImages.length}/9）</div>
                        <div className="flex flex-col gap-1 items-center">
                          {connectedInputs.imageUrls.map((img: string, i: number) => (
                            <div key={`conn-${i}`} className="relative bg-black/30 rounded" style={{ maxWidth: 280 }}>
                              <img src={img} className="h-auto block rounded" style={{ maxWidth: 280 }} />
                              <span className="absolute bottom-1 left-1 text-[10px] text-blue-300 bg-black/70 px-1 rounded">[{i + 1}]</span>
                            </div>
                          ))}
                          {parsedRefImages.map((img: string, i: number) => (
                            <div key={`upload-${i}`} className="relative bg-black/30 rounded group" style={{ maxWidth: 280 }}>
                              <img src={img} className="h-auto block rounded" style={{ maxWidth: 280 }} />
                              <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); removeRefImage(i); }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                              <span className="absolute bottom-1 left-1 text-[10px] text-white bg-black/70 px-1 rounded">[{connectedInputs.imageUrls.length + i + 1}]</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 参考视频 */}
                    {(connectedInputs.videoUrl || refVideoName) && (
                      <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg p-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span className="text-gray-300 text-xs truncate flex-1">
                          {connectedInputs.videoUrl ? <span className="text-blue-300">来自连接</span> : (refVideoName === '上传中...' ? <span className="text-gray-400">上传中...</span> : refVideoName)}
                        </span>
                        {!connectedInputs.videoUrl && refVideoName && refVideoName !== '上传中...' && (
                          <button className="text-gray-500 hover:text-red-400 text-xs flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); up({ refVideoUrl: '', refVideoName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                        )}
                      </div>
                    )}

                    {/* 参考音频 */}
                    {refAudioBase64 && (
                      <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg p-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        <span className="text-gray-300 text-xs truncate flex-1">{refAudioName || '已上传'}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); up({ refAudioBase64: '', refAudioName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </HTMLContainer>
    );
  }

  indicator(shape: SeedanceCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
