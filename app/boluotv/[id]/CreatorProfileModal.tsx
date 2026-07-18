'use client';

import { useEffect, useState } from 'react';

// 甲方查看创作者完整资料 + 作品集(只读展示)
type Profile = {
  display_name: string | null; avatar_url: string | null; specialties: string[] | null;
  bio: string | null; verification_status: string | null; completed_count: number | null;
};
type PortfolioItem = { id: string; title: string | null; media_type: string; media_url: string };

export function CreatorProfileModal({
  creatorId, profile, application, onClose,
}: {
  creatorId: string;
  profile: Profile | null;
  application: { quote_min: number | null; quote_max: number | null; delivery_days: number | null; availability: string | null; intro: string | null };
  onClose: () => void;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/commissions/portfolio?creatorId=${creatorId}`);
        if (res.ok) { const d = await res.json(); setPortfolio(d.items || []); }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [creatorId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-zinc-900 border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">创作者资料</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        {/* 头部:头像+昵称+擅长 */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500/40 to-blue-500/40 shrink-0">
            {profile?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="头像" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{profile?.display_name || '创作者'}</span>
              {profile?.completed_count ? <span className="text-xs text-zinc-500">已合作 {profile.completed_count} 次</span> : null}
            </div>
            {profile?.specialties && profile.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.specialties.map((s) => (
                  <span key={s} className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-zinc-300 border border-white/10">{s}</span>
                ))}
              </div>
            )}
            {profile?.bio && <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{profile.bio}</p>}
          </div>
        </div>

        {/* 本次申请信息 */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5">
          <div className="text-xs text-zinc-500 mb-2">本次申请</div>
          <div className="flex flex-wrap items-center gap-4 text-sm mb-2">
            <span className="text-emerald-400 font-medium">报价 {application.quote_min != null ? `¥${application.quote_min}-${application.quote_max}` : '面议'}</span>
            <span className="text-zinc-400">工期 {application.delivery_days || '?'} 天</span>
            <span className="text-zinc-400">档期 {application.availability || '待定'}</span>
          </div>
          {application.intro && <p className="text-sm text-zinc-300 leading-relaxed">{application.intro}</p>}
        </div>

        {/* 作品集 */}
        <div>
          <div className="text-sm font-semibold mb-3">作品集</div>
          {loading ? (
            <div className="text-center text-zinc-500 py-8 text-sm">加载中…</div>
          ) : portfolio.length === 0 ? (
            <div className="text-center text-zinc-500 py-8 text-sm rounded-xl border border-white/10 bg-white/[0.02]">该创作者暂未上传作品</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {portfolio.map((p) => (
                <a key={p.id} href={p.media_url} target="_blank" rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-zinc-800 hover:border-white/30 transition-colors">
                  {p.media_type === 'video' ? (
                    <video src={p.media_url} className="w-full h-full object-cover" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media_url} alt={p.title || '作品'} className="w-full h-full object-cover" />
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
