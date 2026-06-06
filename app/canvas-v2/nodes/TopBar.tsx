'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMembership } from '@/lib/useMembership';
import { createClient } from '@/lib/supabase/client';
import { listCanvases, createCanvas, deleteCanvas } from '@/lib/canvas-storage';

// ============================================================
// 画布右上角状态栏(照原网 fixed top-4 right-4)
// 会员/余额 + 画布列表(新建/切换/删除) + 保存 + 主页
// 充值/会员跳主站(扣费后端已做,这里只显示+跳转)
// ============================================================

interface Props {
  saveStatus: 'saved' | 'saving' | 'unsaved';
  switchCanvas: (id: string) => Promise<void> | void;
  getCurrentCanvasId: () => string | null;
}

export function TopBar({ saveStatus, switchCanvas, getCurrentCanvasId }: Props) {
  const { isMember, balance, loading } = useMembership();
  const [showList, setShowList] = useState(false);
  const [canvases, setCanvases] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const goHome = () => { window.location.href = '/'; };
  const goRecharge = () => { window.location.href = '/pricing'; };
  const manualSave = () => { (window as any).saveCanvasV2Now?.(); };

  const refreshList = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setCanvases(await listCanvases(user.id));
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  const onNew = async () => {
    if (!userId) return;
    const c = await createCanvas(userId);
    if (c) {
      await refreshList();
      await switchCanvas(c.id);
      setShowList(false);
    }
  };

  const onSwitch = async (id: string) => {
    await switchCanvas(id);
    setShowList(false);
  };

  const onDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除这个画布?此操作不可恢复。')) return;
    const isCurrent = getCurrentCanvasId() === id;
    await deleteCanvas(id);
    const list = userId ? await listCanvases(userId) : [];
    setCanvases(list);
    // 删的是当前画布 → 切到列表第一个
    if (isCurrent && list[0]) await switchCanvas(list[0].id);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* 余额 + 会员 */}
      <div style={pill}>
        {loading ? (
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>···</span>
        ) : isMember ? (
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>会员</span>
        ) : (
          <button style={{ ...linkBtn, color: '#fbbf24' }} onClick={goRecharge}>开通会员</button>
        )}
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>¥{(balance ?? 0).toFixed(2)}</span>
        <button style={{ ...linkBtn, color: '#60a5fa' }} onClick={goRecharge}>充值</button>
      </div>

      {/* 画布列表 */}
      <div style={{ position: 'relative' }}>
        <button style={pillBtn} onClick={() => { setShowList((v) => !v); if (!showList) refreshList(); }} title="画布管理">画布 ▾</button>
        {showList && (
          <div style={listBox}>
            <button style={newBtn} onClick={onNew}>+ 新建画布</button>
            <div className="cv2-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {canvases.length === 0 && <div style={{ padding: 12, color: '#71717a', fontSize: 12 }}>暂无画布</div>}
              {canvases.map((c) => {
                const isCur = getCurrentCanvasId() === c.id;
                return (
                  <div key={c.id} style={{ ...listItem, ...(isCur ? { background: 'rgba(96,165,250,0.12)' } : {}) }} onClick={() => onSwitch(c.id)}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isCur ? '#93c5fd' : '#d4d4d8' }}>{c.title}</span>
                    {isCur && <span style={{ fontSize: 9, color: '#60a5fa', marginRight: 6 }}>当前</span>}
                    <button style={delBtn} onClick={(e) => onDelete(c.id, e)} title="删除画布">×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 保存 */}
      <button style={pillBtn} onClick={manualSave} title="保存画布">
        {saveStatus === 'saving' ? '保存中…' : saveStatus === 'unsaved' ? '● 保存' : '已保存'}
      </button>

      {/* 主页 */}
      <button style={pillBtn} onClick={goHome} title="返回主页">主页</button>
    </div>
  );
}

const pill: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
  padding: '7px 12px', borderRadius: 999, background: 'rgba(24,24,27,0.8)',
  backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8',
};
const pillBtn: React.CSSProperties = {
  fontSize: 12, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
  background: 'rgba(24,24,27,0.8)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0,
};
const listBox: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 240,
  background: 'rgba(24,24,27,0.97)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14,
  boxShadow: '0 18px 55px rgba(0,0,0,0.6)', overflow: 'hidden', zIndex: 200,
};
const newBtn: React.CSSProperties = {
  width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent',
  color: '#60a5fa', fontSize: 12, cursor: 'pointer',
};
const listItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '9px 10px 9px 14px', cursor: 'pointer', fontSize: 12,
};
const delBtn: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent',
  color: '#f87171', cursor: 'pointer', fontSize: 14, lineHeight: 1,
};
