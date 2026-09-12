'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useMembership } from '@/lib/useMembership';
import {
  IMAGE_MODELS, DEFAULT_IMAGE_MODEL, RATIO_OPTIONS, type ImageModel,
} from '../canvas-v2/imageModels';
import { refImageMax, STYLE_PRESETS, applyStylePrefix } from '../canvas-v2/imagePresets';
import { generateImage, uploadImageToStorage } from '../canvas-v2/lib/api';

// ============================================================
// AI 生图（/studio）
//
// 与画布共用后端与账户体系，只是换一种界面形态：
//   左侧固定的参数栏 + 右侧结果流，没有画布的拖拽、连线、卡片。
//
// 余额天然与画布联动 —— 两边都读 useMembership，同一个接口同一张表。
// 生成也走同一个 /api/image/generate，所以模型、扣费、Azure 转存全部一致。
//
// 画布零改动:本页只 import 它的配置与调用函数，不修改任何画布文件。
// ============================================================

type HistoryItem = {
  id: string;
  model: string;
  prompt: string | null;
  image_url: string;
  aspect_ratio: string | null;
  quality: string | null;
  ref_count: number;
  created_at: string;
};

/** 生成中的占位项 —— 与历史项同列展示，让用户看到进度而非空白 */
type PendingItem = { key: string; prompt: string; model: string };

export default function StudioPage() {
  const supabase = createClient();
  const { isMember, balance, loading: memberLoading } = useMembership();

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_IMAGE_MODEL);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [quality, setQuality] = useState('2k');
  const [refImages, setRefImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const model: ImageModel = IMAGE_MODELS.find((m) => m.id === modelId) ?? IMAGE_MODELS[0];
  const maxRef = refImageMax(modelId);

  // ── 登录校验。用 getSession 只读本地存储，不像 getUser 要发网络请求 ——
  //    否则未登录用户会先看到界面再被弹走 ──
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        window.location.replace('/auth');
        return;   // 不置 authed，遮罩保持到导航完成
      }
      setAuthed(true);
    })();
  }, []);

  // ── 拉历史 ──
  const loadHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/studio/history?limit=60', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setHistory(data.items ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { if (authed) loadHistory(); }, [authed, loadHistory]);

  // 换模型时把超出新上限的参考图截掉，并把清晰度纠正到该模型支持的档
  useEffect(() => {
    setRefImages((cur) => cur.slice(0, refImageMax(modelId)));
    const opts = model.qualityOptions;
    if (opts && !opts.some((o) => o.value === quality)) setQuality(opts[0].value);
  }, [modelId]);

  const pickRefImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = maxRef - refImages.length;
    if (room <= 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) {
        const url = await uploadImageToStorage(f);
        if (url) urls.push(url);
      }
      setRefImages((cur) => [...cur, ...urls]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    if (!prompt.trim() && refImages.length === 0) {
      setError('请输入提示词，或上传参考图');
      return;
    }
    setError('');

    const key = `p${Date.now()}`;
    setPending((cur) => [{ key, prompt: prompt.trim(), model: modelId }, ...cur]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const url = await generateImage({
        model: modelId,
        prompt: prompt.trim(),
        aspectRatio: ratio,
        imageQuality: quality,
        imageUrlArray: refImages.length ? refImages : undefined,
        userId: user?.id,
      });

      // 记一条历史。失败不影响图片本身 —— 图已在 Azure，只是列表少一条
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        fetch('/api/studio/history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            imageUrl: url, model: modelId, prompt: prompt.trim(),
            aspectRatio: ratio, quality, refCount: refImages.length,
          }),
        }).then(() => loadHistory()).catch(() => {});
      }

      // 乐观插入，不等 loadHistory 回来
      setHistory((cur) => [{
        id: key, model: modelId, prompt: prompt.trim(), image_url: url,
        aspect_ratio: ratio, quality, ref_count: refImages.length,
        created_at: new Date().toISOString(),
      }, ...cur]);
    } catch (e: any) {
      setError(e?.message || '生成失败');
    } finally {
      setPending((cur) => cur.filter((p) => p.key !== key));
    }
  };

  const removeHistory = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setHistory((cur) => cur.filter((h) => h.id !== id));
    await fetch(`/api/studio/history?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
  };

  const download = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `filmavo-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  // 登录判定完成前不渲染界面 —— 免得未登录用户看到一眼再被弹走
  if (authed === null) {
    return <div style={{ minHeight: '100vh', background: '#f8fafc' }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid #e2e8f0',
          position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link href="/" style={{ fontWeight: 700, letterSpacing: 1, color: '#0f172a', textDecoration: 'none' }}>
            FILMAVO
          </Link>
          <span style={{ fontSize: 13, color: '#64748b' }}>AI 生图</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
          <Link href="/canvas" style={{ color: '#475569', textDecoration: 'none' }}>
            进入画布
          </Link>
          {/* 余额与画布同源(useMembership)，一边充值另一边刷新即可见 */}
          <span style={{ color: '#475569' }}>
            {memberLoading ? '···' : `¥${(balance ?? 0).toFixed(2)}`}
          </span>
          {isMember && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#dbeafe', color: '#2563eb' }}>
              会员
            </span>
          )}
          <Link
            href="/pricing"
            style={{
              padding: '6px 14px', borderRadius: 999, background: '#2563eb', color: '#fff',
              fontWeight: 600, fontSize: 12.5, textDecoration: 'none',
            }}
          >
            充值
          </Link>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左侧参数栏 */}
        <aside
          style={{
            width: 340, flexShrink: 0, padding: 20, overflowY: 'auto',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          <Field label="模型">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              style={inputStyle}
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id} style={{ background: '#18181b' }}>
                  {m.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
              {model.price}
            </div>
          </Field>

          <Field label="提示词">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的画面…"
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {STYLE_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPrompt((cur) => applyStylePrefix(cur, p.prompt))}
                  style={chipStyle}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {model.supportsImage !== false && maxRef > 0 && (
            <Field label={`参考图 ${refImages.length}/${maxRef}`}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple={maxRef > 1}
                onChange={(e) => pickRefImages(e.target.files)}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || refImages.length >= maxRef}
                style={{ ...inputStyle, cursor: 'pointer', opacity: refImages.length >= maxRef ? 0.4 : 1 }}
              >
                {uploading ? '上传中…' : `上传图片（还能传 ${maxRef - refImages.length} 张）`}
              </button>
              {refImages.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {refImages.map((u, i) => (
                    <div key={u + i} style={{ position: 'relative' }}>
                      <img src={u} alt="" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 7 }} />
                      <button
                        onClick={() => setRefImages((cur) => cur.filter((_, j) => j !== i))}
                        style={{
                          position: 'absolute', top: -5, right: -5, width: 18, height: 18,
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.85)',
                          color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: 1,
                        }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          )}

          <Field label="比例">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(model.ratios ?? RATIO_OPTIONS).map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRatio(r.value)}
                  style={ratio === r.value ? chipActive : chipStyle}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          {model.qualityOptions && (
            <Field label="清晰度">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {model.qualityOptions.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setQuality(q.value)}
                    style={quality === q.value ? chipActive : chipStyle}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {error && (
            <div style={{ fontSize: 12.5, color: '#fca5a5', marginBottom: 12, lineHeight: 1.6 }}>
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={pending.length > 0}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: pending.length ? '#cbd5e1' : '#2563eb',
              color: '#fff',
              fontWeight: 700, fontSize: 14, cursor: pending.length ? 'default' : 'pointer',
            }}
          >
            {pending.length ? '生成中…' : '生成'}
          </button>
        </aside>

        {/* 右侧结果 */}
        <main style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {loadingHistory ? (
            <div style={emptyStyle}>加载中…</div>
          ) : pending.length === 0 && history.length === 0 ? (
            <div style={emptyStyle}>
              还没有作品 —— 在左侧写下提示词，点「生成」开始
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              {pending.map((p) => (
                <div key={p.key} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1' }}>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 6 }}>生成中…</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                      {p.prompt.slice(0, 40) || '(无提示词)'}
                    </div>
                  </div>
                </div>
              ))}

              {history.map((h) => (
                <div key={h.id} style={cardStyle}>
                  <img
                    src={h.image_url}
                    alt={h.prompt ?? ''}
                    onClick={() => setLightbox(h.image_url)}
                    style={{ width: '100%', display: 'block', cursor: 'zoom-in' }}
                  />
                  <div style={{ padding: '9px 11px' }}>
                    <div
                      style={{
                        fontSize: 11.5, color: '#475569', lineHeight: 1.5,
                        overflow: 'hidden', display: '-webkit-box',
                        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}
                      title={h.prompt ?? ''}
                    >
                      {h.prompt || '(无提示词)'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {IMAGE_MODELS.find((m) => m.id === h.model)?.label ?? h.model}
                      </span>
                      <span style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => download(h.image_url)} style={miniBtn}>下载</button>
                        <button onClick={() => removeHistory(h.id)} style={miniBtn}>删除</button>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 放大查看 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30,
            cursor: 'zoom-out',
          }}
        >
          <img src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 7, letterSpacing: 0.3 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  background: '#fff', border: '1px solid #cbd5e1',
  color: '#0f172a', fontSize: 13, outline: 'none',
};

const chipStyle: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 8, fontSize: 11.5, cursor: 'pointer',
  background: '#fff', border: '1px solid #cbd5e1', color: '#475569',
};

// 选中态用蓝色 —— 蓝只出现在强调处，铺太满会像模板站
const chipActive: React.CSSProperties = {
  ...chipStyle, background: '#2563eb', color: '#fff', borderColor: '#2563eb', fontWeight: 600,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 12, overflow: 'hidden', background: '#fff',
  border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,.06)',
};

const miniBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', color: '#64748b',
  fontSize: 11, cursor: 'pointer', padding: 0,
};

const emptyStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#94a3b8', fontSize: 13,
};
