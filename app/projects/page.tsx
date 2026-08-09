'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  listCanvasesWithCover,
  createCanvas,
  deleteCanvas,
  renameCanvas,
  type CanvasWithCover,
} from '@/lib/canvas-storage';

// ============================================================
// 我的项目
// ============================================================
// 左侧固定导航(首页/项目/Skill),右侧项目网格。
// 第一格是"开始创作"新建位,其余为项目卡片。
// 封面取该项目最新快照里的第一张图片产出,没有则显示空白位
// (后续要加视频封面/素材缩略图,扩 listCanvasesWithCover 的 cover 即可)。
// 点卡片进画布:/canvas-v2?canvas=<id>
// ============================================================

const NAV = [
  { key: 'home', label: '首页', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { key: 'projects', label: '项目', href: '/projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { key: 'skill', label: 'Skill', href: '/canvas-v2?studio=true', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function ProjectsPage() {
  const [items, setItems] = useState<CanvasWithCover[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setUserId(null); setItems([]); return; }
      setUserId(user.id);
      setItems(await listCanvasesWithCover(user.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openProject = (id: string) => { window.location.href = `/canvas-v2?canvas=${id}`; };

  const handleCreate = async () => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const created = await createCanvas(userId);
      if (created) openProject(created.id);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (item: CanvasWithCover) => {
    const next = prompt('重命名项目', item.title);
    if (next === null) return;
    const t = next.trim();
    if (!t || t === item.title) return;
    await renameCanvas(item.id, t);
    setMenuFor(null);
    refresh();
  };

  const handleDelete = async (item: CanvasWithCover) => {
    if (!confirm(`删除项目「${item.title}」？项目内的画布内容将一并删除，无法恢复。`)) return;
    await deleteCanvas(item.id);
    setMenuFor(null);
    refresh();
  };

  const filtered = keyword.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(keyword.trim().toLowerCase()))
    : items;

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(10,10,10)' }}>
      {/* 左侧导航 */}
      <aside
        className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen"
        style={{ width: 176, borderRight: '1px solid #ffffff12' }}
      >
        <div className="px-5 py-5">
          <a href="/" className="flex items-center gap-2">
            <img src="/filmavo-logo-primary.svg" alt="Filmavo" style={{ width: 26, height: 26, borderRadius: 7 }} />
            <span className="text-sm font-bold tracking-tight" style={{ color: 'rgb(238,238,238)' }}>Filmavo</span>
          </a>
        </div>

        <nav className="px-2.5 flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.key === 'projects';
            return (
              <a
                key={n.key}
                href={n.href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
                style={{
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: active ? 'rgb(240,240,240)' : 'rgb(150,150,150)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={n.icon} />
                </svg>
                {n.label}
              </a>
            );
          })}
        </nav>

        <div className="flex-1" />
        <div className="px-5 py-5">
          <a href="/pricing" className="text-[11px] hover:opacity-70 transition-opacity" style={{ color: 'rgb(110,110,110)' }}>
            定价 ↗
          </a>
        </div>
      </aside>

      {/* 右侧主区 */}
      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(10,10,10,0.82)', borderBottom: '1px solid #ffffff12' }}>
          <div className="px-6 py-4 flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight" style={{ color: 'rgb(240,240,240)' }}>我的项目</h1>
            {items.length > 0 && (
              <span className="text-xs" style={{ color: 'rgb(110,110,110)' }}>{items.length} 个</span>
            )}
            <div className="flex-1" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索项目"
              className="px-3 py-2 rounded-lg text-xs w-40 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #ffffff1c', color: 'rgb(230,230,230)' }}
            />
          </div>
        </div>

        <div className="px-6 py-6">
          {loading && <div className="text-sm py-20 text-center" style={{ color: 'rgb(110,110,110)' }}>加载中…</div>}

          {!loading && !userId && (
            <div className="py-24 text-center">
              <p className="text-sm mb-4" style={{ color: 'rgb(150,150,150)' }}>登录后查看你的项目</p>
              <a href="/auth" className="inline-block px-5 py-2.5 rounded-lg text-xs font-semibold" style={{ background: 'rgb(113,208,131)', color: '#04170a' }}>登录</a>
            </div>
          )}

          {!loading && userId && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* 第一格:开始创作 */}
              <button
                onClick={handleCreate}
                disabled={busy}
                className="group rounded-2xl overflow-hidden transition-all hover:-translate-y-1 disabled:opacity-50"
                style={{ border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex flex-col items-center justify-center gap-2" style={{ aspectRatio: '16/9' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
                  >
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 18, height: 18 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'rgb(225,225,225)' }}>
                    {busy ? '创建中…' : '开始创作'}
                  </span>
                </div>
                <div className="px-3.5 py-3 text-left">
                  <div className="text-[13px] font-semibold" style={{ color: 'rgb(180,180,180)' }}>新建项目</div>
                  <div className="text-[10.5px] mt-1" style={{ color: 'rgb(100,100,100)' }}>进入无限画布</div>
                </div>
              </button>

              {/* 项目卡片 */}
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-2xl overflow-hidden transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff14' }}
                >
                  <div
                    onClick={() => openProject(item.id)}
                    className="relative cursor-pointer overflow-hidden"
                    style={{ aspectRatio: '16/9', background: 'linear-gradient(160deg, rgb(30,30,32), rgb(16,16,18))' }}
                  >
                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.title}
                        className="w-full h-full"
                        style={{ objectFit: 'cover', display: 'block' }}
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[11px]" style={{ color: 'rgb(85,85,90)' }}>
                          {item.nodeCount > 0 ? '暂无预览' : '空白项目'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="px-3.5 py-3">
                    <div
                      onClick={() => openProject(item.id)}
                      className="text-[13px] font-semibold truncate cursor-pointer"
                      style={{ color: 'rgb(232,232,232)' }}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10.5px]" style={{ color: 'rgb(110,110,110)' }}>{fmtTime(item.updated_at)}</span>
                      {item.nodeCount > 0 && (
                        <span className="text-[10.5px]" style={{ color: 'rgb(90,90,95)' }}>· {item.nodeCount} 个卡片</span>
                      )}
                    </div>
                  </div>

                  {/* 更多操作 */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === item.id ? null : item.id); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-md"
                      style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgb(225,225,225)' }}
                      title="更多"
                    >
                      ⋯
                    </button>
                    {menuFor === item.id && (
                      <div className="absolute right-0 mt-1 w-28 rounded-xl overflow-hidden shadow-2xl z-30" style={{ background: 'rgb(26,26,28)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRename(item); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-white/5"
                          style={{ color: 'rgb(225,225,225)' }}
                        >
                          重命名
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-white/5"
                          style={{ color: 'rgb(235,120,120)' }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && userId && keyword.trim() && filtered.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: 'rgb(130,130,130)' }}>没有匹配的项目</div>
          )}
        </div>
      </main>

      {menuFor && <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />}
    </div>
  );
}
