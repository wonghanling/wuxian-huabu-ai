'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMembership } from '@/lib/useMembership';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';
import { listCanvases, createCanvas, deleteCanvas } from '@/lib/canvas-storage';
import AccountModal from '@/app/canvas/AccountModal';
import { SaveTemplateModal } from './SaveTemplateModal';
import { ScriptStudioModal } from './ScriptStudioModal';

// ============================================================
// 画布右上角状态栏(照原网 fixed top-4 right-4，1:1 复刻样式)
// 余额/会员(点击开 AccountModal) + 保存为模板(仅管理员) + 画布列表 + 保存 + 主页
// ============================================================

interface Props {
  saveStatus: 'saved' | 'saving' | 'unsaved';
  switchCanvas: (id: string) => Promise<void> | void;
  getCurrentCanvasId: () => string | null;
}

export function TopBar({ saveStatus, switchCanvas, getCurrentCanvasId }: Props) {
  const { isMember, balance, memberExpiresAt, loading: memberLoading } = useMembership();
  const [showCanvasList, setShowCanvasList] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showScriptStudio, setShowScriptStudio] = useState(false);
  const [canvases, setCanvases] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const goHome = () => { window.location.href = '/'; };
  const manualSave = () => { (window as any).saveCanvasV2Now?.(); };

  // 支付(照原网 handlePay:调 /api/payment/alipay,提交支付表单)
  const handlePay = async (plan: 'membership' | 'recharge', amount: number) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('请先登录'); return; }
    const res = await fetch('/api/payment/alipay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, amount }),
    });
    const data = await res.json();
    if (data.paymentForm) {
      const div = document.createElement('div');
      div.innerHTML = data.paymentForm;
      document.body.appendChild(div);
      div.querySelector('form')?.submit();
    } else {
      alert(data.error || '发起支付失败');
    }
  };

  const refreshList = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setUserEmail(user.email ?? null);
    setCanvases(await listCanvases(user.id));
  }, []);

  useEffect(() => { refreshList(); }, [refreshList]);

  const onNew = async () => {
    if (!userId) return;
    const c = await createCanvas(userId);
    if (c) {
      await refreshList();
      await switchCanvas(c.id);
      setShowCanvasList(false);
    }
  };

  const onSwitch = async (id: string) => {
    await switchCanvas(id);
    setShowCanvasList(false);
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
    <>
      <div className="flex items-center gap-2">

        {/* 余额 + 会员状态 */}
        <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300">
          {memberLoading ? (
            <span className="text-white/30">···</span>
          ) : isMember ? (
            <span className="text-violet-400 font-semibold cursor-pointer hover:text-violet-300 transition-colors" onClick={() => setShowAccountModal(true)}>会员</span>
          ) : (
            <button
              className="text-yellow-400 hover:text-yellow-300 transition-colors"
              onClick={() => setShowAccountModal(true)}
            >
              开通会员
            </button>
          )}
          <span className="text-white/20">|</span>
          <span className="text-white/60">¥{(balance ?? 0).toFixed(2)}</span>
          <button
            className="text-blue-400 hover:text-blue-300 transition-colors ml-0.5"
            onClick={() => setShowAccountModal(true)}
          >
            充值
          </button>
        </div>

        {/* 保存为模板（仅管理员） */}
        {isAdmin(userEmail) && (
          <button
            onClick={() => setShowSaveTemplateModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600/30 backdrop-blur-md border border-purple-500/40 text-purple-200 hover:bg-purple-600/50 hover:border-purple-500/60 transition-all"
            title="保存当前画布为工作流模板"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            保存为模板
          </button>
        )}

        {/* 画布列表按钮 */}
        <div className="relative">
          <button
            onClick={() => { setShowCanvasList(!showCanvasList); if (!showCanvasList) refreshList(); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            画布
          </button>

          {showCanvasList && (
            <div className="absolute top-8 right-0 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-2 border-b border-white/5">
                <button
                  className="w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-white/5 rounded-lg transition-all"
                  onClick={onNew}
                >
                  + 新建画布
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto cv2-scroll">
                {canvases.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-500">暂无画布</div>
                )}
                {canvases.map((c) => {
                  const isCur = getCurrentCanvasId() === c.id;
                  return (
                    <div key={c.id} className={`flex items-center gap-1 px-2 py-1 hover:bg-white/5 ${isCur ? 'bg-white/5' : ''}`}>
                      <button
                        className={`flex-1 text-left text-xs py-1 px-1 truncate ${isCur ? 'text-white' : 'text-gray-400'}`}
                        onClick={() => onSwitch(c.id)}
                      >
                        {isCur ? '● ' : '○ '}{c.title}
                      </button>
                      {/* 删除按钮 - 至少保留一个画布 */}
                      {canvases.length > 1 && (
                        <button
                          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 rounded transition-all flex-shrink-0"
                          title="删除画布"
                          onClick={(e) => onDelete(c.id, e)}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 手动保存按钮 */}
        <button
          onClick={manualSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? (
            <><div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /><span className="text-yellow-400">保存中...</span></>
          ) : saveStatus === 'saved' ? (
            <><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-green-400">已保存</span></>
          ) : (
            <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg><span>保存</span></>
          )}
        </button>

        {/* 剧本工作室入口 */}
        <button
          onClick={() => setShowScriptStudio(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-600/30 backdrop-blur-md border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/50 hover:border-emerald-500/60 transition-all"
          title="剧本工作室:从想法到拍摄剧本"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>剧本工作室</span>
        </button>

        {/* 返回主页按钮 */}
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>主页</span>
        </button>
      </div>

      {/* 账户弹窗(复用原网 AccountModal) */}
      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          onPay={handlePay}
          balance={balance ?? 0}
          isMember={isMember}
          memberExpiresAt={memberExpiresAt}
        />
      )}

      {/* 保存为模板弹窗(canvas-v2 版,存 {nodes,edges}) */}
      {showSaveTemplateModal && (
        <SaveTemplateModal onClose={() => setShowSaveTemplateModal(false)} />
      )}

      {/* 剧本工作室全屏弹窗 */}
      {showScriptStudio && (
        <ScriptStudioModal onClose={() => setShowScriptStudio(false)} />
      )}
    </>
  );
}
