'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = '1825221780@qq.com';

interface ProviderStat {
  total: number;
  success: number;
  failure: number;
  avgMs: number;
  totalMs: number;
}

interface KeyStat {
  total: number;
  success: number;
  failure: number;
  totalMs: number;
}

interface ApiKeyBrief {
  id: string;
  provider: string;
  key_name: string | null;
  status: string;
  current_concurrency: number;
  max_concurrency: number;
  total_calls: number;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
}

interface StatsData {
  range: string;
  since: string;
  providerStats: Record<string, ProviderStat>;
  keyStats: Record<string, KeyStat>;
  errorTypeCount: Record<string, number>;
  recentErrors: Array<{
    created_at: string;
    provider: string;
    key_id: string | null;
    error_type: string | null;
    error_msg: string | null;
    duration_ms: number | null;
  }>;
  keys: ApiKeyBrief[];
}

const PROVIDERS: Record<string, string> = {
  n1n: 'n1n (Yunwu)',
  fal: 'fal.ai',
  dashscope: 'DashScope',
  ark: 'ARK 火山企业版',
  volc: 'Volc 即梦',
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  rate_limit: '限流',
  auth: '认证失败',
  content: '内容审核',
  timeout: '超时',
  other: '其他',
};

export default function ApiPoolStatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState('');
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [data, setData] = useState<StatsData | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/auth'); return; }
      if (session.user.email !== ADMIN_EMAIL) { router.replace('/'); return; }
      setToken(session.access_token);
      setAuthorized(true);
      setLoading(false);
    })();
  }, [router]);

  const load = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/api-pool/stats?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const d = await res.json();
      if (res.ok) setData(d);
      else alert('加载失败: ' + d.error);
    } catch (err: any) {
      alert('加载失败: ' + err.message);
    }
  };

  useEffect(() => {
    if (authorized) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, range]);

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">加载中...</div>;
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">API 调用监控</h1>
            <p className="text-sm text-zinc-400 mt-1">时间范围内各 provider 的使用情况</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-lg bg-white/5 p-0.5">
              {(['1h', '24h', '7d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-xs transition ${range === r ? 'bg-white/15' : 'hover:bg-white/5'}`}
                >
                  {r === '1h' ? '1 小时' : r === '24h' ? '24 小时' : '7 天'}
                </button>
              ))}
            </div>
            <button onClick={load} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs">
              刷新
            </button>
            <a href="/admin/api-pool" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs">
              ← 返回池管理
            </a>
          </div>
        </div>

        {!data && <div className="text-zinc-500">加载中...</div>}

        {data && (
          <>
            {/* Provider 总览 */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              {Object.keys(PROVIDERS).map(p => {
                const s = data.providerStats[p];
                const total = s?.total || 0;
                const success = s?.success || 0;
                const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
                return (
                  <div key={p} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-[10px] text-zinc-400">{PROVIDERS[p]}</div>
                    <div className="text-2xl font-bold mt-1">{total}</div>
                    <div className="text-[10px] text-zinc-500">调用次数</div>
                    {total > 0 && (
                      <div className="flex justify-between mt-2 text-[10px]">
                        <span className="text-green-400">{successRate}% 成功</span>
                        <span className="text-zinc-500">{s.avgMs}ms</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 错误分类 */}
            {Object.keys(data.errorTypeCount).length > 0 && (
              <div className="mb-6 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <div className="text-xs text-red-300 mb-2">错误分类</div>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(data.errorTypeCount).map(([t, c]) => (
                    <div key={t} className="text-xs">
                      <span className="text-red-400">{ERROR_TYPE_LABELS[t] || t}</span>
                      <span className="text-zinc-500 ml-1">× {c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 各 key 使用情况 */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden mb-6">
              <div className="px-3 py-2 border-b border-white/5 text-xs text-zinc-400">各 Key 使用情况</div>
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="text-left px-3 py-2">Provider</th>
                    <th className="text-left px-3 py-2">别名</th>
                    <th className="text-center px-3 py-2">状态</th>
                    <th className="text-center px-3 py-2">并发</th>
                    <th className="text-center px-3 py-2">时间段调用</th>
                    <th className="text-center px-3 py-2">成功率</th>
                    <th className="text-center px-3 py-2">平均耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {data.keys.map(k => {
                    const s = data.keyStats[k.id];
                    const total = s?.total || 0;
                    const success = s?.success || 0;
                    const rate = total > 0 ? Math.round((success / total) * 100) : null;
                    const avgMs = total > 0 ? Math.round((s?.totalMs || 0) / total) : 0;
                    return (
                      <tr key={k.id} className="border-t border-white/5 hover:bg-white/3">
                        <td className="px-3 py-2 font-mono">{k.provider}</td>
                        <td className="px-3 py-2">{k.key_name || '-'}</td>
                        <td className="px-3 py-2 text-center">
                          {k.status === 'active' && <span className="text-green-400">● 启用</span>}
                          {k.status === 'disabled' && <span className="text-red-400">● 禁用</span>}
                          {k.status === 'cooldown' && <span className="text-yellow-400">● 冷却</span>}
                        </td>
                        <td className="px-3 py-2 text-center">{k.current_concurrency}/{k.max_concurrency}</td>
                        <td className="px-3 py-2 text-center">{total}</td>
                        <td className="px-3 py-2 text-center">
                          {rate !== null ? (
                            <span className={rate >= 90 ? 'text-green-400' : rate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                              {rate}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center text-zinc-500">{total > 0 ? `${avgMs}ms` : '-'}</td>
                      </tr>
                    );
                  })}
                  {data.keys.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-zinc-500">账号池为空</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 最近错误 */}
            {data.recentErrors.length > 0 && (
              <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-white/5 text-xs text-zinc-400">最近错误（最多 30 条）</div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5 text-zinc-400 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">时间</th>
                        <th className="text-left px-3 py-2">Provider</th>
                        <th className="text-left px-3 py-2">类型</th>
                        <th className="text-left px-3 py-2">详情</th>
                        <th className="text-right px-3 py-2">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentErrors.map((e, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-3 py-2 text-zinc-500">{new Date(e.created_at).toLocaleString('zh-CN', { hour12: false })}</td>
                          <td className="px-3 py-2 font-mono">{e.provider}</td>
                          <td className="px-3 py-2">
                            <span className="text-red-400">{ERROR_TYPE_LABELS[e.error_type || 'other'] || e.error_type}</span>
                          </td>
                          <td className="px-3 py-2 text-zinc-400 max-w-lg truncate">{e.error_msg || '-'}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{e.duration_ms ? `${e.duration_ms}ms` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
