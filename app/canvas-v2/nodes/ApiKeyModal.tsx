'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// 用户自带 API Key（BYOK）设置弹窗
// ============================================================
// 用户填自己在官方申请的 Key，填了就用：
//   - 不扣画布余额（用量在官方控制台自己看、自己付）
//   - 不占平台账号池并发（绕开并发上限）
// 删掉后自动回到平台账号池 + 正常扣费。
//
// 明文 Key 只在提交那一刻发给后端，之后一律显示掩码。
// ============================================================

type ByokProvider = 'ark' | 'dashscope' | 'volc';
type DashscopeRegion = 'cn' | 'intl';

interface UserKeyMasked {
  provider: ByokProvider;
  keyMasked: string;
  region?: DashscopeRegion;
  status: 'active' | 'invalid';
  lastUsedAt: string | null;
  lastError: string | null;
}

interface ProviderMeta {
  provider: ByokProvider;
  title: string;
  models: string;
  needsSecret: boolean;      // volc 需要 AK + SK 两个值
  needsRegion: boolean;      // dashscope 需要选站点
  keyLabel: string;
  keyPlaceholder: string;
  secretLabel?: string;
  consoleUrl: string;
  consoleName: string;
  hint: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    provider: 'ark',
    title: '火山引擎方舟',
    models: 'Seedance 2.0 视频',
    needsSecret: false,
    needsRegion: false,
    keyLabel: 'API Key',
    keyPlaceholder: '在方舟控制台创建的 API Key',
    consoleUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    consoleName: '方舟控制台 · API Key 管理',
    hint: '需先在方舟开通 Seedance 2.0 模型，否则调用会报无权限。',
  },
  // 阿里云百炼(dashscope)与火山引擎即梦(volc)已下架 ——
  // 即梦全系模型已删除，Wan 2.7 与快乐马已切到别的上游，
  // 两者都不再有任何在售模型会读用户的 Key。留着入口会误导用户：
  // 填了 Key 却一次都不会被调用，还以为绕开了并发限制。
  //
  // 只从这里移除入口，其余全部保留（ByokProvider 类型、后端分支、
  // user_api_keys 表、加解密逻辑），要恢复只需把定义加回本数组。
  // 已填过这两个 Key 的用户，数据仍在表里，不受影响。
];

interface Props {
  onClose: () => void;
}

export function ApiKeyModal({ onClose }: Props) {
  const [keys, setKeys] = useState<UserKeyMasked[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<ByokProvider | null>(null);

  // 各 provider 的输入草稿（明文只在内存，不写 localStorage）
  const [draft, setDraft] = useState<Record<string, { key: string; secret: string; region: DashscopeRegion }>>({
    ark: { key: '', secret: '', region: 'cn' },
    dashscope: { key: '', secret: '', region: 'cn' },
    volc: { key: '', secret: '', region: 'cn' },
  });
  const [busy, setBusy] = useState<ByokProvider | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string } | null>>({});

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/user-keys');
      const data = await res.json();
      setKeys(Array.isArray(data.keys) ? data.keys : []);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const saved = (p: ByokProvider) => keys.find((k) => k.provider === p);

  const submit = async (meta: ProviderMeta, testOnly: boolean) => {
    const d = draft[meta.provider];
    if (!d.key.trim()) {
      setMsg((m) => ({ ...m, [meta.provider]: { ok: false, text: `请填写 ${meta.keyLabel}` } }));
      return;
    }
    if (meta.needsSecret && !d.secret.trim()) {
      setMsg((m) => ({ ...m, [meta.provider]: { ok: false, text: `请填写 ${meta.secretLabel}` } }));
      return;
    }

    setBusy(meta.provider);
    setMsg((m) => ({ ...m, [meta.provider]: null }));
    try {
      const res = await authFetch('/api/user-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: meta.provider,
          keyValue: d.key.trim(),
          secondaryValue: meta.needsSecret ? d.secret.trim() : undefined,
          region: meta.needsRegion ? d.region : undefined,
          testOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg((m) => ({ ...m, [meta.provider]: { ok: false, text: data.error || '操作失败' } }));
        return;
      }
      if (testOnly) {
        setMsg((m) => ({ ...m, [meta.provider]: { ok: true, text: '连接正常，可以保存' } }));
        return;
      }
      // 保存成功：清空明文草稿，刷新掩码列表
      setDraft((s) => ({ ...s, [meta.provider]: { key: '', secret: '', region: d.region } }));
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setMsg((m) => ({ ...m, [meta.provider]: { ok: true, text: '已保存，之后这些模型走你自己的账号' } }));
    } catch (e: any) {
      setMsg((m) => ({ ...m, [meta.provider]: { ok: false, text: e?.message || '网络错误' } }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: ByokProvider) => {
    if (!confirm('删除后这些模型会回到平台账号池，按平台价格扣余额。确定删除？')) return;
    setBusy(p);
    try {
      const res = await authFetch(`/api/user-keys?provider=${p}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMsg((m) => ({ ...m, [p]: { ok: false, text: data.error || '删除失败' } }));
        return;
      }
      setKeys(Array.isArray(data.keys) ? data.keys : []);
      setMsg((m) => ({ ...m, [p]: { ok: true, text: '已删除，恢复使用平台账号池' } }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto cv2-scroll bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">我的 API Key</h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              填入你在官方申请的 Key，对应模型改用你自己的账号：
              <span className="text-gray-300">不扣画布余额、不受平台并发限制</span>。
              用量和账单在官方控制台查看。留空则继续用平台账号，按平台价格扣费。
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              填了 Key 就一直用你的账号，
              <span className="text-gray-400">不会在余额不足或 Key 失效时偷偷切回平台账号扣你余额</span>
              ，而是直接报错提醒你。想改回平台账号请删除这把 Key。
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="关闭"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 列表 */}
        <div className="p-4 space-y-3">
          {loading && <div className="text-xs text-gray-500 px-1 py-4">加载中...</div>}

          {!loading && PROVIDERS.map((meta) => {
            const cur = saved(meta.provider);
            const isOpen = expanded === meta.provider;
            const m = msg[meta.provider];
            const isBusy = busy === meta.provider;

            return (
              <div key={meta.provider} className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
                {/* 折叠头 */}
                <button
                  onClick={() => setExpanded(isOpen ? null : meta.provider)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">{meta.title}</span>
                      {cur ? (
                        cur.status === 'invalid' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                            已失效
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">
                            使用我的 Key
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
                          用平台账号
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {meta.models}
                      {cur && <span className="text-gray-400"> · {cur.keyMasked}</span>}
                      {cur?.region && <span className="text-gray-500"> · {cur.region === 'cn' ? '国内站' : '国际站'}</span>}
                    </div>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 展开体 */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/5">
                    {/* 失效提示 */}
                    {cur?.status === 'invalid' && (
                      <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 leading-relaxed">
                        这把 Key 上次调用被官方拒绝（欠费、过期或权限不足），相关模型已停止生成。
                        <span className="text-red-300">不会自动改用平台账号扣你余额</span>，
                        请到官方控制台检查后重新填写，或删除这把 Key 改回平台账号。
                        {cur.lastError && <div className="text-red-400/70 mt-1 break-all">{cur.lastError}</div>}
                      </div>
                    )}

                    {/* 站点选择（仅 dashscope）*/}
                    {meta.needsRegion && (
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1.5">站点</label>
                        <div className="flex gap-2">
                          {([
                            { v: 'cn' as const, label: '国内站', host: 'dashscope.aliyuncs.com' },
                            { v: 'intl' as const, label: '国际站', host: 'dashscope-intl.aliyuncs.com' },
                          ]).map((opt) => (
                            <button
                              key={opt.v}
                              onClick={() => setDraft((s) => ({ ...s, [meta.provider]: { ...s[meta.provider], region: opt.v } }))}
                              className={`flex-1 px-3 py-2 rounded-lg border text-left transition-all ${
                                draft[meta.provider].region === opt.v
                                  ? 'bg-white/10 border-white/25 text-white'
                                  : 'bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20'
                              }`}
                            >
                              <div className="text-xs">{opt.label}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{opt.host}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 主 Key */}
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1.5">{meta.keyLabel}</label>
                      <input
                        type="password"
                        autoComplete="off"
                        value={draft[meta.provider].key}
                        onChange={(e) => setDraft((s) => ({ ...s, [meta.provider]: { ...s[meta.provider], key: e.target.value } }))}
                        placeholder={cur ? `已保存 ${cur.keyMasked}，重填可覆盖` : meta.keyPlaceholder}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/25 transition-all"
                      />
                    </div>

                    {/* Secret（仅 volc）*/}
                    {meta.needsSecret && (
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1.5">{meta.secretLabel}</label>
                        <input
                          type="password"
                          autoComplete="off"
                          value={draft[meta.provider].secret}
                          onChange={(e) => setDraft((s) => ({ ...s, [meta.provider]: { ...s[meta.provider], secret: e.target.value } }))}
                          placeholder="与 Access Key ID 配对的 Secret"
                          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/25 transition-all"
                        />
                      </div>
                    )}

                    {/* 提示 + 控制台链接 */}
                    <div className="text-[11px] text-gray-500 leading-relaxed">
                      {meta.hint}
                      {' '}
                      <a
                        href={meta.consoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                      >
                        {meta.consoleName} ↗
                      </a>
                    </div>

                    {/* 结果提示 */}
                    {m && (
                      <div className={`text-[11px] rounded-lg px-3 py-2 leading-relaxed break-all ${
                        m.ok
                          ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                          : 'text-red-400 bg-red-500/10 border border-red-500/20'
                      }`}>
                        {m.text}
                      </div>
                    )}

                    {/* 操作 */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => submit(meta, false)}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white hover:bg-white/15 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy ? '处理中...' : cur ? '覆盖保存' : '保存'}
                      </button>
                      <button
                        onClick={() => submit(meta, true)}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 text-xs text-gray-300 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        测试连通
                      </button>
                      {cur && (
                        <button
                          onClick={() => remove(meta.provider)}
                          disabled={isBusy}
                          className="ml-auto px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 transition-all disabled:opacity-50"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部说明 */}
        <div className="px-5 py-3 border-t border-white/5 text-[11px] text-gray-500 leading-relaxed">
          Key 加密存储，页面只显示掩码。按每次选中的模型自动判断用谁的账号 ——
          同一张视频卡片里选 Seedance 走你的 Key，选其他模型仍走平台账号（照常扣余额）。
          其余模型暂不支持自带 Key。
        </div>
      </div>
    </div>
  );
}
