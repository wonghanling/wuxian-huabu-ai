'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 创作者申请弹窗。只填已有信息:报价/工期/档期/介绍。禁止上传定制试稿。
export function ApplyModal({ projectId, onClose, onApplied }: { projectId: string; onClose: () => void; onApplied: () => void }) {
  const [quoteMin, setQuoteMin] = useState('');
  const [quoteMax, setQuoteMax] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [availability, setAvailability] = useState('');
  const [intro, setIntro] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch(`/api/commissions/${projectId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          quoteMin: quoteMin ? Number(quoteMin) : null,
          quoteMax: quoteMax ? Number(quoteMax) : null,
          deliveryDays: deliveryDays ? Number(deliveryDays) : null,
          availability, intro,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '申请失败'); setSubmitting(false); return; }
      onApplied();
    } catch (e: any) {
      setError(e.message || '申请失败');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold">申请这个项目</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>
        <div className="text-xs text-zinc-500 mb-5 leading-relaxed">
          申请阶段无需免费试做，请使用已有作品展示您的能力。只需填写报价、工期和简短介绍。
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="报价最低(¥)"><input value={quoteMin} onChange={(e) => setQuoteMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
            <Field label="报价最高(¥)"><input value={quoteMax} onChange={(e) => setQuoteMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="预计工期(天)"><input value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inputStyle} /></Field>
            <Field label="当前档期"><input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="如:本周可接" style={inputStyle} /></Field>
          </div>
          <Field label={`自我介绍 (${intro.length}/200)`}>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value.slice(0, 200))} rows={4}
              placeholder="简短介绍你的经验和擅长方向" style={{ ...inputStyle, resize: 'none' }} />
          </Field>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          <button onClick={submit} disabled={submitting}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {submitting ? '提交中…' : '提交申请'}
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
