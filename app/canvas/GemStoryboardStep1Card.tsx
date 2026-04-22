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

export type GemStep1CardShape = TLBaseShape<
  'gem-step1-card',
  {
    w: number;
    h: number;
    result: string;
    characterHint?: string;
    isGenerating: boolean;
    isExtractingHint?: boolean;
    isMinimized: boolean;
    showInstruction?: boolean;
    systemInstruction?: string;
  }
>;

// @ts-expect-error
export class GemStep1CardUtil extends BaseBoxShapeUtil<GemStep1CardShape> {
  static override type = 'gem-step1-card' as const;

  static override props: RecordProps<GemStep1CardShape> = {
    w: T.number,
    h: T.number,
    result: T.string,
    characterHint: T.string.optional(),
    isGenerating: T.boolean,
    isExtractingHint: T.boolean.optional(),
    isMinimized: T.boolean,
    showInstruction: T.boolean.optional(),
    systemInstruction: T.string.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): GemStep1CardShape['props'] {
    return {
      w: 400,
      h: 480,
      result: '',
      characterHint: '',
      isGenerating: false,
      isExtractingHint: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep1CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep1CardShape) {
    const { w, h, result, characterHint = '', isGenerating, isExtractingHint = false, isMinimized } = shape.props;
    const editor = useEditor();
    const [images, setImages] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);
    const [copiedHint, setCopiedHint] = useState(false);

    const update = (props: Partial<GemStep1CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step1-card' as any, props: { ...shape.props, ...props } });
    };

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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const remaining = 10 - images.length;
      files.slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const maxSide = 1500;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d')!.drawImage(img, 0, 0, w, h);
            setImages(prev => [...prev, c.toDataURL('image/jpeg', 0.85)]);
          };
          img.onerror = () => setImages(prev => [...prev, dataUrl]);
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

    // 实时读取连接的图片卡片的图片
    const getConnectedImages = (): string[] => {
      const connectedImages: string[] = [];
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const srcShape = editor.getShape((cb as any).toId) as any;
          if (!srcShape) continue;
          if (srcShape.type === 'custom-card' && srcShape.props?.generatedImage) connectedImages.push(srcShape.props.generatedImage);
          else if (srcShape.type === 'media-upload-card' && srcShape.props?.mediaType === 'image' && srcShape.props?.imageData) connectedImages.push(srcShape.props.imageData);
        }
      }
      return connectedImages;
    };

    const connectedImages = getConnectedImages();
    const allDisplayImages = [...connectedImages, ...images];

    const analyze = async () => {
      const connectedImages = getConnectedImages();
      const allImages = [...connectedImages, ...images];
      if (allImages.length === 0) { alert('请先上传图片或连接图片卡片'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/analyze-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: allImages }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.result, isGenerating: false });

        // 自动填充连接的 Step2 卡片
        const outBindings = editor.getBindingsFromShape(shape.id, 'connection');
        for (const binding of outBindings) {
          if ((binding as any).props?.terminal !== 'start') continue;
          const connBindings2 = editor.getBindingsFromShape(binding.fromId, 'connection');
          for (const ob of connBindings2) {
            if ((ob as any).props?.terminal !== 'end') continue;
            const targetShape = editor.getShape((ob as any).toId) as any;
            if (!targetShape || targetShape.type !== 'gem-step2-card') continue;
            editor.updateShape({
              id: (ob as any).toId,
              type: 'gem-step2-card' as any,
              props: { ...targetShape.props, visualProfile: data.result },
            });
          }
        }
      } catch (err: any) {
        alert('分析失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const copyResult = () => {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const extractHint = async () => {
      if (!result.trim()) { alert('请先分析图片获取视觉档案'); return; }
      update({ isExtractingHint: true });
      try {
        const res = await fetch('/api/gem/extract-character-hint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visualJson: result }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ characterHint: data.hint, isExtractingHint: false });
      } catch (err: any) {
        alert('提取失败: ' + err.message);
        update({ isExtractingHint: false });
      }
    };

    const copyHint = () => {
      navigator.clipboard.writeText(characterHint);
      setCopiedHint(true);
      setTimeout(() => setCopiedHint(false), 2000);
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 400 : 160, h: isMinimized ? 480 : 60 });
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

        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span className="text-white text-sm font-semibold">GEM 分镜 · Step 1</span>
              <span className="text-gray-500 text-xs">视觉提取</span>
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
              {/* 图片上传区 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">参考图片 ({allDisplayImages.length}/10){connectedImages.length > 0 && <span className="text-purple-400 ml-1">({connectedImages.length}张来自连接)</span>}</span>
                  {images.length < 10 && allDisplayImages.length > 0 && (
                    <label className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer transition-colors" onPointerDown={(e) => e.stopPropagation()}>
                      + 添加
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} onClick={(e) => e.stopPropagation()} />
                    </label>
                  )}
                </div>

                {allDisplayImages.length === 0 ? (
                  <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-white/15 rounded-xl cursor-pointer hover:border-purple-400/40 hover:bg-purple-400/5 transition-all" onPointerDown={(e) => e.stopPropagation()}>
                    <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-500 text-xs">上传 5-10 张参考图，或连接图片卡片</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} onClick={(e) => e.stopPropagation()} />
                  </label>
                ) : (
                  <div className="grid grid-cols-5 gap-1">
                    {connectedImages.map((img, idx) => (
                      <div key={`conn-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-black/30 group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-purple-600/60 text-white text-[8px] text-center py-0.5">连接</div>
                      </div>
                    ))}
                    {images.map((img, idx) => (
                      <div key={`upload-${idx}`} className="relative aspect-square rounded-lg overflow-hidden bg-black/30 group">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-lg transition-all"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 分析按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); analyze(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || allDisplayImages.length === 0}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || allDisplayImages.length === 0
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '分析中...' : '分析图片'}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0 gap-2">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <span className="text-xs text-gray-400">视觉档案 JSON</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyResult(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {copied ? '已复制 ✓' : '复制'}
                    </button>
                  </div>
                  <div className="flex-1 bg-black/40 border border-white/8 rounded-xl p-2 overflow-y-auto min-h-0">
                    <pre className="text-gray-300 text-[10px] font-mono whitespace-pre-wrap break-all">{result}</pre>
                  </div>

                  {/* 提取 Character Hint 按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); extractHint(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={isExtractingHint}
                    className={`flex-shrink-0 w-full py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isExtractingHint
                        ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-900/60 hover:bg-purple-800/60 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {isExtractingHint ? '提取中...' : 'Extract Character Hint'}
                  </button>

                  {/* Hint 输出 */}
                  {characterHint && (
                    <div className="flex-shrink-0 bg-black/30 border border-purple-500/20 rounded-xl p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-purple-400">Character Hint</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyHint(); }}
                          onPointerDown={(e) => e.stopPropagation()}
                          className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {copiedHint ? '已复制 ✓' : '复制'}
                        </button>
                      </div>
                      <p className="text-gray-300 text-[10px] leading-relaxed">{characterHint}</p>
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

  indicator(shape: GemStep1CardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
