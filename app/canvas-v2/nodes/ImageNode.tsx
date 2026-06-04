'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import {
  IMAGE_MODELS, DEFAULT_IMAGE_MODEL, RATIO_OPTIONS, SIZE_OPTIONS, QUALITY_OPTIONS,
  ratioToWH, type ImageModel,
} from '../imageModels';
import { STYLE_PRESETS, OTHER_PRESETS, refImageMax, applyStylePrefix } from '../imagePresets';
import { IconImage, IconModel, IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { RefThumb } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, generateImage, getUserId, softCompressImage } from '../lib/api';

// ============================================================
// 图片卡片 · 超现代高端风格(与文本卡同框架)
// 矩形框比文本大;默认正方形,按上传/输出图片真实比例变形
// 底部一体式 prompt 栏:模型 / 预设 / 参考图 / 比例 / 清晰度(标签点击弹二级弹窗)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

// 二级弹窗类型
type SubPanel = 'model' | 'preset' | 'ref' | 'ratio' | 'quality' | null;

function ImageNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasImage = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [editing, setEditing] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<SubPanel>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const model = IMAGE_MODELS.find((m) => m.id === data.config.model) ?? IMAGE_MODELS[0];
  const ratio = data.config.ratio ?? '1:1';
  // 卡片框只显示成品(outputUrl);参考图绝不进卡片框(参考图只在底部弹窗参考区)
  const displayImg = hasImage ? data.outputUrl! : null;

  // 卡片尺寸:默认正方形,有真实比例则按真实比例;放大=真实尺寸×1.7(连线自动跟随)
  const baseSide = enlarged ? 320 * 1.7 : 320;
  const dims = data.aspectW && data.aspectH
    ? scaleToBase(data.aspectW, data.aspectH, baseSide)
    : ratioToWH(ratio, baseSide);

  useEffect(() => { if (editing && editRef.current) editRef.current.focus(); }, [editing]);

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 统一上传处理:真实上传到 Supabase storage,拿到可访问 URL
  const handleUpload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const max = refImageMax(model.id);
    const cur = data.config.refImages ?? [];
    const room = Math.max(0, max - cur.length);
    const toUpload = files.slice(0, room);
    if (!toUpload.length) return;
    // 逐张真实上传
    for (const f of toUpload) {
      const url = await uploadImageToStorage(f);
      if (url) {
        const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config.refImages ?? [];
        updateConfig(id, { refImages: [...latest, url] });
      }
    }
  };

  // 顶部上传:成品图,直接显示在卡片框(与参考图完全无关)
  const uploadResult = (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const probe = new Image();
    probe.onload = () => updateCard(id, { status: 'done', outputUrl: url, aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
    probe.src = url;
  };

  const handleGenerate = async () => {
    if (!data.config.prompt.trim()) return;
    updateCard(id, { status: 'generating', progress: 15 });
    // 进度条动画(真实任务无确切进度,用渐进动画到 90% 等结果)
    let p = 15;
    const timer = setInterval(() => {
      p = Math.min(90, p + 6);
      updateCard(id, { progress: p });
    }, 800);

    try {
      const userId = await getUserId();
      const refs = data.config.refImages ?? [];
      // 参考图:已是 storage URL,直接走 imageUrlArray;
      // gpt-image-2 系列走 base64(softCompress)
      const useBase64 = model.useSizeNotRatio; // gpt-image-2 系列
      let imageUrlArray: string[] | undefined;
      let imageBase64Array: string[] | undefined;
      if (refs.length > 0) {
        if (useBase64) {
          imageBase64Array = await Promise.all(
            refs.map(async (u) => {
              const blob = await fetch(u).then((r) => r.blob());
              const dataUrl = await new Promise<string>((res) => {
                const rd = new FileReader();
                rd.onload = () => res(rd.result as string);
                rd.readAsDataURL(blob);
              });
              return softCompressImage(dataUrl);
            })
          );
        } else {
          imageUrlArray = refs;
        }
      }

      const imageUrl = await generateImage({
        model: model.id,
        prompt: data.config.prompt,
        aspectRatio: ratio,
        imageQuality: data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'),
        imageUrlArray,
        imageBase64Array,
        userId,
      });

      clearInterval(timer);
      // 读真实尺寸设置卡片比例
      const probe = new Image();
      probe.onload = () => updateCard(id, { status: 'done', progress: 100, outputUrl: imageUrl, aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
      probe.onerror = () => updateCard(id, { status: 'done', progress: 100, outputUrl: imageUrl });
      probe.src = imageUrl;
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert('生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态:居中带标题副标题小卡 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}><span style={{ color: '#d4d4d8', display: 'flex' }}><IconImage size={18} /></span></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>图片生成</div>
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
        {/* 收起按钮:浮在图片右上角 */}
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        {/* 图片区(铺满整卡) */}
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : displayImg ? (
            <img src={displayImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>点击选中 · 下方描述画面</span>
          )}
        </div>
      </div>

      {/* ===== 底部一体式 prompt 栏(仅空卡片出现;已有图则不出) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !displayImg} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />
          <textarea
            className="nodrag nopan nowheel"
            value={data.config.prompt}
            onChange={(e) => updateConfig(id, { prompt: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
            placeholder="描述你想要的画面…"
            rows={4}
            style={promptInput}
          />
          <div style={tagsRow}>
            <ParamTag label={<><IconModel size={12} /> {model.label}</>} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')} width={280}>
              {IMAGE_MODELS.map((m) => (
                <SubItem key={m.id} active={m.id === data.config.model} onClick={() => { updateConfig(id, { model: m.id }); setSub(null); }}>
                  <span>{m.label}</span><span style={subPrice}>{m.price}</span>
                </SubItem>
              ))}
            </ParamTag>
            <ParamTag label={<>预设{data.config.preset ? ` · ${data.config.preset}` : ''}</>} open={sub === 'preset'} onToggle={() => setSub(sub === 'preset' ? null : 'preset')} width={300}>
              <div style={subHint}>风格(点击在 prompt 前缀填充)</div>
              <div style={presetGrid}>
                {STYLE_PRESETS.map((p) => (
                  <button key={p.label}
                    onClick={() => { updateConfig(id, { prompt: applyStylePrefix(data.config.prompt, p.prompt), preset: p.label }); setSub(null); }}
                    style={{ ...presetChip, ...(data.config.preset === p.label ? { background: 'rgba(192,192,192,0.22)', color: '#fff', borderColor: 'rgba(192,192,192,0.45)' } : {}) }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ ...subHint, marginTop: 8 }}>其他预设(覆盖 prompt)</div>
              <div style={presetGrid}>
                {OTHER_PRESETS.map((p) => (
                  <button key={p.label}
                    onClick={() => { updateConfig(id, { prompt: p.prompt, preset: p.label }); setSub(null); }}
                    style={{ ...presetChip, borderColor: p.accent === 'purple' ? 'rgba(168,85,247,0.5)' : 'rgba(59,130,246,0.5)', color: p.accent === 'purple' ? '#c4b5fd' : '#93c5fd' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </ParamTag>
            {model.supportsImage && (
              <ParamTag label={<>参考图 {(data.config.refImages?.length ?? 0)}/{refImageMax(model.id)}</>} open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')} width={300}>
                <label style={uploadBtn}>
                  <IconPlus size={13} />
                  <span>上传图片（还能传 {Math.max(0, refImageMax(model.id) - (data.config.refImages?.length ?? 0))} 张）</span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} />
                </label>
                {(data.config.refImages?.length ?? 0) > 0 && (
                  <div style={refGrid}>
                    {data.config.refImages!.map((url, i) => (
                      <RefThumb key={i} url={url} index={i}
                        onRemove={() => updateConfig(id, { refImages: data.config.refImages!.filter((_, j) => j !== i) })} />
                    ))}
                  </div>
                )}
              </ParamTag>
            )}
            <ParamTag label={<>{model.useSizeNotRatio ? '尺寸' : '比例'} {ratio}</>} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={220}>
              {(model.useSizeNotRatio ? SIZE_OPTIONS : RATIO_OPTIONS).map((opt: any) => (
                <SubItem key={opt.value} active={opt.value === ratio} onClick={() => { updateConfig(id, { ratio: opt.value }); updateCard(id, { aspectW: undefined, aspectH: undefined }); setSub(null); }}>
                  <span>{opt.label}</span>
                  {opt.priceMedium && <span style={subPrice}>{(data.config.imageQuality ?? 'medium') === 'high' ? opt.priceHigh : opt.priceMedium}</span>}
                </SubItem>
              ))}
            </ParamTag>
            {(model.qualityOptions || model.useSizeNotRatio) && (
              <ParamTag label={<>清晰度 {data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k')}</>} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={180}>
                {(model.useSizeNotRatio ? QUALITY_OPTIONS : model.qualityOptions!).map((opt) => (
                  <SubItem key={opt.value} active={opt.value === (data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'))} onClick={() => { updateConfig(id, { imageQuality: opt.value }); setSub(null); }}>
                    <span>{opt.label}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>{model.price}</span>
            <button onClick={handleGenerate} style={generateBtn}>Generate</button>
          </div>
        </div>
      </NodeToolbar>
      {/* ===== 顶部工具栏(上传 + 放大) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !sub} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {/* 顶部上传:成品图,直接显示在卡片框(所有图片卡都可用) */}
          <label style={toolBtnWide} title="上传图片(作为成品显示)">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconImage size={16} /> 上传
            </span>
            <input
              type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => uploadResult(e.target.files)}
            />
          </label>
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
    // 放大改真实尺寸,端口正常跟随,无需隐藏
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        <Handle
          type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}
        >
          <span style={portPlusIcon}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
}

function scaleToBase(w: number, h: number, base: number) {
  if (w >= h) return { w: base, h: Math.round((base * h) / w) };
  return { w: Math.round((base * w) / h), h: base };
}

// ===== 小组件 =====
function Tag({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...tagBtn, ...(active ? tagActive : {}) }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{children}</span>
    </button>
  );
}
// 参数按钮 + 从按钮正上方弹出的二级弹窗
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
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transform: 'translateZ(0)',
    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
  };
}
const collapsedIconWrap: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(128,128,128,0.10))',
  border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const titleBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 13px', height: 36, boxSizing: 'border-box',
  borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
};
const iconBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#a1a1aa', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const pillBtn: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#a1a1aa', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
// 收起按钮:浮在图片右上角
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 10,
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const refBadge: React.CSSProperties = {
  position: 'absolute', left: 8, bottom: 8, padding: '3px 9px', borderRadius: 99,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#d4d4d8',
  fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
};
const promptBar: React.CSSProperties = {
  width: 620, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const promptInput: React.CSSProperties = {
  width: '100%', padding: '18px 16px 10px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 15, fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.65, minHeight: 200,
  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const tagsRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 8px 4px',
  scrollbarWidth: 'none',
};
const tagBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 14, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const subPanel: React.CSSProperties = {
  position: 'absolute', bottom: '108%', left: 6, width: 280, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.97)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 70,
};
// 从参数按钮正上方弹出(各按钮独立定位)
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 320, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '8px 11px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
};
const subPrice: React.CSSProperties = { fontSize: 10.5, color: '#71717a', flexShrink: 0 };
const subHint: React.CSSProperties = { fontSize: 10, color: '#71717a', padding: '5px 9px 7px' };
const presetGrid: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 6px 4px',
};
const presetChip: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  width: 'calc(100% - 12px)', margin: '4px 6px 8px', padding: '10px',
  borderRadius: 10, border: '1px dashed rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', fontSize: 12, cursor: 'pointer',
};
const refGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '4px 6px 6px',
};
const refThumb: React.CSSProperties = {
  position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.12)', cursor: 'zoom-in' };
const refDel: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12,
  lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const toolRow: React.CSSProperties = { display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center' };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const ImageNode = memo(ImageNodeComponent);
