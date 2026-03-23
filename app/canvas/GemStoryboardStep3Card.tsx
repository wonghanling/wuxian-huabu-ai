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

export type GemStep3CardShape = TLBaseShape<
  'gem-step3-card',
  {
    w: number;
    h: number;
    characterHint: string;
    actionSuggestion: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
    // legacy compat
    storyboard?: string;
  }
>;

// @ts-expect-error
export class GemStep3CardUtil extends BaseBoxShapeUtil<GemStep3CardShape> {
  static override type = 'gem-step3-card' as const;

  static override props: RecordProps<GemStep3CardShape> = {
    w: T.number,
    h: T.number,
    characterHint: T.string,
    actionSuggestion: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    storyboard: T.string.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep3CardShape['props'] {
    return {
      w: 420,
      h: 600,
      characterHint: '',
      actionSuggestion: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep3CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep3CardShape) {
    const { w, h, characterHint, actionSuggestion, result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [startImage, setStartImage] = useState<string>('');
    const [endImage, setEndImage] = useState<string>('');
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);
    const [actionError, setActionError] = useState('');

    const BLOCKED_KEYWORDS = ['camera', 'zoom', 'pan', 'follow', 'shot', 'scene', '镜头', '特写', '远景', '拉近', '推进', '跟拍', '运镜', '背景', '爆炸', '烟雾', '加一个', '出现一个'];

    const validateAction = (val: string): boolean => {
      const lower = val.toLowerCase();
      return BLOCKED_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
    };

    const update = (props: Partial<GemStep3CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step3-card' as any, props: { ...shape.props, ...props } });
    };

    const loadImage = (setter: (s: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const compressed = await compressImage(ev.target?.result as string);
        setter(compressed);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const generate = async () => {
      if (!startImage || !endImage) { alert('请上传起始图和结束图'); return; }
      if (actionSuggestion && validateAction(actionSuggestion)) {
        setActionError('只能填写人物动作，不能包含镜头、场景或特效');
        return;
      }
      setActionError('');
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-transitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startImage, endImage, characterHint, actionSuggestion }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.result, isGenerating: false });
      } catch (err: any) {
        alert('生成失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 420 : 160, h: isMinimized ? 600 : 60 });
    };

    // 解析结果
    let parsed: any = null;
    try { parsed = result ? JSON.parse(result) : null; } catch {}

    const finalPrompt = parsed?.final_video_prompt ?? '';

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-white text-sm font-semibold">GEM 导演引擎 · Step 3</span>
              <span className="text-gray-500 text-xs">图片驱动</span>
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
              <div className="flex gap-2 flex-shrink-0">
                {/* Start Image */}
                <div className="flex-1">
                  <span className="text-[10px] text-gray-400 mb-1 block">Start Image</span>
                  <label
                    className="relative flex items-center justify-center w-full aspect-video rounded-lg overflow-hidden border border-dashed border-white/15 cursor-pointer hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all bg-black/20"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {startImage ? (
                      <>
                        <img src={startImage} alt="start" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="text-white text-[10px]">更换</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-600 text-[10px]">上传图A</span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={loadImage(setStartImage)} onClick={(e) => e.stopPropagation()} />
                  </label>
                </div>

                {/* End Image */}
                <div className="flex-1">
                  <span className="text-[10px] text-gray-400 mb-1 block">End Image</span>
                  <label
                    className="relative flex items-center justify-center w-full aspect-video rounded-lg overflow-hidden border border-dashed border-white/15 cursor-pointer hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all bg-black/20"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {endImage ? (
                      <>
                        <img src={endImage} alt="end" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-all">
                          <span className="text-white text-[10px]">更换</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-600 text-[10px]">上传图B</span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={loadImage(setEndImage)} onClick={(e) => e.stopPropagation()} />
                  </label>
                </div>
              </div>

              {/* Character Hint 输入 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-400">Character Hint（可选，来自 Step 1）</label>
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

              {/* Action Suggestion 输入 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-400">人物动作建议（可选）</label>
                </div>
                <input
                  className={`w-full bg-black/30 border ${actionError ? 'border-red-500/50' : 'border-white/8'} rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600`}
                  placeholder="例如：慢慢走、转头、抬手、滑下去（只填写人物动作）"
                  value={actionSuggestion}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    update({ actionSuggestion: e.target.value });
                    if (actionError) setActionError('');
                  }}
                />
                {actionError && <span className="text-[9px] text-red-400 mt-0.5 block">{actionError}</span>}
              </div>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !startImage || !endImage}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !startImage || !endImage
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '分析中...' : '生成过渡指令'}
              </button>

              {/* 结果输出 */}
              {parsed && (
                <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-y-auto">

                  {/* 关键字段 */}
                  <div className="flex-shrink-0 grid grid-cols-2 gap-1.5">
                    <div className="bg-black/30 border border-white/8 rounded-lg p-2">
                      <span className="text-[9px] text-gray-500 block mb-0.5">transition_type</span>
                      <span className={`text-xs font-semibold ${parsed.transition_type === 'morph_action' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {parsed.transition_type}
                      </span>
                    </div>
                    <div className="bg-black/30 border border-white/8 rounded-lg p-2">
                      <span className="text-[9px] text-gray-500 block mb-0.5">duration</span>
                      <span className="text-xs font-semibold text-blue-400">{parsed.duration_control}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 bg-black/30 border border-white/8 rounded-lg p-2">
                    <span className="text-[9px] text-gray-500 block mb-0.5">motion_intent</span>
                    <span className="text-[10px] text-gray-300">{parsed.motion_intent}</span>
                  </div>

                  {/* Final Video Prompt */}
                  <div className="flex-shrink-0 bg-black/40 border border-emerald-500/20 rounded-xl p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-emerald-400 font-semibold">Final Video Prompt</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(finalPrompt);
                          setCopiedPrompt(true);
                          setTimeout(() => setCopiedPrompt(false), 2000);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        {copiedPrompt ? '已复制 ✓' : '复制'}
                      </button>
                    </div>
                    <p className="text-gray-300 text-[10px] leading-relaxed whitespace-pre-wrap">{finalPrompt}</p>
                  </div>

                  {/* 完整 JSON */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-500">完整 JSON</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(result);
                          setCopiedJson(true);
                          setTimeout(() => setCopiedJson(false), 2000);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {copiedJson ? '已复制 ✓' : '复制'}
                      </button>
                    </div>
                    <div className="bg-black/30 border border-white/8 rounded-lg p-2 max-h-24 overflow-y-auto">
                      <pre className="text-gray-500 text-[9px] font-mono whitespace-pre-wrap break-all">{result}</pre>
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

  indicator(shape: GemStep3CardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
