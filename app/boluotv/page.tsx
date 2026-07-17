'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { PublishCommissionModal } from './PublishModal';

// ============================================================
// 创作委托大厅(独立于画布,只共用 users 账号)
// 甲方发布委托 → 创作者浏览申请。平台只收介绍费解锁联系方式,不碰项目款。
// ============================================================

type Project = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  delivery_days: number | null;
  cover_url: string | null;
  tags: string[] | null;
  status: string;
  application_count: number;
  created_at: string;
};

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'ad', label: '产品广告' },
  { key: 'film', label: '影视短片' },
  { key: 'short', label: '短视频' },
  { key: 'anime', label: '动画' },
  { key: 'other', label: '其它' },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '招募中', color: 'text-emerald-400' },
  reserved: { label: '待确认', color: 'text-yellow-400' },
  exclusive_contact: { label: '独家沟通中', color: 'text-blue-400' },
  cooperated: { label: '已合作', color: 'text-zinc-400' },
  closed: { label: '已关闭', color: 'text-zinc-500' },
};

export default function CommissionHall() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [publishOpen, setPublishOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb?.auth.getUser().then(({ data }: { data: { user: unknown } }) => setLoggedIn(!!data.user));
  }, []);

  const load = () => {
    setLoading(true);
    fetch(`/api/commissions?category=${category}&status=open&limit=60`)
      .then((r) => r.json())
      .then((d) => { setProjects(d.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [category]);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-white/8">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Filmavo<span className="text-emerald-500"> 创作委托</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-zinc-400 hover:text-white transition-colors">首页</Link>
            <Link href="/canvas" className="text-zinc-400 hover:text-white transition-colors">进入画布</Link>
            <button
              onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
              className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors"
            >
              发布委托
            </button>
          </div>
        </div>
      </nav>

      {/* Hero:左半(视频背景+标题+双按钮) + 右半(上:数据统计 下:三步流程) */}
      <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* 左半:视频背景主视觉 */}
          <div className="relative rounded-3xl overflow-hidden border border-white/10 min-h-[340px]">
            <video
              src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/chuangzaoweituo.mp4"
              autoPlay muted loop playsInline preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 55%, rgba(0,0,0,0.3) 100%)' }} />
            <div className="relative p-8 md:p-10 flex flex-col justify-center h-full min-h-[340px]">
              <h1 className="text-3xl md:text-[40px] font-bold tracking-tight mb-4 leading-tight">
                连接创意需求<br />与专业<span className="text-emerald-400">创作者</span>
              </h1>
              <p className="text-zinc-300 text-sm md:text-[15px] mb-7 max-w-md leading-relaxed">
                发布广告、影视、动画等创作需求，找到合适的创作者，在 Filmavo 完成高质量交付。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                  className="px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors"
                >
                  发布创作委托
                </button>
                <a href="#projects"
                  className="px-6 py-3 rounded-full border border-white/30 text-white font-medium text-sm hover:bg-white/10 transition-colors">
                  寻找项目
                </a>
              </div>
            </div>
          </div>

          {/* 右半 */}
          <div className="flex flex-col gap-6">
            {/* 上:16:9 图片卡 */}
            <div className="rounded-3xl overflow-hidden border border-white/10 bg-zinc-900" style={{ aspectRatio: '16/9' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo.png?quality=80"
                alt="创作委托"
                className="w-full h-full object-cover"
              />
            </div>

            {/* 中:数据统计(横排,无图标) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              {[
                { n: '328+', l: '开放项目' },
                { n: '1460+', l: '创作者' },
                { n: '892+', l: '已完成委托' },
                { n: '96%', l: '按时交付率' },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center text-center gap-1 py-1">
                  <div className="text-xl md:text-2xl font-bold text-emerald-400">{s.n}</div>
                  <div className="text-xs text-zinc-400">{s.l}</div>
                </div>
              ))}
            </div>

            {/* 下:三步流程(横排3列) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              {[
                { n: '01', t: '发布需求', d: '描述你的项目需求和预算' },
                { n: '02', t: '匹配创作者', d: '创作者提交作品与报价，你挑选合适的一位' },
                { n: '03', t: '协作交付', d: '在 Filmavo 完成创作与交付' },
              ].map((s) => (
                <div key={s.n} className="flex flex-col gap-2">
                  <div className="text-2xl font-bold text-emerald-400/70">{s.n}</div>
                  <div className="font-semibold text-sm">{s.t}</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 分类筛选 */}
      <div id="projects" className="max-w-[1400px] mx-auto px-6 flex flex-wrap gap-2 mb-8 scroll-mt-20">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              category === c.key ? 'bg-white text-black font-medium' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 项目列表 */}
      <div className="max-w-[1400px] mx-auto px-6 pb-20">
        {loading ? (
          <div className="text-center text-zinc-500 py-20">加载中…</div>
        ) : projects.length === 0 ? (
          <div className="text-center text-zinc-500 py-20">
            暂无开放的委托项目
            <div className="mt-4">
              <button onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium">发布第一个委托</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => {
              const st = STATUS_LABEL[p.status] || { label: p.status, color: 'text-zinc-400' };
              return (
                <Link key={p.id} href={`/boluotv/${p.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all overflow-hidden">
                  {p.cover_url && (
                    <div className="aspect-video bg-zinc-900 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs ${st.color}`}>● {st.label}</span>
                      {p.category && <span className="text-xs text-zinc-500">· {p.category}</span>}
                    </div>
                    <h3 className="font-semibold text-[15px] mb-1.5 line-clamp-1">{p.title}</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mb-3 min-h-[32px]">{p.description || '—'}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-medium">
                        {p.budget_min != null && p.budget_max != null ? `¥${p.budget_min}-${p.budget_max}` : '预算面议'}
                      </span>
                      <span className="text-zinc-500">
                        {p.delivery_days ? `${p.delivery_days}天交付 · ` : ''}{p.application_count || 0}人申请
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {publishOpen && (
        <PublishCommissionModal onClose={() => setPublishOpen(false)} onPublished={() => { setPublishOpen(false); load(); }} />
      )}
    </main>
  );
}
