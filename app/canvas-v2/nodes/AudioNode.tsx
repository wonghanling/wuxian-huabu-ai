'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconMinus, IconPlus, IconUpload } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { getUserId } from '../lib/api';
import { useDebouncedField } from '../lib/useDebouncedField';
import { loadVoices, saveVoice, deleteVoice, renameVoice, type VoiceEntry } from '../lib/voiceLibrary';

// ============================================================
// 语音卡片(对齐其它卡片:底部一体式栏 + 功能弹窗平铺选择)
// 人声(MiniMax):语音合成 / 音色设计 / 音色复刻
// 场景声(fal stable-audio-3):文本转音频 / 文本转音效 / 音效转换 / 音乐转换
// voice_id 存入 voice_library 表(按用户隔离)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

const DEFAULT_VOICE = 'moss_audio_ce44fc67-7ce3-11f0-8de5-96e35d26fb85';

// 全部功能(平铺,选哪个填哪个)
type Fn = 'synthesize' | 'design' | 'clone' | 'scene-text-audio' | 'scene-text-sound' | 'scene-sound' | 'scene-music';
const FUNCTIONS: { key: Fn; label: string; group: '人声' | '场景声'; desc: string; needAudio?: boolean }[] = [
  { key: 'synthesize',       label: '语音合成', group: '人声',   desc: '填 Voice ID + 文本 → 语音' },
  { key: 'design',           label: '音色设计', group: '人声',   desc: '描述音色 → 生成专属 Voice ID' },
  { key: 'clone',            label: '音色复刻', group: '人声',   desc: '上传音频样本 → 复刻出 Voice ID' },
  { key: 'scene-text-audio', label: '文本转音频', group: '场景声', desc: '文字描述 → 生成音频 ¥0.3' },
  { key: 'scene-text-sound', label: '文本转音效', group: '场景声', desc: '文字描述 → 生成音效 ¥0.3' },
  { key: 'scene-sound',      label: '音效转换',   group: '场景声', desc: '上传音效 + 描述 → 新音效 ¥0.3', needAudio: true },
  { key: 'scene-music',      label: '音乐转换',   group: '场景声', desc: '上传音乐 + 描述 → 新音乐 ¥0.3', needAudio: true },
];
const SCENE_MODE_MAP: Record<string, string> = {
  'scene-text-audio': 'text-to-audio', 'scene-text-sound': 'text-to-sound',
  'scene-sound': 'sound-to-sound', 'scene-music': 'music-to-music',
};

function AudioNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<'fn' | 'lib' | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [sceneAudioUrl, setSceneAudioUrl] = useState('');   // 场景声 audio-to-audio 输入音频 URL
  const [voices, setVoices] = useState<VoiceEntry[]>([]);

  const cfg = data.config as any;
  const fn: Fn = (cfg.audioFn as Fn) ?? 'synthesize';
  const fnDef = FUNCTIONS.find((f) => f.key === fn)!;
  const isScene = fn.startsWith('scene-');
  const text = cfg.text ?? '';
  const voiceId = cfg.voiceId ?? DEFAULT_VOICE;
  const designPrompt = cfg.designPrompt ?? '';
  const sceneDuration = cfg.sceneDuration ?? 30;

  const hasAudio = data.status === 'done' && !!data.outputUrl;
  const baseW = enlarged ? 460 : 360;
  const baseH = enlarged ? 360 : 300;

  const set = (patch: any) => updateConfig(id, patch);
  const textField = useDebouncedField(text, (v) => set({ text: v }));
  const designField = useDebouncedField(designPrompt, (v) => set({ designPrompt: v }));
  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  const refreshVoices = async () => setVoices(await loadVoices());
  useEffect(() => { refreshVoices(); }, []);
  useEffect(() => { if (!selected && sub) setSub(null); }, [selected, sub]);

  // 上传音频:克隆样本(拿 fileId) 或 场景声输入音频(拿 URL)
  const uploadAudio = async (fileList: FileList | null, forScene: boolean) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || '上传失败');
      if (forScene) { setSceneAudioUrl(d.url || d.audioUrl || ''); }
      else { setUploadedFileId(d.fileId || d.file_id || ''); alert('音频上传成功,可以开始复刻'); }
    } catch (err: any) {
      alert('上传失败: ' + (err?.message || err));
    } finally {
      setUploadingFile(false);
    }
  };

  const handleGenerate = async () => {
    const userId = await getUserId();

    // ===== 场景声(fal stable-audio-3) =====
    if (isScene) {
      if (!designPrompt.trim()) { alert('请输入声音描述'); return; }
      if (fnDef.needAudio && !sceneAudioUrl) { alert('请先上传输入音频'); return; }
      updateCard(id, { status: 'generating', progress: 30, outputUrl: null });
      try {
        const res = await fetch('/api/audio/scene-generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneMode: SCENE_MODE_MAP[fn], prompt: designPrompt, audioUrl: sceneAudioUrl || undefined, duration: sceneDuration, userId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '生成失败');
        updateCard(id, { status: 'done', progress: 100, outputUrl: d.audioUrl });
        (window as any).saveCanvasV2Now?.();
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('生成失败: ' + (err?.message || err));
      }
      return;
    }

    // ===== 人声:语音合成 =====
    if (fn === 'synthesize') {
      if (!text || !voiceId) { alert('请输入文本和 Voice ID'); return; }
      updateCard(id, { status: 'generating', progress: 30, outputUrl: null });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'synthesize', text, voiceId, speed: cfg.speed ?? 1, vol: cfg.vol ?? 1, pitch: cfg.pitch ?? 0, userId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '生成失败');
        updateCard(id, { status: 'done', progress: 100, outputUrl: d.audioUrl || d.url });
        (window as any).saveCanvasV2Now?.();
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('生成失败: ' + (err?.message || err));
      }
    } else if (fn === 'design') {
      // ===== 人声:音色设计 =====
      if (!designPrompt || !voiceId) { alert('请输入音色描述和 Voice ID'); return; }
      updateCard(id, { status: 'generating', progress: 30 });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'design', prompt: designPrompt, previewText: cfg.previewText ?? '', voiceId, userId }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || '设计失败');
        updateCard(id, { status: 'done', progress: 100, outputUrl: d.audioUrl || d.url || null });
        await saveVoice({ voiceId, description: designPrompt, source: 'design', voiceType: 'human' });
        await refreshVoices();
        alert('音色设计成功!Voice ID 已存入「我的音色库」: ' + voiceId);
      } catch (err: any) {
        updateCard(id, { status: 'error', progress: 0 });
        alert('设计失败: ' + (err?.message || err));
      }
    } else {
      // ===== 人声:音色复刻 =====
      if (!uploadedFileId || !voiceId) { alert('请先上传音频文件并输入 Voice ID'); return; }
      if (voiceId.length < 8 || voiceId.length > 256) { alert('Voice ID 长度必须在 8-256 字符之间'); return; }
      if (!/^[a-zA-Z]/.test(voiceId)) { alert('Voice ID 必须以字母开头'); return; }
      if (!/^[a-zA-Z0-9_-]+$/.test(voiceId)) { alert('Voice ID 只能包含字母、数字、下划线和连字符'); return; }
      if (/[-_]$/.test(voiceId)) { alert('Voice ID 不能以连字符或下划线结尾'); return; }
      updateCard(id, { status: 'generating', progress: 30 });
      try {
        const res = await fetch('/api/audio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'clone', fileId: uploadedFileId, voiceId, text: '', userId }),
        });
        const d = await res.json();
        if (!res.ok) {
          const m = d.error || '复刻失败';
          throw new Error(m.includes('duration too short') ? '音频时长太短,至少需要 10 秒' : m);
        }
        await saveVoice({ voiceId, description: '复刻音色', source: 'clone', voiceType: 'human' });
        await refreshVoices();
        updateCard(id, { status: 'done', progress: 100 });
        alert(`音色复刻成功!\nVoice ID: ${voiceId}\n已存入「我的音色库」。`);
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
          🎙 {fnDef.label}
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
              <div style={{ fontSize: 28, marginBottom: 8 }}>{isScene ? '🔊' : '🎙'}</div>
              <div style={{ fontSize: 13, color: '#d4d4d8' }}>{fnDef.label}</div>
              <div style={{ fontSize: 10, color: '#5a5a5f', marginTop: 4 }}>{fnDef.desc}</div>
            </div>
          )}
        </div>
      </div>

      {/* 底部一体式栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {/* 功能选择(平铺弹窗) + 音色库 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <ParamTag label={`${fnDef.group} · ${fnDef.label} ▾`} open={sub === 'fn'} onToggle={() => setSub(sub === 'fn' ? null : 'fn')} width={300}>
              {(['人声', '场景声'] as const).map((g) => (
                <div key={g}>
                  <div style={{ fontSize: 10, color: '#71717a', padding: '6px 8px 2px' }}>{g}</div>
                  {FUNCTIONS.filter((f) => f.group === g).map((f) => (
                    <button key={f.key} onClick={() => { set({ audioFn: f.key }); setSub(null); }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', textAlign: 'left', cursor: 'pointer',
                        background: fn === f.key ? 'rgba(192,192,192,0.16)' : 'transparent', color: '#d4d4d8' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>{f.label}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{f.desc}</span>
                    </button>
                  ))}
                </div>
              ))}
            </ParamTag>
            {/* 人声功能才有音色库 */}
            {!isScene && (
              <button onClick={() => setSub(sub === 'lib' ? null : 'lib')} title="我的音色库"
                style={{ padding: '0 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: sub === 'lib' ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.06)', color: sub === 'lib' ? '#fff' : '#a1a1aa',
                  border: `1px solid ${sub === 'lib' ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.12)'}` }}>
                音色库{voices.length > 0 ? ` ${voices.length}` : ''}
              </button>
            )}
          </div>

          {/* 音色库面板 */}
          {sub === 'lib' && !isScene && (
            <div className="nodrag nowheel cv2-scroll" style={{ marginBottom: 8, maxHeight: 150, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              {voices.length === 0 ? (
                <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center', padding: '10px 0' }}>音色库为空。设计/复刻成功会自动存入。</div>
              ) : voices.map((v) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={() => { set({ voiceId: v.voiceId }); setSub(null); }}
                    style={{ flex: 1, textAlign: 'left', background: voiceId === v.voiceId ? 'rgba(59,130,246,0.2)' : 'transparent', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '2px 4px' }}>
                    <div style={{ fontSize: 11, color: '#e4e4e7' }}>{v.name || v.voiceId.slice(0, 18)}
                      <span style={{ fontSize: 9, marginLeft: 6, color: v.source === 'design' ? '#86efac' : v.source === 'clone' ? '#c4b5fd' : '#71717a' }}>
                        {v.source === 'design' ? '设计' : v.source === 'clone' ? '复刻' : '收藏'}
                      </span>
                    </div>
                  </button>
                  <button onClick={async () => { const nn = prompt('重命名音色', v.name || ''); if (nn !== null) { await renameVoice(v.voiceId, nn); await refreshVoices(); } }} title="改名" style={{ fontSize: 10, color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer' }}>✎</button>
                  <button onClick={async () => { if (confirm('从音色库删除?')) { await deleteVoice(v.voiceId); await refreshVoices(); } }} title="删除" style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* ===== 人声:语音合成 ===== */}
          {fn === 'synthesize' && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={voiceId} onChange={(e) => set({ voiceId: e.target.value })} placeholder="Voice ID" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                {voiceId && !voices.some((v) => v.voiceId === voiceId) && (
                  <button onClick={async () => { await saveVoice({ voiceId, source: 'manual', voiceType: 'human' }); await refreshVoices(); }} title="收藏到音色库"
                    style={{ padding: '0 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.12)' }}>★</button>
                )}
              </div>
              <textarea className="nodrag nopan nowheel cv2-scroll" value={textField.value} {...textField.bind} placeholder="输入要合成的文本…" rows={3} style={textareaStyle} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <NumIn label="语速" value={cfg.speed ?? 1} step={0.1} min={0.5} max={2} onChange={(v) => set({ speed: v })} />
                <NumIn label="音量" value={cfg.vol ?? 1} step={0.1} min={0.1} max={2} onChange={(v) => set({ vol: v })} />
                <NumIn label="音调" value={cfg.pitch ?? 0} step={1} min={-12} max={12} onChange={(v) => set({ pitch: v })} />
              </div>
            </>
          )}

          {/* ===== 人声:音色设计 ===== */}
          {fn === 'design' && (
            <>
              <input value={voiceId} onChange={(e) => set({ voiceId: e.target.value })} placeholder="给新音色起个 Voice ID(字母开头)" style={inputStyle} />
              <textarea className="nodrag nopan nowheel cv2-scroll" value={designField.value} {...designField.bind} placeholder="描述想要的音色(如:温柔的女声、低沉磁性的男声)…" rows={2} style={textareaStyle} />
              <input value={cfg.previewText ?? ''} onChange={(e) => set({ previewText: e.target.value })} placeholder="试听文本(可选)" style={{ ...inputStyle, marginTop: 6, marginBottom: 0 }} />
            </>
          )}

          {/* ===== 人声:音色复刻 ===== */}
          {fn === 'clone' && (
            <>
              <input value={voiceId} onChange={(e) => set({ voiceId: e.target.value })} placeholder="给复刻音色起个 Voice ID(字母开头)" style={inputStyle} />
              <label style={{ ...uploadBtn, ...(uploadingFile ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconUpload size={13} /> <span>{uploadingFile ? '上传中…' : (uploadedFileId ? '已上传,可更换' : '上传音频样本(≥10秒)')}</span>
                <input type="file" accept="audio/*" disabled={uploadingFile} style={{ display: 'none' }} onChange={(e) => { uploadAudio(e.target.files, false); e.currentTarget.value = ''; }} />
              </label>
            </>
          )}

          {/* ===== 场景声(fal):描述 + 时长 + (转换类)输入音频 ===== */}
          {isScene && (
            <>
              {fnDef.needAudio && (
                <label style={{ ...uploadBtn, ...(uploadingFile ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                  <IconUpload size={13} /> <span>{uploadingFile ? '上传中…' : (sceneAudioUrl ? '已上传输入音频,可更换' : `上传${fn === 'scene-music' ? '音乐' : '音效'}文件`)}</span>
                  <input type="file" accept="audio/*" disabled={uploadingFile} style={{ display: 'none' }} onChange={(e) => { uploadAudio(e.target.files, true); e.currentTarget.value = ''; }} />
                </label>
              )}
              <textarea className="nodrag nopan nowheel cv2-scroll" value={designField.value} {...designField.bind} placeholder={fn === 'scene-music' ? '描述想要的音乐(如:轻快的爵士钢琴)…' : '描述想要的声音/音效(如:海浪拍打礁石、雨夜雷声)…'} rows={3} style={textareaStyle} />
              <div style={{ marginTop: 6 }}>
                <NumIn label="时长(秒)" value={sceneDuration} step={5} min={5} max={180} onChange={(v) => set({ sceneDuration: v })} />
              </div>
            </>
          )}

          {/* 生成按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            {isScene && <span style={{ fontSize: 11, color: '#71717a' }}>¥0.3/次</span>}
            <button onClick={handleGenerate} disabled={data.status === 'generating'}
              style={{ ...generateBtn, marginTop: 0, flex: 1, opacity: data.status === 'generating' ? 0.4 : 1, cursor: data.status === 'generating' ? 'default' : 'pointer' }}>
              {data.status === 'generating' ? '处理中…' : isScene ? '生成' : fn === 'synthesize' ? '生成语音' : fn === 'design' ? '设计音色' : '开始复刻'}
            </button>
          </div>
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

// 弹窗标签(对齐其它卡 ParamTag 风格:正上方弹出)
function ParamTag({ label, open, onToggle, width, children }: { label: React.ReactNode; open: boolean; onToggle: () => void; width: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <button onClick={onToggle} style={{ width: '100%', height: 30, borderRadius: 8, border: `1px solid ${open ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.12)'}`, background: open ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)', color: '#e4e4e7', cursor: 'pointer', fontSize: 11.5 }}>{label}</button>
      {open && (
        <div className="nodrag nowheel cv2-scroll" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, width, maxHeight: 280, overflowY: 'auto', background: 'rgba(28,28,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 6, backdropFilter: 'blur(24px)', boxShadow: '0 18px 55px rgba(0,0,0,0.6)', zIndex: 20 }}>
          {children}
        </div>
      )}
    </div>
  );
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
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function portCircle(color: string): React.CSSProperties {
  return { width: 28, height: 28, borderRadius: '50%', background: color, border: '3px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' };
}

export const AudioNode = memo(AudioNodeComponent);
