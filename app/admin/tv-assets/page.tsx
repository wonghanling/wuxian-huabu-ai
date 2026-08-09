'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin';

// ============================================================
// Filmavo TV 素材管理（仅管理员）
// ============================================================
// 选文件 → 自动上传到 Supabase → 填标题 → 保存，前台立刻生效，
// 不用改代码也不用发版。
//
// showcase → /filmavo-tv 精选素材区
// skill    → /filmavo-tv/skill
// ============================================================

type Category = 'showcase' | 'skill';

interface TvAsset {
  id: string;
  category: Category;
  title: string;
  description: string | null;
  kind: 'video' | 'image';
  src: string;
  poster: string | null;
  model: string | null;
  href: string | null;
  sort_order: number;
  visible: boolean;
  created_at: string;
}

export default function TvAssetsAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<Category>('showcase');
  const [items, setItems] = useState<TvAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 新增表单
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', model: '', href: '',
    kind: 'video' as 'video' | 'image', src: '', sortOrder: 100,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  // ── 权限 & 数据 ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email ?? null;
      setToken(session?.access_token ?? '');
      setAllowed(isAdmin(email));
    })();
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tv-assets?category=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { if (allowed && token) load(); }, [allowed, token, load]);

  // ── 上传 ────────────────────────────────────────────────
  const handleFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/admin/tv-assets/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error || '上传失败' }); return; }
      setForm((s) => ({
        ...s,
        src: data.url,
        kind: data.kind || s.kind,
        title: s.title || f.name.replace(/\.[^.]+$/, ''),
      }));
      setMsg({ ok: true, text: '上传成功，填好标题后保存' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || '上传失败' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── 增删改 ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.src) { setMsg({ ok: false, text: '请先上传素材文件' }); return; }
    if (!form.title.trim()) { setMsg({ ok: false, text: '请填写标题' }); return; }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/tv-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: tab,
          title: form.title,
          description: form.description || undefined,
          kind: form.kind,
          src: form.src,
          model: form.model || undefined,
          href: form.href || undefined,
          sort_order: form.sortOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error || '保存失败' }); return; }
      setForm({ title: '', description: '', model: '', href: '', kind: 'video', src: '', sortOrder: 100 });
      setMsg({ ok: true, text: '已添加，前台即时生效' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch('/api/admin/tv-assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...body }),
    });
    load();
  };

  const remove = async (item: TvAsset) => {
    if (!confirm(`删除「${item.title}」？`)) return;
    await fetch(`/api/admin/tv-assets?id=${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  // ── 渲染 ────────────────────────────────────────────────
  if (allowed === null) {
    return <div className="min-h-screen flex items-center justify-center text-sm" style={{ background: 'rgb(10,10,10)', color: 'rgb(130,130,130)' }}>加载中…</div>;
  }
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'rgb(10,10,10)' }}>
        <p className="text-sm" style={{ color: 'rgb(180,180,180)' }}>此页面仅管理员可访问</p>
        <a href="/" className="text-xs hover:opacity-70" style={{ color: 'rgb(113,208,131)' }}>返回首页</a>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #ffffff1c',
    color: 'rgb(232,232,232)',
  };

  return (
    <div className="min-h-screen" style={{ background: 'rgb(10,10,10)' }}>
      <div className="sticky top-0 z-20 backdrop-blur-xl" style={{ background: 'rgba(10,10,10,0.85)', borderBottom: '1px solid #ffffff12' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/filmavo-tv" className="text-sm hover:opacity-70" style={{ color: 'rgb(180,180,180)' }}>← Filmavo TV</a>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: 'rgb(240,240,240)' }}>素材管理</h1>
          <div className="flex-1" />
          {(['showcase', 'skill'] as Category[]).map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: tab === c ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: '1px solid ' + (tab === c ? '#ffffff2e' : '#ffffff14'),
                color: tab === c ? 'rgb(240,240,240)' : 'rgb(140,140,140)',
              }}
            >
              {c === 'showcase' ? '精选素材' : 'Skill'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* 新增表单 */}
        <div className="rounded-2xl p-5 mb-8" style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff14' }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: 'rgb(232,232,232)' }}>
            添加到{tab === 'showcase' ? '精选素材' : 'Skill'}
          </h2>

          <div className="flex flex-col gap-3">
            {/* 第一步：上传文件 */}
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>1. 选择文件（视频 mp4/mov/webm，图片 jpg/png/webp，≤100MB）</label>
              <div className="flex items-center gap-3">
                <label
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-opacity hover:opacity-85"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid #ffffff2e', color: 'rgb(235,235,235)' }}
                >
                  {uploading ? '上传中…' : '选择文件'}
                  <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files)} disabled={uploading} />
                </label>
                {form.src && (
                  <>
                    <span className="text-[11px]" style={{ color: 'rgb(113,208,131)' }}>✓ 已上传（{form.kind === 'video' ? '视频' : '图片'}）</span>
                    {form.kind === 'video' ? (
                      <video src={form.src} muted loop autoPlay playsInline style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <img src={form.src} alt="预览" style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 6 }} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 第二步：填信息 */}
            <div>
              <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>2. 标题</label>
              <input
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="卡片上显示的名称"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={inputStyle}
              />
            </div>

            {tab === 'skill' && (
              <>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>说明</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="这条技巧讲什么"
                    className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>点击跳转（可选）</label>
                  <input
                    value={form.href}
                    onChange={(e) => setForm((s) => ({ ...s, href: e.target.value }))}
                    placeholder="/canvas?templateId=xxx"
                    className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {tab === 'showcase' && (
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>使用的模型（可选，显示在卡片上）</label>
                <input
                  value={form.model}
                  onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
                  placeholder="如 Seedance 2.5"
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={inputStyle}
                />
              </div>
            )}

            <div className="flex items-end gap-3">
              <div style={{ width: 120 }}>
                <label className="block text-[11px] mb-1.5" style={{ color: 'rgb(140,140,140)' }}>排序（小的靠前）</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((s) => ({ ...s, sortOrder: Number(e.target.value) || 100 }))}
                  className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || uploading || !form.src}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>

            {msg && (
              <div
                className="text-[11px] rounded-lg px-3 py-2"
                style={{
                  color: msg.ok ? 'rgb(113,208,131)' : 'rgb(235,120,120)',
                  background: msg.ok ? 'rgba(113,208,131,0.1)' : 'rgba(235,120,120,0.1)',
                  border: `1px solid ${msg.ok ? 'rgba(113,208,131,0.25)' : 'rgba(235,120,120,0.25)'}`,
                }}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>

        {/* 已有列表 */}
        <h2 className="text-sm font-bold mb-3" style={{ color: 'rgb(232,232,232)' }}>
          已有 {items.length} 条
        </h2>

        {loading && <div className="text-xs py-8 text-center" style={{ color: 'rgb(110,110,110)' }}>加载中…</div>}

        {!loading && items.length === 0 && (
          <div className="text-xs py-10 text-center rounded-2xl" style={{ color: 'rgb(110,110,110)', border: '1px dashed #ffffff14' }}>
            还没有素材，用上面的表单添加
          </div>
        )}

        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgb(18,18,18)', border: '1px solid #ffffff12', opacity: it.visible ? 1 : 0.5 }}
            >
              {it.kind === 'video' ? (
                <video src={it.src} muted loop playsInline style={{ width: 76, height: 43, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <img src={it.src} alt={it.title} style={{ width: 76, height: 43, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              )}

              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold truncate" style={{ color: 'rgb(230,230,230)' }}>{it.title}</div>
                <div className="text-[10.5px] truncate" style={{ color: 'rgb(105,105,105)' }}>
                  {it.kind === 'video' ? '视频' : '图片'}
                  {it.model && ` · ${it.model}`}
                  {it.description && ` · ${it.description}`}
                  {` · 排序 ${it.sort_order}`}
                  {!it.visible && ' · 已下架'}
                </div>
              </div>

              <input
                type="number"
                defaultValue={it.sort_order}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v !== it.sort_order) patch(it.id, { sort_order: v });
                }}
                title="排序"
                className="px-2 py-1.5 rounded-lg text-[11px] focus:outline-none"
                style={{ ...inputStyle, width: 58 }}
              />
              <button
                onClick={() => patch(it.id, { visible: !it.visible })}
                className="px-3 py-1.5 rounded-lg text-[11px]"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #ffffff1c', color: 'rgb(200,200,200)' }}
              >
                {it.visible ? '下架' : '上架'}
              </button>
              <button
                onClick={() => remove(it)}
                className="px-3 py-1.5 rounded-lg text-[11px]"
                style={{ color: 'rgb(235,120,120)' }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
