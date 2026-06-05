'use client';

import { useCanvasStore, getSpawnItems, type SpawnAction } from '../store';
import { IconImage, IconVideo, IconSplit } from './icons';

// ============ 端口加号菜单(引用该节点生成) ============
// 端口圆圈里的 + 点击 → 弹出菜单(按源卡片类型决定可创建的下游,照原网规则)
// 选一项 → 自动新建对应卡片 + 自动连线

function menuIcon(icon: string) {
  if (icon === 'video') return <IconVideo size={16} />;
  if (icon === 'split') return <IconSplit size={16} />;
  return <IconImage size={16} />;
}

export function SpawnMenu({ sourceId, onClose }: { sourceId: string; onClose: () => void }) {
  const spawnFrom = useCanvasStore((s) => s.spawnFrom);
  const srcNode = useCanvasStore((s) => s.nodes.find((n) => n.id === sourceId));
  const items = srcNode ? getSpawnItems(srcNode.data.kind) : [];

  // 该类型卡片不允许创建下游(如文本卡/Step3)→ 不弹菜单
  if (items.length === 0) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
        <div style={menuBox} onClick={(e) => e.stopPropagation()}>
          <div style={menuTitle}>该卡片无下游可创建</div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* 点击遮罩关闭 */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
      />
      <div style={menuBox} onClick={(e) => e.stopPropagation()}>
        <div style={menuTitle}>引用该节点生成</div>
        {items.map((m) => (
          <button
            key={m.action}
            onClick={() => { spawnFrom(sourceId, m.action as SpawnAction); onClose(); }}
            style={menuItem}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,192,192,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={menuItemIcon}>{menuIcon(m.icon)}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const menuBox: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: 'calc(100% + 44px)',
  transform: 'translateY(-50%)',
  width: 188,
  background: 'rgba(28,28,32,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 16,
  padding: 7,
  boxShadow: '0 22px 65px rgba(0,0,0,0.65)',
  zIndex: 95,
};
const menuTitle: React.CSSProperties = {
  fontSize: 10,
  color: '#71717a',
  padding: '5px 9px 7px',
  letterSpacing: '0.04em',
};
const menuItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '9px 10px',
  borderRadius: 10,
  border: 'none',
  background: 'transparent',
  color: '#e4e4e7',
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background .15s',
};
const menuItemIcon: React.CSSProperties = {
  display: 'flex',
  color: '#a1a1aa',
  width: 18,
};
