'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconExpand, IconShrink, IconMinus, IconPlus, IconUpload } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { getUserId } from '../lib/api';
import { useDebouncedField } from '../lib/useDebouncedField';
import { loadVoices, saveVoice, deleteVoice, type VoiceEntry } from '../lib/voiceLibrary';

// ============================================================
// 语音合成卡片(照原网 AudioCard,三模式:合成/音色设计/克隆)
// 调 /api/audio/generate + /api/audio/upload(后端零改动)
// 输出 audioUrl → outputUrl,可连下游(Kling/Seedance 音频输入)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type AudioMode = 'synthesize' | 'design' | 'clone';
const DEFAULT_VOICE = 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85';

function AudioNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<'voice' | 'params' | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [libOpen, setLibOpen] = useState(false);        // 我的音色库弹窗
  const [voices, setVoices] = useState<VoiceEntry[]>([]); // 语音库列表

  // 加载我的音色库(登录后)
  const refreshVoices = async () => setVoices(await loadVoices());
  useEffect(() => { refreshVoices(); }, []);

  const cfg = data.config as any;
  const mode = (cfg.audioMode as AudioMode) ?? 'synthesize';
  const text = cfg.text ?? '';
  const voiceId = cfg.voiceId ?? DEFAULT_VOICE;
  const speed = cfg.speed ?? 1;
  const vol = cfg.vol ?? 1;
  const pitch = cfg.pitch ?? 0;
  const designPrompt = cfg.designPrompt ?? '';
  const previewText = cfg.previewText ?? '';
  const cloneText = cfg.cloneText ?? '';
  const clonedVoices: string[] = (() => { try { return JSON.parse(cfg.clonedVoices ?? '[]'); } catch { return []; } })();

  const hasAudio = data.status === 'done' && !!data.outputUrl;
  const baseW = enlarged ? 460 : 360;
  const baseH = enlarged ? 360 : 300;

  const set = (patch: any) => updateConfig(id, patch);
  // 输入框本地state+防抖(中文输入不被打断)
  const textField = useDebouncedField(text, (v) => set({ text: v }));
  const designField = useDebouncedField(designPrompt, (v) => set({ designPrompt: v }));
  const cloneField = useDebouncedField(cloneText, (v) => set({ cloneText: v }));
  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 克隆模式:上传音频文件拿 fileId
  const uploadCloneFile = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '上传失败');
      setUploadedFileId(d.fileId || d.file_id || '');
      alert('音频上传成功,可以开始复刻');
    } catch (err: any) {
      alert('上传失败: ' + (err?.message || err));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerate = async () => {
    const userId = await getUserId();
    if (mode === 'synthesize') {
      if (!text || !voiceId) { alert('请输入文本和 Voice ID'); return; }
      updateCard(id, { status: 'generating', progress: 30, outputUrl: null });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'synthesize', text, voiceId, speed, vol, pitch, userId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '生成失败');
        updateCard(id, { status: 'done', progress: 100, outputUrl: d.audioUrl || d.url });
        (window as any).saveCanvasV2Now?.();
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('生成失败: ' + (err?.message || err));
      }
    } else if (mode === 'design') {
      if (!designPrompt || !voiceId) { alert('请输入音色描述和 Voice ID'); return; }
      updateCard(id, { status: 'generating', progress: 30 });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'design', prompt: designPrompt, previewText, voiceId, userId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '设计失败');
        updateCard(id, { status: 'done', progress: 100, outputUrl: d.audioUrl || d.url || null });
        // 自动存入我的音色库(设计来源)
        await saveVoice({ voiceId, description: designPrompt, source: 'design', voiceType: 'human' });
        await refreshVoices();
        alert('音色设计成功!Voice ID 已存入「我的音色库」: ' + voiceId);
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('设计失败: ' + (err?.message || err));
      }
    } else {
      // clone
      if (!uploadedFileId || !voiceId) { alert('请先上传音频文件并输入 Voice ID'); return; }
      if (voiceId.length < 8 || voiceId.length > 256) { alert('Voice ID 长度必须在 8-256 字符之间'); return; }
      if (!/^[a-zA-Z]/.test(voiceId)) { alert('Voice ID 必须以字母开头'); return; }
      if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) { alert('Voice ID 只能包含字母、数字、下划线和连字符'); return; }
      if (/[-_]$/.test(voiceId)) { alert('Voice ID 不能以连字符或下划线结尾'); return; }
      updateCard(id, { status: 'generating', progress: 30 });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'clone', fileId: uploadedFileId, voiceId, text: cloneText, userId }),
        });
        const d = await res.json();
        if (!res.ok) {
          const m = d.error || '复刻失败';
          throw new Error(m.includes('duration too short') ? '音频时长太短,至少需要 10 秒' : m);
        }
        set({ clonedVoices: JSON.stringify([...clonedVoices, voiceId]) });
        // 自动存入我的音色库(复刻来源)
        await saveVoice({ voiceId, description: '复刻音色', source: 'clone', voiceType: 'human' });
        await refreshVoices();
        updateCard(id, { status: 'done', progress: 100 });
        alert(`音色复刻成功!\nVoice ID: ${voiceId}\n已存入「我的音色库」,可在语音合成模式选择使用。`);
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('复刻失败: ' + (err?.message || err));
      }
    }
  };

  // 收起态
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onDoubleClick={toggleCollapse} style={{ width: 160, height: 44, background: GLASS_BG, border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a1a1aa', fontSize: 12, backdropFilter: 'blur(20px)' }}>
          🎙 语音合成
        </div>
      </>
    );
  }

  return (
    <>
      <Ports />
      <div style={{
        width: baseW, height: baseH, background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        position: 'relative', transition: 'border-color .25s, box-shadow .25s, width .3s, height .3s',
      }}>
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', gap: 10 }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>处理中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasAudio ? (
            <audio src={data.outputUrl!} controls style={{ width: '90%' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#71717a' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎙</div>
              <div style={{ fontSize: 13 }}>语音合成</div>
              <div style={{ fontSize: 10, color: '#5a5a5f', marginTop: 4 }}>选中卡片 → 底部输入文本 → 生成</div>
            </div>
          )}
        </div>
      </div>

      {/* 底部弹窗:模式 + 文本/参数 */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {/* 模式切换 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['synthesize', 'design', 'clone'] as AudioMode[]).map((m) => (
              <button key={m} onClick={() => set({ audioMode: m })}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                  background: mode === m ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.05)',
                  color: mode === m ? '#fff' : '#a1a1aa', border: `1px solid ${mode === m ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                {m === 'synthesize' ? '语音合成' : m === 'design' ? '音色设计' : '音色克隆'}
              </button>
            ))}
          </div>

          {/* Voice ID 输入(三模式共用) + 音色库入口 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input value={voiceId} onChange={(e) => set({ voiceId: e.target.value })} placeholder="Voice ID"
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
            <button onClick={() => setLibOpen((v) => !v)} title="我的音色库"
              style={{ padding: '0 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                background: libOpen ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.06)', color: libOpen ? '#fff' : '#a1a1aa',
                border: `1px solid ${libOpen ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.12)'}` }}>
              音色库{voices.length > 0 ? ` ${voices.length}` : ''}
            </button>
            {/* 手动收藏当前 Voice ID(网络找的也能存) */}
            {voiceId && !voices.some((v) => v.voiceId === voiceId) && (
              <button onClick={async () => { await saveVoice({ voiceId, source: 'manual', voiceType: 'human' }); await refreshVoices(); }}
                title="收藏当前 ID 到音色库"
                style={{ padding: '0 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.12)' }}>
                ★收藏
              </button>
            )}
          </div>

          {/* 我的音色库面板:选 ID / 改名 / 删除 */}
          {libOpen && (
            <div className="nodrag nowheel cv2-scroll" style={{ marginBottom: 8, maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              {voices.length === 0 ? (
                <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center', padding: '10px 0' }}>音色库为空。设计/复刻成功会自动存入,或填 ID 后点★收藏。</div>
              ) : voices.map((v) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={() => { set({ voiceId: v.voiceId }); setLibOpen(false); }}
                    style={{ flex: 1, textAlign: 'left', background: voiceId === v.voiceId ? 'rgba(59,130,246,0.2)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '2px 4px' }}>
                    <div style={{ fontSize: 11, color: '#e4e4e7' }}>{v.name || v.voiceId.slice(0, 18)}
                      <span style={{ fontSize: 9, marginLeft: 6, color: v.source === 'design' ? '#86efac' : v.source === 'clone' ? '#c4b5fd' : '#71717a' }}>
                        {v.source === 'design' ? '设计' : v.source === 'clone' ? '复刻' : '收藏'}
                      </span>
                    </div>
                    {v.description && <div style={{ fontSize: 9, color: '#71717a', marginTop: 1 }}>{v.description.slice(0, 30)}</div>}
                  </button>
                  <button onClick={async () => {
                      const nn = prompt('重命名音色', v.name || '');
                      if (nn !== null) { const { renameVoice } = await import('../lib/voiceLibrary'); await renameVoice(v.voiceId, nn); await refreshVoices(); }
                    }} title="改名" style={{ fontSize: 10, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer' }}>✎</button>
                  <button onClick={async () => { if (confirm('从音色库删除?')) { await deleteVoice(v.voiceId); await refreshVoices(); } }}
                    title="删除" style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {mode === 'synthesize' && (
            <>
              <textarea className="nodrag nopan nowheel cv2-scroll" value={textField.value} {...textField.bind}
                placeholder="输入要合成的文本…" rows={3} style={textareaStyle} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <NumIn label="语速" value={speed} step={0.1} min={0.5} max={2} onChange={(v) => set({ speed: v })} />
                <NumIn label="音量" value={vol} step={0.1} min={0.1} max={2} onChange={(v) => set({ vol: v })} />
                <NumIn label="音调" value={pitch} step={1} min={-12} max={12} onChange={(v) => set({ pitch: v })} />
              </div>
            </>
          )}
          {mode === 'design' && (
            <>
              <textarea className="nodrag nopan nowheel cv2-scroll" value={designField.value} {...designField.bind}
                placeholder="描述想要的音色(如:温柔的女声、低沉磁性的男声)…" rows={2} style={textareaStyle} />
              <input value={previewText} onChange={(e) => set({ previewText: e.target.value })} placeholder="试听文本(可选)" style={inputStyle} />
            </>
          )}
          {mode === 'clone' && (
            <>
              <label style={{ ...uploadBtn, ...(uploadingFile ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconUpload size={13} /> <span>{uploadingFile ? '上传中…' : (uploadedFileId ? '已上传,可更换' : '上传音频样本(≥10秒)')}</span>
                <input type="file" accept="audio/*" disabled={uploadingFile} style={{ display: 'none' }} onChange={(e) => { uploadCloneFile(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              <textarea className="nodrag nopan nowheel cv2-scroll" value={cloneField.value} {...cloneField.bind}
                placeholder="复刻后试听文本(可选)…" rows={2} style={textareaStyle} />
            </>
          )}

          <button onClick={handleGenerate} disabled={data.status === 'generating'} style={{ ...generateBtn, opacity: data.status === 'generating' ? 0.4 : 1, cursor: data.status === 'generating' ? 'default' : 'pointer' }}>
            {data.status === 'generating' ? '生成中…' : mode === 'synthesize' ? '生成语音' : mode === 'design' ? '设计音色' : '开始复刻'}
          </button>
        </div>
      </NodeToolbar>

      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !sub} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtn}>
            {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
          </button>
        </div>
      </NodeToolbar>
    </>
  );

  function Ports() {
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}>
          <span style={portPlusIcon}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
}

function NumIn({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 9, color: '#71717a', marginBottom: 2 }}>{label}</div>
      <input type="number" value={value} step={step} min={min} max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 6px', color: '#fff', fontSize: 11, boxSizing: 'border-box' }} />
    </div>
  );
}

const promptBar: React.CSSProperties = {
  width: 360, padding: 10, background: 'rgba(24,24,27,0.96)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, boxShadow: '0 18px 55px rgba(0,0,0,0.6)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '7px 10px', color: '#e4e4e7', fontSize: 12, marginBottom: 6, boxSizing: 'border-box',
};
const textareaStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '8px 10px', color: '#e4e4e7', fontSize: 12, resize: 'none', outline: 'none', boxSizing: 'border-box',
};
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '8px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.04)', color: '#a1a1aa', fontSize: 11, cursor: 'pointer', marginBottom: 6,
};
const generateBtn: React.CSSProperties = {
  width: '100%', padding: '9px 0', marginTop: 8, borderRadius: 10, border: 'none',
  background: '#fff', color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const track: React.CSSProperties = { width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 7,
  border: 'none', background: 'rgba(0,0,0,0.4)', color: '#d4d4d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
};
const toolRow: React.CSSProperties = {
  display: 'flex', gap: 6, padding: 6, background: 'rgba(28,28,32,0.92)',
  borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)',
};
const toolBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function portCircle(color: string): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', background: color, border: '3px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };
}

export const AudioNode = memo(AudioNodeComponent);
