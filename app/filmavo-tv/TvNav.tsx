'use client';

// ============================================================
// Filmavo TV 子站左侧导航
// ============================================================
// 三个页面共用:
//   /filmavo-tv           TV 首页(活动宣传 + 素材)
//   /filmavo-tv/projects  我的项目(私人)
//   /filmavo-tv/skill     Skill 库
// "首页"指回主站 /,其余在子站内切换。
// ============================================================

export type TvNavKey = 'site' | 'tv' | 'projects' | 'skill';

const ITEMS: { key: TvNavKey; label: string; href: string; icon: string }[] = [
  {
    key: 'site',
    label: '首页',
    href: '/',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    key: 'tv',
    label: 'Filmavo TV',
    href: '/filmavo-tv',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  },
  {
    key: 'projects',
    label: '项目',
    href: '/filmavo-tv/projects',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
  {
    key: 'skill',
    label: 'Skill',
    href: '/filmavo-tv/skill',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

export function TvNav({ active }: { active: TvNavKey }) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 sticky top-0 h-screen"
      style={{ width: 184, borderRight: '1px solid #ffffff12' }}
    >
      <div className="px-5 py-5">
        <a href="/" className="flex items-center gap-2">
          <img src="/filmavo-logo-primary.svg" alt="Filmavo" style={{ width: 26, height: 26, borderRadius: 7 }} />
          <span className="text-sm font-bold tracking-tight" style={{ color: 'rgb(238,238,238)' }}>Filmavo</span>
        </a>
      </div>

      <nav className="px-2.5 flex flex-col gap-0.5">
        {ITEMS.map((n) => {
          const on = n.key === active;
          return (
            <a
              key={n.key}
              href={n.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] transition-colors hover:bg-white/[0.04]"
              style={{
                background: on ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: on ? 'rgb(240,240,240)' : 'rgb(150,150,150)',
                fontWeight: on ? 600 : 400,
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
      <div className="px-5 py-5 flex flex-col gap-2">
        <a href="/canvas" className="text-[11px] hover:opacity-70 transition-opacity" style={{ color: 'rgb(150,150,150)' }}>
          进入画布 ↗
        </a>
        <a href="/pricing" className="text-[11px] hover:opacity-70 transition-opacity" style={{ color: 'rgb(110,110,110)' }}>
          定价
        </a>
      </div>
    </aside>
  );
}
