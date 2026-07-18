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

// 中间轮播图(render/image quality=80 压缩)
const HERO_IMAGES = [
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo.png?quality=80',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo1.png?quality=80',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo2.png?quality=80',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo3.png?quality=80',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo4.png?quality=80',
  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/chuangzuoweituo5.png?quality=80',
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
  const [heroSlide, setHeroSlide] = useState(0);
  const [role, setRole] = useState<'client' | 'creator'>('client'); // 我是客户 / 我是创作者

  useEffect(() => {
    const sb = createClient();
    sb?.auth.getUser().then(({ data }: { data: { user: unknown } }) => setLoggedIn(!!data.user));
  }, []);

  // 中间轮播图自动左滑
  useEffect(() => {
    const t = setInterval(() => setHeroSlide((s) => (s + 1) % HERO_IMAGES.length), 3500);
    return () => clearInterval(t);
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
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              Filmavo<sup className="text-emerald-500 text-[0.6em] font-bold ml-0.5 align-super">TV</sup>
              <span className="text-emerald-500 ml-1.5">创作委托</span>
            </span>
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

      {/* Hero:左(视频卡槽+文案+双按钮+数据) 中(轮播图+项目文案) 右(3小卡) */}
      <section className="max-w-[1920px] mx-auto px-6 md:px-12 pt-12 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1.4fr_0.5fr] gap-6 items-stretch">
          {/* 左:轮播图 + 项目文案叠加 */}
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-zinc-900 min-h-[380px]">
            {/* 轮播轨道 */}
            <div
              className="flex h-full absolute inset-0 transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${heroSlide * 100}%)` }}
            >
              {HERO_IMAGES.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`创作委托${i + 1}`} className="w-full h-full object-cover shrink-0" />
              ))}
            </div>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.75) 100%)' }} />
            {/* 项目文案叠加 */}
            <div className="relative h-full flex flex-col justify-between p-7 min-h-[380px]">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500 text-black text-xs font-bold">精选推荐</span>
                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur text-white text-xs">正在招募中</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">正在招募中</h3>
                <p className="text-zinc-300 text-sm mb-4 max-w-lg leading-relaxed">
                  发布你的创作需求，让专业创作者为你实现。
                </p>
                <button
                  onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                  className="px-6 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
                  立即发布 →
                </button>
              </div>
            </div>
            {/* 轮播指示点 */}
            <div className="absolute top-4 right-4 flex gap-1.5 z-10">
              {HERO_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${i === heroSlide ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                  aria-label={`第${i + 1}张`}
                />
              ))}
            </div>
          </div>

          {/* 中:视频背景卡槽 + 文案 + 双按钮 + 4数据 */}
          <div className="relative rounded-3xl overflow-hidden border border-white/10 min-h-[380px]">
            <video
              src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/uploads/chuangzaoweituo.mp4"
              autoPlay muted loop playsInline preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.15) 100%)' }} />
            <div className="relative h-full flex flex-col justify-center p-7 md:p-8 min-h-[380px]">
              <h1 className="text-2xl md:text-[34px] font-bold tracking-tight mb-3 leading-[1.2]">
                把创意需求，<br />交给专业的<span className="text-emerald-400">创作者</span>
              </h1>
              <p className="text-zinc-300 text-sm mb-6 leading-relaxed max-w-sm">
                发布广告、影视、动画等创作需求，多位创作者免费申请，你挑选最合适的一位一对一沟通合作。
              </p>
              <div className="flex flex-wrap gap-3 mb-7">
                <button
                  onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                  className="px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  发布创作委托
                </button>
                <a href="#tabs"
                  className="px-6 py-3 rounded-full border border-white/30 text-white font-medium text-sm hover:bg-white/10 transition-colors">
                  成为创作者
                </a>
              </div>
              {/* 4数据横排 */}
              <div className="grid grid-cols-4 gap-2 max-w-sm">
                {[
                  { n: '328+', l: '开放项目' },
                  { n: '1460+', l: '创作者' },
                  { n: '892+', l: '已完成' },
                  { n: '96%', l: '按时交付' },
                ].map((s, i) => (
                  <div key={s.l} className={`text-center ${i > 0 ? 'border-l border-white/15' : ''}`}>
                    <div className="text-lg md:text-xl font-bold text-white tracking-tight">{s.n}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右:3个小卡竖排 */}
          <div className="flex flex-col gap-4">
            {[
              { n: '12', l: '创意方案', s: '份待你查看', c: 'from-emerald-500/20' },
              { n: '5', l: '制作中', s: '个进行项目', c: 'from-blue-500/20' },
              { n: '24', l: '本周已完成', s: '个交付', c: 'from-purple-500/20' },
            ].map((s) => (
              <div key={s.l}
                className={`flex-1 rounded-2xl border border-white/10 p-5 flex flex-col justify-center bg-gradient-to-br ${s.c} to-transparent`}
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                <div className="text-3xl font-bold text-white mb-1">{s.n}</div>
                <div className="text-sm text-zinc-300">{s.l}</div>
                <div className="text-xs text-zinc-500">{s.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab切换区: 我是客户 / 我是创作者 */}
      <div id="tabs" className="max-w-[1920px] mx-auto px-6 md:px-12 scroll-mt-20 mb-8">
        <div className="flex gap-3">
          <button
            onClick={() => setRole('client')}
            className={`flex-1 md:flex-none md:min-w-[280px] rounded-2xl border px-6 py-4 text-left transition-all ${
              role === 'client' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <div className="font-semibold text-base mb-0.5">我是客户</div>
            <div className="text-xs text-zinc-400">发布需求，找创作者</div>
          </button>
          <button
            onClick={() => setRole('creator')}
            className={`flex-1 md:flex-none md:min-w-[280px] rounded-2xl border px-6 py-4 text-left transition-all ${
              role === 'creator' ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            <div className="font-semibold text-base mb-0.5">我是创作者</div>
            <div className="text-xs text-zinc-400">寻找项目，接单赚钱</div>
          </button>
        </div>
      </div>

      {/* 主体: 我是客户 内容 */}
      {role === 'client' ? (
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 pb-20 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* 左: 筛选 + 分类 + 项目列表 */}
          <div>
            {/* 筛选栏 */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex-1 min-w-[200px]">
                <input placeholder="搜索项目关键词…"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25" />
              </div>
              {['全部预算', '交付周期', '项目状态', '发布时间'].map((f) => (
                <button key={f} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-300 hover:bg-white/10 transition-colors">
                  {f} ▾
                </button>
              ))}
            </div>

            {/* 分类标签 */}
            <div className="flex flex-wrap gap-2 mb-6">
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

            {/* 项目列表(横向大卡) */}
            {loading ? (
              <div className="text-center text-zinc-500 py-20">加载中…</div>
            ) : projects.length === 0 ? (
              <div className="text-center text-zinc-500 py-20 rounded-2xl border border-white/10 bg-white/[0.02]">
                暂无开放的委托项目
                <div className="mt-4">
                  <button onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                    className="px-5 py-2 rounded-full bg-white text-black text-sm font-medium">发布第一个委托</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {projects.map((p) => {
                  const st = STATUS_LABEL[p.status] || { label: p.status, color: 'text-zinc-400' };
                  return (
                    <Link key={p.id} href={`/boluotv/${p.id}`}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all overflow-hidden p-4">
                      {/* 左图 */}
                      <div className="w-40 h-28 shrink-0 rounded-xl bg-zinc-900 overflow-hidden">
                        {p.cover_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                        )}
                      </div>
                      {/* 中信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-xs ${st.color}`}>● {st.label}</span>
                          {p.category && <span className="text-xs text-zinc-500">· {p.category}</span>}
                        </div>
                        <h3 className="font-semibold text-base mb-1 line-clamp-1">{p.title}</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-2">{p.description || '—'}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <span className="text-emerald-400 font-medium">
                            {p.budget_min != null && p.budget_max != null ? `¥${p.budget_min}-${p.budget_max}` : '预算面议'}
                          </span>
                          {p.delivery_days ? <span className="text-zinc-500">{p.delivery_days}天交付</span> : null}
                          <span className="text-zinc-500">{p.application_count || 0}人申请</span>
                        </div>
                      </div>
                      {/* 右按钮 */}
                      <div className="shrink-0 flex items-center">
                        <span className="px-4 py-2 rounded-full bg-white/10 text-sm text-white hover:bg-white/20 transition-colors">查看项目 →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右侧边栏(静态占位) */}
          <aside className="flex flex-col gap-5">
            {/* 客户工作台 */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-semibold text-sm mb-4">客户工作台</div>
              <div className="space-y-2.5">
                {[
                  { l: '草稿', n: 0 }, { l: '招募中', n: 0 }, { l: '待选择', n: 0 },
                  { l: '制作中', n: 0 }, { l: '待验收', n: 0 },
                ].map((it) => (
                  <div key={it.l} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{it.l}</span>
                    <span className="text-white font-medium">{it.n}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { if (!loggedIn) { window.location.href = '/auth'; return; } setPublishOpen(true); }}
                className="w-full mt-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors">
                + 发布新委托
              </button>
            </div>

            {/* 推荐创作者(静态占位) */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-semibold text-sm mb-4">推荐创作者</div>
              <div className="space-y-3">
                {['创作者招募中', '创作者招募中', '创作者招募中'].map((name, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/40 to-blue-500/40" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-300">{name}</div>
                      <div className="text-xs text-zinc-500">等待优质创作者入驻</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI优化需求 */}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
              <div className="font-semibold text-sm mb-1.5">AI 优化需求</div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">不知道怎么写需求？用 AI 帮你把想法整理成清晰的委托描述。</p>
              <button className="w-full py-2.5 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 transition-colors">
                试试 AI 优化
              </button>
            </div>
          </aside>
        </div>
      ) : (
        /* 我是创作者 内容(下一步做) */
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 pb-20">
          <div className="text-center text-zinc-500 py-20 rounded-2xl border border-white/10 bg-white/[0.02]">
            创作者视图开发中…
          </div>
        </div>
      )}

      {publishOpen && (
        <PublishCommissionModal onClose={() => setPublishOpen(false)} onPublished={() => { setPublishOpen(false); load(); }} />
      )}
    </main>
  );
}
