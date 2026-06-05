'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { RefThumb } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, generateGemStoryboard, getUserId } from '../lib/api';

// ============================================================
// GEM 分镜设计卡片 (Step2)
// 输入:剧本文本 + 可选参考图(最多9张)
// 参数:模式(故事/时空) + 格子数 + 风格
// 输出:分镜 JSON 文案显示在卡片框
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type GemMode = 'story' | 'cinematic';

const STORY_GRIDS = [
  { value: '4', label: '2×2', desc: '4格' },
  { value: '9', label: '3×3', desc: '9格' },
  { value: '25', label: '5×5', desc: '25格' },
];
const CINEMATIC_GRIDS = [
  { value: '4', label: '2×2', desc: '4格' },
  { value: '9', label: '3×3', desc: '9格' },
];

const STYLE_OPTIONS = [
  { label: '电影写实3D', prompt: '3D animation style, game cinematic, Unreal Engine lighting, realistic shadows, high detail, consistent character,' },
  { label: '超写实电影', prompt: 'cinematic film still, photorealistic, natural skin texture, global illumination, volumetric lighting, depth of field,' },
  { label: '游戏CG', prompt: 'AAA game cinematic, Unreal Engine 5 render, real-time rendering, cinematic lighting, epic atmosphere,' },
  { label: '动漫3D', prompt: 'anime 3D style, stylized character, clean face shading, soft lighting, anime cinematic,' },
  { label: '宫崎骏', prompt: 'Studio Ghibli style, hand-painted background, soft warm lighting, anime film look,' },
  { label: '新海诚', prompt: 'Makoto Shinkai style, ultra detailed sky, light bloom, emotional atmosphere,' },
  { label: '黑暗电影', prompt: 'dark cinematic, moody lighting, low key lighting, dramatic shadows, foggy atmosphere,' },
  { label: '武侠电影', prompt: 'ancient Chinese wuxia style, dusty atmosphere, wind movement, cinematic composition, epic tone,' },
  { label: '赛博朋克3D', prompt: 'cyberpunk, futuristic city, neon lights, holographic displays, 3D render, Unreal Engine 5,' },
  { label: '赛博江湖', prompt: 'cyberpunk wuxia, futuristic ancient China, neon lanterns, glowing Chinese signs,' },
  { label: '迪士尼3D', prompt: 'Disney 3D animation style, expressive characters, bright colors, cinematic lighting,' },
  { label: '梦工厂', prompt: 'DreamWorks animation style, stylized 3D, dramatic lighting, expressive faces,' },
  { label: '卡通渲染', prompt: 'toon shading, cel shading, outline render, stylized 3D,' },
  { label: '油画风', prompt: 'oil painting, brush strokes, classical art,' },
  { label: '水墨风', prompt: 'ink wash painting, Chinese ink style, minimalist composition,' },
  { label: '电影胶片', prompt: 'film grain, analog film, vintage cinematic,' },
];

type SubPanel = 'mode' | 'grid' | 'style' | 'ref' | 'gemMode' | null;

const REF_MAX = 9;

function GemNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasResult = data.status === 'done' && !!data.text;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [sub, setSub] = useState<SubPanel>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [modeTooltip, setModeTooltip] = useState<GemMode | null>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)

  const mode: GemMode = (data.config.preset as GemMode) ?? 'story';
  const gridSize = data.config.textDuration ?? '9';   // 复用 textDuration 存格子数
  const style = data.config.ratio ?? '';              // 复用 ratio 存风格 prompt
  const styleLabel = STYLE_OPTIONS.find((s) => s.prompt === style)?.label ?? '';
  const refImages = data.config.refImages ?? [];
  const gridOptions = mode === 'story' ? STORY_GRIDS : CINEMATIC_GRIDS;
  const selectedGrid = gridOptions.find((g) => g.value === gridSize) ?? gridOptions[1];

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const addRefImages = async (fileList: FileList | null) => {
    if (!fileList) return;
    const cur = data.config.refImages ?? [];
    const room = Math.max(0, REF_MAX - cur.length);
    const files = Array.from(fileList).slice(0, room);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const url = await uploadImageToStorage(f);
        if (url) {
          const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config.refImages ?? [];
          updateConfig(id, { refImages: [...latest, url] });
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!data.config.prompt.trim()) return;
    updateCard(id, { status: 'generating', progress: 10 });
    let p = 10;
    const timer = setInterval(() => { p = Math.min(90, p + 8); updateCard(id, { progress: p }); }, 600);
    try {
      const userId = await getUserId();
      // 风格 prompt 拼在剧本前(照原网),refImages 已是 storage URL
      const script = style ? `${style}\n${data.config.prompt}` : data.config.prompt;
      const result = await generateGemStoryboard({
        images: refImages.length > 0 ? refImages : undefined,
        script,
        gridSize,
        mode,   // 'story' | 'cinematic'
        userId,
      });
      clearInterval(timer);
      updateCard(id, { status: 'done', progress: 100, text: result });
      (window as any).saveCanvasV2Now?.();
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert('分镜生成失败: ' + (err?.message || err));
    }
  };

  // 卡片框尺寸固定 360×320
  const mult = enlarged ? 1.7 : 1;
  const W = 360 * mult;
  const H = 280 * mult;

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/>
              <rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>GEM 分镜</div>
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
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '80%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>分镜生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasResult ? (
            <pre style={{ fontSize: 11, color: '#e4e4e7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflow: 'auto', maxHeight: '100%', width: '100%', margin: 0, fontFamily: 'monospace' }}>
              {data.text}
            </pre>
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>输入剧本 → 生成分镜 JSON</span>
          )}
        </div>
      </div>

      {/* 底部弹窗(无输出时显示) */}
      <NodeToolbar isVisible={selected && !spawnOpen && !hasResult} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />

          {/* 剧本输入 */}
          <textarea
            className="nodrag nopan nowheel"
            value={data.config.prompt}
            onChange={(e) => updateConfig(id, { prompt: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
            placeholder="输入剧本或故事内容…"
            rows={4}
            style={promptInput}
          />

          {/* 参数按钮行 */}
          <div style={tagsRow}>
            {/* 模式选择(ParamTag弹窗，hover 显示完整说明，黑底白字) */}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setSub(sub === 'gemMode' ? null : 'gemMode')}
                style={{ ...tagBtn, ...(sub === 'gemMode' ? tagActive : {}) }}>
                {mode === 'story' ? '故事' : '时空'} ▾
              </button>
              {sub === 'gemMode' && (
                <div style={{ ...popPanel, width: 300 }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
                  {([
                    { key: 'story', label: '故事模式', desc: '输入剧本或故事文本，AI 按叙事节奏自动拆解为多个连续分镜画面。适合从剧情主线生成完整故事分镜，支持2×2/3×3/5×5格子布局。' },
                    { key: 'cinematic', label: '时空模式', desc: '上传两张关键帧图（首帧+尾帧），AI 分析两帧之间的动作变化，生成过渡中间镜头序列。适合动作细节拆解，支持2×2/3×3格子布局。' },
                  ] as { key: GemMode; label: string; desc: string }[]).map((opt) => (
                    <button key={opt.key}
                      onClick={() => { updateConfig(id, { preset: opt.key }); setSub(null); }}
                      onMouseEnter={() => setModeTooltip(opt.key)}
                      onMouseLeave={() => setModeTooltip(null)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none', background: mode === opt.key ? 'rgba(192,192,192,0.16)' : 'transparent', color: '#d4d4d8', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>{opt.label}</span>
                      {modeTooltip === opt.key && (
                        <span style={{ fontSize: 11, color: '#e4e4e7', background: '#000', padding: '6px 8px', borderRadius: 6, lineHeight: 1.55, display: 'block', whiteSpace: 'normal' }}>
                          {opt.desc}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 格子数 */}
            <ParamTag label={selectedGrid.label} open={sub === 'grid'} onToggle={() => setSub(sub === 'grid' ? null : 'grid')} width={160}>
              {gridOptions.map((g) => (
                <SubItem key={g.value} active={g.value === gridSize} onClick={() => { updateConfig(id, { textDuration: g.value }); setSub(null); }}>
                  <span>{g.label}</span><span style={subHint}>{g.desc}</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 风格 */}
            <ParamTag label={styleLabel || '风格'} open={sub === 'style'} onToggle={() => setSub(sub === 'style' ? null : 'style')} width={220}>
              {STYLE_OPTIONS.map((s) => (
                <SubItem key={s.label} active={s.prompt === style} onClick={() => { updateConfig(id, { ratio: s.prompt }); setSub(null); }}>
                  <span>{s.label}</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 参考图(可选,最多9张) */}
            <ParamTag label={<>参考图{refImages.length > 0 ? ` ${refImages.length}` : ' 可选'}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</>} open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')} width={300}>
              <label style={{ ...uploadBtn, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconPlus size={13} /> <span>{uploading ? '上传中…' : `上传图片（还能传 ${REF_MAX - refImages.length} 张）`}</span>
                <input type="file" accept="image/*" multiple disabled={uploading} style={{ display: 'none' }} onChange={(e) => { addRefImages(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 6 }}>AI 将参考图片风格生成分镜</div>
              {refImages.length > 0 && (
                <div style={refGrid}>
                  {refImages.map((url, i) => (
                    <RefThumb key={i} url={url} index={i}
                      onRemove={() => updateConfig(id, { refImages: refImages.filter((_, j) => j !== i) })} />
                  ))}
                </div>
              )}
            </ParamTag>
          </div>

          {/* 底行 Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>GEM 分镜 · 内置专业系统指令</span>
            <button onClick={handleGenerate} style={generateBtn}>Generate</button>
          </div>
        </div>
      </NodeToolbar>

      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !sub} position={Position.Top} offset={12}>
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
function SubItem({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...subItem, ...(active ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>
      {children}
    </button>
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
const promptInput: React.CSSProperties = {
  width: '100%', padding: '14px 12px 10px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
  lineHeight: 1.65, minHeight: 100, userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
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
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 13, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
};
const subHint: React.CSSProperties = { fontSize: 11, color: '#71717a', flexShrink: 0 };
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', marginBottom: 4,
  borderRadius: 8, border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)',
  color: '#d4d4d8', fontSize: 12, cursor: 'pointer',
};
const refGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 };
const refThumb: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', cursor: 'zoom-in' };
const refDel: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, cursor: 'pointer',
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
const modeBtnBase: React.CSSProperties = {
  padding: '9px 16px', border: 'none',
  background: 'rgba(255,255,255,0.06)', color: '#d4d4d8', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const modeBtnActive: React.CSSProperties = { background: 'rgba(59,130,246,0.3)', color: '#93c5fd' };
const modeBtnActivePurple: React.CSSProperties = { background: 'rgba(168,85,247,0.3)', color: '#d8b4fe' };
// hover 说明 tooltip(深色风格,从按钮下方弹出)
const inlineTooltip: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0, whiteSpace: 'nowrap',
  background: 'rgba(28,28,32,0.97)', backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  padding: '6px 10px', fontSize: 11, color: '#a1a1aa',
  boxShadow: '0 6px 20px rgba(0,0,0,0.5)', zIndex: 9999, pointerEvents: 'none',
};

export const GemNode = memo(GemNodeComponent);
