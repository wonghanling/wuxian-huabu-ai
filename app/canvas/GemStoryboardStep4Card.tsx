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
    characterHint: string;
    actionSuggestion: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
  }
>;

// @ts-expect-error
export class GemStep4CardUtil extends BaseBoxShapeUtil<GemStep4CardShape> {
  static override type = 'gem-step4-card' as const;

  static override props: RecordProps<GemStep4CardShape> = {
    w: T.number,
    h: T.number,
    characterHint: T.string,
    actionSuggestion: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): GemStep4CardShape['props'] {
    return {
      w: 380,
      h: 480,
      characterHint: '',
      actionSuggestion: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep4CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep4CardShape) {
    const { w, h, characterHint, actionSuggestion, result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [image, setImage] = useState<string>('');
    const [copied, setCopied] = useState(false);

    const update = (props: Partial<GemStep4CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...shape.props, ...props } });
    };

    // 实时读取连接的上游图片卡片（1张）
    const getConnectedImage = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (!src) continue;
          if (src.type === 'custom-card' && src.props?.generatedImage) return src.props.generatedImage;
          if (src.type === 'media-upload-card' && src.props?.mediaType === 'image' && src.props?.imageData) return src.props.imageData;
        }
      }
      return '';
    };

    const connectedImage = getConnectedImage();
    const displayImage = connectedImage || image;

    // 生成完后推送 result 到连接的下游视频卡片
    const pushResultToDownstream = (resultText: string) => {
      const outBindings = editor.getBindingsFromShape(shape.id, 'connection');
      for (const binding of outBindings) {
        if ((binding as any).props?.terminal !== 'start') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const ob of connBindings) {
          if ((ob as any).props?.terminal !== 'end') continue;
          const target = editor.getShape((ob as any).toId) as any;
          if (!target) continue;
          if (target.type === 'custom-card' && target.props?.cardType === 'video') {
            editor.updateShape({ id: (ob as any).toId, type: 'custom-card' as any, props: { ...target.props, prompt: resultText } });
          }
          if (target.type === 'seedance-card') {
            editor.updateShape({ id: (ob as any).toId, type: 'seedance-card' as any, props: { ...target.props, prompt: resultText } });
          }
        }
      }
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

    const loadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const compressed = await compressImage(ev.target?.result as string);
        setImage(compressed);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const generate = async () => {
      if (!displayImage) { alert('请上传或连接图片'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-solo-motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: displayImage, characterHint, actionSuggestion }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.final_video_prompt, isGenerating: false });
        pushResultToDownstream(data.final_video_prompt);
      } catch (err: any) {
        alert('生成失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 380 : 160, h: isMinimized ? 480 : 60 });
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
              <div className="w-2 h-2 rounded-full bg-sky-400"></div>
              <span className="text-white text-sm font-semibold">GEM 导演引擎 · Step 3-Solo</span>
              <span className="text-gray-500 text-xs">单图运动</span>
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
                <span className="text-[10px] text-gray-400 mb-1 block">
                  Image{connectedImage && <span className="text-sky-400 ml-1">·来自连接</span>}
                </span>
                <label
                  className="relative flex items-center justify-center w-full rounded-lg overflow-hidden border border-dashed cursor-pointer transition-all bg-black/20"
                  style={{ aspectRatio: '16/9', borderColor: connectedImage ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.15)' }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
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
                    <span className="text-gray-600 text-[10px]">上传图片或连接图片卡片</span>
                  )}
                  {!connectedImage && <input type="file" accept="image/*" className="hidden" onChange={loadImage} onClick={(e) => e.stopPropagation()} />}
                </label>
              </div>

              {/* Character Hint */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-400">Character Hint（可选）</label>
                  <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await navigator.clipboard.readText();
                      if (text) update({ characterHint: text });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >粘贴</button>
                </div>
                <input
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder="Character reference: silver-white hair, mechanical right arm..."
                  value={characterHint}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ characterHint: e.target.value })}
                />
              </div>

              {/* Action Suggestion */}
              <div className="flex-shrink-0">
                <label className="text-[10px] text-gray-400 mb-1 block">剧情引导（可选）</label>
                <input
                  className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder="例如：他很害怕然后逃跑、慢慢转身离开..."
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
                disabled={isGenerating || !displayImage}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !displayImage
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '分析中...' : '生成运动指令'}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 bg-black/40 border border-sky-500/20 rounded-xl p-2 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                      <span className="text-[10px] text-sky-400 font-semibold">Final Video Prompt</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(result);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-[10px] text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        {copied ? '已复制 ✓' : '复制'}
                      </button>
                    </div>
                    <p className="text-gray-300 text-[10px] leading-relaxed whitespace-pre-wrap overflow-y-auto">{result}</p>
                  </div>
                </div>
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
