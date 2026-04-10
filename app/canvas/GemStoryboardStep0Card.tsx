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

export type GemStep0CardShape = TLBaseShape<
  'gem-step0-card',
  {
    w: number;
    h: number;
    story: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
  }
>;

// @ts-expect-error
export class GemStep0CardUtil extends BaseBoxShapeUtil<GemStep0CardShape> {
  static override type = 'gem-step0-card' as const;

  static override props: RecordProps<GemStep0CardShape> = {
    w: T.number,
    h: T.number,
    story: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep0CardShape['props'] {
    return {
      w: 400,
      h: 520,
      story: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep0CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep0CardShape) {
    const { w, h, story, result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [copied, setCopied] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyBeat = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

    const update = (props: Partial<GemStep0CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step0-card' as any, props: { ...shape.props, ...props } });
    };

    const generate = async () => {
      if (!story.trim()) { alert('请输入故事文本（最多800字）'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-beats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ story }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        const resultText = typeof data.result === 'string'
          ? data.result
          : JSON.stringify(data.result, null, 2);
        update({ result: resultText, isGenerating: false });
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

    // 解析 beats 用于展示
    let beats: Array<{ beat_type: string; content: string }> = [];
    try {
      const parsed = JSON.parse(result);
      beats = parsed.narrative_beats ?? [];
    } catch { /* raw text fallback */ }

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-400"></div>
              <span className="text-white text-sm font-semibold">GEM 分镜 · Step 0</span>
              <span className="text-gray-500 text-xs">剧情分段</span>
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

              {/* 故事输入 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">故事文本（最多800字）</label>
                  <button
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await navigator.clipboard.readText();
                      if (text) update({ story: text });
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >粘贴</button>
                </div>
                <textarea
                  className="w-full h-36 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder="输入中文故事或小说片段..."
                  value={story}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => update({ story: e.target.value })}
                />
                <div className="text-right text-[10px] text-gray-600 mt-0.5">{story.length} / 800</div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !story.trim()}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !story.trim()
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '分析中...' : '生成剧情分段'}
              </button>

              {/* 结果：beats 列表 */}
              {beats.length > 0 && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">叙事段落（{beats.length} 段）</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyResult(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      {copied ? '已复制 ✓' : '复制 JSON'}
                    </button>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto min-h-0">
                    {beats.map((beat, i) => (
                      <div
                        key={i}
                        className="bg-black/30 border border-white/8 rounded-lg p-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">
                            {beat.beat_type}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyBeat(beat.content, i); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors px-1.5 py-0.5 rounded hover:bg-purple-900/20"
                          >
                            {copiedIndex === i ? '已复制 ✓' : '复制'}
                          </button>
                        </div>
                        <p className="text-gray-300 text-[11px] leading-relaxed">{beat.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* raw fallback */}
              {result && beats.length === 0 && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">原始输出</span>
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
                </div>
              )}
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: GemStep0CardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
