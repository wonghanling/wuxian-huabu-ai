'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// 我发布的项目(甲方视角,找回自己发的项目 - 含已进入沟通/已完成的)
type Project = {
  id: string; title: string; description: string | null; category: string | null;
  budget_min: number | null; budget_max: number | null; delivery_days: number | null;
  cover_url: string | null; status: string; application_count: number; created_at: string;
  reservation?: { id: string; hidden_by_client: boolean } | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '招募中', color: 'text-emerald-400' },
  reserved: { label: '待确认', color: 'text-yellow-400' },
  exclusive_contact: { label: '独家沟通中', color: 'text-blue-400' },
  cooperated: { label: '已合作', color: 'text-emerald-400' },
  closed: { label: '✅ 任务完成', color: 'text-blue-400' },
};

export function ClientProjects({ loggedIn }: { loggedIn: boolean }) {
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!loggedIn) { setLoading(false); return; }
      try {
        const sb = createClient();
        const { data: { session } } = await sb!.auth.getSession();
        if (!session) { setLoading(false); return; }
        const res = await fetch('/api/commissions/mine?role=client', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) { const d = await res.json(); setItems(d.items || []); }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [loggedIn]);

  // 删除(隐藏)已完成项目
  const hideItem = async (projectId: string, reservationId: string) => {
    if (!window.confirm('确认从列表中删除该项目？（不影响对方）')) return;
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/commissions/${projectId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'hide', reservationId }),
      });
      if (res.ok) setItems((prev) => prev.filter((p) => p.id !== projectId));
    } catch { /* noop */ }
  };

  if (!loggedIn) {
    return (
      <div className="text-center text-zinc-500 py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
        登录后查看你发布的项目
      </div>
    );
  }
  if (loading) return <div className="text-center text-zinc-500 py-16">加载中…</div>;
  if (items.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
        你还没有发布任何项目
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {items.map((p) => {
          const st = STATUS_LABEL[p.status] || { label: p.status, color: 'text-zinc-400' };
          return (
            <Link key={p.id} href={`/boluotv/${p.id}`}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all overflow-hidden p-4">
              <div className="w-32 h-24 shrink-0 rounded-xl bg-zinc-900 overflow-hidden">
                {p.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-medium ${st.color}`}>● {st.label}</span>
                  {p.category && <span className="text-xs text-zinc-500">· {p.category}</span>}
                </div>
                <h3 className="font-semibold text-base mb-1 line-clamp-1">{p.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed line-clamp-1 mb-2">{p.description || '—'}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-emerald-400 font-medium">
                    {p.budget_min != null && p.budget_max != null ? `¥${p.budget_min}-${p.budget_max}` : '预算面议'}
                  </span>
                  <span className="text-zinc-500">{p.application_count || 0} 人申请</span>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="px-4 py-2 rounded-full bg-white/10 text-sm text-white">管理项目 →</span>
                {p.reservation?.id && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); hideItem(p.id, p.reservation!.id); }}
                    className="px-3 py-2 rounded-full border border-white/15 text-zinc-400 text-sm hover:bg-white/10 hover:text-white transition-colors">
                    删除
                  </button>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
