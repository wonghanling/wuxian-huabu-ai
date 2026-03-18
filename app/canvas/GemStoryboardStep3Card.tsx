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

export type GemStep3CardShape = TLBaseShape<
  'gem-step3-card',
  {
    w: number;
    h: number;
    storyboard: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
  }
>;

// @ts-expect-error
export class GemStep3CardUtil extends BaseBoxShapeUtil<GemStep3CardShape> {
  static override type = 'gem-step3-card' as const;

  static override props: RecordProps<GemStep3CardShape> = {
    w: T.number,
    h: T.number,
    storyboard: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep3CardShape['props'] {
    return {
      w: 400,
      h: 520,
      storyboard: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep3CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep3CardShape) {
    const { w, h, storyboard, result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [copied, setCopied] = useState(false);

    const update = (props: Partial<GemStep3CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step3-card' as any, props: { ...shape.props, ...props } });
    };

    const generate = async () => {
      if (!storyboard.trim()) { alert('请粘贴 Step 2 的分镜 JSON'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-transitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyboard }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.result, isGenerating: false });
      } catch (err: any) {
        alert('生成失败: ' + err.message);
        update({ isGenerating: false });
      }
    };

    const copyResult = () => {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      update({ isMinimized: !isMinimized, w: isMinimized ? 400 : 160, h: isMinimized ? 520 : 60 });
    };

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="text-white text-sm font-semibold">GEM 导演引擎 · Step 3</span>
              <span className="text-gray-500 text-xs">过渡指令</span>
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

              {/* 分镜 JSON 输入 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Step 2 分镜 JSON</label>
                  <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await navigator.clipboard.readText();
                      if (text) update({ storyboard: text });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >粘贴</button>
                </div>
                <textarea
                  className="w-full h-48 bg-black/30 border border-white/8 rounded-lg p-2 text-gray-300 text-[10px] resize-none focus:outline-none focus:border-white/15 font-mono placeholder-gray-600"
                  placeholder='粘贴 Step 2 输出的分镜 JSON，例如 {"shots": [...]}...'
                  value={storyboard}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ storyboard: e.target.value })}
                />
              </div>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !storyboard.trim()}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !storyboard.trim()
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '生成过渡指令中...' : '生成过渡指令'}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">过渡指令 JSON</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyResult(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {copied ? '已复制 ✓' : '复制'}
                    </button>
                  </div>
                  <div className="flex-1 bg-black/40 border border-white/8 rounded-xl p-2 overflow-y-auto min-h-0">
                    <pre className="text-gray-300 text-[10px] font-mono whitespace-pre-wrap break-all">{result}</pre>
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
