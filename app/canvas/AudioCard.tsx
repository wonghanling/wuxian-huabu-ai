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

export type AudioCardShape = TLBaseShape<
  'audio-card',
  {
    w: number;
    h: number;
    mode: 'synthesize' | 'design';
    text: string;
    voiceId: string;
    speed: number;
    vol: number;
    pitch: number;
    designPrompt: string;
    previewText: string;
    audioUrl: string;
    isGenerating: boolean;
    isMinimized: boolean;
  }
>;

// @ts-expect-error
export class AudioCardUtil extends BaseBoxShapeUtil<AudioCardShape> {
  static override type = 'audio-card' as const;

  static override props: RecordProps<AudioCardShape> = {
    w: T.number,
    h: T.number,
    mode: T.string,
    text: T.string,
    voiceId: T.string,
    speed: T.number,
    vol: T.number,
    pitch: T.number,
    designPrompt: T.string,
    previewText: T.string,
    audioUrl: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => false;

  getDefaultProps(): AudioCardShape['props'] {
    return {
      w: 400,
      h: 520,
      mode: 'synthesize',
      text: '',
      voiceId: 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85',
      speed: 1,
      vol: 1,
      pitch: 0,
      designPrompt: '',
      previewText: '',
      audioUrl: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: AudioCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: AudioCardShape) {
    const { w, h, mode, text, voiceId, speed, vol, pitch, designPrompt, previewText, audioUrl, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();

    const update = (props: Partial<AudioCardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'audio-card' as any, props: { ...shape.props, ...props } });
    };

    const generate = async () => {
      if (mode === 'synthesize') {
        if (!text || !voiceId) { alert('请输入文本和 Voice ID'); return; }
        update({ isGenerating: true, audioUrl: '' });
        try {
          const res = await fetch('/api/audio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'synthesize', text, voiceId, speed, vol, pitch }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '生成失败');
          update({ audioUrl: data.audioUrl, isGenerating: false });
        } catch (err: any) {
          alert('生成失败: ' + err.message);
          update({ isGenerating: false });
        }
      } else if (mode === 'design') {
        if (!designPrompt || !voiceId) { alert('请输入音色描述和 Voice ID'); return; }
        update({ isGenerating: true });
        try {
          const res = await fetch('/api/audio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'design', prompt: designPrompt, previewText, voiceId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || '设计失败');
          alert('音色设计成功！Voice ID: ' + voiceId);
          update({ isGenerating: false });
        } catch (err: any) {
          alert('设计失败: ' + err.message);
          update({ isGenerating: false });
        }
      }
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
              <span className="text-white text-sm font-semibold">MiniMax 语音合成</span>
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
              {/* 模式切换 */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); update({ mode: 'synthesize' }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'synthesize' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  语音合成
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); update({ mode: 'design' }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'design' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  音色设计
                </button>
              </div>

              {mode === 'synthesize' ? (
                <>
                  {/* 文本输入 */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">文本内容</label>
                    <textarea
                      className="w-full h-24 bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600 resize-none"
                      placeholder="输入要转换成语音的文本..."
                      value={text}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ text: e.target.value })}
                    />
                  </div>

                  {/* Voice ID */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">Voice ID</label>
                    <input
                      className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                      placeholder="moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85"
                      value={voiceId}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ voiceId: e.target.value })}
                    />
                  </div>

                  {/* 参数调节 */}
                  <div className="flex-shrink-0 grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] text-gray-400 mb-1 block">语速 {speed.toFixed(1)}</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={speed}
                        onChange={(e) => update({ speed: parseFloat(e.target.value) })}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 mb-1 block">音量 {vol.toFixed(1)}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="2"
                        step="0.1"
                        value={vol}
                        onChange={(e) => update({ vol: parseFloat(e.target.value) })}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-400 mb-1 block">音调 {pitch}</label>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={pitch}
                        onChange={(e) => update({ pitch: parseInt(e.target.value) })}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 音色描述 */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">音色描述</label>
                    <textarea
                      className="w-full h-20 bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600 resize-none"
                      placeholder="例如：讲述悬疑故事的播音员，声音低沉富有磁性"
                      value={designPrompt}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ designPrompt: e.target.value })}
                    />
                  </div>

                  {/* 预览文本 */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">预览文本（可选）</label>
                    <input
                      className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                      placeholder="用于试听的文本"
                      value={previewText}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ previewText: e.target.value })}
                    />
                  </div>

                  {/* Voice ID */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">自定义 Voice ID</label>
                    <input
                      className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                      placeholder="例如：my_custom_voice_001"
                      value={voiceId}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ voiceId: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* 生成按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); generate(); }}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isGenerating}
                className={`flex-shrink-0 w-full py-2 rounded-xl text-sm font-semibold transition-all ${
                  isGenerating
                    ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-700 hover:bg-purple-600 text-white shadow-lg'
                }`}
              >
                {isGenerating ? '生成中...' : mode === 'synthesize' ? '生成语音' : '设计音色'}
              </button>

              {/* 音频播放器 */}
              {audioUrl && (
                <div className="flex-shrink-0 bg-black/40 border border-purple-500/20 rounded-xl p-2">
                  <audio controls className="w-full" src={audioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: AudioCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
