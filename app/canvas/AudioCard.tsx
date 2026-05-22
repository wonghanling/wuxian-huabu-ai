import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  useEditor,
  useValue,
  Rectangle2d,
} from 'tldraw';
import { useState } from 'react';

export type AudioCardShape = TLBaseShape<
  'audio-card',
  {
    w: number;
    h: number;
    mode: 'synthesize' | 'design' | 'clone';
    text: string;
    voiceId: string;
    speed: number;
    vol: number;
    pitch: number;
    designPrompt: string;
    previewText: string;
    cloneText: string;
    clonedVoices: string;
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
    mode: T.literalEnum('synthesize', 'design', 'clone'),
    text: T.string,
    voiceId: T.string,
    speed: T.number,
    vol: T.number,
    pitch: T.number,
    designPrompt: T.string,
    previewText: T.string,
    cloneText: T.string,
    clonedVoices: T.string,
    audioUrl: T.string,
    isGenerating: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

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
      cloneText: '',
      clonedVoices: '[]',
      audioUrl: '',
      isGenerating: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: AudioCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: AudioCardShape) {
    const { w, h, mode, text, voiceId, speed, vol, pitch, designPrompt, previewText, cloneText, clonedVoices, audioUrl, isGenerating, isMinimized } = shape.props;
    const editor = useEditor();
    const [uploadedFileId, setUploadedFileId] = useState<string>('');

    const isInViewport = useValue('inViewport', () => {
      const vp = editor.getViewportPageBounds();
      const sb = editor.getShapePageBounds(shape.id);
      if (!sb) return true;
      return !(sb.maxX < vp.minX || sb.minX > vp.maxX || sb.maxY < vp.minY || sb.minY > vp.maxY);
    }, [editor, shape.id]);
    if (!isInViewport && !isGenerating) {
      return <HTMLContainer><div style={{ width: w, height: h, background: '#18181b', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>Audio</span></div></HTMLContainer>;
    }

    const clonedVoicesList: string[] = clonedVoices ? JSON.parse(clonedVoices) : [];

    const update = (props: Partial<AudioCardShape['props']>) => {
      editor.updateShape({ id: shape.id, type: 'audio-card' as any, props: { ...shape.props, ...props } });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      update({ isGenerating: true });
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'voice_clone');

        const res = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '上传失败');

        setUploadedFileId(data.fileId);
        alert('文件上传成功！File ID: ' + data.fileId);
        update({ isGenerating: false });
      } catch (err: any) {
        alert('上传失败: ' + err.message);
        update({ isGenerating: false });
      }
      e.target.value = '';
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
          (window as any).saveCanvasNow?.();
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
      } else if (mode === 'clone') {
        if (!uploadedFileId || !voiceId) { alert('请先上传音频文件并输入 Voice ID'); return; }

        // 校验 Voice ID 格式
        if (voiceId.length < 8 || voiceId.length > 256) {
          alert('Voice ID 长度必须在 8-256 字符之间');
          return;
        }
        if (!/^[a-zA-Z]/.test(voiceId)) {
          alert('Voice ID 必须以字母开头');
          return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
          alert('Voice ID 只能包含字母、数字、下划线和连字符');
          return;
        }
        if (/[-_]$/.test(voiceId)) {
          alert('Voice ID 不能以连字符或下划线结尾');
          return;
        }

        update({ isGenerating: true });
        try {
          const res = await fetch('/api/audio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'clone', fileId: uploadedFileId, voiceId, text: cloneText }),
          });
          const data = await res.json();
          if (!res.ok) {
            const errMsg = data.error || '复刻失败';
            if (errMsg.includes('duration too short')) {
              throw new Error('音频时长太短，至少需要 10 秒');
            }
            throw new Error(errMsg);
          }

          // 将复刻的 Voice ID 加入列表
          const newList = [...clonedVoicesList, voiceId];
          update({ isGenerating: false, clonedVoices: JSON.stringify(newList) });
          alert(`音色复刻成功！\nVoice ID: ${voiceId}\n\n已保存到音色列表，可在语音合成模式选择使用。`);
        } catch (err: any) {
          alert('复刻失败: ' + err.message);
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

        {/* 输出端口 - Right */}
        <div className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{ right: '-6px', zIndex: 101, pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            editor.setCurrentTool('port', { shapeId: shape.id, portId: 'output', terminal: 'start' });
          }}>
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(168,85,247,0.8)', boxShadow: '0 0 8px rgba(168,85,247,0.8)', pointerEvents: 'none' }} />
        </div>

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
                <button
                  onClick={(e) => { e.stopPropagation(); update({ mode: 'clone' }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'clone' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  音色复刻
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-gray-400">Voice ID</label>
                      <span className="text-[10px] text-white/70">在 MiniMax 官网复制 ID 获得</span>
                      {clonedVoicesList.length > 0 && (
                        <select
                          className="text-[9px] bg-black/50 border border-white/10 rounded px-1 py-0.5 text-gray-300"
                          onChange={(e) => update({ voiceId: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <option value="">选择已复刻音色</option>
                          {clonedVoicesList.map((vid, i) => (
                            <option key={i} value={vid}>{vid}</option>
                          ))}
                        </select>
                      )}
                    </div>
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
              ) : mode === 'design' ? (
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
              ) : (
                <>
                  {/* 音色复刻 - 文件上传 */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">上传音频文件（10秒-5分钟，mp3/m4a/wav）</label>
                    <label
                      className="w-full bg-black/30 border border-dashed border-white/15 rounded-lg px-3 py-4 flex flex-col items-center justify-center cursor-pointer hover:border-purple-400/40 hover:bg-purple-400/5 transition-all"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <svg className="w-8 h-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-[10px] text-gray-400">点击上传音频</span>
                      {uploadedFileId && <span className="text-[9px] text-green-400 mt-1">已上传 ✓ File ID: {uploadedFileId}</span>}
                      <input
                        type="file"
                        accept="audio/mp3,audio/m4a,audio/wav"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>

                  {/* 复刻预览文本 */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">试听文本（可选）</label>
                    <input
                      className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                      placeholder="你好，这是音色复刻预览"
                      value={cloneText}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ cloneText: e.target.value })}
                    />
                  </div>

                  {/* Voice ID */}
                  <div className="flex-shrink-0">
                    <label className="text-[10px] text-gray-400 mb-1 block">自定义 Voice ID（8-256字符，字母开头）</label>
                    <input
                      className="w-full bg-black/30 border border-white/8 rounded-lg px-2 py-1.5 text-gray-300 text-[10px] focus:outline-none focus:border-white/15 placeholder-gray-600"
                      placeholder="例如：my_cloned_voice_001"
                      value={voiceId}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => update({ voiceId: e.target.value })}
                    />
                    <span className="text-[8px] text-gray-500 mt-0.5 block">只能包含字母、数字、下划线、连字符</span>
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
                {isGenerating ? '生成中...' : mode === 'synthesize' ? '生成语音' : mode === 'design' ? '设计音色' : '复刻音色'}
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
