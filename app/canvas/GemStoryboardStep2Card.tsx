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

type GridSize = '4' | '9' | '12' | '16';

const GRID_OPTIONS: { value: GridSize; label: string; desc: string }[] = [
  { value: '4',  label: '2×2', desc: '4格' },
  { value: '9',  label: '3×3', desc: '9格' },
  { value: '12', label: '3×4', desc: '12格 ⭐' },
  { value: '16', label: '4×4', desc: '16格' },
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
  override canBind = () => true;

  getDefaultProps(): GemStep2CardShape['props'] {
    return {
      w: 400,
      h: 580,
      visualProfile: '',
      script: '',
      gridSize: '12',
      result: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: GemStep2CardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: GemStep2CardShape) {
    const { w, h, visualProfile, script, gridSize = '12', result, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [copied, setCopied] = useState(false);
    const [showStyles, setShowStyles] = useState(false);

    const update = (props: Partial<GemStep2CardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'gem-step2-card' as any, props: { ...shape.props, ...props } });
    };

    // 实时读取连接的 Step1 的 result
    const getConnectedVisualProfile = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (src?.type === 'gem-step1-card' && src.props?.result) return src.props.result;
        }
      }
      return '';
    };

    const connectedVisualProfile = getConnectedVisualProfile();
    const effectiveVisualProfile = connectedVisualProfile || visualProfile;

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
      if (!effectiveVisualProfile.trim()) { alert('请连接 Step 1 或粘贴视觉档案 JSON'); return; }
      if (!script.trim()) { alert('请输入剧本/故事'); return; }
      update({ isGenerating: true, result: '' });
      try {
        const res = await fetch('/api/gem/generate-storyboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visualProfile: effectiveVisualProfile, script, gridSize }),
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

    const selectedGrid = GRID_OPTIONS.find(o => o.value === gridSize) ?? GRID_OPTIONS[2];

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

              {/* 视觉档案 */}
              <div className="flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">
                    Step 1 视觉档案 JSON
                    {connectedVisualProfile && <span className="text-purple-400 ml-1">· 已连接</span>}
                  </label>
                  {!connectedVisualProfile && (
                    <button
                      className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const text = await navigator.clipboard.readText();
                        if (text) update({ visualProfile: text });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >粘贴</button>
                  )}
                </div>
                <textarea
                  className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-gray-300 text-[10px] resize-none focus:outline-none focus:border-white/15 font-mono placeholder-gray-600"
                  placeholder="连接 Step 1 自动读取，或手动粘贴 JSON..."
                  value={effectiveVisualProfile}
                  readOnly={!!connectedVisualProfile}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => { if (!connectedVisualProfile) update({ visualProfile: e.target.value }); }}
                />
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

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating || !effectiveVisualProfile.trim() || !script.trim()}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating || !effectiveVisualProfile.trim() || !script.trim()
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
