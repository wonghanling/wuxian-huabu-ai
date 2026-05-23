'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';

const PROVIDERS = [
  { value: 'n1n', label: 'n1n (Yunwu)', desc: 'MJ/豆包/Flux/文本/Kling/MiniMax' },
  { value: 'fal', label: 'fal.ai', desc: 'Veo/nano-banana/gpt-image-2/flux-kontext' },
  { value: 'dashscope', label: 'DashScope', desc: '阿里云 Wan 视频' },
  { value: 'ark', label: 'ARK', desc: '火山引擎企业版 Seedance 2.0' },
  { value: 'volc', label: 'Volc (即梦)', desc: '火山引擎即梦（需双 key）' },
];

interface ApiKey {
  id: string;
  provider: string;
  key_name: string | null;
  key_value_mask: string;
  secondary_value_mask: string;
  priority: number;
  max_concurrency: number;
  current_concurrency: number;
  total_calls: number;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function ApiPoolAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [token, setToken] = useState('');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [filterProvider, setFilterProvider] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);

  // 身份验证
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth');
        return;
      }
      if (!isAdmin(session.user.email)) {
        router.replace('/');
        return;
      }
      setToken(session.access_token);
      setAuthorized(true);
      setLoading(false);
    })();
  }, [router]);

  // 加载列表
  const loadKeys = async () => {
    if (!token) return;
    try {
      const url = filterProvider
        ? `/api/admin/api-pool/list?provider=${filterProvider}`
        : '/api/admin/api-pool/list';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) setKeys(data.keys || []);
      else alert('加载失败: ' + data.error);
    } catch (err: any) {
      alert('加载失败: ' + err.message);
    }
  };

  useEffect(() => {
    if (authorized) loadKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, filterProvider]);

  // 更新状态
  const updateKey = async (id: string, patch: Record<string, any>) => {
    const res = await fetch(`/api/admin/api-pool/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadKeys();
    else {
      const d = await res.json();
      alert('更新失败: ' + d.error);
    }
  };

  // 删除 key
  const deleteKey = async (id: string) => {
    if (!confirm('确定删除这个 key？不可恢复')) return;
    const res = await fetch(`/api/admin/api-pool/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) loadKeys();
    else {
      const d = await res.json();
      alert('删除失败: ' + d.error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">加载中...</div>;
  }
  if (!authorized) return null;

  // 按 provider 分组统计
  const groupStats = PROVIDERS.map(p => {
    const rows = keys.filter(k => k.provider === p.value);
    return {
      ...p,
      count: rows.length,
      active: rows.filter(k => k.status === 'active').length,
      disabled: rows.filter(k => k.status === 'disabled').length,
      totalCapacity: rows.reduce((sum, k) => sum + k.max_concurrency, 0),
      totalBusy: rows.reduce((sum, k) => sum + k.current_concurrency, 0),
    };
  });

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">API 账号池管理</h1>
            <p className="text-sm text-zinc-400 mt-1">仅管理员可访问</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/admin/api-pool/stats"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              监控
            </a>
            <button
              onClick={() => loadKeys()}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              刷新
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-medium"
            >
              + 添加 Key
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {groupStats.map(p => (
            <button
              key={p.value}
              onClick={() => setFilterProvider(filterProvider === p.value ? '' : p.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                filterProvider === p.value
                  ? 'bg-purple-600/20 border-purple-500/50'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="text-xs text-zinc-400 mb-1">{p.desc}</div>
              <div className="text-sm font-semibold">{p.label}</div>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <span className="text-2xl font-bold">{p.active}</span>
                  <span className="text-xs text-zinc-500 ml-1">/ {p.count}</span>
                </div>
                {p.totalCapacity > 0 && (
                  <div className="text-[10px] text-zinc-500">
                    并发 {p.totalBusy}/{p.totalCapacity}
                  </div>
                )}
              </div>
              {p.disabled > 0 && (
                <div className="text-[10px] text-red-400 mt-1">禁用 {p.disabled}</div>
              )}
            </button>
          ))}
        </div>

        {/* 过滤提示 */}
        {filterProvider && (
          <div className="mb-3 text-sm text-zinc-400">
            当前筛选: <span className="text-white font-medium">{filterProvider}</span>
            <button
              onClick={() => setFilterProvider('')}
              className="ml-2 text-blue-400 hover:text-blue-300"
            >
              清除
            </button>
          </div>
        )}

        {/* Key 列表 */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-zinc-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Provider</th>
                <th className="text-left px-3 py-2">别名</th>
                <th className="text-left px-3 py-2">Key</th>
                <th className="text-center px-3 py-2">并发</th>
                <th className="text-center px-3 py-2">优先级</th>
                <th className="text-center px-3 py-2">成功</th>
                <th className="text-center px-3 py-2">失败</th>
                <th className="text-center px-3 py-2">状态</th>
                <th className="text-center px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-zinc-500">
                    {filterProvider ? `无 ${filterProvider} 的 key` : '账号池为空，点击右上角「添加 Key」开始'}
                  </td>
                </tr>
              )}
              {keys.map(k => (
                <tr key={k.id} className="border-t border-white/5 hover:bg-white/3">
                  <td className="px-3 py-2 font-mono text-xs">{k.provider}</td>
                  <td className="px-3 py-2">{k.key_name || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                    {k.key_value_mask}
                    {k.secondary_value_mask && <div className="text-[10px]">+ {k.secondary_value_mask}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={k.current_concurrency >= k.max_concurrency ? 'text-yellow-400' : ''}>
                      {k.current_concurrency}/{k.max_concurrency}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">{k.priority}</td>
                  <td className="px-3 py-2 text-center text-green-400">{k.success_count}</td>
                  <td className="px-3 py-2 text-center text-red-400">{k.failure_count}</td>
                  <td className="px-3 py-2 text-center">
                    {k.status === 'active' && <span className="text-green-400 text-xs">● 启用</span>}
                    {k.status === 'disabled' && <span className="text-red-400 text-xs">● 禁用</span>}
                    {k.status === 'cooldown' && <span className="text-yellow-400 text-xs">● 冷却</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex gap-1 justify-center">
                      {k.status !== 'active' ? (
                        <button
                          onClick={() => updateKey(k.id, { status: 'active' })}
                          className="text-[10px] px-2 py-0.5 rounded bg-green-600/20 hover:bg-green-600/40 text-green-300"
                        >
                          启用
                        </button>
                      ) : (
                        <button
                          onClick={() => updateKey(k.id, { status: 'disabled' })}
                          className="text-[10px] px-2 py-0.5 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300"
                        >
                          禁用
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const v = prompt('最大并发（当前 ' + k.max_concurrency + '）', String(k.max_concurrency));
                          if (v && !isNaN(+v) && +v > 0) updateKey(k.id, { max_concurrency: +v });
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
                      >
                        并发
                      </button>
                      <button
                        onClick={() => deleteKey(k.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-red-600/10 hover:bg-red-600/30 text-red-400"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddKeyModal token={token} onClose={() => setShowAdd(false)} onAdded={loadKeys} />}
    </div>
  );
}

// 添加 Key 弹窗
function AddKeyModal({ token, onClose, onAdded }: { token: string; onClose: () => void; onAdded: () => void }) {
  const [provider, setProvider] = useState('fal');
  const [keyName, setKeyName] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [maxConcurrency, setMaxConcurrency] = useState(2);
  const [priority, setPriority] = useState(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!keyValue.trim()) { alert('请输入 key_value'); return; }
    if (provider === 'volc' && !secondaryValue.trim()) { alert('volc 必须填 secret_key'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-pool/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider,
          key_name: keyName.trim() || null,
          key_value: keyValue.trim(),
          secondary_value: secondaryValue.trim() || null,
          max_concurrency: maxConcurrency,
          priority,
          notes: notes.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onAdded();
      onClose();
    } catch (err: any) {
      alert('添加失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">添加 API Key</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Provider</label>
            <select
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
              value={provider}
              onChange={e => setProvider(e.target.value)}
              disabled={loading}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">别名（方便识别）</label>
            <input
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="例如 fal-01 / 团购号 A"
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">
              Key Value <span className="text-red-400">*</span>
            </label>
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono"
              rows={3}
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder="粘贴完整的 API Key"
              disabled={loading}
            />
          </div>
          {provider === 'volc' && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Secret Key <span className="text-red-400">*</span>（volc 需要）
              </label>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono"
                rows={2}
                value={secondaryValue}
                onChange={e => setSecondaryValue(e.target.value)}
                placeholder="粘贴 secret access key"
                disabled={loading}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">最大并发</label>
              <input
                type="number"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
                value={maxConcurrency}
                onChange={e => setMaxConcurrency(+e.target.value)}
                min={1}
                max={100}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">优先级</label>
              <input
                type="number"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
                value={priority}
                onChange={e => setPriority(+e.target.value)}
                min={1}
                max={10}
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">备注</label>
            <input
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="可选"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-medium disabled:opacity-50"
          >
            {loading ? '添加中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}
