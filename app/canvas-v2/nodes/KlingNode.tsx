'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { KLING_LIPSYNC_PRICE, KLING_VIDEO_HINT, KLING_AUDIO_HINT } from '../klingConfig';
import { ratioToWH } from '../imageModels';
import { IconVideo, IconExpand, IconShrink, IconMinus, IconPlus, IconUpload, IconScissors } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { PromptTools } from './PromptTools';
import { uploadFileToStorage, generateKlingLipSync, mirrorOutput } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';

// ============================================================
// Kling 对口型卡片 · 矩形框
// 输入:源视频 + 音频(都做成参考内容弹窗按钮);输出对口型视频显示在卡片框
// 价格按次固定(会员¥1.085 / 普通¥1.285)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type SubPanel = 'video' | 'audio' | null;

function KlingNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasVideo = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [editing, setEditing] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<SubPanel>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)
  const editRef = useRef<HTMLTextAreaElement>(null);

  const srcVideo = data.config.refVideos?.[0];
  const srcVideoName = data.config.refVideoNames?.[0];
  // 连线实时:上游视频→源视频,上游音频→音频(照原网渲染时实时读)
  const upstreamLive = useUpstream(id);
  const connVideo = upstreamLive.videos[0];
  const dispVideo = srcVideo || connVideo;
  const videoFromConn = !srcVideo && !!connVideo;
  const audioName = data.config.refAudioName;

  // 卡片框:矩形(默认 16:9),只显示成品
  const mult = enlarged ? 1.7 : 1;
  const dims = ratioToWH('16:9', 360 * mult);

  useEffect(() => { if (editing && editRef.current) editRef.current.focus(); }, [editing]);

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 上传源视频(真实上传到 storage,拿 URL)
  const uploadSrcVideo = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'video');
      if (url) updateConfig(id, { refVideos: [url], refVideoNames: [f.name] });
    } finally {
      setUploading(false);
    }
  };
  const uploadAudio = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadFileToStorage(f, 'audio');
      if (url) updateConfig(id, { refAudio: url, refAudioName: f.name });
    } finally {
      setUploading(false);
    }
  };
  // 顶部上传:成品视频(进卡片框)
  const uploadResult = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    updateCard(id, { status: 'done', outputUrl: URL.createObjectURL(f) });
  };

  const handleGenerate = async () => {
    // 连线传参:上游视频→源视频,上游音频→音频
    const upstream = getUpstreamOutputs(id);
    const effVideo = srcVideo || upstream.videos[0];
    const effAudio = data.config.refAudio || upstream.audios[0];
    if (!effVideo || !effAudio) return;  // 需要视频+音频
    updateCard(id, { status: 'generating', progress: 5 });
    try {
      const videoUrl = await generateKlingLipSync(
        { videoUrl: effVideo, audioUrl: effAudio },
        (progress) => updateCard(id, { progress }),
      );
      updateCard(id, { status: 'done', progress: 100, outputUrl: videoUrl });
      mirrorOutput(videoUrl, 'video').then((permUrl) => {
        if (permUrl && permUrl !== videoUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      updateCard(id, { status: 'error', progress: 0 });
      alert('对口型生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}><span style={{ color: '#d4d4d8', display: 'flex' }}><IconVideo size={18} /></span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>Kling 对口型</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>点击展开</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn} title="展开"><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      <div
        style={{
          width: dims.w, height: dims.h,
          background: GLASS_BG,
          backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
          border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
          borderRadius: 20, overflow: 'hidden',
          backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
          transition: 'border-color .25s, box-shadow .25s, width .3s cubic-bezier(.34,1.2,.4,1), height .3s cubic-bezier(.34,1.2,.4,1)',
          position: 'relative',
        }}
      >
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>对口型生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasVideo ? (
            <>
              <img src={data.outputUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span style={playBadge}>▶</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>上传视频+音频 · 点击下方生成</span>
          )}
        </div>
      </div>

      {/* ===== 底部一体式栏 ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !hasVideo} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />
          <textarea
            className="nodrag nopan nowheel"
            value={data.config.prompt}
            onChange={(e) => updateConfig(id, { prompt: e.target.value })}
            placeholder="备注(可选)…"
            rows={2}
            style={promptInput}
          />

          {/* 参数标签行:源视频 + 音频(各自从按钮正上方弹出) */}
          <div style={tagsRow}>
            <ParamTag label={<>源视频{dispVideo && <span style={greenDot} />}{videoFromConn && <span style={{ marginLeft: 4, color: '#a78bfa' }}>来自连接</span>}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</>} open={sub === 'video'} onToggle={() => setSub(sub === 'video' ? null : 'video')} width={260}>
              <label style={{ ...uploadBtn, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconUpload size={13} /> <span>{uploading ? '上传中…' : KLING_VIDEO_HINT}</span>
                <input type="file" accept="video/mp4,video/quicktime" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { uploadSrcVideo(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              {srcVideo ? (
                <div style={fileRow}>
                  <IconVideo size={13} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srcVideoName || '源视频'}</span>
                  <button style={fileDel} onClick={() => updateConfig(id, { refVideos: [], refVideoNames: [] })}>×</button>
                </div>
              ) : videoFromConn ? (
                <div style={fileRow}>
                  <IconVideo size={13} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a78bfa' }}>来自连接的视频</span>
                </div>
              ) : null}
            </ParamTag>

            <ParamTag label={<>音频{data.config.refAudio && <span style={greenDot} />}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</>} open={sub === 'audio'} onToggle={() => setSub(sub === 'audio' ? null : 'audio')} width={260}>
              <label style={{ ...uploadBtn, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconUpload size={13} /> <span>{uploading ? '上传中…' : KLING_AUDIO_HINT}</span>
                <input type="file" accept="audio/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { uploadAudio(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              {audioName && (
                <div style={fileRow}>
                  <span style={{ display: 'flex' }}>♪</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audioName}</span>
                  <button style={fileDel} onClick={() => updateConfig(id, { refAudio: undefined, refAudioName: undefined })}>×</button>
                </div>
              )}
            </ParamTag>
          </div>

          {/* 底行:固定价格(按次) + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '2px 6px 4px', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: '#e4e4e7' }}>
              会员 <b style={{ color: '#fff' }}>¥{KLING_LIPSYNC_PRICE.member.toFixed(3)}</b>
              <span style={{ color: '#71717a' }}> / 普通 ¥{KLING_LIPSYNC_PRICE.normal.toFixed(3)}</span>
            </span>
            <span style={{ fontSize: 10, color: '#52525b' }}>按次</span>
            <button onClick={handleGenerate} style={generateBtn}>Generate</button>
          </div>
        </div>
      </NodeToolbar>

      {/* ===== 顶部工具栏(剪辑 + 放大) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !sub} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => alert('剪辑功能开发中')} style={toolBtnWide} title="剪辑(开发中)">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconScissors size={16} /> 剪辑</span>
          </button>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide} title={enlarged ? '还原' : '放大卡片'}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
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

// ===== 小组件 =====
function ParamTag({ label, open, onToggle, width = 240, children }: {
  label: React.ReactNode; open: boolean; onToggle: () => void; width?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={onToggle} style={{ ...tagBtn, ...(open ? tagActive : {}) }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
      </button>
      {open && (
        <div style={{ ...popPanel, width }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

// ===== 样式 =====
function portCircle(c: string): React.CSSProperties {
  return {
    width: 20, height: 20, minWidth: 20, minHeight: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
    background: 'rgba(24,24,27,0.95)', border: `2px solid ${c}`,
    boxShadow: `0 0 10px ${c}, 0 0 0 4px rgba(0,0,0,0.25)`, color: '#e4e4e7', zIndex: 5,
  };
}
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function collapsedCard(selected: boolean): React.CSSProperties {
  return {
    width: 200, padding: '20px 18px',
    background: GLASS_BG, backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
    border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 18,
    backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 14px 40px rgba(0,0,0,0.5)' : '0 8px 28px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transform: 'translateZ(0)',
    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
  };
}
const collapsedIconWrap: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(128,128,128,0.10))',
  border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const pillBtn: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#a1a1aa', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 10,
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const modelBadge: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, zIndex: 10,
  padding: '3px 9px', borderRadius: 8, fontSize: 10, color: '#e4e4e7',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.12)',
};
const playBadge: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18,
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const promptBar: React.CSSProperties = {
  width: 680, minHeight: 340, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const promptInput: React.CSSProperties = {
  width: '100%', padding: '18px 16px 10px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 15, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.65, minHeight: 200,
  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 6px 6px' };
const tagBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', marginLeft: 4 };
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', marginBottom: 6,
  borderRadius: 8, border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)',
  color: '#d4d4d8', fontSize: 11, cursor: 'pointer',
};
const fileRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)',
  color: '#d4d4d8', fontSize: 11.5,
};
const fileDel: React.CSSProperties = {
  border: 'none', background: 'transparent', color: '#71717a', fontSize: 14, cursor: 'pointer', flexShrink: 0,
};
const toolRow: React.CSSProperties = { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const KlingNode = memo(KlingNodeComponent);
