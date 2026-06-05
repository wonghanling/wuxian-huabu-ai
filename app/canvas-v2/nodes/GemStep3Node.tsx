'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { HoverZoomImg } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, generateGemTransitions, getUserId } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';

// ============================================================
// GEM 导演引擎 Step3 · 视频过渡指令
// 输入:首帧图 + 尾帧图(可连接上游或手动上传) + 角色提示 + 剧情引导
// 输出:视频过渡指令 JSON 显示在卡片框
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

function GemStep3NodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasResult = data.status === 'done' && !!data.text;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<'ref' | null>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)

  // 首帧/尾帧图 — 存在 refImages[0] 和 refImages[1]
  const refImages = data.config.refImages ?? [];
  const startImage = refImages[0];
  const endImage = refImages[1];
  // 连线实时:首/尾帧可来自连接(照原网渲染时实时读)
  const upstreamLive = useUpstream(id);
  const dispStart = startImage || upstreamLive.images[0];
  const dispEnd = endImage || upstreamLive.images[1];
  const startFromConn = !startImage && !!upstreamLive.images[0];
  const endFromConn = !endImage && !!upstreamLive.images[1];

  // 角色提示 存在 ratio 字段(复用), 剧情引导存在 preset 字段
  const characterHint = data.config.ratio ?? '';
  const actionSuggestion = data.config.preset ?? '';

  const mult = enlarged ? 1.7 : 1;
  const W = 360 * mult;
  const H = 280 * mult;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const uploadFrame = async (index: 0 | 1, fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(f);
      if (!url) return;
      const cur = [...(data.config.refImages ?? [])];
      cur[index] = url;
      updateConfig(id, { refImages: cur });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    // 连线传参:首帧/尾帧优先上游图
    const upstream = getUpstreamOutputs(id);
    const effStart = startImage || upstream.images[0];
    const effEnd = endImage || upstream.images[1];
    if (!effStart || !effEnd) return;
    updateCard(id, { status: 'generating', progress: 10 });
    let p = 10;
    const timer = setInterval(() => { p = Math.min(90, p + 8); updateCard(id, { progress: p }); }, 600);
    try {
      const userId = await getUserId();
      const result = await generateGemTransitions({
        startImage: effStart, endImage: effEnd, characterHint, actionSuggestion, userId,
      });
      clearInterval(timer);
      updateCard(id, { status: 'done', progress: 100, text: result });
      (window as any).saveCanvasV2Now?.();
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert('过渡指令生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>导演引擎 Step3</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>视频过渡指令</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn}><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      {/* 卡片框 */}
      <div style={{
        width: W, height: H,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        position: 'relative',
        transition: 'border-color .25s, box-shadow .25s, width .3s, height .3s',
      }}>
        <button onClick={toggleCollapse} style={floatMinus}><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '80%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>生成过渡指令中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasResult ? (
            <pre style={{ fontSize: 11, color: '#e4e4e7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflow: 'auto', maxHeight: '100%', width: '100%', margin: 0, fontFamily: 'monospace' }}>
              {data.text}
            </pre>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#71717a', marginBottom: 6 }}>GEM 导演引擎 · Step 3</div>
              <span style={{ fontSize: 12, color: '#5a5a5f' }}>上传首帧 + 尾帧 → 生成过渡指令</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部弹窗 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !hasResult} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />

          {/* 角色提示 + 剧情引导(大 prompt 区域) */}
          <textarea
            className="nodrag nopan nowheel"
            value={characterHint}
            onChange={(e) => updateConfig(id, { ratio: e.target.value })}
            placeholder="角色提示（可选）：silver-white hair, mechanical right arm..."
            rows={2}
            style={promptInput}
          />
          <textarea
            className="nodrag nopan nowheel"
            value={actionSuggestion}
            onChange={(e) => updateConfig(id, { preset: e.target.value })}
            placeholder="剧情引导（可选）：他很害怕然后逃跑、慢慢转身离开..."
            rows={2}
            style={{ ...promptInput, borderTop: '1px solid rgba(255,255,255,0.06)' }}
          />

          {/* 参数按钮行 — 参考图按钮(首帧+尾帧,可来自连接) */}
          <div style={tagsRow}>
            <ParamTag
              label={<>参考图{(dispStart || dispEnd) ? <span style={greenDot} /> : ' (首帧+尾帧)'}{(startFromConn || endFromConn) && <span style={{ marginLeft: 4, color: '#a78bfa' }}>来自连接</span>}</>}
              open={sub === 'ref'}
              onToggle={() => setSub(sub === 'ref' ? null : 'ref')}
              width={300}
            >
              <div style={{ display: 'flex', gap: 10, padding: 6 }}>
                <FrameSlot label={startFromConn ? '首帧·连接' : '首帧'} url={dispStart}
                  onUpload={(fl) => uploadFrame(0, fl)} uploading={uploading}
                  onClear={() => { const cur = [...(data.config.refImages ?? [])]; cur[0] = ''; updateConfig(id, { refImages: cur }); }} />
                <FrameSlot label={endFromConn ? '尾帧·连接' : '尾帧'} url={dispEnd}
                  onUpload={(fl) => uploadFrame(1, fl)} uploading={uploading}
                  onClear={() => { const cur = [...(data.config.refImages ?? [])]; cur[1] = ''; updateConfig(id, { refImages: cur }); }} />
              </div>
            </ParamTag>
          </div>

          {/* 底行 Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>首帧 + 尾帧必填</span>
            <button onClick={handleGenerate} disabled={!dispStart || !dispEnd}
              style={{ ...generateBtn, opacity: dispStart && dispEnd ? 1 : 0.4 }}>
              Generate
            </button>
          </div>
        </div>
      </NodeToolbar>

      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide}>
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
        {/* Step3 照原网无"+"号下游菜单,仅可拖线连接 */}
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }} />
      </>
    );
  }
}

// ===== 首帧/尾帧上传槽 =====
function FrameSlot({ label, url, onUpload, onClear, uploading }: {
  label: string; url?: string;
  onUpload: (fl: FileList | null) => void;
  onClear: () => void;
  uploading?: boolean;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}>
        {url ? (
          <>
            <HoverZoomImg url={url} />
            <button style={frameDel} onClick={onClear}>×</button>
          </>
        ) : (
          <label style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'default' : 'pointer', color: '#6b7280', opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
            <IconPlus size={16} />
            <span style={{ fontSize: 10, marginTop: 3 }}>{uploading ? '上传中…' : `上传${label}`}</span>
            <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ''; }} />
          </label>
        )}
      </div>
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
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
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
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const promptBar: React.CSSProperties = {
  width: 520, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#d4d4d8', fontSize: 12,
  outline: 'none', fontFamily: 'inherit',
};
const frameDel: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const toolRow: React.CSSProperties = { display: 'flex', gap: 8 };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};
const promptInput: React.CSSProperties = {
  width: '100%', padding: '36px 12px 8px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
  lineHeight: 1.55, userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 8px 4px' };
const tagBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 8,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const greenDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', background: '#34d399',
  display: 'inline-block', marginLeft: 4,
};

function ParamTag({ label, open, onToggle, width = 200, children }: {
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

export const GemStep3Node = memo(GemStep3NodeComponent);
