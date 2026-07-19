'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ProfileModal } from './ProfileModal';

// 我是创作者视图: 我申请/被选中的项目(找回订单,不依赖大厅)
type MineItem = {
  application: { id: string; project_id: string; status: string; quote_min: number | null; quote_max: number | null };
  project: { id: string; title: string; description: string | null; category: string | null; budget_min: number | null; budget_max: number | null; delivery_days: number | null; cover_url: string | null; status: string } | null;
  reservation: { id: string; status: string; payment_status: string; amount_cents: number; pay_deadline: string | null } | null;
};

export function CreatorView({ loggedIn }: { loggedIn: boolean }) {
  const [items, setItems] = useState<MineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (!loggedIn) { setLoading(false); return; }
      try {
        const sb = createClient();
        const { data: { session } } = await sb!.auth.getSession();
        if (!session) { setLoading(false); return; }
        const res = await fetch('/api/commissions/mine?role=creator', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) { const d = await res.json(); setItems(d.items || []); }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="text-center text-zinc-500 py-20 rounded-2xl border border-white/10 bg-white/[0.02]">
        登录后查看你申请和接单的项目
        <div className="mt-4">
          <a href="/auth" className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium">去登录</a>
        </div>
      </div>
    );
  }
  if (loading) return <div className="text-center text-zinc-500 py-20">加载中…</div>;

  // 顶部"完善资料"按钮(登录后都显示)
  const profileBar = (
    <div className="flex items-center justify-between mb-5">
      <div className="text-sm text-zinc-400">完善创作者资料，让客户更容易选择你</div>
      <button onClick={() => setProfileOpen(true)}
        className="px-4 py-2 rounded-full border border-white/20 text-white text-sm hover:bg-white/10 transition-colors">
        完善我的资料
      </button>
    </div>
  );

  if (items.length === 0) {
    return (
      <>
        {profileBar}
        <div className="text-center text-zinc-500 py-20 rounded-2xl border border-white/10 bg-white/[0.02]">
          你还没有申请任何项目
          <div className="mt-4">
            <a href="#tabs" className="text-emerald-400 text-sm">去大厅看看有什么项目 →</a>
          </div>
        </div>
        {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
      </>
    );
  }

  // 状态标签
  const badge = (it: MineItem) => {
    const r = it.reservation;
    if (r?.status === 'active') return { t: '独家沟通中', c: 'text-emerald-400' };
    if (r?.status === 'cooperated') return { t: '已合作', c: 'text-emerald-400' };
    if (r?.status === 'completed') return { t: '✅ 任务完成', c: 'text-blue-400' };
    if (it.application.status === 'selected') return { t: '已被选择', c: 'text-blue-400' };
    if (it.application.status === 'rejected') return { t: '未选中', c: 'text-zinc-500' };
    return { t: '申请中', c: 'text-zinc-300' };
  };

  // 删除(隐藏)已完成的接单记录
  const hideItem = async (reservationId: string) => {
    if (!window.confirm('确认从列表中删除该记录？（不影响对方）')) return;
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/commissions/${items.find((i) => i.reservation?.id === reservationId)?.project?.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'hide', reservationId }),
      });
      if (res.ok) setItems((prev) => prev.filter((i) => i.reservation?.id !== reservationId));
    } catch { /* noop */ }
  };

  return (
    <>
      {profileBar}
      <div className="flex flex-col gap-4">
      {items.map((it) => {
        if (!it.project) return null;
        const b = badge(it);
        return (
          <Link key={it.application.id} href={`/boluotv/${it.project.id}`}
            className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all overflow-hidden p-4">
            <div className="w-40 h-28 shrink-0 rounded-xl bg-zinc-900 overflow-hidden">
              {it.project.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.project.cover_url} alt={it.project.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs font-medium ${b.c}`}>● {b.t}</span>
                {it.project.category && <span className="text-xs text-zinc-500">· {it.project.category}</span>}
              </div>
              <h3 className="font-semibold text-base mb-1 line-clamp-1">{it.project.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-2">{it.project.description || '—'}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-emerald-400 font-medium">
                  {it.project.budget_min != null && it.project.budget_max != null ? `¥${it.project.budget_min}-${it.project.budget_max}` : '预算面议'}
                </span>
                <span className="text-zinc-500">我的报价 {it.application.quote_min != null ? `¥${it.application.quote_min}-${it.application.quote_max}` : '面议'}</span>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {it.reservation?.status === 'completed' && it.reservation?.id ? (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideItem(it.reservation!.id); }}
                  className="px-3 py-2 rounded-full border border-white/15 text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-colors">
                  删除
                </button>
              ) : (
                <span className="px-4 py-2 rounded-full bg-white/10 text-sm text-white">查看详情 →</span>
              )}
            </div>
          </Link>
        );
      })}
      </div>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  );
}
