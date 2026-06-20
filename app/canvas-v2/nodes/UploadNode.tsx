'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconImage, IconVideo, IconExpand, IconShrink, IconMinus, IconUpload, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { uploadImageToStorage, uploadFileToStorage, mirrorOutput } from '../lib/api';
import { ImageStudio } from './ImageStudio';

// ============================================================
// 素材上传卡片(照原网 media-upload-card)
// 双击画布空白处创建;无底部 prompt 弹窗
// 用途:上传图片/视频素材 → 右侧端口加号创建下游卡片(自动连线传素材)
// outputUrl 存素材 URL;config.mediaType 区分 image/video(供 connections 归类)
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

function UploadNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [spawnOpen, setSpawnOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const mediaType = (data.config as any).mediaType as 'image' | 'video' | undefined;
  const hasMedia = !!data.outputUrl;

  // 卡片按上传素材真实比例显示(无素材时正方形)
  const baseSide = enlarged ? 420 : 300;
  const aw = (data as any).aspectW as number | undefined;
  const ah = (data as any).aspectH as number | undefined;
  let baseW = baseSide, baseH = baseSide;
  if (aw && ah && aw > 0 && ah > 0) {
    const ratio = aw / ah;
    if (ratio >= 1) { baseW = baseSide; baseH = Math.round(baseSide / ratio); }
    else { baseH = baseSide; baseW = Math.round(baseSide * ratio); }
  }

  const toggleCollapse = (e: React.MouseEvent) => { e.stopPropagation(); updateCard(id, { collapsed: !collapsed }); };

  // 上传素材:图片走 uploadImageToStorage,视频走 uploadFileToStorage
  const upload = async (fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith('video/');
    setUploading(true);
    try {
      const url = isVideo ? await uploadFileToStorage(f, 'video') : await uploadImageToStorage(f);
      if (url) {
        updateConfig(id, { mediaType: isVideo ? 'video' : 'image' } as any);
        updateCard(id, { status: 'done', outputUrl: url });
        // 探测真实尺寸,卡片按比例显示
        if (isVideo) {
          const v = document.createElement('video');
          v.onloadedmetadata = () => updateCard(id, { aspectW: v.videoWidth, aspectH: v.videoHeight });
          v.src = url;
        } else {
          const probe = new Image();
          probe.onload = () => updateCard(id, { aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
          probe.src = url;
        }
        (window as any).saveCanvasV2Now?.();
      }
    } finally {
      setUploading(false);
    }
  };

  // 收起态
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onDoubleClick={toggleCollapse} style={{ width: 160, height: 44, background: GLASS_BG, border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a1a1aa', fontSize: 12, backdropFilter: 'blur(20px)' }}>
          <IconUpload size={14} /> 素材上传
        </div>
      </>
    );
  }

  return (
    <>
      <Ports />

      <div style={{
        width: baseW, height: baseH,
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

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {hasMedia ? (
            <UploadMedia url={data.outputUrl!} isVideo={mediaType === 'video'} />
          ) : (
            <label style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'default' : 'pointer', color: '#71717a', gap: 8 }}>
              <IconUpload size={28} />
              <span style={{ fontSize: 13 }}>{uploading ? '上传中…' : '点击上传图片 / 视频素材'}</span>
              <span style={{ fontSize: 10, color: '#5a5a5f' }}>上传后用右侧 + 创建下游卡片</span>
              <input type="file" accept="image/*,video/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
            </label>
          )}
        </div>

        {/* 已有素材:右上角换素材按钮 */}
        {hasMedia && (
          <label style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }} title="更换素材">
            <IconUpload size={14} />
            <input type="file" accept="image/*,video/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
          </label>
        )}
      </div>

      {/* 顶部工具栏:放大/缩小(无底部 prompt 弹窗) */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          {hasMedia && mediaType !== 'video' && (
            <button onClick={() => setEditOpen(true)} style={toolBtnWide} title="进入 Image Studio 编辑">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>✎ 编辑</span>
            </button>
          )}
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtn}>
            {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
          </button>
        </div>
      </NodeToolbar>
      {editOpen && hasMedia && mediaType !== 'video' && (
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
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function portCircle(color: string): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: '50%', background: color, border: '3px solid #18181b',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
  };
}

export const UploadNode = memo(UploadNodeComponent);

// 媒体展示子组件:按 url+isVideo memo,父组件(选中/拖动等)重渲染时不重新挂载 → 不闪烁
const UploadMedia = memo(function UploadMedia({ url, isVideo }: { url: string; isVideo: boolean }) {
  if (isVideo) {
    return (
      <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted loop playsInline preload="metadata"
        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }} />
    );
  }
  return <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
});

