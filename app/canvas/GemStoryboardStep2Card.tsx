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

type GridSize = '4' | '9' | '25';

const GRID_OPTIONS: { value: GridSize; label: string; desc: string }[] = [
  { value: '4',  label: '2×2', desc: '4格' },
  { value: '9',  label: '3×3', desc: '9格' },
  { value: '25', label: '5×5', desc: '25格' },
];

export type GemStep2CardShape = TLBaseShape<
  'gem-step2-card',
  {
    w: number;
    h: number;
    visualProfile: string;
    script: string;
    gridSize?: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
    showInstruction?: boolean;
    systemInstruction?: string;
  }
>;

// @ts-expect-error
export class GemStep2CardUtil extends BaseBoxShapeUtil<GemStep2CardShape> {
  static override type = 'gem-step2-card' as const;

  static override props: RecordProps<GemStep2CardShape> = {
    w: T.number,
    h: T.number,
    visualProfile: T.string,
    script: T.string,
    gridSize: T.string.optional(),
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    showInstruction: T.boolean.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep2CardShape['props'] {
    return {
      w: 400,
      h: 520,
      visualProfile: '',
      script: '',
      gridSize: '25',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep2CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep2CardShape) {
    const { w, h, visualProfile, script, gridSize = '25', result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [copied, setCopied] = useState(false);

    const update = (props: Partial<GemStep2CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step2-card' as any, props: { ...shape.props, ...props } });
    };

    const generate = async () => {
      if (!visualProfile.trim()) { alert('请粘贴 Step 1 的视觉档案 JSON'); return; }
      if (!script.trim()) { alert('请输入剧本/故事'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visualProfile, script, gridSize }),
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

    const selectedGrid = GRID_OPTIONS.find(o => o.value === gridSize) ?? GRID_OPTIONS[2];

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-white text-sm font-semibold">GEM 分镜 · Step 2</span>
              <span className="text-gray-500 text-xs">分镜生成</span>
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

              {/* 格数选择 */}
              <div className="flex-shrink-0">
                <span className="text-xs text-gray-400 mb-1.5 block">宫格数量</span>
                <div className="flex gap-2">
                  {GRID_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={(e) => { e.stopPropagation(); update({ gridSize: opt.value }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        gridSize === opt.value
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <div>{opt.label}</div>
                      <div className="text-[10px] opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 视觉档案输入 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Step 1 视觉档案 JSON</label>
                  <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await navigator.clipboard.readText();
                      if (text) update({ visualProfile: text });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >粘贴</button>
                </div>
                <textarea
                  className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-gray-300 text-[10px] resize-none focus:outline-none focus:border-white/15 font-mono placeholder-gray-600"
                  placeholder="粘贴 Step 1 输出的 JSON..."
                  value={visualProfile}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ visualProfile: e.target.value })}
                />
              </div>

              {/* 剧本输入 */}
              <div className="flex-shrink-0">
                <label className="text-xs text-gray-400 mb-1 block">剧本 / 故事</label>
                <textarea
                  className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder="输入中文剧本或故事内容..."
                  value={script}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ script: e.target.value })}
                />
              </div>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !visualProfile.trim() || !script.trim()}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !visualProfile.trim() || !script.trim()
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '生成中...' : `生成 ${selectedGrid.label} 分镜`}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">分镜 JSON ({selectedGrid.desc})</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyResult(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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

  indicator(shape: GemStep2CardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
