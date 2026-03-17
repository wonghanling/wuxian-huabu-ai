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

const DEFAULT_SYSTEM_INSTRUCTION = `You are Creative Visualization Script Assistant - Concise Storyboard Mode.

Your task is to generate a NanoBananaPro-ready 5x5 storyboard JSON from a Chinese script and a pre-extracted visual profile.

This is NOT an image analysis task.
Do NOT analyze reference images.
Do NOT extract style tags from images again.
Use ONLY the provided visual_tags and visual_bible as the visual source of truth.

━━━━━━━━━━━━━━━━━━━
INPUT
━━━━━━━━━━━━━━━━━━━

You will receive:

1. A Chinese script
2. visual_tags JSON
3. visual_bible text

The provided visual profile is the ONLY visual reference for the storyboard.

━━━━━━━━━━━━━━━━━━━
CORE GOAL
━━━━━━━━━━━━━━━━━━━

Generate a 5x5 storyboard JSON for NanoBananaPro.

Requirements:
- EXACTLY 25 shots
- Each shot is an independent visual moment
- Prompts must be concise, cinematic, and optimized for image generation
- Prompts must preserve character consistency, monster consistency, environment consistency, and style consistency

━━━━━━━━━━━━━━━━━━━
PRIMARY RESPONSIBILITIES
━━━━━━━━━━━━━━━━━━━

1. Split the script into EXACTLY 25 key visual moments
2. Maintain narrative progression from opening to ending
3. Convert each moment into a concise keyword-based English prompt
4. Reuse the provided visual profile consistently in all shots
5. Keep prompt structure highly compressed and generation-friendly

━━━━━━━━━━━━━━━━━━━
VISUAL CONSISTENCY RULES
━━━━━━━━━━━━━━━━━━━

- Always follow visual_tags and visual_bible strictly
- Maintain the same main character identity across all relevant shots
- Maintain the same monster identity across all relevant shots
- Maintain the same environment and style language across the storyboard
- Do NOT introduce new visual elements that conflict with the visual profile
- If the script is vague, stay consistent with visual_bible instead of inventing unrelated details
- Always incorporate key visual details from visual_bible into every shot prompt
- Prioritize visual_bible over script when conflicts occur

━━━━━━━━━━━━━━━━━━━
PROMPT WRITING FORMULA
━━━━━━━━━━━━━━━━━━━

Each prompt should follow this compressed structure:

[Shot Type] + [Subject and Action] + [Environment] + [Key Visual Traits] + [Style Tags] + [Constraint]

- Shot Type: Extreme Wide Shot / Medium Shot / Close-up / Over-shoulder Shot / POV Shot / Hero Shot / Dynamic Action Shot
- Every prompt_text MUST include: "no timecode, no subtitles"
- Each prompt_text must be 20 to 30 English words

━━━━━━━━━━━━━━━━━━━
FORBIDDEN
━━━━━━━━━━━━━━━━━━━

- No markdown
- No explanations
- No storytelling outside JSON
- No extra keys
- No Chinese in output

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━

{
  "image_generation_model": "NanoBananaPro",
  "grid_layout": "5x5",
  "grid_aspect_ratio": "16:9",
  "global_watermark": {
    "position": "bottom_center",
    "size": "extremely small"
  },
  "shots": [
    {
      "shot_number": "1",
      "prompt_text": ""
    }
  ]
}

Output EXACTLY 25 shot objects. Output ONLY valid JSON. No text before or after JSON.`;

export type GemStep2CardShape = TLBaseShape<
  'gem-step2-card',
  {
    w: number;
    h: number;
    systemInstruction: string;
    visualProfile: string;
    script: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
    showInstruction: boolean;
  }
>;

// @ts-expect-error
export class GemStep2CardUtil extends BaseBoxShapeUtil<GemStep2CardShape> {
  static override type = 'gem-step2-card' as const;

  static override props: RecordProps<GemStep2CardShape> = {
    w: T.number,
    h: T.number,
    systemInstruction: T.string,
    visualProfile: T.string,
    script: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    showInstruction: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep2CardShape['props'] {
    return {
      w: 400,
      h: 560,
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      visualProfile: '',
      script: '',
      result: '',
      isGenerating: false,
      isMinimized: false,
      showInstruction: false,
    };
  }

  override getGeometry(shape: GemStep2CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep2CardShape) {
    const { w, h, systemInstruction, visualProfile, script, result, isGenerating, isMinimized, showInstruction } = shape.props;
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
          body: JSON.stringify({ visualProfile, script, systemInstruction }),
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
      update({ isMinimized: !isMinimized, w: isMinimized ? 400 : 160, h: isMinimized ? 560 : 60 });
    };

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

          {isMinimized ? null : (
            <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
              {/* 系统指令（可折叠） */}
              <div className="flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); update({ showInstruction: !showInstruction }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-white/5 hover:bg-white/8 rounded-lg text-xs text-gray-400 transition-all"
                >
                  <span>系统指令</span>
                  <svg className={`w-3 h-3 transition-transform ${showInstruction ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showInstruction && (
                  <textarea
                    className="w-full mt-1 h-32 bg-black/40 border border-white/8 rounded-lg p-2 text-gray-300 text-[10px] resize-none focus:outline-none focus:border-white/20 font-mono"
                    value={systemInstruction}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => update({ systemInstruction: e.target.value })}
                  />
                )}
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
                  placeholder='粘贴 Step 1 输出的 JSON...'
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
                {isGenerating ? '生成中...' : '生成 25 格分镜'}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
                    <span className="text-xs text-gray-400">分镜 JSON (25 shots)</span>
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
