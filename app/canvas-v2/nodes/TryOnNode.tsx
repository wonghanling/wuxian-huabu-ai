'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { uploadImageToStorage, generateTryOn, mirrorOutput, getUserId } from '../lib/api';
import { useUpstream } from '../lib/connections';
import { Lightbox, downloadFile } from './Lightbox';

// ============================================================
// 虚拟试衣卡片 · fal-ai/image-apps-v2/virtual-try-on
// 双图槽:人物图(refImages[0],可上传/连线) + 衣服图(config.clothingImage,上传)
// 保留姿势开关 + 一键试穿 → 输出试穿图
// 照角色卡模板,独立调 /api/tryon(账号池+扣费在后端)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';
const RATIOS = ['3:4', '1:1', '16:9', '9:16', '4:3'];

function TryOnNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasOutput = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [lightbox, setLightbox] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [uploadingCloth, setUploadingCloth] = useState(false);

  const personImage = data.config.refImages?.[0];
  const clothingImage = data.config.clothingImage;
  const preservePose = data.config.preservePose ?? true;
  const ratio = data.config.ratio ?? '3:4';
  // 连线:上游图作人物图
  const connectedImage = useUpstream(id).images[0];
  const effPerson = personImage || connectedImage;

  const mult = enlarged ? 1.4 : 1;
  const W = 480 * mult;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const uploadPerson = async (fl: FileList | null) => {
    const f = fl?.[0]; if (!f) return;
    setUploadingPerson(true);
    try { const url = await uploadImageToStorage(f); if (url) updateConfig(id, { refImages: [url] }); }
    finally { setUploadingPerson(false); }
  };
  const uploadCloth = async (fl: FileList | null) => {
    const f = fl?.[0]; if (!f) return;
    setUploadingCloth(true);
    try { const url = await uploadImageToStorage(f); if (url) updateConfig(id, { clothingImage: url }); }
    finally { setUploadingCloth(false); }
  };

  const handleGenerate = async () => {
    if (!effPerson || !clothingImage) return;
    updateCard(id, { status: 'generating', progress: 10 });
    let p = 10;
    const timer = setInterval(() => { p = Math.min(90, p + 6); updateCard(id, { progress: p }); }, 800);
    try {
      const userId = await getUserId();
      const imageUrl = await generateTryOn({
        personImageUrl: effPerson,
        clothingImageUrl: clothingImage,
        preservePose,
        aspectRatio: ratio,
        userId,
      });
      clearInterval(timer);
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
      alert('虚拟试衣失败: ' + (err?.message || err));
    }
  };

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

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>👕</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>虚拟试衣</div>
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
      <div style={{
        width: W,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        transition: 'border-color .25s, box-shadow .25s',
        position: 'relative',
      }}>
        <button onClick={toggleCollapse} style={floatMinus} title="收起"><IconMinus /></button>

        {/* 标题 */}
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>👕</span>
          <span style={{ color: '#f4f4f5', fontSize: 14, fontWeight: 600 }}>虚拟试衣</span>
          <span style={{ color: '#71717a', fontSize: 11, marginLeft: 'auto' }}>人物 + 衣服 → 试穿</span>
        </div>

        {/* 输出 / 双图槽 */}
        <div style={{ padding: '0 16px 14px' }}>
          {hasOutput ? (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${GLASS_BORDER}` }}>
              <img src={data.outputUrl!} alt="试穿结果" onClick={() => setLightbox(true)}
                style={{ width: '100%', display: 'block', cursor: 'zoom-in' }} draggable={false} />
              <button onClick={() => updateCard(id, { status: 'empty', outputUrl: null })}
                style={redoBtn} title="重做">↻ 重做</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                {/* 人物图槽 */}
                <Slot
                  label="人物图"
                  img={effPerson}
                  uploading={uploadingPerson}
                  fromLink={!personImage && !!connectedImage}
                  onUpload={uploadPerson}
                  onClear={() => updateConfig(id, { refImages: [] })}
                />
                {/* 衣服图槽 */}
                <Slot
                  label="衣服图"
                  img={clothingImage}
                  uploading={uploadingCloth}
                  fromLink={false}
                  onUpload={uploadCloth}
                  onClear={() => updateConfig(id, { clothingImage: undefined })}
                />
              </div>

              {/* 保留姿势 */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', color: '#d4d4d8', fontSize: 12.5 }}>
                <input type="checkbox" checked={preservePose}
                  onChange={(e) => updateConfig(id, { preservePose: e.target.checked })} />
                保留人物姿势
              </label>

              {/* 输出比例 */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6 }}>输出比例</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {RATIOS.map((r) => {
                    const on = ratio === r;
                    return (
                      <button key={r} onClick={() => updateConfig(id, { ratio: r })}
                        style={{
                          padding: '5px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                          border: `1px solid ${on ? 'rgba(255,255,255,0.5)' : GLASS_BORDER}`,
                          background: on ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.04)',
                          color: on ? '#fff' : '#a1a1aa', fontWeight: on ? 600 : 400,
                        }}>
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerate}
                disabled={!effPerson || !clothingImage || data.status === 'generating'}
                style={{
                  ...genBtn,
                  opacity: (!effPerson || !clothingImage || data.status === 'generating') ? 0.45 : 1,
                  cursor: data.status === 'generating' ? 'wait' : 'pointer',
                }}
              >
                {data.status === 'generating' ? `试穿中… ${data.progress ?? 0}%` : '开始试穿 · ¥0.3/次'}
              </button>
              {(!effPerson || !clothingImage) && (
                <div style={{ color: '#71717a', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                  需先提供人物图和衣服图
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <NodeToolbar isVisible={selected && !lightbox && !spawnOpen} position={Position.Top} offset={12}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtn} title={enlarged ? '缩小' : '放大'}>
            {enlarged ? <IconShrink /> : <IconExpand />}
          </button>
          {hasOutput && (
            <button onClick={() => downloadFile(data.outputUrl!, 'tryon.jpg')} style={toolBtn} title="下载">下载</button>
          )}
        </div>
      </NodeToolbar>

      {lightbox && hasOutput && <Lightbox url={data.outputUrl!} kind="image" onClose={() => setLightbox(false)} />}
    </>
  );
}

// ===== 单个图槽 =====
function Slot({ label, img, uploading, fromLink, onUpload, onClear }: {
  label: string; img?: string; uploading: boolean; fromLink: boolean;
  onUpload: (fl: FileList | null) => void; onClear: () => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 6 }}>{label}{fromLink ? '(来自连接)' : ''}</div>
      {img ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${GLASS_BORDER}`, aspectRatio: '1/1', background: '#0c0c0d' }}>
          <img src={img} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
          {!fromLink && (
            <button onClick={onClear} style={slotClear} title="移除">✕</button>
          )}
        </div>
      ) : (
        <label style={slotEmpty}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onUpload(e.target.files)} />
          <span style={{ fontSize: 22, opacity: 0.4 }}>＋</span>
          <span style={{ fontSize: 11, color: '#71717a' }}>{uploading ? '上传中…' : '上传'}</span>
        </label>
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

const collapsedCard = (sel: boolean): React.CSSProperties => ({
  width: 220, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
  background: GLASS_BG, backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
  border: `1px solid ${sel ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 18,
  backdropFilter: 'blur(20px)', cursor: 'pointer',
});
const collapsedIconWrap: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.06)', fontSize: 18,
};
const pillBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 9, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 10, right: 10, zIndex: 3,
  width: 26, height: 26, borderRadius: 8, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(0,0,0,0.3)', color: '#d4d4d8', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const slotEmpty: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
  aspectRatio: '1/1', borderRadius: 12, cursor: 'pointer',
  border: `1px dashed rgba(255,255,255,0.2)`, background: 'rgba(255,255,255,0.02)',
};
const slotClear: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 7,
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', fontSize: 11,
};
const genBtn: React.CSSProperties = {
  width: '100%', marginTop: 12, padding: '11px 0', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#e4e4e7,#a1a1aa)', color: '#0a0a0a', fontSize: 14, fontWeight: 600,
};
const redoBtn: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, padding: '5px 10px', borderRadius: 9,
  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.55)', color: '#fff',
  cursor: 'pointer', fontSize: 12,
};
const toolBtn: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 10, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.9)', color: '#d4d4d8', cursor: 'pointer', fontSize: 12.5,
};

export const TryOnNode = memo(TryOnNodeComponent);
