'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 创作者资料填写(昵称/擅长方向/简介/联系方式)。联系方式用于双方解锁后甲方查看。
const SPECIALTIES = ['产品广告', '影视短片', '短视频', '动画', '分镜', '剪辑', '品牌视觉', '游戏CG'];
const CONTACT_TYPES = [
  { key: 'wechat', label: '微信' },
  { key: 'qq', label: 'QQ' },
  { key: 'phone', label: '手机' },
  { key: 'email', label: '邮箱' },
];

export function ProfileModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [contactType, setContactType] = useState('wechat');
  const [contactValue, setContactValue] = useState('');
  const [portfolio, setPortfolio] = useState<{ id: string; media_url: string; title: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const sb = createClient();
        const { data: { session } } = await sb!.auth.getSession();
        if (!session) { window.location.href = '/auth'; return; }
        const res = await fetch('/api/commissions/profile', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const d = await res.json();
          if (d.profile) {
            setDisplayName(d.profile.display_name || '');
            setBio(d.profile.bio || '');
            setSpecialties(d.profile.specialties || []);
            setContactType(d.profile.contact_type || 'wechat');
            setContactValue(d.profile.contact_value || '');
          }
        }
        const pRes = await fetch('/api/commissions/portfolio', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (pRes.ok) { const pd = await pRes.json(); setPortfolio(pd.items || []); }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, []);

  // 上传作品到 Supabase assets(commissions/ 独立路径)
  const onPortfolioPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true); setError('');
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      const { data: { user } } = await sb!.auth.getUser();
      if (!session || !user) { window.location.href = '/auth'; return; }
      for (const f of files.slice(0, 12 - portfolio.length)) {
        const dotExt = f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : '.jpg';
        const filename = `commissions/${user.id}/portfolio/${Date.now()}-${Math.random().toString(36).slice(2)}${dotExt}`;
        const { error: upErr } = await sb!.storage.from('assets').upload(filename, f, { contentType: f.type || 'image/jpeg', upsert: false });
        if (upErr) { setError('上传失败: ' + upErr.message); continue; }
        const { data: urlData } = sb!.storage.from('assets').getPublicUrl(filename);
        const isVideo = (f.type || '').startsWith('video');
        const res = await fetch('/api/commissions/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ mediaType: isVideo ? 'video' : 'image', mediaUrl: urlData.publicUrl }),
        });
        const d = await res.json();
        if (res.ok) setPortfolio((prev) => [...prev, { id: d.id, media_url: urlData.publicUrl, title: null }]);
      }
    } catch (e: any) { setError(e.message || '上传失败'); }
    setUploading(false);
  };

  const deletePortfolio = async (itemId: string) => {
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/commissions/portfolio?id=${itemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) setPortfolio((prev) => prev.filter((p) => p.id !== itemId));
    } catch { /* noop */ }
  };

  const toggleSpec = (s: string) => {
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const submit = async () => {
    setError('');
    if (!displayName.trim()) { setError('请填写昵称'); return; }
    if (!contactValue.trim()) { setError('请填写联系方式(合作达成后甲方才能看到)'); return; }
    setSubmitting(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch('/api/commissions/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ displayName, bio, specialties, contactType, contactValue }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '保存失败'); setSubmitting(false); return; }
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || '保存失败');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-2xl bg-zinc-900 border border-white/10 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">创作者资料</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 py-10">加载中…</div>
        ) : (
          <div className="space-y-4">
            <Field label="昵称 *"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={20} style={inputStyle} /></Field>

            <Field label="擅长方向">
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((s) => (
                  <button key={s} onClick={() => toggleSpec(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${specialties.includes(s) ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="个人简介"><textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 200))} rows={3} placeholder="简短介绍你的经验和风格(≤200字)" style={{ ...inputStyle, resize: 'none' }} /></Field>

            <Field label={`作品集(展示给客户,最多12个) ${portfolio.length}/12`}>
              <div className="flex flex-wrap gap-2">
                {portfolio.map((p) => (
                  <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/15 bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.media_url} alt={p.title || '作品'} className="w-full h-full object-cover" />
                    <button onClick={() => deletePortfolio(p.id)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs">✕</button>
                  </div>
                ))}
                {portfolio.length < 12 && (
                  <label className="w-20 h-20 flex items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/5 cursor-pointer hover:bg-white/10 text-xl text-zinc-400">
                    <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onPortfolioPick} />
                    {uploading ? '…' : '+'}
                  </label>
                )}
              </div>
            </Field>

            <div className="pt-2 border-t border-white/10">
              <div className="text-sm text-emerald-400 mb-3">你的联系方式(合作达成后甲方才能看到)</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="类型">
                  <select value={contactType} onChange={(e) => setContactType(e.target.value)} style={inputStyle}>
                    {CONTACT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="联系方式 *"><input value={contactValue} onChange={(e) => setContactValue(e.target.value)} placeholder="微信/QQ/手机/邮箱" style={inputStyle} /></Field>
              </div>
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <button onClick={submit} disabled={submitting}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {submitting ? '保存中…' : '保存资料'}
            </button>
          </div>
        )}
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
