import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  useEditor,
  Rectangle2d,
} from 'tldraw';
import { useState, useRef } from 'react';
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
    <div className="relative w-full h-44 bg-gradient-to-br from-black/50 to-zinc-900/50 rounded-xl border border-white/8 overflow-hidden">
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
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): CameraControlCardShape['props'] {
    return {
      w: 360,
      h: 520,
      sourceShapeId: '',
      cameraVertical: 0,
      cameraHorizontal: 0,
      generatedImage: '',
      isGenerating: false,
      isMinimized: false,
      model: 'nano-banana-pro',
      prompt: '',
    };
  }

  override getGeometry(shape: CameraControlCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: CameraControlCardShape) {
    const { w, h, sourceShapeId, cameraVertical, cameraHorizontal, generatedImage, isGenerating, isMinimized, model, prompt } = shape.props;
    const editor = useEditor();
    const [lightbox, setLightbox] = useState(false);

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

    // 从连接的源图片卡片读取图片
    const getSourceImage = (): string => {
      if (!sourceShapeId) return '';
      const src = editor.getShape(sourceShapeId as any) as any;
      return src?.props?.generatedImage ?? '';
    };

    const sourceImage = getSourceImage();

    const generate = async () => {
      if (!sourceImage) { alert('源图片卡片还没有生成图片'); return; }
      update({ isGenerating: true });
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { alert('请先登录'); update({ isGenerating: false }); return; }

        const cameraPrompt = `${prompt} [Camera: vertical ${cameraVertical >= 0 ? '+' : ''}${cameraVertical}°, horizontal ${cameraHorizontal >= 0 ? '+' : ''}${cameraHorizontal}°]`;

        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cameraPrompt,
            model,
            image: sourceImage,
            userId: user.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '生成失败');

        let imgUrl = data.imageUrl || data.url || '';
        if (imgUrl && !imgUrl.startsWith('data:')) {
          try { imgUrl = await mirrorUrlToStorage(user.id, imgUrl, 'image'); } catch {}
        }
        update({ generatedImage: imgUrl, isGenerating: false });
      } catch (err: any) {
        alert('生成失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const downloadImage = () => {
      if (!generatedImage) return;
      const a = document.createElement('a');
      a.href = generatedImage;
      a.download = `camera-control-${Date.now()}.jpg`;
      a.click();
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 360 : 160, h: isMinimized ? 520 : 60 });
    };

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
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
            style={{ backgroundColor: '#27272a', border: '2px solid #60a5fa', boxShadow: '0 0 8px #60a5fa', pointerEvents: 'none' }} />
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
            style={{ backgroundColor: '#27272a', border: '2px solid #60a5fa', boxShadow: '0 0 8px #60a5fa', pointerEvents: 'none' }} />
        </div>

        {/* 放大查看 */}
        {lightbox && generatedImage && (
          <div
            className="fixed inset-0 z-[99999] bg-black/85 flex items-center justify-center"
            onClick={() => setLightbox(false)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="relative" style={{ maxWidth: '80vw', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
              <img src={generatedImage} alt="" className="rounded-xl object-contain" style={{ maxWidth: '80vw', maxHeight: '80vh' }} />
              <button
                className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightbox(false)}
                onPointerDown={(e) => e.stopPropagation()}
              >✕</button>
            </div>
          </div>
        )}

        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-white text-sm font-semibold">镜头控制</span>
              <span className="text-gray-500 text-xs">Camera Control</span>
            </div>
            <button
              onClick={toggleMinimize}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              {isMinimized ? '+' : '−'}
            </button>
          </div>

          {!isMinimized && (
            <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">

              {/* 源图片小预览（仅有图时显示） */}
              {sourceImage && (
                <div className="flex-shrink-0 relative w-full h-20 bg-black/30 rounded-lg overflow-hidden border border-white/8">
                  <img src={sourceImage} alt="source" className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 text-[9px] text-white/40 bg-black/40 px-1 rounded">源图片</div>
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

              {/* 生成结果 */}
              {generatedImage && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-[10px] text-gray-400">生成结果</span>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setLightbox(true); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-white transition-colors">查看</button>
                      <button onClick={(e) => { e.stopPropagation(); downloadImage(); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-white transition-colors">下载</button>
                      <button onClick={(e) => { e.stopPropagation(); update({ generatedImage: '' }); }} onPointerDown={(e) => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">删除</button>
                    </div>
                  </div>
                  <div className="flex-1 bg-black/30 rounded-xl overflow-hidden border border-white/8 cursor-pointer min-h-0"
                    onClick={(e) => { e.stopPropagation(); setLightbox(true); }} onPointerDown={(e) => e.stopPropagation()}>
                    <img src={generatedImage} alt="result" className="w-full h-full object-cover" />
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
