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
import { useMembership } from '@/lib/useMembership';
import MembershipModal from './MembershipModal';
import { createClient } from '@/lib/supabase/client';

export type PromptOptimizerCardShape = TLBaseShape<
  'prompt-optimizer-card',
  {
    w: number;
    h: number;
    userInput: string;
    duration: string;
    ratio: string;
    optimizedPrompt: string;
    isGenerating: boolean;
    isMinimized?: boolean;
    showOutput?: boolean;
    uploadedImage?: string; // 可选：上传的参考图片（base64）
  }
>;

// @ts-expect-error - Custom shape types are not recognized by BaseBoxShapeUtil constraint
export class PromptOptimizerCardUtil extends BaseBoxShapeUtil<PromptOptimizerCardShape> {
  static override type = 'prompt-optimizer-card' as const;

  static override props: RecordProps<PromptOptimizerCardShape> = {
    w: T.number,
    h: T.number,
    userInput: T.string,
    duration: T.string,
    ratio: T.string,
    optimizedPrompt: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean.optional(),
    showOutput: T.boolean.optional(),
    uploadedImage: T.string.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): PromptOptimizerCardShape['props'] {
    return {
      w: 380,
      h: 380,
      userInput: '',
      duration: '13-15秒',
      ratio: '16:9',
      optimizedPrompt: '',
      isGenerating: false,
      isMinimized: false,
      showOutput: false,
      uploadedImage: '',
    };
  }

  override getGeometry(shape: PromptOptimizerCardShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: PromptOptimizerCardShape) {
    const { w, h, userInput, duration, ratio, optimizedPrompt, isGenerating, isMinimized, showOutput, uploadedImage } = shape.props;
    const editor = useEditor();
    const { isMember, loading: memberLoading } = useMembership();
    const [showMemberModal, setShowMemberModal] = useState(false);

    const handlePay = async (plan: 'membership' | 'recharge', amount: number) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('请先登录'); return; }
      const res = await fetch('/api/payment/alipay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, amount }),
      });
      const data = await res.json();
      if (data.paymentForm) {
        const div = document.createElement('div');
        div.innerHTML = data.paymentForm;
        document.body.appendChild(div);
        const form = div.querySelector('form');
        form?.submit();
      } else {
        alert(data.error || '发起支付失败');
      }
    };

    // 切换缩放
    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newMinimized = !isMinimized;
      const newW = newMinimized ? 150 : 380;
      const newH = newMinimized ? 80 : 380;
      editor.updateShape({
        id: shape.id,
        type: 'prompt-optimizer-card' as any,
        props: {
          ...shape.props,
          w: newW,
          h: newH,
          isMinimized: newMinimized,
        },
      });
    };

    const generatePrompt = async () => {
      if (!isMember) { setShowMemberModal(true); return; }
      if (!userInput.trim()) {
        alert('请输入视频描述');
        return;
      }

      editor.updateShape({
        id: shape.id,
        type: 'prompt-optimizer-card' as any,
        props: { ...shape.props, isGenerating: true },
      });

      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const response = await fetch('/api/optimize-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userInput,
            duration,
            ratio,
            uploadedImage: uploadedImage || null,
            userId: user?.id,
          }),
        });

        if (!response.ok) throw new Error('API调用失败');

        const data = await response.json();
        editor.updateShape({
          id: shape.id,
          type: 'prompt-optimizer-card' as any,
          props: { ...shape.props, optimizedPrompt: data.optimizedPrompt, isGenerating: false, showOutput: true },
        });
      } catch (error) {
        console.error('生成提示词失败:', error);
        alert('生成失败，请重试');
        editor.updateShape({
          id: shape.id,
          type: 'prompt-optimizer-card' as any,
          props: { ...shape.props, isGenerating: false },
        });
      }
    };

    const toggleOutput = () => {
      editor.updateShape({
        id: shape.id,
        type: 'prompt-optimizer-card' as any,
        props: { ...shape.props, showOutput: !showOutput },
      });
    };

    const copyToClipboard = () => {
      navigator.clipboard.writeText(optimizedPrompt);
      alert('已复制到剪贴板');
    };

    // 颜色配置 - 黑白灰主题（和其他卡片一致）
    const color = {
      gradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.12) 50%, rgba(128, 128, 128, 0.08) 100%)',
      border: 'rgba(192, 192, 192, 0.3)',
      glow: '0 0 40px rgba(192, 192, 192, 0.15)',
      icon: 'text-gray-300',
      iconBg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/20',
      buttonBg: 'bg-gradient-to-r from-gray-500/80 to-gray-600/80 hover:from-gray-500 hover:to-gray-600',
      inputPortColor: 'rgba(59, 130, 246, 0.8)', // 蓝色 - 输入端口
      outputPortColor: 'rgba(156, 163, 175, 0.8)', // 灰色 - 输出端口
    };

    const scale = Math.min(w / 380, h / 380);

    // 处理输出端口点击 - 只能主动发起连接
    const handleOutputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'output',
        terminal: 'start', // 作为起点
      });
    };

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
          overflow: 'visible',
        }}
      >
        {showMemberModal && <MembershipModal onClose={() => setShowMemberModal(false)} onPay={() => handlePay('membership', 39)} />}
        {/* 输出端口 - Right（灰色，只能主动发起连接）*/}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{
            right: '-6px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="output"
          data-node-id={shape.id}
          onMouseDown={handleOutputPortDown}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Output Port"
        >
          <div
            className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{
              backgroundColor: '#27272a',
              border: `2px solid ${color.outputPortColor}`,
              boxShadow: `0 0 8px ${color.outputPortColor}`,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 输入端口 - Left（蓝色，只能被动接收连接）*/}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: '-6px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="input"
          data-node-id={shape.id}
          title="Input Port"
        >
          <div
            className="w-3 h-3 rounded-full transition-all"
            style={{
              backgroundColor: '#27272a',
              border: `2px solid ${color.inputPortColor}`,
              boxShadow: `0 0 8px ${color.inputPortColor}`,
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          className="w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl transition-all duration-300"
          style={{
            background: color.gradient,
            border: `1px solid ${color.border}`,
            backgroundColor: 'rgba(192, 192, 192, 0.08)',
            boxShadow: color.glow,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          }}
        >
          {/* 缩放按钮 */}
          <button
            onClick={toggleMinimize}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg transition-all z-10"
            style={{
              transform: `scale(${1 / scale})`,
              transformOrigin: 'center',
            }}
            title={isMinimized ? "展开" : "缩小"}
          >
            {isMinimized ? '+' : '−'}
          </button>

          {/* 缩小状态 */}
          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">Prompt Optimizer</div>
                <div className="text-gray-400 text-xs mt-1">提示词优化</div>
                <div className="text-gray-500 text-[10px] mt-2">点击+展开</div>
              </div>
            </div>
          ) : (
            /* 正常状态 */
            <div className="p-4 h-full flex flex-col">
              {/* 标题栏 */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${color.iconBg} flex items-center justify-center flex-shrink-0 backdrop-blur-sm`}>
                  <svg className={`w-4 h-4 ${color.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm truncate">Prompt Optimizer</h3>
                  <p className="text-gray-400 text-xs truncate">提示词优化</p>
                </div>
              </div>

              {/* 输入区域 */}
              <div className="mb-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 text-xs">视频描述</label>
                  <button
                    className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        editor.updateShape({
                          id: shape.id,
                          type: 'prompt-optimizer-card' as any,
                          props: { ...shape.props, userInput: (userInput ? userInput + '\n' : '') + text },
                        });
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >粘贴</button>
                </div>
                <textarea
                  className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500"
                  placeholder="输入你想生成的视频内容，例如：一段仙侠战斗、奶茶产品广告..."
                  value={userInput}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    editor.updateShape({
                      id: shape.id,
                      type: 'prompt-optimizer-card' as any,
                      props: { ...shape.props, userInput: e.target.value },
                    });
                  }}
                />

                {/* 上传参考图片（可选） */}
                <div className="mt-2">
                  <label className="text-gray-400 text-xs mb-1 block">参考图片（可选）</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const imageData = event.target?.result as string;
                          editor.updateShape({
                            id: shape.id,
                            type: 'prompt-optimizer-card' as any,
                            props: { ...shape.props, uploadedImage: imageData },
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {uploadedImage && (
                    <div className="mt-2 relative w-full h-20 bg-black/30 rounded-lg overflow-hidden">
                      <img src={uploadedImage} alt="Reference" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.updateShape({
                            id: shape.id,
                            type: 'prompt-optimizer-card' as any,
                            props: { ...shape.props, uploadedImage: '' },
                          });
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 hover:bg-red-600 rounded flex items-center justify-center text-white text-xs"
                        title="删除图片"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* 参数选择 */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">时长</label>
                    <select
                      value={duration}
                      onChange={(e) => {
                        editor.updateShape({
                          id: shape.id,
                          type: 'prompt-optimizer-card' as any,
                          props: { ...shape.props, duration: e.target.value },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full bg-black/30 border border-white/8 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-white/15"
                    >
                      <option value="4-8秒">4-8秒</option>
                      <option value="9-12秒">9-12秒</option>
                      <option value="13-15秒">13-15秒</option>
                      <option value=">15秒">&gt;15秒</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">比例</label>
                    <select
                      value={ratio}
                      onChange={(e) => {
                        editor.updateShape({
                          id: shape.id,
                          type: 'prompt-optimizer-card' as any,
                          props: { ...shape.props, ratio: e.target.value },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full bg-black/30 border border-white/8 rounded-lg p-1.5 text-white text-xs focus:outline-none focus:border-white/15"
                    >
                      <option value="16:9">横屏 16:9</option>
                      <option value="9:16">竖屏 9:16</option>
                      <option value="1:1">方形 1:1</option>
                    </select>
                  </div>
                </div>

                {/* 输出区域 */}
                {optimizedPrompt && showOutput && (
                  <div className="mt-2 flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-gray-400 text-xs">优化后的提示词</label>
                      <button
                        onClick={copyToClipboard}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-xs text-gray-400 hover:text-gray-300"
                      >
                        复制
                      </button>
                    </div>
                    <div className="flex-1 bg-black/30 border border-white/10 rounded-lg p-2 text-white text-xs overflow-y-auto whitespace-pre-wrap min-h-0">
                      {optimizedPrompt}
                    </div>
                  </div>
                )}
              </div>

              {/* 生成按钮 */}
              <button
                onClick={generatePrompt}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  isGenerating
                    ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                    : color.buttonBg + ' text-white shadow-lg'
                }`}
              >
                {isGenerating ? '生成中...' : '生成专业提示词'}
              </button>

              {/* 查看/收起按钮 - 只在有输出时显示 */}
              {optimizedPrompt && (
                <button
                  onClick={toggleOutput}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full py-2 mt-2 rounded-lg font-semibold text-xs transition-all bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600 text-white shadow-lg"
                >
                  {showOutput ? '收起提示词' : '查看提示词'}
                </button>
              )}
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: PromptOptimizerCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

