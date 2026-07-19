'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ApplyModal } from './ApplyModal';
import { CreatorProfileModal } from './CreatorProfileModal';
import { ChatBox } from './ChatBox';

// 项目详情页(独立于画布)。甲方看申请者列表+选择创作者;创作者看详情+申请入口。
type Project = {
  id: string; client_id: string; title: string; description: string | null;
  category: string | null; budget_min: number | null; budget_max: number | null;
  delivery_days: number | null; cover_url: string | null; tags: string[] | null; reference_files: string[] | null;
  status: string; application_count: number; current_reservation_id: string | null; created_at: string;
};
type CreatorProfile = {
  display_name: string | null; avatar_url: string | null; specialties: string[] | null;
  verification_status: string | null; completed_count: number | null;
};
type Application = {
  id: string; creator_id?: string; quote_min: number | null; quote_max: number | null;
  delivery_days: number | null; availability: string | null; intro: string | null;
  status: string; created_at: string; creator_profile?: CreatorProfile | null;
};
type Reservation = {
  id: string; creator_id: string; status: string; payment_status: string;
  amount_cents: number; pay_deadline: string | null; contact_deadline: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '招募中', color: 'text-emerald-400' },
  reserved: { label: '待确认', color: 'text-yellow-400' },
  exclusive_contact: { label: '独家沟通中', color: 'text-blue-400' },
  cooperated: { label: '已合作', color: 'text-zinc-400' },
  closed: { label: '已关闭', color: 'text-zinc-500' },
};

export default function ProjectDetail() {
  const params = useParams();
  const id = params?.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [myApplication, setMyApplication] = useState<Application | null>(null);
  const [myReservation, setMyReservation] = useState<Reservation | null>(null);
  const [creatorContact, setCreatorContact] = useState<{ display_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [viewCreator, setViewCreator] = useState<Application | null>(null);

  // 甲方选择创作者独家沟通(需确认)
  const selectCreator = async (applicationId: string) => {
    const ok = window.confirm('选择后，项目将暂停接受其他申请。创作者支付介绍服务费后，双方联系方式将解锁。在本轮独家沟通结束前，您不能选择其他创作者。确定选择？');
    if (!ok) return;
    setSelecting(applicationId);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch(`/api/commissions/${id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ applicationId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || '选择失败'); setSelecting(null); return; }
      await load();
    } catch (e: any) {
      alert(e.message || '选择失败');
    }
    setSelecting(null);
  };

  // 被选创作者支付介绍费(走支付宝 commission_intro)

  // 标记合作结果(已合作/未合作),双方均可操作
  const finalizeOutcome = async (result: 'cooperated' | 'not_cooperated') => {
    if (!myReservation && !isOwner) return;
    const reservationId = myReservation?.id;
    if (!reservationId) return;
    const reason = result === 'not_cooperated'
      ? (window.prompt('请简要填写未达成合作的原因(如:价格未谈拢/工期不合适/创作方向不匹配等)') || '未说明')
      : null;
    const ok = window.confirm(result === 'cooperated'
      ? '确认已达成合作？项目将关闭，不再重新开放。'
      : '确认结束本轮沟通？项目将重新开放，可再选择其他创作者。');
    if (!ok) return;
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch(`/api/commissions/${id}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'outcome', reservationId, result, reason }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || '操作失败'); return; }
      await load();
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      setLoggedIn(!!session);
      const res = await fetch(`/api/commissions/${id}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setProject(data.project);
      setIsOwner(data.isOwner);
      setApplications(data.applications || []);
      setMyApplication(data.myApplication || null);
      setMyReservation(data.myReservation || null);
      setCreatorContact(data.creatorContact || null);
    } catch { /* noop */ }
    setLoading(false);
  };

  useEffect(() => { if (id) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (loading) return <Shell><div className="text-center text-zinc-500 py-32">加载中…</div></Shell>;
  if (notFound || !project) return <Shell><div className="text-center text-zinc-500 py-32">项目不存在或已删除</div></Shell>;

  const st = STATUS_LABEL[project.status] || { label: project.status, color: 'text-zinc-400' };

  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <Link href="/boluotv" className="text-sm text-zinc-400 hover:text-white transition-colors">← 返回大厅</Link>

        {/* 项目头 */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          {project.cover_url && (
            <div className="aspect-[21/9] bg-zinc-900 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm ${st.color}`}>● {st.label}</span>
              {project.category && <span className="text-sm text-zinc-500">· {project.category}</span>}
            </div>
            <h1 className="text-2xl font-bold mb-3">{project.title}</h1>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap mb-5">{project.description || '暂无描述'}</p>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">预算</div>
                <div className="text-emerald-400 font-semibold">
                  {project.budget_min != null && project.budget_max != null ? `¥${project.budget_min}-${project.budget_max}` : '面议'}
                </div>
              </div>
              {project.delivery_days ? (
                <div>
                  <div className="text-xs text-zinc-500 mb-0.5">交付周期</div>
                  <div className="text-white font-medium">{project.delivery_days} 天</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">申请人数</div>
                <div className="text-white font-medium">{project.application_count || 0} 人</div>
              </div>
            </div>
            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {project.tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 text-xs rounded-full bg-white/5 text-zinc-300 border border-white/10">{t}</span>
                ))}
              </div>
            )}
            {project.reference_files && project.reference_files.length > 0 && (
              <div className="mt-5">
                <div className="text-xs text-zinc-500 mb-2">参考资料</div>
                <div className="flex flex-wrap gap-3">
                  {project.reference_files.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-zinc-900 hover:border-white/30 transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`参考${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 甲方视角: 独家沟通中 → 看创作者 + 标记合作结果 */}
        {isOwner && myReservation?.status === 'active' && (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-6">
            <div className="text-base font-semibold text-emerald-400 mb-3">🎉 独家沟通中</div>
            <div className="space-y-2 text-sm mb-4">
              <div><span className="text-zinc-500">被选创作者：</span><span className="text-white">{creatorContact?.display_name || '创作者'}</span></div>
            </div>
            <div className="text-xs text-zinc-400 mb-4 leading-relaxed">
              请在下方实时沟通，确认最终价格、制作周期、修改次数、交付内容与付款方式。项目款由双方线下自行结算，平台不参与项目资金交易。
            </div>
            <div className="flex flex-wrap gap-3 pb-4 border-b border-white/10">
              <button onClick={() => finalizeOutcome('cooperated')}
                className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
                确认合作（结束项目）
              </button>
              <button onClick={() => finalizeOutcome('not_cooperated')}
                className="px-5 py-2.5 rounded-full border border-white/20 text-zinc-300 text-sm hover:bg-white/10 transition-colors">
                未谈拢（重新招募）
              </button>
            </div>
            <div className="mt-6">
              <ChatBox projectId={id} reservationId={myReservation.id} paid={true} onRefresh={() => load()} />
            </div>
          </div>
        )}

        {/* 甲方视角: 申请者列表 */}
        {isOwner ? (
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4">申请者 ({applications.length})</h2>
            {applications.length === 0 ? (
              <div className="text-center text-zinc-500 py-12 rounded-2xl border border-white/10 bg-white/[0.02]">
                还没有创作者申请，耐心等待或分享你的项目
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {applications.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/40 to-blue-500/40 shrink-0">
                            {a.creator_profile?.avatar_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.creator_profile.avatar_url} alt="头像" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{a.creator_profile?.display_name || '创作者'}</span>
                              {a.creator_profile?.completed_count ? <span className="text-xs text-zinc-500">已合作{a.creator_profile.completed_count}次</span> : null}
                            </div>
                            <span className="text-xs text-zinc-500">
                              报价 {a.quote_min != null ? `¥${a.quote_min}-${a.quote_max}` : '面议'} · {a.delivery_days || '?'}天 · {a.availability || '档期待定'}
                            </span>
                          </div>
                        </div>
                        {a.creator_profile?.specialties && a.creator_profile.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {a.creator_profile.specialties.map((s) => (
                              <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-zinc-400 border border-white/10">{s}</span>
                            ))}
                          </div>
                        )}
                        {a.intro && <p className="text-sm text-zinc-300 leading-relaxed">{a.intro}</p>}
                        <button onClick={() => setViewCreator(a)}
                          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300">查看申请详情 →</button>
                      </div>
                      <div className="shrink-0">
                        {project.status === 'open' ? (
                          <button
                            onClick={() => selectCreator(a.id)}
                            disabled={selecting !== null}
                            className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
                            {selecting === a.id ? '处理中…' : '选择独家沟通'}
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-500">{a.status === 'selected' ? '已选择' : '—'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : myReservation && myReservation.status === 'active' ? (
          /* 创作者视角: 被选中,独家沟通中(会员制:选中即聊) */
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-6">
            <div className="text-base font-semibold text-emerald-400 mb-2">🎉 甲方选择了你，独家沟通中</div>
            <div className="text-xs text-zinc-400 mb-4 leading-relaxed">
              在下方与甲方沟通，确认最终价格、制作周期、修改次数、交付内容与付款方式。项目款由双方线下自行结算，平台不参与项目资金交易。
            </div>
            <div className="flex flex-wrap gap-3 pb-4 border-b border-white/10">
              <button onClick={() => finalizeOutcome('cooperated')}
                className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
                确认合作（结束项目）
              </button>
              <button onClick={() => finalizeOutcome('not_cooperated')}
                className="px-5 py-2.5 rounded-full border border-white/20 text-zinc-300 text-sm hover:bg-white/10 transition-colors">
                未谈拢
              </button>
            </div>
            <div className="mt-6">
              <ChatBox projectId={id} reservationId={myReservation.id} paid={true} onRefresh={() => load()} />
            </div>
          </div>
        ) : myApplication ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div>
              <div className="text-sm text-emerald-400 mb-2">✓ 你已申请该项目</div>
              <div className="text-sm text-zinc-400">
                报价 {myApplication.quote_min != null ? `¥${myApplication.quote_min}-${myApplication.quote_max}` : '面议'} ·
                {myApplication.delivery_days || '?'}天 · 状态: {myApplication.status}
              </div>
            </div>
          </div>
        ) : (
          /* 创作者视角: 申请入口 */
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            {project.status === 'open' ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-zinc-300">
                  <div className="font-medium mb-1">申请这个项目</div>
                  <div className="text-xs text-zinc-500">申请阶段无需免费试做，请使用已有作品展示您的能力。</div>
                </div>
                <button
                  onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setApplyOpen(true); }}
                  className="shrink-0 px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors">
                  立即申请
                </button>
              </div>
            ) : (
              <div className="text-sm text-zinc-500">该项目当前不接受新申请（{st.label}）</div>
            )}
          </div>
        )}
      </div>

      {applyOpen && (
        <ApplyModal projectId={id} onClose={() => setApplyOpen(false)} onApplied={() => { setApplyOpen(false); load(); }} />
      )}
      {viewCreator && viewCreator.creator_id && (
        <CreatorProfileModal
          creatorId={viewCreator.creator_id}
          profile={viewCreator.creator_profile ?? null}
          application={viewCreator}
          onClose={() => setViewCreator(null)}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/8">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/boluotv" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              Filmavo<sup className="text-emerald-500 text-[0.6em] font-bold ml-0.5 align-super">TV</sup>
              <span className="text-emerald-500 ml-1.5">创作委托</span>
            </span>
          </Link>
          <Link href="/canvas" className="text-zinc-400 hover:text-white transition-colors text-sm">进入画布</Link>
        </div>
      </nav>
      {children}
    </main>
  );
}
