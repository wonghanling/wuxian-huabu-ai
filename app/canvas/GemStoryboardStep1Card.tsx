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

const DEFAULT_SYSTEM_INSTRUCTION = `You are a high-precision visual feature extraction engine.

Your task is to analyze multiple uploaded reference images and produce ONE unified visual profile for downstream storyboard generation.

This is NOT a storytelling task.
This is NOT a storyboard task.
This is a visual consolidation task.

━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (STRICT JSON ONLY)
━━━━━━━━━━━━━━━━━━━

{
  "visual_tags": {
    "character": "",
    "outfit": "",
    "cybernetic_parts": "",
    "monster": "",
    "environment": "",
    "style_tags": []
  },
  "visual_bible": ""
}

━━━━━━━━━━━━━━━━━━━
CORE OBJECTIVE
━━━━━━━━━━━━━━━━━━━

You must merge all uploaded images into ONE consistent visual profile.

The goal is to preserve the most stable and reusable visual traits across multiple reference images.

━━━━━━━━━━━━━━━━━━━
MULTI-IMAGE FUSION RULES
━━━━━━━━━━━━━━━━━━━

1. CONSISTENCY PRIORITY
- Keep ONLY features that appear consistently across multiple images
- Ignore any detail that appears in only one image
- Focus on dominant and repeated visual traits

2. CONFLICT RESOLUTION
- If images conflict, choose the MOST COMMON visual pattern
- If no clear majority exists, simplify instead of guessing

3. NOISE REDUCTION
- Ignore minor variations caused by angle, pose, crop, lighting, or background clutter
- Ignore accidental or non-essential details unless visually dominant

4. NO HALLUCINATION
- Do NOT invent missing details
- If something is unclear, leave it minimal

━━━━━━━━━━━━━━━━━━━
FIELD DEFINITIONS
━━━━━━━━━━━━━━━━━━━

visual_tags.character
- Core identity traits of the main character
- Include gender presentation, hair, face shape, body type
- Use short keyword phrases only

visual_tags.outfit
- Clothing, armor, materials, silhouette
- Keep only stable recurring outfit traits

visual_tags.cybernetic_parts
- Mechanical limbs, implants, glowing tech structures
- If none, return ""

visual_tags.monster
- Creature type, skeletal structure, iconic traits
- If none, return ""

visual_tags.environment
- Dominant setting and lighting atmosphere
- Example: desert, ruins, sunset, heat haze

visual_tags.style_tags
- 3 to 6 concise style tags only

━━━━━━━━━━━━━━━━━━━
VISUAL_BIBLE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━

The field "visual_bible" must be a concise but rich cinematic anchor paragraph in English.
- 80 to 180 English words
- One paragraph only
- Do NOT write plot
- Do NOT write storyboard instructions
- Do NOT mention camera shots

━━━━━━━━━━━━━━━━━━━
STRICT OUTPUT RULES
━━━━━━━━━━━━━━━━━━━

- English ONLY
- JSON ONLY
- No markdown
- No explanations
- No extra keys
- style_tags must contain 3 to 6 items
- visual_bible must be plain English prose

Output ONLY the JSON object. No text before or after.`;

export type GemStep1CardShape = TLBaseShape<
  'gem-step1-card',
  {
    w: number;
    h: number;
    systemInstruction: string;
    result: string;
    isGenerating: boolean;
    isMinimized: boolean;
    showInstruction: boolean;
  }
>;

// @ts-expect-error
export class GemStep1CardUtil extends BaseBoxShapeUtil<GemStep1CardShape> {
  static override type = 'gem-step1-card' as const;

  static override props: RecordProps<GemStep1CardShape> = {
    w: T.number,
    h: T.number,
    systemInstruction: T.string,
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    showInstruction: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): GemStep1CardShape['props'] {
    return {
      w: 400,
      h: 520,
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      result: '',
      isGenerating: false,
      isMinimized: false,
      showInstruction: false,
    };
  }

  override getGeometry(shape: GemStep1CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep1CardShape) {
    const { w, h, systemInstruction, result, isGenerating, isMinimized, showInstruction } = shape.props;
    const editor = useEditor();
    const [images, setImages] = useState<string[]>([]);
    const [copied, setCopied] = useState(false);

    const update = (props: Partial<GemStep1CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step1-card' as any, props: { ...shape.props, ...props } });
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const remaining = 10 - images.length;
      const toProcess = files.slice(0, remaining);

      toProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImages(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const removeImage = (idx: number) => {
      setImages(prev => prev.filter((_, i) => i !== idx));
    };

    const analyze = async () => {
      if (images.length === 0) { alert('请先上传图片'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/analyze-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images, systemInstruction }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.result, isGenerating: false });
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

              {/* 图片上传区 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">参考图片 ({images.length}/10)</span>
                  {images.length < 10 && (
                    <label
                      className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer transition-colors"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      + 添加
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                  )}
                </div>

                {images.length === 0 ? (
                  <label className="flex flex-col items-center justify-center w-full h-20 border border-dashed border-white/15 rounded-xl cursor-pointer hover:border-purple-400/40 hover:bg-purple-400/5 transition-all" onPointerDown={(e) => e.stopPropagation()}>
                    <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-500 text-xs">上传 5-10 张参考图</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} onClick={(e) => e.stopPropagation()} />
                  </label>
                ) : (
                  <div className="grid grid-cols-5 gap-1">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-black/30 group">
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
                disabled={isGenerating || images.length === 0}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || images.length === 0
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '分析中...' : '分析图片'}
              </button>

              {/* 结果输出 */}
              {result && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-1 flex-shrink-0">
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
