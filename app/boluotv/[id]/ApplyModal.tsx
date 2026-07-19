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
  const [needMembership, setNeedMembership] = useState(false);
  const [paying, setPaying] = useState(false);

  // 开通接单会员(9.9/月,走支付宝)
  const openMembership = async () => {
    setPaying(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch('/api/payment/alipay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: 'creator_membership', amount: 9.9 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '下单失败'); setPaying(false); return; }
      const win = window.open('', '_blank');
      if (win) { win.document.write(data.paymentForm); win.document.close(); }
      else { alert('请允许弹窗以完成支付'); }
    } catch (e: any) {
      setError(e.message || '下单失败');
    }
    setPaying(false);
  };

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
      if (!res.ok) {
        if (data.needMembership) { setNeedMembership(true); setSubmitting(false); return; }
        setError(data.error || '申请失败'); setSubmitting(false); return;
      }
      onApplied();
    } catch (e: any) {
      setError(e.message || '申请失败');
      setSubmitting(false);
    }
  };

  // 需要开通会员的界面
  if (needMembership) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-6 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">开通接单会员</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
          </div>
          <div className="text-4xl font-bold text-emerald-400 mb-1">¥9.9</div>
          <div className="text-sm text-zinc-400 mb-5">/ 1个月接单资格</div>
          <div className="text-sm text-zinc-300 leading-relaxed mb-6 text-left bg-white/[0.03] border border-white/10 rounded-xl p-4">
            开通后 1 个月内：<br />
            · 可申请大厅所有项目，不限次数<br />
            · 被甲方选中后自由沟通、交换联系方式<br />
            · 到期后续费即可继续接单
          </div>
          {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
          <button onClick={openMembership} disabled={paying}
            className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {paying ? '跳转支付…' : '支付 ¥9.9 开通接单会员'}
          </button>
          <button onClick={() => { setNeedMembership(false); setError(''); }}
            className="w-full mt-2 py-2.5 text-sm text-zinc-400 hover:text-white">
            我已支付，返回申请
          </button>
          <p className="text-xs text-zinc-600 mt-3">接单会员独立于画布会员，通过支付宝支付</p>
        </div>
      </div>
    );
  }

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
