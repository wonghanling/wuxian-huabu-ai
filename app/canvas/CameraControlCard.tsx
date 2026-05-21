import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  useEditor,
  useValue,
  Rectangle2d,
} from 'tldraw';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { mirrorUrlToStorage } from '@/lib/canvas-storage';

function compressImage(dataUrl: string, maxSize = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function CameraController({
  vertical, horizontal, onAngleChange,
}: { vertical: number; horizontal: number; onAngleChange: (v: number, h: number) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [rotX, setRotX] = useState(vertical);
  const [rotY, setRotY] = useState(horizontal);
  const lastPos = useRef({ x: 0, y: 0 });

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    const ny = ((rotY + dx * 0.5 + 180) % 360) - 180;
    const nx = Math.max(-90, Math.min(90, rotX + dy * 0.5));
    setRotX(nx); setRotY(ny);
    onAngleChange(Math.round(nx), Math.round(ny));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative w-full h-36 bg-gradient-to-br from-black/50 to-zinc-900/50 rounded-xl border border-white/8 overflow-hidden">
      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: '800px' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
      >
        <div
          className="relative"
          style={{ width: 110, height: 110, transformStyle: 'preserve-3d', transform: `rotateX(${-rotX}deg) rotateY(${rotY}deg)` }}
        >
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {[0, 90].map(r => (
              <div key={r} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-blue-400/25"
                style={{ transform: `rotateY(${r}deg)` }} />
            ))}
            {[-60, -30, 30, 60].map(r => (
              <div key={r} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/15"
                style={{ width: `${Math.cos(r * Math.PI / 180) * 100}%`, height: `${Math.cos(r * Math.PI / 180) * 100}%`, transform: `rotateX(${r}deg)` }} />
            ))}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: 'translateZ(55px)' }}>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="absolute inset-0 bg-blue-500/30 rounded-xl blur-lg -z-10" />
            </div>
          </div>
        </div>
      </div>

      {/* 角度显示 */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        <div className="text-[10px] font-mono bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
          <span className="text-gray-400">俯仰 </span><span className="text-blue-400 font-bold">{Math.round(rotX)}°</span>
        </div>
        <div className="text-[10px] font-mono bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
          <span className="text-gray-400">偏航 </span><span className="text-blue-400 font-bold">{Math.round(rotY)}°</span>
        </div>
      </div>

      {/* 重置 */}
      <button
        className="absolute top-2 right-2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-lg flex items-center justify-center transition-all"
        onClick={(e) => { e.stopPropagation(); setRotX(0); setRotY(0); onAngleChange(0, 0); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {!isDragging && rotX === 0 && rotY === 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/30 pointer-events-none">拖动旋转 · 360° 自由控制</div>
      )}
    </div>
  );
}

export type CameraControlCardShape = TLBaseShape<
  'camera-control-card',
  {
    w: number;
    h: number;
    sourceShapeId: string;
    cameraVertical: number;
    cameraHorizontal: number;
    generatedImage: string;
    isGenerating: boolean;
    isMinimized: boolean;
    model: string;
    prompt: string;
    aspectRatio: string;
    imageQuality: string;
    showSettingsPanel?: boolean;
    showOutputPanel?: boolean;
    isCollapsed?: boolean;
  }
>;

// @ts-expect-error
export class CameraControlCardUtil extends BaseBoxShapeUtil<CameraControlCardShape> {
  static override type = 'camera-control-card' as const;

  static override props: RecordProps<CameraControlCardShape> = {
    w: T.number,
    h: T.number,
    sourceShapeId: T.string,
    cameraVertical: T.number,
    cameraHorizontal: T.number,
    generatedImage: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    model: T.string,
    prompt: T.string,
    aspectRatio: T.string,
    imageQuality: T.string,
    showSettingsPanel: T.boolean.optional(),
    showOutputPanel: T.boolean.optional(),
    isCollapsed: T.boolean.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): CameraControlCardShape['props'] {
    return {
      w: 360,
      h: 400,
      sourceShapeId: '',
      cameraVertical: 0,
      cameraHorizontal: 0,
      generatedImage: '',
      isGenerating: false,
      isMinimized: false,
      model: 'nano-banana-pro',
      prompt: '',
      aspectRatio: '16:9',
      imageQuality: '2k',
    };
  }

  override getGeometry(shape: CameraControlCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: CameraControlCardShape) {
    const { w, h, sourceShapeId, cameraVertical, cameraHorizontal, generatedImage, isGenerating, isMinimized, model, prompt, aspectRatio, imageQuality, showSettingsPanel, showOutputPanel, isCollapsed } = shape.props;
    const editor = useEditor();
    const [lightbox, setLightbox] = useState(false);
    // 视口检测（必须在所有 hooks 之后）
    const isInViewport = useValue('inViewport', () => {
      const vp = editor.getViewportPageBounds();
      const sb = editor.getShapePageBounds(shape.id);
      if (!sb) return true;
      return !(sb.maxX < vp.minX || sb.minX > vp.maxX || sb.maxY < vp.minY || sb.minY > vp.maxY);
    }, [editor, shape.id]);
    const hasActiveTask = !!(isGenerating || showSettingsPanel || showOutputPanel);
    if (!isInViewport && !hasActiveTask) {
      return <HTMLContainer><div style={{ width: w, height: h, background: '#18181b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>时空镜头延展</span></div></HTMLContainer>;
    }

    const update = (props: Partial<CameraControlCardShape['props']>) =>
      editor.updateShape({ id: shape.id, type: 'camera-control-card' as any, props: { ...shape.props, ...props } });

    const handleOutputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'output',
        terminal: 'start',
      });
    };

    const handleInputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'input',
        terminal: 'end',
      });
    };

    // 从连接的上游卡片读取图片（通过 binding 系统）
    const getSourceImage = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (!src) continue;
          if (src.type === 'custom-card' && src.props?.cardType === 'character' && src.props?.characterGeneratedImage) return src.props.characterGeneratedImage;
          if (src.type === 'custom-card' && src.props?.generatedImage) return src.props.generatedImage;
          if (src.type === 'camera-control-card' && src.props?.generatedImage) return src.props.generatedImage;
          if (src.type === 'gem-step4-card' && src.props?.generatedImage) return src.props.generatedImage;
          if (src.type === 'media-upload-card' && src.props?.mediaType === 'image' && src.props?.imageData) return src.props.imageData;
        }
      }
      return '';
    };

    const sourceImage = getSourceImage();

    const generate = async () => {
      if (!sourceImage) { alert('请先连接图片卡片'); return; }
      update({ isGenerating: true });
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { alert('请先登录'); update({ isGenerating: false }); return; }

        const cameraPrompt = `${prompt} [Camera: vertical ${cameraVertical >= 0 ? '+' : ''}${cameraVertical}°, horizontal ${cameraHorizontal >= 0 ? '+' : ''}${cameraHorizontal}°]`;

        const isBase64 = sourceImage.startsWith('data:');
        const currentModel = model || 'nano-banana-pro';
        let imgBase64: string | undefined;
        let imgBase64Array: string[] | undefined;
        let imgUrlArray: string[] | undefined;

        // GPT Image 2 走 /api/image/generate
        if (currentModel === 'gpt-image-2') {
          const raw = isBase64 ? sourceImage : await fetch(sourceImage).then(r => r.blob()).then(b => new Promise<string>(res => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b); }));
          const compressed = await compressImage(raw);
          // 兼容：如果 aspectRatio/imageQuality 是 nano-banana 的值，转成 GPT Image 2 的合法值
          const gptAspect = ['2048x1152', '3840x2160', '2160x3840', '2048x2048'].includes(aspectRatio) ? aspectRatio : '2048x1152';
          const gptQuality = ['medium', 'high'].includes(imageQuality) ? imageQuality : 'medium';
          const res = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-image-2',
              prompt: cameraPrompt,
              aspectRatio: gptAspect,
              imageQuality: gptQuality,
              imageBase64Array: [compressed],
              userId: user.id,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '生成失败');

          // GPT Image 2 是异步模式，需要轮询
          if (data.pending && data.requestId) {
            const endpoint = data.endpoint || 'openai/gpt-image-2/edit';
            let pollAttempts = 0;
            const poll = async (): Promise<string> => {
              pollAttempts++;
              await new Promise(r => setTimeout(r, 3000));
              try {
                const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
                const qData = await qRes.json();
                if (qData.imageUrl) return qData.imageUrl;
                if (qData.status === 'failed') throw new Error(qData.error || '生成失败');
                if (pollAttempts >= 60) throw new Error('生成超时');
                return poll();
              } catch (e: any) {
                if (pollAttempts >= 60) throw e;
                return poll();
              }
            };
            const imageUrl = await poll();
            update({ generatedImage: imageUrl, isGenerating: false });
          } else if (data.imageUrl) {
            update({ generatedImage: data.imageUrl, isGenerating: false });
          } else {
            throw new Error('未获取到图片');
          }
          (window as any).refreshBalance?.();
          return;
        }

        if (['nano-banana-pro'].includes(currentModel)) {
          if (isBase64) {
            const { fal: falClient } = await import('@fal-ai/client');
            const blob = await fetch(sourceImage).then(r => r.blob());
            const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
            const url = await falClient.storage.upload(file);
            imgUrlArray = [url];
          } else {
            imgUrlArray = [sourceImage];
          }
        } else if (currentModel === 'nano-banana') {
          const raw = isBase64 ? sourceImage : await fetch(sourceImage).then(r => r.blob()).then(b => new Promise<string>(res => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b); }));
          imgBase64Array = [await compressImage(raw)];
        } else {
          const raw = isBase64 ? sourceImage : await fetch(sourceImage).then(r => r.blob()).then(b => new Promise<string>(res => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b); }));
          imgBase64 = await compressImage(raw);
        }

        const response = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: currentModel,
            prompt: cameraPrompt,
            aspectRatio: aspectRatio || '16:9',
            imageQuality: imageQuality || '2k',
            userId: user.id,
            imageBase64: imgBase64,
            imageBase64Array: imgBase64Array,
            imageUrlArray: imgUrlArray,
          }),
        });

        if (!response.ok) throw new Error('API 调用失败');
        const data = await response.json();

        // MJ 异步轮询
        if (data.pending && data.taskId) {
          const mjPoll = async (): Promise<string> => {
            await new Promise(r => setTimeout(r, 3000));
            const qRes = await fetch(`/api/image/mj-query?taskId=${encodeURIComponent(data.taskId)}`);
            const qData = await qRes.json();
            if (qData.status === 'completed' && qData.imageUrl) return qData.imageUrl;
            if (qData.status === 'failed') throw new Error(qData.error || 'MJ 生成失败');
            return mjPoll();
          };
          data.imageUrl = await mjPoll();
        }

        // fal 异步轮询
        if (data.pending && data.requestId) {
          const hasImages = imgUrlArray && imgUrlArray.length > 0;
          const falEndpointMap: Record<string, string> = {
            'flux-kontext': 'fal-ai/flux-pro/kontext/max',
            'nano-banana-pro': hasImages ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2',
          };
          const falEndpoint = falEndpointMap[currentModel] || 'fal-ai/nano-banana-2/edit';
          let pollAttempts = 0;
          const falPoll = async (): Promise<string> => {
            pollAttempts++;
            await new Promise(r => setTimeout(r, 3000));
            try {
              const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(falEndpoint)}`);
              const qData = await qRes.json();
              if (qData.success && qData.imageUrl) return qData.imageUrl;
              if (qData.error) throw new Error(qData.error);
              if (pollAttempts > 60) throw new Error('生成超时');
              return falPoll();
            } catch (e: any) {
              if (e.message?.includes('超时') || e.message?.includes('error')) throw e;
              if (pollAttempts > 60) throw new Error('生成超时');
              await new Promise(r => setTimeout(r, 5000));
              return falPoll();
            }
          };
          data.imageUrl = await falPoll();
        }

        update({ generatedImage: data.imageUrl, isGenerating: false });
        (window as any).refreshBalance?.();

        // 后台上传到 Supabase
        try {
          if (data.imageUrl) {
            const permanentUrl = await mirrorUrlToStorage(user.id, data.imageUrl, 'image');
            const latest = editor.getShape(shape.id);
            if (latest) {
              editor.updateShape({
                id: shape.id, type: 'camera-control-card' as any,
                props: { ...(latest.props as any), generatedImage: permanentUrl },
              });
            }
          }
        } catch {}
      } catch (err: any) {
        alert('生成失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const downloadImage = async () => {
      if (!generatedImage) return;
      try {
        let url = generatedImage;
        if (!generatedImage.startsWith('data:')) {
          const blob = await fetch(generatedImage).then(r => r.blob());
          url = URL.createObjectURL(blob);
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = `camera-control-${Date.now()}.jpg`;
        a.click();
        if (!generatedImage.startsWith('data:')) URL.revokeObjectURL(url);
      } catch {
        alert('下载失败，请长按图片保存');
      }
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 360 : 160, h: isMinimized ? 500 : 60 });
    };

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>

        {/* 右侧浮板：参数设置（上）+ 图片输出（下） */}
        {(!isMinimized || isCollapsed) && (showSettingsPanel || (showOutputPanel && generatedImage)) && (
          <div
            className="absolute flex flex-col gap-2"
            style={{ left: '100%', marginLeft: '8px', top: 0, width: 280, zIndex: 200, pointerEvents: 'all' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* 参数设置 - 折叠时隐藏 */}
            {showSettingsPanel && !isCollapsed && (
              <div
                className="rounded-2xl shadow-2xl backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(100,100,100,0.1) 100%)',
                  border: '1px solid rgba(192,192,192,0.3)',
                }}
              >
                <div className="p-3 flex flex-col gap-2">
                  <span className="text-[10px] text-gray-400 font-semibold">参数设置</span>

                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">模型</label>
                    <select
                      className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                      value={model || 'nano-banana-pro'}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ model: e.target.value })}
                    >
                      <option value="nano-banana-pro">Nano Banana 2（2K ¥1.2 / 4K ¥1.5）</option>
                      <option value="nano-banana">Nano Banana — ¥0.5/次</option>
                      <option value="gpt-image-2">GPT Image 2 — ¥0.5~0.8/次</option>
                      <option value="flux-kontext">Flux Kontext — ¥0.6/次</option>
                      <option value="doubao-seedream-4-5-251128">豆包 Seedream — ¥0.3/次</option>
                    </select>
                  </div>

                  {(model || 'nano-banana-pro') === 'nano-banana-pro' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-gray-400 text-xs mb-1 block">清晰度</label>
                        <div className="flex gap-1">
                          {[{ value: '2k', label: '2K ¥1.2' }, { value: '4k', label: '4K ¥1.5' }].map(({ value, label }) => (
                            <button key={value}
                              onClick={(e) => { e.stopPropagation(); update({ imageQuality: value }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${(imageQuality || '2k') === value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-gray-400 text-xs mb-1 block">比例</label>
                        <select
                          className="w-full bg-black/30 border border-white/8 rounded p-1 text-white text-[10px] focus:outline-none"
                          value={aspectRatio || '16:9'}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => update({ aspectRatio: e.target.value })}
                        >
                          {['1:1','16:9','9:16','4:3','3:4','3:2','2:3'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {model === 'gpt-image-2' && (
                    <>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">尺寸</label>
                        <div className="flex gap-1 flex-wrap">
                          {[
                            { value: '2048x1152', label: '16:9 2K', priceMedium: '¥0.7', priceHigh: '¥0.7' },
                            { value: '3840x2160', label: '16:9 4K', priceMedium: '¥1.5', priceHigh: '¥2.0' },
                            { value: '2160x3840', label: '9:16 4K', priceMedium: '¥1.5', priceHigh: '¥2.0' },
                            { value: '2048x2048', label: '1:1 2K', priceMedium: '¥0.7', priceHigh: '¥1.0' },
                          ].map(({ value, label, priceMedium, priceHigh }) => (
                            <button key={value}
                              onClick={(e) => { e.stopPropagation(); update({ aspectRatio: value }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${(aspectRatio ?? '2048x1152') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                            >
                              <div>{label}</div>
                              <div className="text-[10px] opacity-70">{(imageQuality ?? 'medium') === 'high' ? priceHigh : priceMedium}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">画质</label>
                        <div className="flex gap-1">
                          {[{ value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }].map(({ value, label }) => (
                            <button key={value}
                              onClick={(e) => { e.stopPropagation(); update({ imageQuality: value }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(imageQuality ?? 'medium') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                            >{label}</button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {!['nano-banana-pro', 'gpt-image-2'].includes(model || 'nano-banana-pro') && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">比例</label>
                      <select
                        className="w-full bg-black/30 border border-white/8 rounded p-1 text-white text-[10px] focus:outline-none"
                        value={aspectRatio || '16:9'}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => update({ aspectRatio: e.target.value })}
                      >
                        {['1:1','16:9','9:16','4:3','3:4','3:2','2:3'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 图片输出 */}
            {showOutputPanel && generatedImage && (
              <div
                className="rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(100,100,100,0.1) 100%)',
                  border: '1px solid rgba(192,192,192,0.3)',
                }}
              >
                <button
                  className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 text-white text-base flex items-center justify-center transition-all"
                  onClick={(e) => { e.stopPropagation(); (window as any).openOutputMenu?.(shape.id, e.clientX, e.clientY, 'image-output'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="继续创建下游卡片"
                >+</button>
                <div className="relative group">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-auto max-h-[400px] object-contain bg-black/20"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      查看
                    </button>
                    <button
                      className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => { e.stopPropagation(); downloadImage(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下载
                    </button>
                    <button
                      className="px-3 py-2 bg-red-500/90 hover:bg-red-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => { e.stopPropagation(); update({ generatedImage: '', showOutputPanel: false }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 输出端口 - Right */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ right: '-6px', zIndex: 101, pointerEvents: 'all' }}
          data-port-type="output"
          data-node-id={shape.id}
          onMouseDown={handleOutputPortDown}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)', pointerEvents: 'none' }} />
        </div>

        {/* 输入端口 - Left */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ left: '-6px', zIndex: 101, pointerEvents: 'all' }}
          data-port-type="input"
          data-node-id={shape.id}
          onMouseDown={handleInputPortDown}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)', pointerEvents: 'none' }} />
        </div>

        {/* 放大查看 */}
        {lightbox && generatedImage && (
          <div
            className="fixed inset-0 z-[99999] bg-black/85 flex items-center justify-center"
            onClick={() => setLightbox(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="relative" style={{ maxWidth: '80vw', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
              <img src={generatedImage} alt="" className="rounded-xl object-contain" style={{ maxWidth: '80vw', maxHeight: '80vh', imageRendering: 'high-quality' as any }} />
              <button
                className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightbox(false)}
                onPointerDown={(e) => e.stopPropagation()}
              >✕</button>
            </div>
          </div>
        )}

        <div className="relative w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-visible">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-white text-sm font-semibold">时空镜头延展</span>
            </div>
            <div className="flex items-center gap-1">
              {/* 折叠按钮 */}
              {!isMinimized && (
                <button
                  onClick={(e) => { e.stopPropagation(); update({ isCollapsed: !isCollapsed, w: isCollapsed ? 360 : 150, h: isCollapsed ? 400 : 80 }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                  title={isCollapsed ? '展开' : '折叠'}
                >{isCollapsed ? '▼' : '▲'}</button>
              )}
              {/* 缩小按钮 */}
              <button
                onClick={toggleMinimize}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
              >{isMinimized ? '+' : '−'}</button>
            </div>
          </div>


          {!isMinimized && isCollapsed && (
            <div className="px-3 h-full flex items-center">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></div>
                <div className="min-w-0">
                  <div className="text-white text-xs font-semibold truncate">时空镜头延展</div>
                  <div className="text-gray-500 text-[10px]">▼展开</div>
                </div>
              </div>
            </div>
          )}

          {!isMinimized && !isCollapsed && (
            <div className="flex flex-col overflow-visible p-3 gap-2" onPointerDown={(e) => e.stopPropagation()} onWheelCapture={(e) => e.stopPropagation()}>

              {/* 说明 */}
              <div className="flex-shrink-0 px-2 pt-1">
                <span className="text-[10px] text-green-400">• 后退 —5s：前5秒场景 &nbsp;• 前进 +5s：后5秒场景</span>
              </div>

              {/* 源图片小预览 */}
              {sourceImage && (
                <div className="flex-shrink-0">
                  <label className="text-gray-400 text-xs mb-1 block">源图片（来自连接）</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div
                      className="relative rounded-lg border border-purple-500/40 group"
                      style={{ aspectRatio: '1', width: '100%', background: 'rgba(0,0,0,0.3)' }}
                    >
                      <img src={sourceImage} alt="source" className="w-full h-full object-cover rounded-lg" />
                      {/* hover 弹出原比例图层 */}
                      <img
                        src={sourceImage}
                        className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-2xl rounded-lg border border-purple-500/60"
                        style={{ left: 0, top: 0, maxWidth: 280, maxHeight: 280, width: 'auto', height: 'auto', zIndex: 20, background: 'rgba(0,0,0,0.9)' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {!sourceImage && (
                <div className="flex-shrink-0 w-full h-10 bg-black/20 rounded-lg border border-white/5 flex items-center justify-center">
                  <span className="text-gray-600 text-[10px]">连接图片卡片后自动读取源图</span>
                </div>
              )}

              {/* 摄像头控制球 */}
              <div className="flex-shrink-0">
                <label className="text-gray-400 text-xs mb-2 block">拖动摄像头调整角度</label>
                <CameraController
                  vertical={cameraVertical}
                  horizontal={cameraHorizontal}
                  onAngleChange={(v, h) => update({ cameraVertical: v, cameraHorizontal: h })}
                />
              </div>

              {/* 角度显示 */}
              <div className="flex justify-between text-xs flex-shrink-0">
                <div className="bg-black/30 px-3 py-1.5 rounded">
                  <span className="text-gray-400">垂直: </span>
                  <span className="text-white font-mono">{cameraVertical}°</span>
                </div>
                <div className="bg-black/30 px-3 py-1.5 rounded">
                  <span className="text-gray-400">水平: </span>
                  <span className="text-white font-mono">{cameraHorizontal}°</span>
                </div>
              </div>

              {/* 提示 */}
              <div className="text-[10px] text-gray-500 bg-black/30 p-2 rounded flex-shrink-0">
                拖动摄像头图标旋转，参数自动添加到生成词
              </div>

              {/* 模型选择 + 比例 + 清晰度 - 已全部移至右侧浮板 */}
              {false && (
              <>
              <div className="flex-shrink-0">
                <label className="text-gray-400 text-xs mb-1 block">模型</label>
                <select
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-white/15 transition-all"
                  value={model}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ model: e.target.value })}
                >
                  <option value="nano-banana-pro">Nano Banana 2（2K ¥1.2 / 4K ¥1.5）</option>
                  <option value="nano-banana">Nano Banana — ¥0.5/次</option>
                  <option value="gpt-image-2">GPT Image 2 — ¥0.5~0.8/次</option>
                  <option value="flux-kontext">Flux Kontext — ¥0.6/次</option>
                  <option value="doubao-seedream-4-5-251128">豆包 Seedream — ¥0.3/次</option>
                </select>
              </div>

              {/* 比例 + 清晰度 - 按模型区分 */}
              {(model || 'nano-banana-pro') === 'nano-banana-pro' && (
                <div className="flex gap-2 flex-shrink-0">
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">清晰度</label>
                    <div className="flex gap-1">
                      {[{ value: '2k', label: '2K ¥1.2' }, { value: '4k', label: '4K ¥1.5' }].map(({ value, label }) => (
                        <button key={value}
                          onClick={(e) => { e.stopPropagation(); update({ imageQuality: value }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${(imageQuality || '2k') === value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">比例</label>
                    <select
                      className="w-full bg-black/30 border border-white/8 rounded p-1 text-white text-[10px] focus:outline-none"
                      value={aspectRatio || '16:9'}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ aspectRatio: e.target.value })}
                    >
                      {['1:1','16:9','9:16','4:3','3:4','3:2','2:3'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {(model || 'nano-banana-pro') === 'gpt-image-2' && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">尺寸</label>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { value: '2048x1152', label: '16:9 2K' },
                        { value: '3840x2160', label: '16:9 4K' },
                        { value: '2160x3840', label: '9:16 4K' },
                        { value: '2048x2048', label: '1:1 2K' },
                      ].map(({ value, label }) => (
                        <button key={value}
                          onClick={(e) => { e.stopPropagation(); update({ aspectRatio: value }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${(aspectRatio || '2048x1152') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">画质</label>
                    <div className="flex gap-1">
                      {[{ value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }].map(({ value, label }) => (
                        <button key={value}
                          onClick={(e) => { e.stopPropagation(); update({ imageQuality: value }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${(imageQuality || 'medium') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!['nano-banana-pro', 'gpt-image-2'].includes(model || 'nano-banana-pro') && (
                <div className="flex-shrink-0">
                  <label className="text-gray-400 text-xs mb-1 block">比例</label>
                  <select
                    className="w-full bg-black/30 border border-white/8 rounded p-1 text-white text-[10px] focus:outline-none"
                    value={aspectRatio || '16:9'}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => update({ aspectRatio: e.target.value })}
                  >
                    {['1:1','16:9','9:16','4:3','3:4','3:2','2:3'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              </>
              )}

              {/* Prompt 输入 */}
              <div className="flex-shrink-0">
                <label className="text-gray-400 text-xs mb-1 block">补充描述（可选）</label>
                <textarea
                  className="w-full h-12 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/20 placeholder-gray-600"
                  placeholder="描述镜头细节，如：低角度仰拍，背景虚化..."
                  value={prompt}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ prompt: e.target.value })}
                />
              </div>

              {/* 展开参数设置按钮 */}
              <button
                className="flex-shrink-0 w-full py-1.5 rounded-lg text-[10px] font-medium transition-all bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300"
                onClick={(e) => { e.stopPropagation(); update({ showSettingsPanel: !showSettingsPanel }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showSettingsPanel ? '收起参数设置 ▲' : `展开参数设置 ▼  ${model || 'nano-banana-pro'} · ${aspectRatio || '16:9'}`}
              </button>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !sourceImage}
                className={`flex-shrink-0 w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg ${
                  isGenerating || !sourceImage
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {isGenerating ? '生成中...' : '生成'}
              </button>

              {/* 查看图片按钮 */}
              {generatedImage && (
                <button
                  className="flex-shrink-0 w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600"
                  onClick={(e) => { e.stopPropagation(); update({ showOutputPanel: !showOutputPanel }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {showOutputPanel ? '隐藏图片' : '查看生成图片'}
                </button>
              )}

              {/* 生成结果 - 已移至右侧浮板 */}
              {false && generatedImage && (
                <div className="flex-shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400">生成结果</span>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setLightbox(true); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-white transition-colors">查看</button>
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-white transition-colors">下载</button>
                      <button onClick={(e) => { e.stopPropagation(); update({ generatedImage: '' }); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">删除</button>
                    </div>
                  </div>
                  <div
                    className="relative w-full bg-black/30 rounded-xl overflow-hidden border border-white/8 cursor-pointer group"
                    style={{ aspectRatio: '16/9' }}
                    onClick={(e) => { e.stopPropagation(); setLightbox(true); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <img src={generatedImage} alt="result" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs">点击放大</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: CameraControlCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
