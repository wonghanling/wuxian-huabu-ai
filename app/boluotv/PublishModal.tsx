'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 发布委托弹窗(甲方填需求 + 联系方式)。联系方式单独存,不进公开描述。
const CATEGORIES = [
  { key: 'ad', label: '产品广告' },
  { key: 'film', label: '影视短片' },
  { key: 'short', label: '短视频' },
  { key: 'anime', label: '动画' },
  { key: 'poster', label: '海报设计' },
  { key: 'product', label: '产品设计' },
  { key: 'logo', label: '商标logo设计' },
  { key: 'other', label: '其它' },
];
export function PublishCommissionModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ad');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [contactName, setContactName] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [refFiles, setRefFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 上传到 Supabase assets bucket, 独立 commissions/ 路径(与画布隔离)
  const uploadToStorage = async (file: File): Promise<string | null> => {
    try {
      const sb = createClient();
      const { data: { user } } = await sb!.auth.getUser();
      if (!user) { window.location.href = '/auth'; return null; }
      const dotExt = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg';
      const filename = `commissions/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${dotExt}`;
      const { error: upErr } = await sb!.storage.from('assets').upload(filename, file, { contentType: file.type || 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = sb!.storage.from('assets').getPublicUrl(filename);
      return urlData.publicUrl;
    } catch (e: any) {
      setError('上传失败: ' + (e.message || ''));
      return null;
    }
  };

  const onCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const url = await uploadToStorage(file);
    if (url) setCoverUrl(url);
    setUploading(false);
  };

  const onRefPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError('');
    for (const f of files.slice(0, 6 - refFiles.length)) {
      const url = await uploadToStorage(f);
      if (url) setRefFiles((prev) => [...prev, url]);
    }
    setUploading(false);
  };

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('请填写项目标题'); return; }
    setSubmitting(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          title, description, category,
          budgetMin: budgetMin ? Number(budgetMin) : null,
          budgetMax: budgetMax ? Number(budgetMax) : null,
          deliveryDays: deliveryDays ? Number(deliveryDays) : null,
          coverUrl: coverUrl || null,
          referenceFiles: refFiles,
          contactName,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '发布失败'); setSubmitting(false); return; }
      onPublished();
    } catch (e: any) {
      setError(e.message || '发布失败');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-auto rounded-2xl bg-zinc-900 border border-white/10" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold">发布创作委托</h2>
            <p className="text-xs text-zinc-500 mt-0.5">填写你的创作需求，创作者会主动申请</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        {/* 主体:双列 */}
        <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-6 p-7">
          {/* 左列:文字信息 */}
          <div className="space-y-4">
            <Field label="项目标题 *">
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60}
                placeholder="例如:30秒产品广告短视频" style={inputStyle} />
            </Field>

            <Field label="需求描述">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={1000}
                placeholder="描述创作需求、风格、参考、时长等（请勿填写联系方式）" style={{ ...inputStyle, resize: 'none' }} />
            </Field>

            <Field label="分类">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.key} onClick={() => setCategory(c.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${category === c.key ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="预算最低(¥)"><input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
              <Field label="预算最高(¥)"><input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
              <Field label="交付天数"><input value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
            </div>

            <Field label="你的称呼(可选)"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="创作者会这样称呼你" style={inputStyle} /></Field>
          </div>

          {/* 右列:封面 + 参考文件 */}
          <div className="space-y-4">
            <Field label="封面图">
              {coverUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-white/15" style={{ aspectRatio: '16/9' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverUrl} alt="封面" className="w-full h-full object-cover" />
                  <button onClick={() => setCoverUrl('')} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-sm">✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors" style={{ aspectRatio: '16/9' }}>
                  <input type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
                  <span className="text-2xl text-zinc-500">＋</span>
                  <span className="text-sm text-zinc-400">{uploading ? '上传中…' : '点击上传封面图'}</span>
                </label>
              )}
            </Field>

            <Field label={`参考图/需求文件(可选) ${refFiles.length}/6`}>
              <div className="flex flex-wrap gap-2">
                {refFiles.map((url, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`参考${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => setRefFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs">✕</button>
                  </div>
                ))}
                {refFiles.length < 6 && (
                  <label className="w-16 h-16 flex items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/10 text-xl text-zinc-400">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onRefPick} />
                    +
                  </label>
                )}
              </div>
            </Field>

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3 text-xs text-zinc-500 leading-relaxed">
              选择创作者后可先各发一条消息试探，支付介绍费后即可在站内无限沟通、交换联系方式。标题和描述中请勿填写联系方式。
            </div>
          </div>
        </div>

        {/* 底部 */}
        <div className="px-7 py-5 border-t border-white/10">
          {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
          <button onClick={submit} disabled={submitting}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {submitting ? '发布中…' : '发布委托'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-zinc-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: 14, outline: 'none',
};
