'use client';
import { BaseBoxShapeUtil, HTMLContainer, RecordProps, T } from 'tldraw';
import { useState, useRef, useCallback } from 'react';

type SeedanceCardShape = any;

export class SeedanceCardUtil extends BaseBoxShapeUtil<SeedanceCardShape> {
  static override type = 'seedance-card' as const;

  static override props: RecordProps<SeedanceCardShape> = {
    w: T.number,
    h: T.number,
    mode: T.string.optional(),
    model: T.string.optional(),
    prompt: T.string.optional(),
    ratio: T.string.optional(),
    duration: T.string.optional(),
    resolution: T.string.optional(),
    generateAudio: T.boolean.optional(),
    firstFrameImage: T.string.optional(),
    lastFrameImage: T.string.optional(),
    refImages: T.string.optional(),
    refVideoUrl: T.string.optional(),
    refVideoName: T.string.optional(),
    refAudioBase64: T.string.optional(),
    refAudioName: T.string.optional(),
    generatedVideo: T.string.optional(),
    capturedFrame: T.string.optional(),
    isGenerating: T.boolean.optional(),
    generationProgress: T.number.optional(),
    generationStatus: T.string.optional(),
    showSettings: T.boolean.optional(),
    isMinimized: T.boolean.optional(),
  };

  getDefaultProps() {
    return {
      w: 420, h: 560,
      mode: 't2v', model: 'doubao-seedance-2-0',
      prompt: '', ratio: '16:9', duration: '5',
      resolution: '720p', generateAudio: true,
      firstFrameImage: '', lastFrameImage: '',
      refImages: '[]', refVideoUrl: '', refVideoName: '',
      refAudioBase64: '', refAudioName: '',
      generatedVideo: '', capturedFrame: '', isGenerating: false,
      generationProgress: 0, generationStatus: '',
      showSettings: false, isMinimized: false,
    };
  }

  component(shape: SeedanceCardShape) {
    const { w, h, mode, model, prompt, ratio, duration, resolution, generateAudio,
      firstFrameImage, lastFrameImage, refImages, refVideoUrl, refVideoName, refAudioBase64, refAudioName,
      generatedVideo, capturedFrame, isGenerating, generationProgress, generationStatus, showSettings, isMinimized,
    } = shape.props;

    const editor = (this as any).editor;
    const up = (props: any) => editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...shape.props, ...props } });
    const parsedRefImages: string[] = (() => { try { return JSON.parse(refImages || '[]'); } catch { return []; } })();
    const scale = Math.min(w / 420, h / 420);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
    const [showVideoOutput, setShowVideoOutput] = useState(true);

    const captureCurrentFrame = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const frameImage = canvas.toDataURL('image/png');
      const ls = editor.getShape(shape.id);
      const lp = ls ? (ls as any).props : shape.props;
      editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, capturedFrame: frameImage } });
    }, [editor, shape.id]);

    const handleGenerate = async () => {
      if (!prompt && mode === 't2v') { alert('请输入提示词'); return; }
      if ((mode === 'i2v' || mode === 'first-last') && !firstFrameImage) { alert('请上传首帧图片'); return; }
      if (mode === 'first-last' && !lastFrameImage) { alert('请上传尾帧图片'); return; }
      if (mode === 'multimodal' && parsedRefImages.length === 0 && !refVideoUrl) { alert('请至少上传一张参考图或视频URL'); return; }
      up({ isGenerating: true, generationStatus: '提交中...', generationProgress: 5, generatedVideo: '' });
      try {
        const res = await fetch('/api/seedance/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode, model, prompt, ratio,
            duration: duration === '-1' ? -1 : parseInt(duration || '5'),
            resolution, generateAudio,
            firstFrameImage: firstFrameImage || undefined,
            lastFrameImage: lastFrameImage || undefined,
            refImages: parsedRefImages.length > 0 ? parsedRefImages : undefined,
            refVideoUrl: refVideoUrl || undefined,
            refAudioBase64: refAudioBase64 || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '提交失败');
        const taskId = data.taskId;
        let attempts = 0;
        const poll = async () => {
          attempts++;
          const qRes = await fetch('/api/seedance/query?taskId=' + taskId);
          const qData = await qRes.json();
          const ls = editor.getShape(shape.id);
          const lp = ls ? (ls as any).props : shape.props;
          if (qData.status === 'completed' && qData.videoUrl) {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generatedVideo: qData.videoUrl, generationProgress: 100, generationStatus: '完成' } });
          } else if (qData.status === 'failed') {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '失败: ' + (qData.error || '') } });
          } else if (attempts < 120) {
            const prog = qData.status === 'queued' ? 10 : Math.min(90, 10 + attempts * 1.5);
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, generationProgress: prog, generationStatus: qData.status === 'queued' ? '排队中...' : '生成中...' } });
            setTimeout(poll, 5000);
          } else {
            editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: '超时' } });
          }
        };
        setTimeout(poll, 5000);
      } catch (err: any) {
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, isGenerating: false, generationStatus: err?.message || '失败' } });
      }
    };

    const addRefImage = (base64: string) => {
      if (parsedRefImages.length >= 9) { alert('最多9张参考图'); return; }
      up({ refImages: JSON.stringify([...parsedRefImages, base64]) });
    };
    const removeRefImage = (idx: number) => {
      const arr = [...parsedRefImages]; arr.splice(idx, 1);
      up({ refImages: JSON.stringify(arr) });
    };

    const handleRefVideoUpload = async (file: File) => {
      if (file.size > 50 * 1024 * 1024) { alert('视频文件不能超过 50MB'); return; }
      up({ refVideoName: '上传中...', refVideoUrl: '' });
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/video/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok || !data?.url) throw new Error(data?.error || '上传失败');
        const ls = editor.getShape(shape.id);
        const lp = ls ? (ls as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'seedance-card' as any, props: { ...lp, refVideoUrl: data.url, refVideoName: file.name } });
      } catch (err: any) {
        alert(err?.message || '视频上传失败');
        up({ refVideoName: '', refVideoUrl: '' });
      }
    };

    const MODES = [
      { key: 't2v', label: '文生视频' },
      { key: 'i2v', label: '图生-首帧' },
      { key: 'first-last', label: '首尾帧' },
      { key: 'multimodal', label: '多模态' },
    ];

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all', overflow: 'visible' }}>
        <div
          className="w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg,rgba(192,192,192,0.15) 0%,rgba(169,169,169,0.12) 50%,rgba(128,128,128,0.08) 100%)',
            border: '1px solid rgba(192,192,192,0.3)',
            boxShadow: '0 0 40px rgba(192,192,192,0.15)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          }}
        >
          <button
            onClick={() => up({ isMinimized: !isMinimized })}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg z-10"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'center' }}
          >{isMinimized ? '+' : '−'}</button>

          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">Seedance 2.0</div>
                <div className="text-gray-400 text-xs mt-1">视频生成</div>
                <div className="text-gray-500 text-[10px] mt-2">点击+展开</div>
              </div>
            </div>
          ) : (
            <div className="p-4 h-full flex flex-col overflow-y-auto">

              {/* 标题 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400/20 to-gray-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">Seedance 2.0</h3>
                  <p className="text-gray-400 text-xs">视频生成</p>
                </div>
              </div>

              {/* 模式切换 */}
              <div className="flex gap-1 bg-black/20 rounded-lg p-1 mb-2">
                {MODES.map((m) => (
                  <button key={m.key}
                    className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${(mode || 't2v') === m.key ? 'bg-gray-600/80 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                    onClick={(e) => { e.stopPropagation(); up({ mode: m.key }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{m.label}</button>
                ))}
              </div>

              {/* 模型 */}
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">模型</label>
                <select
                  className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all"
                  value={model || 'doubao-seedance-2-0'}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => up({ model: e.target.value })}
                >
                  <option value="doubao-seedance-2-0">Seedance 2.0</option>
                  <option value="doubao-seedance-2-0-fast">Seedance 2.0 Fast</option>
                </select>
              </div>

              {/* 提示词 */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-400 text-xs">提示词{mode === 't2v' ? '（必填）' : '（可选）'}</label>
                  <button className="text-[10px] text-gray-400 hover:text-gray-300"
                    onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) up({ prompt: (prompt ? prompt + '\n' : '') + t }); } catch {} }}
                    onPointerDown={(e) => e.stopPropagation()}>粘贴</button>
                </div>
                <textarea
                  className="w-full h-16 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                  placeholder="描述视频内容..." value={prompt || ''}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => up({ prompt: e.target.value })}
                />
              </div>

              {/* 首帧 */}
              {(mode === 'i2v' || mode === 'first-last') && (
                <div className="mb-2">
                  <label className="text-gray-400 text-xs mb-1 block">首帧图片（必填）</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ firstFrameImage: ev.target?.result as string }); r.readAsDataURL(f); e.target.value = ''; }}
                  />
                  {firstFrameImage && (
                    <div className="mt-1 relative w-full h-14 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={firstFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); up({ firstFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                    </div>
                  )}
                </div>
              )}

              {/* 尾帧 */}
              {mode === 'first-last' && (
                <div className="mb-2">
                  <label className="text-gray-400 text-xs mb-1 block">尾帧图片（必填）</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ lastFrameImage: ev.target?.result as string }); r.readAsDataURL(f); e.target.value = ''; }}
                  />
                  {lastFrameImage && (
                    <div className="mt-1 relative w-full h-14 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={lastFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); up({ lastFrameImage: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                    </div>
                  )}
                </div>
              )}

              {/* 多模态 */}
              {mode === 'multimodal' && (
                <div className="mb-2 space-y-2">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考图片（最多9张）</label>
                    <input type="file" accept="image/*" multiple
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => { Array.from(e.target.files || []).forEach(f => { const r = new FileReader(); r.onload = (ev) => addRefImage(ev.target?.result as string); r.readAsDataURL(f); }); e.target.value = ''; }}
                    />
                    {parsedRefImages.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {parsedRefImages.map((img: string, i: number) => (
                          <div key={i} className="relative w-12 h-12 bg-black/30 rounded overflow-hidden group">
                            <img src={img} className="w-full h-full object-cover" />
                            <button className="absolute top-0 right-0 w-4 h-4 bg-black/60 hover:bg-red-500/80 rounded text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); removeRefImage(i); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                            <span className="absolute bottom-0 left-0 text-[8px] text-white bg-black/50 px-0.5">[{i + 1}]</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考视频（可选，mp4/mov ≤50MB）</label>
                    <input type="file" accept="video/mp4,video/quicktime"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; await handleRefVideoUpload(f); e.target.value = ''; }}
                    />
                    {refVideoName && refVideoName !== '上传中...' && (
                      <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                        <span className="text-gray-300 text-xs truncate flex-1">{refVideoName}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs"
                          onClick={(e) => { e.stopPropagation(); up({ refVideoUrl: '', refVideoName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                      </div>
                    )}
                    {refVideoName === '上传中...' && (
                      <div className="mt-1 text-gray-400 text-xs">上传中...</div>
                    )}
                    {!refVideoName && (
                      <div className="mt-1">
                        <input
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                          placeholder="或直接填写视频 URL https://..."
                          value={refVideoUrl && !refVideoName ? refVideoUrl : ''}
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => up({ refVideoUrl: e.target.value, refVideoName: '' })}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">参考音频（可选，wav/mp3）</label>
                    <input type="file" accept="audio/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => up({ refAudioBase64: ev.target?.result as string, refAudioName: f.name }); r.readAsDataURL(f); e.target.value = ''; }}
                    />
                    {refAudioBase64 && (
                      <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                        <span className="text-gray-300 text-xs truncate flex-1">{refAudioName || '已上传'}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs"
                          onClick={(e) => { e.stopPropagation(); up({ refAudioBase64: '', refAudioName: '' }); }} onPointerDown={(e) => e.stopPropagation()}>x</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 比例 */}
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">比例</label>
                <div className="flex gap-1 flex-wrap">
                  {['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'].map((r) => (
                    <button key={r}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${(ratio || '16:9') === r ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                      onClick={(e) => { e.stopPropagation(); up({ ratio: r }); }} onPointerDown={(e) => e.stopPropagation()}
                    >{r}</button>
                  ))}
                </div>
              </div>

              {/* 参数设置折叠 */}
              <button
                className="w-full py-1.5 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => { e.stopPropagation(); up({ showSettings: !showSettings }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{showSettings ? '收起参数设置 ▲' : '展开参数设置 ▼'}</button>

              {showSettings && (
                <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">时长（秒）</label>
                    <div className="flex gap-1 flex-wrap">
                      {['4', '5', '6', '8', '10', '12', '15', '-1'].map((d) => (
                        <button key={d}
                          className={`px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${(duration || '5') === d ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); up({ duration: d }); }} onPointerDown={(e) => e.stopPropagation()}
                        >{d === '-1' ? '智能' : d + 's'}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">分辨率</label>
                    <div className="flex gap-1">
                      {['480p', '720p'].map((r) => (
                        <button key={r}
                          className={`px-3 py-1 rounded-lg border text-[10px] font-medium transition-all ${(resolution || '720p') === r ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); up({ resolution: r }); }} onPointerDown={(e) => e.stopPropagation()}
                        >{r.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">有声视频</label>
                    <button
                      className={`relative w-10 h-5 rounded-full transition-colors ${generateAudio ? 'bg-blue-500' : 'bg-white/10'}`}
                      onClick={(e) => { e.stopPropagation(); up({ generateAudio: !generateAudio }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${generateAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Generate */}
              <button
                className={`w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600 hover:scale-[1.02] active:scale-[0.98]'}`}
                disabled={isGenerating}
                onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
                onPointerDown={(e) => e.stopPropagation()}
              >{isGenerating ? (generationStatus || '生成中...') : 'Generate'}</button>

              {isGenerating && (
                <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                  <div className="bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${generationProgress || 0}%` }} />
                </div>
              )}

              {generatedVideo && (
                <>
                  {/* lightbox */}
                  {lightboxVideo && (
                    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center"
                      onClick={() => setLightboxVideo(null)} onPointerDown={(e) => e.stopPropagation()}>
                      <div className="relative" style={{ maxWidth: '70vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
                        <video src={lightboxVideo} controls autoPlay className="rounded-xl" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
                        <button className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                          onClick={() => setLightboxVideo(null)} onPointerDown={(e) => e.stopPropagation()}>✕</button>
                      </div>
                    </div>
                  )}
                  {/* 查看/隐藏按钮 */}
                  <button
                    className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-yellow-400/80 to-yellow-500/80 hover:from-yellow-400 hover:to-yellow-500"
                    onClick={(e) => { e.stopPropagation(); setShowVideoOutput(!showVideoOutput); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{showVideoOutput ? '隐藏视频' : '查看生成视频'}</button>

                  {showVideoOutput && (
                    <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                      <div className="relative group" style={{ minHeight: '180px' }}>
                        <video
                          ref={videoRef}
                          src={generatedVideo}
                          controls
                          crossOrigin="anonymous"
                          className="w-full bg-black"
                          style={{ minHeight: '180px', maxHeight: '250px' }}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        />
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* 保存当前帧 */}
                          <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="保存当前帧"
                            onClick={(e) => { e.stopPropagation(); captureCurrentFrame(); }}
                            onPointerDown={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          {/* 放大播放 */}
                          <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="放大播放"
                            onClick={(e) => { e.stopPropagation(); setLightboxVideo(generatedVideo); }}
                            onPointerDown={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                          </button>
                          {/* 下载 */}
                          <button className="p-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white transition-all" title="下载视频"
                            onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = generatedVideo; a.download = 'seedance-' + Date.now() + '.mp4'; a.click(); }}
                            onPointerDown={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                          {/* 删除 */}
                          <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="删除视频"
                            onClick={(e) => { e.stopPropagation(); up({ generatedVideo: '', capturedFrame: '' }); }}
                            onPointerDown={(e) => e.stopPropagation()}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                          <p className="text-white text-[10px] truncate">生成成功 · Seedance 2.0</p>
                        </div>
                      </div>

                      {/* 捕获的帧 */}
                      {capturedFrame && (
                        <div className="mt-2 bg-black/40 border border-purple-500/30 rounded-lg overflow-hidden">
                          <div className="p-2 bg-purple-500/10 border-b border-purple-500/20">
                            <p className="text-purple-400 text-[10px] font-semibold">捕获的视频帧</p>
                          </div>
                          <div className="relative group">
                            <img src={capturedFrame} alt="Captured Frame" className="w-full h-auto max-h-[200px] object-contain bg-black/20" onClick={(e) => e.stopPropagation()} />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => { e.stopPropagation(); setLightboxVideo(capturedFrame); }}
                                onPointerDown={(e) => e.stopPropagation()} title="查看大图">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                                查看
                              </button>
                              <button className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = capturedFrame; a.download = 'seedance-frame-' + Date.now() + '.png'; a.click(); }}
                                onPointerDown={(e) => e.stopPropagation()} title="下载图片">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                下载
                              </button>
                              <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => { e.stopPropagation(); up({ capturedFrame: '' }); }}
                                onPointerDown={(e) => e.stopPropagation()} title="删除图片">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: SeedanceCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
