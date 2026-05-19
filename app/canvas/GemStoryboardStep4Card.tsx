import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  useEditor,
  Rectangle2d,
} from 'tldraw';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function compressImage(dataUrl: string, maxSize = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

export type GemStep4CardShape = TLBaseShape<
  'gem-step4-card',
  {
    w: number;
    h: number;
    characterHint?: string;
    actionSuggestion: string;
    result: string;
    generatedImage?: string;
    isGenerating: boolean;
    isMinimized: boolean;
    duration?: string;
    scriptMode?: 'normal' | 'detail';
    ratio?: '16:9' | '9:16' | '1:1';
    generationProgress?: number;
    showImageOutput?: boolean;
    showSettingsPanel?: boolean;
    isCollapsed?: boolean;
  }
>;

// @ts-expect-error
export class GemStep4CardUtil extends BaseBoxShapeUtil<GemStep4CardShape> {
  static override type = 'gem-step4-card' as const;

  static override props: RecordProps<GemStep4CardShape> = {
    w: T.number,
    h: T.number,
    characterHint: T.string.optional() as any,
    actionSuggestion: T.string,
    result: T.string,
    generatedImage: T.string.optional() as any,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    duration: T.string.optional() as any,
    scriptMode: T.string.optional() as any,
    ratio: T.string.optional() as any,
    generationProgress: T.number.optional() as any,
    showImageOutput: T.boolean.optional() as any,
    showSettingsPanel: T.boolean.optional() as any,
    isCollapsed: T.boolean.optional() as any,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): GemStep4CardShape['props'] {
    return {
      w: 380,
      h: 520,
      actionSuggestion: '',
      result: '',
      generatedImage: '',
      isGenerating: false,
      isMinimized: false,
      duration: '5',
      scriptMode: 'normal',
      ratio: '16:9',
    };
  }

  override getGeometry(shape: GemStep4CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep4CardShape) {
    const { w, h, actionSuggestion, result, generatedImage, isGenerating, isMinimized, duration, scriptMode, ratio, generationProgress, showImageOutput, showSettingsPanel, isCollapsed } = shape.props;
    const editor = useEditor();
    const [image, setImage] = useState<string>('');
    const [image2, setImage2] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [inputType, setInputType] = useState<'single' | '2x2' | '3x3'>('single');
    const [lightbox, setLightbox] = useState(false);

    const update = (props: Partial<GemStep4CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...shape.props, ...props } });
    };

    const getConnectedImage = (): string => {
      if (inputType === 'single') return '';
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
          if (src.type === 'media-upload-card' && src.props?.mediaType === 'image' && src.props?.imageData) return src.props.imageData;
        }
      }
      return '';
    };

    const connectedImage = getConnectedImage();
    const displayImage = connectedImage || image;

    const APPEND_SUFFIX = '\nAvoid sudden state changes without intermediate motion. Always describe transitional movement between states.\nno grid, no panels, no borders, no collage layout, maintain scene continuity, follow visible continuity, if scene change exists follow it, if no scene change do not add one, do not describe frame numbers.';

    const pushResultToDownstream = (resultText: string) => {
      const textWithSuffix = resultText + APPEND_SUFFIX;
      const outBindings = editor.getBindingsFromShape(shape.id, 'connection');
      for (const binding of outBindings) {
        if ((binding as any).props?.terminal !== 'start') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const ob of connBindings) {
          if ((ob as any).props?.terminal !== 'end') continue;
          const target = editor.getShape((ob as any).toId) as any;
          if (!target) continue;
          if (target.type === 'custom-card' && target.props?.cardType === 'video') {
            editor.updateShape({ id: (ob as any).toId, type: 'custom-card' as any, props: { ...target.props, prompt: textWithSuffix } });
          }
          if (target.type === 'seedance-card') {
            editor.updateShape({ id: (ob as any).toId, type: 'seedance-card' as any, props: { ...target.props, prompt: textWithSuffix } });
          }
        }
      }
    };

    const handleOutputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      editor.setCurrentTool('port', { shapeId: shape.id, portId: 'output', terminal: 'start' });
    };

    const handleInputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      editor.setCurrentTool('port', { shapeId: shape.id, portId: 'input', terminal: 'end' });
    };

    const loadImage = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 = 1) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const compressed = await compressImage(ev.target?.result as string);
        if (slot === 2) setImage2(compressed);
        else setImage(compressed);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const generate = async () => {
      if (!displayImage) { alert('请上传或连接图片'); return; }
      if (inputType === 'single' && !image2) { alert('单图模式需要上传两张图片（人物三视角 + 剧情首帧）'); return; }
      update({ isGenerating: true, result: '', generatedImage: '', generationProgress: 5 });

      let progress = 5;
      const progressTimer = setInterval(() => {
        progress = Math.min(progress + 3, 90);
        const ls = editor.getShape(shape.id) as any;
        if (ls) editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...ls.props, generationProgress: progress } });
      }, 3000);

      try {
        const templateFileMap: Record<string, string> = {
          'single': '/fenjingmuban2x2.jpg',
          '2x2': '/fenjingmuban2x2.jpg',
          '3x3': '/fenjingmuban3X3.jpg',
        };
        // 重试加载模板图片（偶发的 fetch 失败兜底）
        const fetchTemplate = async (attempt: number = 1): Promise<Blob> => {
          const templateUrl = `${templateFileMap[inputType]}?v=${Date.now()}-${attempt}`;
          const templateRes = await fetch(templateUrl, { cache: 'no-store' });
          if (!templateRes.ok) throw new Error(`HTTP ${templateRes.status}`);
          const blob = await templateRes.blob();
          if (blob.size === 0) throw new Error('空响应');
          return blob;
        };
        let templateBlob: Blob;
        try {
          templateBlob = await fetchTemplate(1);
        } catch (err1) {
          console.warn('模板图片第1次加载失败，重试:', err1);
          await new Promise(r => setTimeout(r, 500));
          try {
            templateBlob = await fetchTemplate(2);
          } catch (err2) {
            console.warn('模板图片第2次加载失败，重试:', err2);
            await new Promise(r => setTimeout(r, 1000));
            templateBlob = await fetchTemplate(3);
          }
        }
        const templateB64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('模板图片读取失败'));
          reader.readAsDataURL(templateBlob);
        });
        if (!templateB64 || !templateB64.startsWith('data:image/')) {
          throw new Error('模板图片格式无效');
        }

        const sizeMap: Record<string, string> = {
          '16:9': '2048x1152',
          '9:16': '2160x3840',
          '1:1': '2048x2048',
        };

        let prompt = '';
        if (inputType === 'single') {
          prompt = `图1是人物三视角参考图，用于保持角色外观、服装、比例的一致性。图2是剧情首帧，定义起始场景、构图、光线和氛围。根据这两张参考图，设计4个连续电影级分镜画面：第1格严格还原首帧构图，第2-4格按剧情发展推进动作。把4个画面嵌入分镜脚本模板的4个空白画面框里，同时只在模板说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效，不覆盖画面框。整体为一个${duration}s电影级镜头，时间轴按动作节奏分配。${actionSuggestion}`;
        } else {
          const isCellMode = scriptMode === 'detail';
          const shotCount = inputType === '2x2' ? 4 : 9;
          const gridLabel = shotCount === 9 ? '9宫格' : '4宫格';
          prompt = isCellMode
            ? `把${gridLabel}分镜图的画面嵌入分镜脚本模板的空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。写一个${duration}s电影级细化动作分镜脚本，这${shotCount}个宫格是细化动作分解，整体为一个${duration}s镜头，可以跳过重复帧，时间轴按实际动作节奏分配。${actionSuggestion}`
            : `把${gridLabel}分镜图的画面嵌入分镜脚本模板的空白画面框里，同时只在模板原本说明栏填写镜头号、时间轴、景别、运镜、动作说明、音效。不覆盖分镜画面。写一个${duration}s电影级分镜脚本。${actionSuggestion}`;
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const res = await fetch('/api/gem/generate-storyboard-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            aspectRatio: sizeMap[ratio || '16:9'] || '2048x1152',
            imageBase64Array: inputType === 'single'
              ? [displayImage, image2, templateB64]
              : [displayImage, templateB64],
            userId: user?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');

        if (data.pending && data.requestId) {
          const falEndpoint = data.endpoint || 'openai/gpt-image-2/edit';
          let attempts = 0;
          const poll = async (): Promise<void> => {
            attempts++;
            await new Promise(r => setTimeout(r, 3000));
            try {
              const prog = Math.min(20 + attempts * 5, 90);
              const ls = editor.getShape(shape.id) as any;
              if (ls) editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...ls.props, generationProgress: prog } });
              const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(falEndpoint)}`);
              const qData = await qRes.json();
              if (qData.success && qData.imageUrl) {
                clearInterval(progressTimer);
                const ls2 = editor.getShape(shape.id) as any;
                editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...ls2.props, generatedImage: qData.imageUrl, isGenerating: false, generationProgress: 100 } });
                (window as any).saveCanvasNow?.();
                (window as any).refreshBalance?.();
              } else if (qData.error) {
                clearInterval(progressTimer);
                const ls2 = editor.getShape(shape.id) as any;
                editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...ls2.props, isGenerating: false, generationProgress: 0 } });
                alert('生成失败: ' + qData.error);
              } else if (attempts < 120) {
                poll();
              } else {
                clearInterval(progressTimer);
                const ls2 = editor.getShape(shape.id) as any;
                editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...ls2.props, isGenerating: false, generationProgress: 0 } });
                alert('生成超时，请重试');
              }
            } catch {
              if (attempts < 120) poll();
            }
          };
          poll();
        } else if (data.imageData) {
          clearInterval(progressTimer);
          update({ generatedImage: data.imageData, isGenerating: false, generationProgress: 100 });
          (window as any).saveCanvasNow?.();
          (window as any).refreshBalance?.();
        }
      } catch (err: any) {
        clearInterval(progressTimer);
        alert('生成失败: ' + err.message);
        update({ isGenerating: false, generationProgress: 0 });
      }
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 380 : 160, h: isMinimized ? 520 : 60 });
    };

    const downloadImage = () => {
      if (!generatedImage) return;
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `storyboard-${Date.now()}.png`;
      link.click();
    };

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        {/* lightbox */}
        {lightbox && generatedImage && (
          <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center"
            onClick={() => setLightbox(false)} onPointerDown={(e) => e.stopPropagation()}>
            <div className="relative" style={{ maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
              <img src={generatedImage} alt="分镜脚本" className="rounded-xl object-contain" style={{ maxWidth: '85vw', maxHeight: '85vh', imageRendering: 'high-quality' as any }} />
              <button className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightbox(false)} onPointerDown={(e) => e.stopPropagation()}>✕</button>
            </div>
          </div>
        )}

        {/* 右侧浮层容器 - 参数设置 + 图片输出紧靠在一起 */}
        {((showSettingsPanel && !isCollapsed) || (showImageOutput && generatedImage)) && (!isMinimized || isCollapsed) && (
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

                  {(inputType === '2x2' || inputType === '3x3') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400">脚本模式</label>
                      <div className="flex gap-1">
                        {([['normal', '普通分镜脚本'], ['detail', '细化动作脚本']] as const).map(([val, label]) => (
                          <button key={val}
                            onClick={(e) => { e.stopPropagation(); update({ scriptMode: val }); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${scriptMode === val ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">时长</label>
                    <div className="flex gap-1 flex-wrap">
                      {['4', '5', '6', '8', '10', '12', '15'].map((d) => (
                        <button key={d}
                          onClick={(e) => { e.stopPropagation(); update({ duration: d }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${duration === d ? 'bg-sky-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">输出比例</label>
                    <div className="flex gap-1">
                      {([['16:9', '16:9', '1536×1024'], ['9:16', '9:16', '1024×1536'], ['1:1', '1:1', '1024×1024']] as const).map(([val, label, res]) => (
                        <button key={val}
                          onClick={(e) => { e.stopPropagation(); update({ ratio: val }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all flex flex-col items-center ${ratio === val ? 'bg-sky-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                          <span>{label}</span>
                          <span className={`text-[8px] ${ratio === val ? 'text-sky-200' : 'text-gray-600'}`}>{res}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 图片输出 */}
            {showImageOutput && generatedImage && (
              <div
                className="rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(100,100,100,0.1) 100%)',
                  border: '1px solid rgba(192,192,192,0.3)',
                }}
              >
                <div className="relative group">
                  <img
                    src={generatedImage}
                    alt="分镜脚本"
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
                      onClick={(e) => { e.stopPropagation(); update({ generatedImage: '', showImageOutput: false }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">生成成功</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 输出端口 - Right */}
        <div className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ right: '-6px', zIndex: 101, pointerEvents: 'all' }}
          data-port-type="output" data-node-id={shape.id}
          onMouseDown={handleOutputPortDown} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)', pointerEvents: 'none' }} />
        </div>

        {/* 输入端口 - Left */}
        <div className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ left: '-6px', zIndex: 101, pointerEvents: 'all' }}
          data-port-type="input" data-node-id={shape.id}
          onMouseDown={handleInputPortDown} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)', pointerEvents: 'none' }} />
        </div>

        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-visible">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-sky-400 flex-shrink-0"></div>
              <span className="text-white text-sm font-semibold truncate">GEM 导演引擎 · Step 3-Solo</span>
              {!isMinimized && <span className="text-gray-500 text-xs flex-shrink-0">单图运动</span>}
            </div>
            <div className="flex items-center gap-1">
              {/* 折叠按钮 */}
              {!isMinimized && (
                <button
                  onClick={(e) => { e.stopPropagation(); update({ isCollapsed: !isCollapsed, w: isCollapsed ? 380 : 150, h: isCollapsed ? 520 : 80 }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs"
                  title={isCollapsed ? '展开' : '折叠'}
                >{isCollapsed ? '▼' : '▲'}</button>
              )}
              <button onClick={toggleMinimize} onPointerDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm">
                {isMinimized ? '+' : '−'}
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="flex-1 flex flex-col overflow-visible p-3 gap-2" style={{ display: isCollapsed ? 'none' : undefined }}>

              {/* 模式选择 */}
              <div className="flex gap-1 flex-shrink-0">
                {([['single', '单图'], ['2x2', '4宫格'], ['3x3', '9宫格']] as const).map(([val, label]) => (
                  <button key={val}
                    onClick={(e) => { e.stopPropagation(); setInputType(val); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-medium transition-all ${inputType === val ? 'bg-sky-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* 展开参数设置按钮 */}
              <button
                className="flex-shrink-0 w-full py-1.5 rounded-lg text-[10px] font-medium transition-all bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300"
                onClick={(e) => { e.stopPropagation(); update({ showSettingsPanel: !showSettingsPanel }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showSettingsPanel ? '收起参数设置 ▲' : `展开参数设置 ▼  ${duration}s · ${ratio || '16:9'}`}
              </button>

              {/* 图片上传区 */}
              {inputType === 'single' ? (
                <div className="flex-shrink-0 flex gap-1.5">
                  {/* 图1：人物三视角 */}
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-gray-400 mb-1 block">人物三视角</span>
                    <label
                      className="relative flex items-center justify-center w-full rounded-lg overflow-hidden border border-dashed cursor-pointer transition-all bg-black/20"
                      style={{ aspectRatio: '1/1', borderColor: 'rgba(255,255,255,0.15)' }}
                      onPointerDown={(e) => e.stopPropagation()}>
                      {displayImage ? (
                        <>
                          <img src={displayImage} alt="人物三视角" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px]">更换</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-600 text-[9px] text-center px-1">上传人物三视角</span>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => loadImage(e, 1)} onClick={(e) => e.stopPropagation()} />
                    </label>
                  </div>
                  {/* 图2：剧情首帧 */}
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-gray-400 mb-1 block">剧情首帧</span>
                    <label
                      className="relative flex items-center justify-center w-full rounded-lg overflow-hidden border border-dashed cursor-pointer transition-all bg-black/20"
                      style={{ aspectRatio: '1/1', borderColor: image2 ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.15)' }}
                      onPointerDown={(e) => e.stopPropagation()}>
                      {image2 ? (
                        <>
                          <img src={image2} alt="剧情首帧" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px]">更换</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-600 text-[9px] text-center px-1">上传剧情首帧</span>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => loadImage(e, 2)} onClick={(e) => e.stopPropagation()} />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex-shrink-0">
                  <span className="text-[10px] text-gray-400 mb-1 block">
                    分镜图{connectedImage && <span className="text-sky-400 ml-1">·来自连接</span>}
                  </span>
                  <label
                    className="relative flex items-center justify-center w-full rounded-lg overflow-hidden border border-dashed cursor-pointer transition-all bg-black/20"
                    style={{ aspectRatio: '16/9', borderColor: connectedImage ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.15)' }}
                    onPointerDown={(e) => e.stopPropagation()}>
                    {displayImage ? (
                      <>
                        <img src={displayImage} alt="input" className="w-full h-full object-cover" />
                        {!connectedImage && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px]">更换</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-600 text-[10px]">上传分镜图或连接图片卡片</span>
                    )}
                    {!connectedImage && <input type="file" accept="image/*" className="hidden" onChange={(e) => loadImage(e, 1)} onClick={(e) => e.stopPropagation()} />}
                  </label>
                </div>
              )}

              {/* 剧情引导 */}
              <div className="flex-shrink-0">
                <label className="text-[10px] text-gray-400 mb-1 block">
                  {inputType === 'single' ? '剧情引导（可选）' : '剧情说明（可选）'}
                </label>
                <input
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder={inputType === 'single' ? '例如：他很害怕然后逃跑...' : '例如：一个武士在雨中决斗...'}
                  value={actionSuggestion}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ actionSuggestion: e.target.value })}
                />
              </div>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !displayImage || (inputType === 'single' && !image2)}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !displayImage
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg'
                }`}>
                {isGenerating ? '生成中...' : '生成分镜脚本'}
              </button>

              {/* 进度条（所有模式） */}
              {isGenerating && (
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400">生成中...</span>
                    <span className="text-[10px] text-gray-300">{generationProgress || 0}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                    <div className="bg-sky-400 h-1 rounded-full transition-all duration-1000"
                      style={{ width: `${generationProgress || 0}%` }} />
                  </div>
                </div>
              )}

              {/* 图片输出按钮 */}
              {generatedImage && (
                <button
                  className="flex-shrink-0 w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600"
                  onClick={(e) => { e.stopPropagation(); update({ showImageOutput: !showImageOutput }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {showImageOutput ? '隐藏图片' : '查看生成图片'}
                </button>
              )}

            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: GemStep4CardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
