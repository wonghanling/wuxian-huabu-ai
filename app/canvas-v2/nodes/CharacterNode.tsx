'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { ratioToWH, SIZE_OPTIONS, QUALITY_OPTIONS } from '../imageModels';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { HoverZoomImg } from './RefThumb';
import { uploadImageToStorage, generateImage, mirrorOutput, getUserId, editDesignImage } from '../lib/api';
import { getUpstreamOutputs, useUpstream } from '../lib/connections';
import { Lightbox, downloadFile } from './Lightbox';
import { ImageStudio } from './ImageStudio';

// ============================================================
// 角色设计卡片 · 矩形框
// 输入:1张参考图(必填) + 内置三视角 prompt
// 参数:模型 / 比例 / 清晰度(nano-banana-pro才有)
// 输出:三视角图显示在卡片框
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

// 内置三视角 prompt(照搬原网)
const CHARACTER_PROMPT = `use the uploaded image as the ONLY character reference, character turnaround sheet, TOP SECTION: full body views front view, side view, back view, full body, head to toe visible, BOTTOM SECTION: head detail views reuse the SAME head from the original image, do not generate a new face, close-up crops of the same character head, front face, side profile, 3/4 view, same character, identical face, preserve facial features exactly, preserve hairstyle exactly, same hair shape, same hair volume, no variation, reuse the same identity across all views, no redesign, no reinterpretation, keep original outfit exactly, do not redesign, match the original image style exactly, same rendering, same lighting, same material, no duplicate character generation, no alternate versions, neutral pose, clean studio background, arranged in one frame, structured grid layout, clear separation`;

const CHAR_MODELS = [
  { id: 'nano-banana-pro', label: 'Nano Banana 2', price: '2K ¥1.0 / 4K ¥1.2', useSizeNotRatio: false, qualityOptions: [{ value: '2k', label: '2K — ¥1.0/次' }, { value: '4k', label: '4K — ¥1.2/次' }] },
  { id: 'nano-banana', label: 'Nano Banana', price: '¥0.5/次', useSizeNotRatio: false, qualityOptions: null },
  { id: 'gpt-image-2', label: 'GPT Image 2', price: '¥0.5~0.8/次', useSizeNotRatio: true, qualityOptions: null },
  { id: 'flux-kontext', label: 'Flux Kontext', price: '¥0.6/次', useSizeNotRatio: false, qualityOptions: null },
  { id: 'doubao-seedream-4-5-251128', label: '豆包 Seedream 5.0', price: '¥0.7/次', useSizeNotRatio: false, qualityOptions: null },
];

const CHAR_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'];

type SubPanel = 'model' | 'ratio' | 'quality' | 'ref' | null;

function CharacterNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasOutput = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [sub, setSub] = useState<SubPanel>(null);
  const [lightbox, setLightbox] = useState(false);
  const [editOpen, setEditOpen] = useState(false);   // Image Studio
  const [identityBusy, setIdentityBusy] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)

  const modelId = data.config.model || 'nano-banana-pro';
  const model = CHAR_MODELS.find((m) => m.id === modelId) ?? CHAR_MODELS[0];
  const ratio = data.config.ratio ?? '1:1';
  const quality = data.config.imageQuality ?? '2k';
  const refImage = data.config.refImages?.[0];
  // 连线实时:上游图→参考图(照原网,角色设计参考图可来自连接)
  const connectedImage = useUpstream(id).images[0];
  const effRefDisplay = refImage || connectedImage;
  const isNanoPro = modelId === 'nano-banana-pro';
  const isGptImage2 = modelId === 'gpt-image-2';

  const mult = enlarged ? 1.7 : 1;
  const dims = ratioToWH(ratio, 360 * mult);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const uploadRef = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(f);
      if (url) updateConfig(id, { refImages: [url] });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    // 连线传参:参考图优先上游图,其次本地
    const upstream = getUpstreamOutputs(id);
    const effRef = refImage || upstream.images[0];
    if (!effRef) return;
    updateCard(id, { status: 'generating', progress: 10 });
    let p = 10;
    const timer = setInterval(() => { p = Math.min(90, p + 6); updateCard(id, { progress: p }); }, 800);
    try {
      const userId = await getUserId();
      // 参考图传 URL(后端自适应);内置三视角 prompt
      const imageUrl = await generateImage({
        model: modelId,
        prompt: CHARACTER_PROMPT,
        aspectRatio: ratio,
        imageQuality: data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'),
        imageUrlArray: effRef && !effRef.startsWith('data:') ? [effRef] : undefined,
        imageBase64Array: effRef && effRef.startsWith('data:') ? [effRef] : undefined,
        userId,
      });
      clearInterval(timer);
      // 立即显示成品(不等大图下载完),宽高异步补上
      updateCard(id, { status: 'done', progress: 100, outputUrl: imageUrl });
      const probe = new Image();
      probe.onload = () => updateCard(id, { aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
      probe.src = imageUrl;
      mirrorOutput(imageUrl, 'image').then((permUrl) => {
        if (permUrl && permUrl !== imageUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert('角色三视图生成失败: ' + (err?.message || err));
    }
  };

  // 真人设定：直接调 nano-banana-pro，结果在画布创建新卡并连线
  const handleIdentityMask = async () => {
    if (!hasOutput || identityBusy) return;
    setIdentityBusy(true);
    try {
      const userId = await getUserId();
      const IDENTITY_PROMPT = '对角色设定图中的所有人脸进行隐私遮挡。保持原图构图、人物、衣服、发型、背景不变。只在可见眼睛和嘴巴区域添加纯黑色矩形遮挡条。正脸遮挡双眼和嘴巴，侧脸遮挡可见眼睛和嘴巴。不要改变人物身份、发型、服装、姿态和画面风格。';
      const newUrl = await editDesignImage({
        imageUrl: data.outputUrl!,
        prompt: IDENTITY_PROMPT,
        mode: 'region-edit',
        provider: 'fal',
        model: 'nano-banana-pro',
        userId,
      });
      const permUrl = await mirrorOutput(newUrl, 'image') || newUrl;
      useCanvasStore.getState().addImageCardWithRef(permUrl, IDENTITY_PROMPT, 'nano-banana-pro');
      (window as any).saveCanvasV2Now?.();
    } catch (err: any) {
      alert('真人设定失败: ' + (err?.message || err));
    } finally {
      setIdentityBusy(false);
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#d4d4d8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>角色设计</div>
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
        width: dims.w, height: dims.h,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        transition: 'border-color .25s, box-shadow .25s, width .3s cubic-bezier(.34,1.2,.4,1), height .3s cubic-bezier(.34,1.2,.4,1)',
        position: 'relative',
      }}>
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>生成三视角中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasOutput ? (
            <img src={data.outputUrl!} alt="" onDoubleClick={(e) => { e.stopPropagation(); setEditOpen(true); }} title="双击进入 Image Studio 编辑" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }} />
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>上传参考图 · 生成三视角</span>
          )}
        </div>
      </div>

      {/* 底部弹窗(无输出时显示) */}
      <NodeToolbar isVisible={selected && !spawnOpen && !hasOutput} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>

          {/* 提示文案 */}
          <div style={{ padding: '12px 14px 6px', fontSize: 13, color: '#a1a1aa' }}>
            角色三视图 · 内置专业 prompt · 上传参考图后生成
          </div>

          {/* 参数按钮行 */}
          <div style={tagsRow}>
            {/* 模型 */}
            <ParamTag label={model.label} open={sub === 'model'} onToggle={() => setSub(sub === 'model' ? null : 'model')} width={280}>
              {CHAR_MODELS.map((m) => (
                <SubItem key={m.id} active={m.id === modelId} onClick={() => { updateConfig(id, { model: m.id }); setSub(null); }}>
                  <span>{m.label}</span>
                  <span style={subPrice}>{m.price}</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 比例/尺寸 — 照搬图片卡:GPT Image 2 用 SIZE_OPTIONS(带价格),其他用普通比例 */}
            <ParamTag label={<>{model.useSizeNotRatio ? '尺寸' : '比例'} {ratio}</>} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={220}>
              {(model.useSizeNotRatio ? SIZE_OPTIONS : CHAR_RATIOS.map((r) => ({ value: r, label: r }))).map((opt: any) => (
                <SubItem key={opt.value} active={opt.value === ratio} onClick={() => { updateConfig(id, { ratio: opt.value }); updateCard(id, { aspectW: undefined, aspectH: undefined }); setSub(null); }}>
                  <span>{opt.label}</span>
                  {opt.priceMedium && <span style={subPrice}>{(data.config.imageQuality ?? 'medium') === 'high' ? opt.priceHigh : opt.priceMedium}</span>}
                </SubItem>
              ))}
            </ParamTag>

            {/* 清晰度 — nano-banana-pro: 2K/4K; gpt-image-2: medium/high */}
            {(model.qualityOptions || model.useSizeNotRatio) && (
              <ParamTag label={<>清晰度 {data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k')}</>} open={sub === 'quality'} onToggle={() => setSub(sub === 'quality' ? null : 'quality')} width={180}>
                {(model.useSizeNotRatio ? QUALITY_OPTIONS : model.qualityOptions!).map((opt) => (
                  <SubItem key={opt.value} active={opt.value === (data.config.imageQuality ?? (model.useSizeNotRatio ? 'medium' : '2k'))} onClick={() => { updateConfig(id, { imageQuality: opt.value }); setSub(null); }}>
                    <span>{opt.label}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}

            {/* 参考图(1张必填,可来自连接) */}
            <ParamTag
              label={<>参考图{effRefDisplay ? <span style={greenDot} /> : ' (必填)'}{!refImage && connectedImage && <span style={{ marginLeft: 4, color: '#a1a1aa' }}>来自连接</span>}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</>}
              open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')} width={220}
            >
              <label style={{ ...uploadBtn, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconPlus size={13} /> <span>{uploading ? '上传中…' : '上传参考图（1张）'}</span>
                <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { uploadRef(e.target.files); setSub(null); e.currentTarget.value = ''; }} />
              </label>
              {effRefDisplay && (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', marginTop: 6 }}>
                  <HoverZoomImg url={effRefDisplay} />
                  {refImage ? (
                    <button style={refDel} onClick={() => updateConfig(id, { refImages: [] })}>×</button>
                  ) : (
                    <span style={{ position: 'absolute', top: 4, left: 4, fontSize: 9, color: '#fff', background: 'rgba(82,82,91,0.9)', padding: '1px 6px', borderRadius: 99 }}>来自连接</span>
                  )}
                </div>
              )}
            </ParamTag>
          </div>

          {/* 底行:价格 + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>{model.price}</span>
            <button onClick={handleGenerate} disabled={!effRefDisplay || data.status === 'generating'} style={{ ...generateBtn, opacity: (effRefDisplay && data.status !== 'generating') ? 1 : 0.4 }}>
              {data.status === 'generating' ? '生成中…' : 'Generate'}
            </button>
          </div>
        </div>
      </NodeToolbar>

      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !sub && !lightbox} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {hasOutput && (
            <>
              <button onClick={() => setLightbox(true)} style={toolBtnWide} title="查看(放大)">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><IconExpand size={16} /> 查看</span>
              </button>
              <button onClick={() => downloadFile(data.outputUrl!, `character-${id}.jpg`)} style={toolBtnWide} title="下载">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>↓ 下载</span>
              </button>
              <button onClick={() => updateCard(id, { status: 'empty', outputUrl: null })} style={toolBtnWide} title="删除图片">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>× 删除</span>
              </button>
              <button onClick={() => setEditOpen(true)} style={toolBtnWide} title="进入 Image Studio 编辑">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>✎ 设计师</span>
              </button>
            </>
          )}
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
          </button>
        </div>
      </NodeToolbar>
      {lightbox && hasOutput && <Lightbox url={data.outputUrl!} kind="image" onClose={() => setLightbox(false)} />}
      {editOpen && hasOutput && (
        <ImageStudio
          initialImageUrl={data.outputUrl!}
          onClose={() => setEditOpen(false)}
          onApply={(finalUrl) => {
            updateCard(id, { outputUrl: finalUrl });
            mirrorOutput(finalUrl, 'image').then((permUrl) => {
              if (permUrl && permUrl !== finalUrl) updateCard(id, { outputUrl: permUrl });
              (window as any).saveCanvasV2Now?.();
            });
          }}
        />
      )}
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
const subPrice: React.CSSProperties = { fontSize: 11, color: '#71717a', flexShrink: 0 };
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#e4e4e7', display: 'inline-block', marginLeft: 4 };
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', marginBottom: 4,
  borderRadius: 8, border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)',
  color: '#d4d4d8', fontSize: 12, cursor: 'pointer',
};
const refDel: React.CSSProperties = {
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

export const CharacterNode = memo(CharacterNodeComponent);
