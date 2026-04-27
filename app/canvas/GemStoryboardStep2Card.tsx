import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  useEditor,
  Rectangle2d,
} from 'tldraw';
import { useState, useRef } from 'react';

type GridSize = '4' | '9' | '12' | '16' | '25';

const STORY_GRID_OPTIONS: { value: GridSize; label: string; desc: string }[] = [
  { value: '4',  label: '2×2', desc: '4格' },
  { value: '9',  label: '3×3', desc: '9格' },
  { value: '25', label: '5×5', desc: '25格' },
];

const CINEMATIC_GRID_OPTIONS: { value: GridSize; label: string; desc: string }[] = [
  { value: '4',  label: '2×2', desc: '4格' },
  { value: '9',  label: '3×3', desc: '9格' },
];

const STYLE_OPTIONS: { label: string; prompt: string }[] = [
  {
    label: '电影写实3D',
    prompt: '3D animation style, game cinematic, Unreal Engine lighting, realistic shadows, high detail, consistent character,',
  },
  {
    label: '超写实电影',
    prompt: 'cinematic film still, photorealistic, natural skin texture, global illumination, volumetric lighting, depth of field,',
  },
  {
    label: '游戏CG',
    prompt: 'AAA game cinematic, Unreal Engine 5 render, real-time rendering, cinematic lighting, epic atmosphere,',
  },
  {
    label: '动漫3D',
    prompt: 'anime 3D style, stylized character, clean face shading, soft lighting, anime cinematic,',
  },
  {
    label: '宫崎骏',
    prompt: 'Studio Ghibli style, hand-painted background, soft warm lighting, anime film look,',
  },
  {
    label: '新海诚',
    prompt: 'Makoto Shinkai style, ultra detailed sky, light bloom, emotional atmosphere,',
  },
  {
    label: '黑暗电影',
    prompt: 'dark cinematic, moody lighting, low key lighting, dramatic shadows, foggy atmosphere,',
  },
  {
    label: '武侠电影',
    prompt: 'ancient Chinese wuxia style, dusty atmosphere, wind movement, cinematic composition, epic tone,',
  },
  {
    label: '赛博朋克3D',
    prompt: 'cyberpunk, futuristic city, neon lights, holographic displays, 3D render, Unreal Engine 5, game cinematic, realistic lighting, realistic shadows, PBR materials, realistic textures, cinematic composition, depth of field, high detail, ultra detailed, not illustration, not painting, not anime, not 2D,',
  },
  {
    label: '赛博江湖',
    prompt: 'cyberpunk wuxia, futuristic ancient China, neon lanterns, glowing Chinese signs, traditional robe mixed with technology, cybernetic swordsman, energy blade, dark cinematic lighting, foggy atmosphere, Unreal Engine lighting, high detail, consistent character,',
  },
  {
    label: '迪士尼3D',
    prompt: 'Disney Pixar style, smooth skin, cartoon proportions, bright lighting,',
  },
  {
    label: '梦工厂',
    prompt: 'DreamWorks style, expressive face, stylized realism,',
  },
  {
    label: '卡通渲染',
    prompt: 'toon shading, cel shading, flat color, anime render,',
  },
  {
    label: '油画风',
    prompt: 'oil painting, brush strokes, classical art,',
  },
  {
    label: '水墨风',
    prompt: 'ink wash painting, Chinese ink style, minimalist composition,',
  },
  {
    label: '电影胶片',
    prompt: 'film grain, analog film, vintage cinematic,',
  },
];

export type GemStep2CardShape = TLBaseShape<
  'gem-step2-card',
  {
    w: number;
    h: number;
    visualProfile: string;
    script: string;
    gridSize?: string;
    mode?: 'story' | 'cinematic';
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
    mode: T.literalEnum('story', 'cinematic').optional(),
    result: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
    showInstruction: T.boolean.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): GemStep2CardShape['props'] {
    return {
      w: 400,
      h: 580,
      visualProfile: '',
      script: '',
      gridSize: '9',
      mode: 'story',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep2CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep2CardShape) {
    const { w, h, script, gridSize = '9', mode = 'story', result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [copied, setCopied] = useState(false);
    const [showStyles, setShowStyles] = useState(false);
    const [localImages, setLocalImages] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const update = (props: Partial<GemStep2CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step2-card' as any, props: { ...shape.props, ...props } });
    };

    // 读取连接的图片（素材卡片 / 图片生成卡片）
    const getConnectedImages = (): string[] => {
      const imgs: string[] = [];
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (src?.type === 'media-upload-card' && src.props?.imageData) {
            imgs.push(src.props.imageData);
          }
          if (src?.type === 'custom-card' && src.props?.generatedImage) {
            imgs.push(src.props.generatedImage);
          }
          if (imgs.length >= 9) return imgs;
        }
      }
      return imgs;
    };

    const connectedImages = getConnectedImages();
    const allImages = [...connectedImages, ...localImages];

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const remaining = Math.max(0, 9 - allImages.length);
      files.slice(0, remaining).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const maxSide = 1500;
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const cw = Math.round(img.width * scale);
            const ch = Math.round(img.height * scale);
            const c = document.createElement('canvas');
            c.width = cw; c.height = ch;
            c.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
            setLocalImages(prev => [...prev, c.toDataURL('image/jpeg', 0.85)]);
          };
          img.onerror = () => setLocalImages(prev => [...prev, dataUrl]);
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const removeLocalImage = (idx: number) => {
      setLocalImages(prev => prev.filter((_, i) => i !== idx));
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

    const applyStyle = (stylePrompt: string) => {
      // 去掉已有的风格提示词（如果之前选过），替换为新的
      // 检测 script 开头是否已有风格提示词（以逗号结尾的英文行）
      const stylePattern = /^[a-zA-Z0-9 ,.\-()]+,\s*\n/;
      const cleanScript = stylePattern.test(script) ? script.replace(stylePattern, '') : script;
      update({ script: stylePrompt + '\n' + cleanScript });
      setShowStyles(false);
    };

    const generate = async () => {
      if (!script.trim()) { alert('请输入剧本/故事'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: allImages, script, gridSize, mode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '请求失败');
        update({ result: data.result, isGenerating: false });

        // 自动推送 result 到连接的图片卡片
        const outBindings = editor.getBindingsFromShape(shape.id, 'connection');
        for (const binding of outBindings) {
          if ((binding as any).props?.terminal !== 'start') continue;
          const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
          for (const ob of connBindings) {
            if ((ob as any).props?.terminal !== 'end') continue;
            const targetShape = editor.getShape((ob as any).toId) as any;
            if (!targetShape || targetShape.type !== 'custom-card') continue;
            if (targetShape.props?.cardType !== 'image') continue;
            // 找到连接的图片卡片，自动填充 prompt
            editor.updateShape({
              id: (ob as any).toId,
              type: 'custom-card' as any,
              props: { ...targetShape.props, prompt: data.result },
            });
          }
        }
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
      update({ isMinimized: !isMinimized, w: isMinimized ? 400 : 160, h: isMinimized ? 580 : 60 });
    };

    const gridOptions = mode === 'story' ? STORY_GRID_OPTIONS : CINEMATIC_GRID_OPTIONS;
    const selectedGrid = gridOptions.find(o => o.value === gridSize) ?? gridOptions[1];

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

        {/* Step2 菜单按钮 - 右侧 */}
        {!isMinimized && (
          <div
            className="absolute cursor-pointer group"
            style={{ right: '-32px', top: '50%', transform: 'translateY(-50%)', zIndex: 102, pointerEvents: 'all' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              window.dispatchEvent(new CustomEvent('card-menu-open', {
                detail: { x: rect.right + 6, y: rect.top - 20, shapeId: shape.id, type: 'step2-card' },
              }));
            }}
            title="卡片菜单"
          >
            <div className="w-6 h-6 rounded-full bg-zinc-800/90 border border-white/15 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:border-white/30 transition-all shadow-lg">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </div>
          </div>
        )}

        <div className="w-full h-full bg-zinc-900/95 backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400"></div>
              <span className="text-white text-sm font-semibold">GEM 分镜 · Step 2</span>
              {/* 模式切换 */}
              <div className="flex rounded-lg overflow-hidden border border-white/10 ml-2" onPointerDown={(e) => e.stopPropagation()}>
                <div className="relative group">
                  <button
                    onClick={(e) => { e.stopPropagation(); update({ mode: 'story', gridSize: '9' }); }}
                    className={`text-xs px-3 py-1 transition-all ${mode === 'story' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >故事</button>
                  <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-zinc-800 border border-white/15 rounded-lg p-2.5 text-[11px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                    <div className="font-semibold text-white mb-1">故事模式</div>
                    <div>输入剧本，AI 按叙事节奏拆解为分镜。适合从剧情主线生成完整故事分镜。</div>
                  </div>
                </div>
                <div className="relative group">
                  <button
                    onClick={(e) => { e.stopPropagation(); update({ mode: 'cinematic', gridSize: '9' }); }}
                    className={`text-xs px-3 py-1 transition-all ${mode === 'cinematic' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >时空</button>
                  <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-zinc-800 border border-white/15 rounded-lg p-2.5 text-[11px] text-gray-300 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                    <div className="font-semibold text-white mb-1">时空模式</div>
                    <div>上传首帧和尾帧，AI 生成两帧之间的过渡中间镜头。适合动作细节拆解。</div>
                  </div>
                </div>
              </div>
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
                  {gridOptions.map(opt => (
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

              {/* 参考图片上传 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">
                    参考图片
                    {connectedImages.length > 0 && <span className="text-purple-400 ml-1">· 已连接 {connectedImages.length} 张</span>}
                  </label>
                  <span className="text-[10px] text-gray-600">{allImages.length}/9</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* 连接的图片（只读） */}
                  {connectedImages.map((img, idx) => (
                    <div key={`conn-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-purple-500/40">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-purple-900/30 flex items-center justify-center">
                        <svg className="w-3 h-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        </svg>
                      </div>
                    </div>
                  ))}
                  {/* 本地上传的图片 */}
                  {localImages.map((img, idx) => (
                    <div key={`local-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/15 group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        onClick={(e) => { e.stopPropagation(); removeLocalImage(idx); }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {/* 上传按钮 */}
                  {allImages.length < 9 && (
                    <label
                      className="w-12 h-12 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-white/40 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">可选，连接素材卡片或手动上传，AI 将参考图片风格生成分镜</p>
              </div>

              {/* 剧本输入 + 风格选择 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">剧本 / 故事</label>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowStyles(v => !v); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 transition-colors"
                  >
                    选风格
                  </button>
                </div>

                {showStyles && (
                  <div
                    className="mb-1.5 flex flex-wrap gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {STYLE_OPTIONS.map(s => (
                      <button
                        key={s.label}
                        onClick={(e) => { e.stopPropagation(); applyStyle(s.prompt); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-blue-600/40 hover:border-blue-500/50 hover:text-white transition-all"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 placeholder-gray-600"
                  placeholder="选择风格后提示词会出现在这里，后面接着写剧本内容..."
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
                disabled={isGenerating || !script.trim()}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !script.trim()
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
