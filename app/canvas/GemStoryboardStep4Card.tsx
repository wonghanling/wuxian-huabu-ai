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
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep4CardShape['props'] {
    return {
      w: 380,
      h: 480,
      characterHint: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep4CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep4CardShape) {
    const { w, h, characterHint, result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [image, setImage] = useState<string>('');
    const [copied, setCopied] = useState(false);

    const update = (props: Partial<GemStep4CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step4-card' as any, props: { ...shape.props, ...props } });
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
      if (!image) { alert('请上传图片'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-solo-motion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, characterHint }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.final_video_prompt, isGenerating: false });
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
                <span className="text-[10px] text-gray-400 mb-1 block">Image</span>
                <label
                  className="relative flex items-center justify-center w-full rounded-lg overflow-hidden border border-dashed border-white/15 cursor-pointer hover:border-sky-400/40 hover:bg-sky-400/5 transition-all bg-black/20"
                  style={{ aspectRatio: '16/9' }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {image ? (
                    <>
                      <img src={image} alt="input" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="text-white text-[10px]">更换</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-600 text-[10px]">上传图片</span>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={loadImage} onClick={(e) => e.stopPropagation()} />
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

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !image}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !image
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-sky-700 hover:bg-sky-600 text-white shadow-lg'
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
