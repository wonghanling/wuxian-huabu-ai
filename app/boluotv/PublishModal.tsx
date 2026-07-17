'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 发布委托弹窗(甲方填需求 + 联系方式)。联系方式单独存,不进公开描述。
const CATEGORIES = [
  { key: 'ad', label: '产品广告' },
  { key: 'film', label: '影视短片' },
  { key: 'short', label: '短视频' },
  { key: 'anime', label: '动画' },
  { key: 'other', label: '其它' },
];
const CONTACT_TYPES = [
  { key: 'wechat', label: '微信' },
  { key: 'qq', label: 'QQ' },
  { key: 'phone', label: '手机' },
  { key: 'email', label: '邮箱' },
];

export function PublishCommissionModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ad');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [contactType, setContactType] = useState('wechat');
  const [contactValue, setContactValue] = useState('');
  const [contactName, setContactName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!title.trim()) { setError('请填写项目标题'); return; }
    if (!contactValue.trim()) { setError('请填写联系方式'); return; }
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
          contactType, contactValue, contactName,
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl bg-zinc-900 border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">发布创作委托</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="space-y-4">
          <Field label="项目标题 *">
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60}
              placeholder="例如:30秒产品广告短视频" style={inputStyle} />
          </Field>

          <Field label="需求描述">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={1000}
              placeholder="描述你的创作需求、风格、参考、时长等。注意:请勿在此填写联系方式" style={{ ...inputStyle, resize: 'none' }} />
            <div className="text-xs text-zinc-500 mt-1">⚠️ 描述里不能写手机/微信/QQ/链接，联系方式请填在下方专门栏位</div>
          </Field>

          <Field label="分类">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${category === c.key ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
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

          <div className="pt-2 border-t border-white/10">
            <div className="text-sm text-emerald-400 mb-3">你的联系方式(创作者支付介绍费后才能看到)</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="联系方式类型">
                <select value={contactType} onChange={(e) => setContactType(e.target.value)} style={inputStyle}>
                  {CONTACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="称呼(可选)"><input value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} /></Field>
            </div>
            <div className="mt-3">
              <Field label="联系方式 *"><input value={contactValue} onChange={(e) => setContactValue(e.target.value)} placeholder="微信号/QQ/手机/邮箱" style={inputStyle} /></Field>
            </div>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

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
