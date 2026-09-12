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
import { DoodleModal } from '../canvas-v2/nodes/DoodleModal';
import { ImageStudio } from '../canvas-v2/nodes/ImageStudio';

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

  // 三栏布局的状态。
  //   current  中间大图当前显示哪张（点右侧历史缩略图切换）
  const [current, setCurrent] = useState<string | null>(null);
  // 两个编辑器各自的开关。刻意不合并成一个 —— 它们能力不同:
  //   doodle  涂抹/圈选 + 指令，Seedream 5.0 Pro 一个模型
  //   studio  6 个精修工具（局部重绘/GPT编辑/扩图/消除/换背景/抠图）
  const [doodleUrl, setDoodleUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editMenu, setEditMenu] = useState(false);

  // 当前大图对应的历史记录 —— 用来在操作条显示它的提示词。
  // 查不到时为 undefined（比如刚生成还没回表），界面留空即可。
  const currentMeta = current ? history.find((h) => h.image_url === current) : undefined;

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

  // 把一张图记进历史表。生成与两个编辑器都走这里。
  //
  // 原先编辑产出只存在内存里 —— 刷新页面、点其他历史、去画布再回来
  // 就没了，用户以为改好的图丢了，其实从来没存过。产出即保存能一次解决这类问题。
  const saveToHistory = useCallback(async (
    imageUrl: string,
    meta: { model: string; prompt?: string; aspectRatio?: string; quality?: string; refCount?: number },
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/studio/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageUrl, ...meta }),
      });
      await loadHistory();
    } catch {
      // 写历史失败不影响图片本身 —— 图已在 Azure，只是列表少一条
    }
  }, [loadHistory]);

  const submit = async () => {
    if (!prompt.trim() && refImages.length === 0) {
      setError('请输入提示词或上传参考图');
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

      saveToHistory(url, {
        model: modelId, prompt: prompt.trim(),
        aspectRatio: ratio, quality, refCount: refImages.length,
      });

      // 新图直接成为中间大图，并清掉上一张的衍生物
      setCurrent(url);

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
    return <div style={{ minHeight: '100vh', background: '#fff' }} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#1d1d1f', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 26px', borderBottom: '1px solid rgba(0,0,0,.07)',
          position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.82)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Link href="/" style={{ fontWeight: 700, letterSpacing: 1, color: '#1d1d1f', textDecoration: 'none' }}>
            FILMAVO
          </Link>
          <span style={{ fontSize: 13, color: '#6e6e73' }}>AI 生图</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
          <Link href="/canvas" style={{ color: '#424245', textDecoration: 'none' }}>
            进入画布
          </Link>
          {/* 余额与画布同源(useMembership)，一边充值另一边刷新即可见 */}
          <span style={{ color: '#424245' }}>
            {memberLoading ? '' : `¥${(balance ?? 0).toFixed(2)}`}
          </span>
          {isMember && (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: '#f5f5f7', color: '#1d1d1f' }}>
              会员
            </span>
          )}
          <Link
            href="/pricing"
            style={{
              padding: '6px 14px', borderRadius: 999, background: '#1d1d1f', color: '#fff',
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
            width: 352, flexShrink: 0, padding: '26px 24px', overflowY: 'auto',
            borderRight: '1px solid rgba(0,0,0,.07)',
          }}
        >
          <Field label="模型">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              style={inputStyle}
            >
              {IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11.5, color: '#86868b', marginTop: 6 }}>
              {model.price}
            </div>
          </Field>

          <Field label="提示词">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的画面"
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
                {uploading ? '上传中' : `上传图片（还能传 ${maxRef - refImages.length} 张）`}
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
              width: '100%', padding: '13px 0', borderRadius: 999, border: 'none',
              background: pending.length ? '#d2d2d7' : '#1d1d1f',
              color: '#fff',
              fontWeight: 500, fontSize: 14.5, cursor: pending.length ? 'default' : 'pointer',
            }}
          >
            {pending.length ? '生成中' : '生成'}
          </button>
        </aside>

        {/* 中间:大图预览。撑满可用空间 —— 生图工具的主体是"看图"，
            原先做成网格小卡片，图小到看不清细节，本末倒置了。 */}
        <main
          style={{
            flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
            padding: '22px 26px', gap: 14,
          }}
        >
          {current ? (
            <>
              {/* 操作条 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 12.5, color: '#6e6e73', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentMeta?.prompt || ''}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {/* 一个"编辑"入口，点开三条路 —— 三者是不同层次的改图方式:
                       交互编辑  涂抹/圈选标记 + 指令，Seedream 5.0 Pro，
                                 含图层分离(拆出多张，落到大图下方缩略条)
                       设计工具  6 个精修工具:局部重绘/GPT编辑/扩图/消除/换背景/抠图
                       以此图重绘 不做局部编辑，把当前图当参考图交给左栏的模型
                                 (Nano Banana / GPT Image 2.5 等)整图生成新图 */}
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setEditMenu((v) => !v)} style={ghostBtn}>
                      编辑 ▾
                    </button>
                    {editMenu && (
                      <div
                        style={{
                          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 40,
                          width: 216, padding: 6, borderRadius: 12, background: '#fff',
                          border: '1px solid rgba(0,0,0,.08)', boxShadow: '0 12px 32px -12px rgba(0,0,0,.28)',
                        }}
                      >
                        <MenuItem
                          title="图片交互编辑"
                          desc="涂抹标记改局部 · 图层分离"
                          onClick={() => { setEditMenu(false); setDoodleUrl(current); }}
                        />
                        <MenuItem
                          title="设计师工具"
                          desc="局部重绘 · 扩图 · 消除 · 抠图"
                          onClick={() => { setEditMenu(false); setEditing(current); }}
                        />
                        <MenuItem
                          title="以此图重绘"
                          desc="作为参考图，用左栏模型生成新图"
                          onClick={() => {
                            setEditMenu(false);
                            // 当前图放进参考图，用户改提示词后点生成即可
                            setRefImages((cur) => (cur.includes(current) ? cur : [...cur, current].slice(0, refImageMax(modelId))));
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <button onClick={() => download(current)} style={ghostBtn}>下载</button>
                </div>
              </div>

              {/* 大图 */}
              <div
                style={{
                  flex: 1, minHeight: 0, borderRadius: 14, background: '#f5f5f7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={current}
                  alt=""
                  onClick={() => setLightbox(current)}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }}
                />
              </div>

            </>
          ) : pending.length > 0 ? (
            <div style={emptyStyle}>生成中</div>
          ) : (
            <div style={emptyStyle}>{loadingHistory ? '' : '开始你的第一张作品'}</div>
          )}
        </main>

        {/* 右侧:历史缩略图。点击切换中间大图 */}
        <aside
          style={{
            width: 132, flexShrink: 0, padding: '22px 14px', overflowY: 'auto',
            borderLeft: '1px solid rgba(0,0,0,.07)',
          }}
        >
          <div style={{ fontSize: 11.5, color: '#86868b', marginBottom: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>历史</span>
            <span style={{ color: history.length >= 50 ? '#c2410c' : '#c7c7cc' }}>{history.length}</span>
          </div>
          {/* 到 50 条给个提醒而不是自动删 —— 自动删可能清掉用户还要的图，
              而他未必看到提示。让他自己决定删哪些更稳妥。 */}
          {history.length >= 50 && (
            <div style={{
              fontSize: 10.5, lineHeight: 1.55, color: '#7c2d12', background: '#fff7ed',
              border: '1px solid #fed7aa', borderRadius: 8, padding: '7px 9px', marginBottom: 10,
            }}>
              已有 {history.length} 张，建议下载保存后删掉不需要的
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {pending.map((p) => (
                <div
                  key={p.key}
                  style={{
                    width: '100%', aspectRatio: '1', borderRadius: 9, background: '#f5f5f7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10.5, color: '#86868b',
                  }}
                >
                  生成中
                </div>
              ))}

              {history.map((h) => (
                <div key={h.id} style={{ position: 'relative' }}>
                  <img
                    src={h.image_url}
                    alt={h.prompt ?? ''}
                    onClick={() => setCurrent(h.image_url)}
                    title={h.prompt ?? ''}
                    style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 9,
                      cursor: 'pointer', display: 'block',
                      border: current === h.image_url ? '2px solid #1d1d1f' : '1px solid rgba(0,0,0,.08)',
                    }}
                  />
                  {/* 删除按钮:悬停才出现，缩略图很小，常驻会挡住画面 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeHistory(h.id); }}
                    style={{
                      position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.55)',
                      color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: 1,
                      opacity: 0, transition: 'opacity .15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </aside>
      </div>

      {/* 图片交互编辑(Seedream 5.0 Pro)。图层分离会返回多张 —— 
          每张都写进历史 —— 存内存的话切换记录就丢了 */}
      {doodleUrl !== null && (
        <DoodleModal
          imageUrl={doodleUrl || undefined}
          onClose={() => setDoodleUrl(null)}
          onConfirm={() => setDoodleUrl(null)}
          onGenerated={({ imageUrl }) => {
            // 写进历史而非内存 —— 图层分离拆出的每一张都会走到这里
            setCurrent(imageUrl);
            saveToHistory(imageUrl, { model: 'seedream-5-pro', prompt: '交互编辑' });
            setDoodleUrl(null);
          }}
        />
      )}

      {/* 设计师专用编辑中心。onApply 回传最终版本 */}
      {editing !== null && (
        <ImageStudio
          initialImageUrl={editing}
          onApply={(finalUrl) => {
            setCurrent(finalUrl);
            saveToHistory(finalUrl, { model: 'image-studio', prompt: '设计师工具' });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

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

/** 编辑菜单里的一项:标题 + 一行说明。三条路的差别不写清楚，用户会乱点 */
function MenuItem({ title, desc, onClick }: { title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none',
        background: 'transparent', padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f7'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ display: 'block', fontSize: 13, color: '#1d1d1f', fontWeight: 500 }}>{title}</span>
      <span style={{ display: 'block', fontSize: 11, color: '#86868b', marginTop: 2 }}>{desc}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: '#6e6e73', marginBottom: 7, letterSpacing: 0.3 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', borderRadius: 11,
  background: '#f5f5f7', border: '1px solid transparent',
  color: '#1d1d1f', fontSize: 13.5, outline: 'none',
};

const chipStyle: React.CSSProperties = {
  padding: '7px 13px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
  background: '#f5f5f7', border: '1px solid transparent', color: '#424245',
  transition: 'background .16s ease',
};

// 选中态用蓝色 —— 蓝只出现在强调处，铺太满会像模板站
const chipActive: React.CSSProperties = {
  ...chipStyle, background: '#1d1d1f', color: '#fff', borderColor: '#1d1d1f', fontWeight: 500,
};

const cardStyle: React.CSSProperties = {
  borderRadius: 14, overflow: 'hidden', background: '#fff',
  border: '1px solid rgba(0,0,0,.06)', boxShadow: '0 1px 2px rgba(0,0,0,.04)',
};

/** 操作条上的按钮:浅灰底无描边，与页面的苹果风格一致 */
const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: '#f5f5f7', color: '#1d1d1f', fontSize: 12.5, fontWeight: 500,
  whiteSpace: 'nowrap',
};

const miniBtn: React.CSSProperties = {
  border: 'none', background: 'transparent', color: '#6e6e73',
  fontSize: 11, cursor: 'pointer', padding: 0,
};

const emptyStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#86868b', fontSize: 13,
};
