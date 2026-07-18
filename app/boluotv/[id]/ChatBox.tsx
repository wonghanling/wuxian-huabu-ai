'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 独家沟通实时聊天(Supabase Realtime)
type Message = { id: string; sender_id: string; content: string; created_at: string };

// 按钮包一层:点击才展开聊天窗口
export function ChatToggle({ projectId, reservationId, paid }: { projectId: string; reservationId: string | null; paid?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors">
        💬 进入实时聊天
      </button>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={() => setOpen(false)} className="text-xs text-zinc-400 hover:text-white">收起聊天 ✕</button>
      </div>
      <ChatBox projectId={projectId} reservationId={reservationId} paid={paid} />
    </div>
  );
}

export function ChatBox({ projectId, reservationId, paid, onTriggerPay }: { projectId: string; reservationId: string | null; paid?: boolean; onTriggerPay?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string>('');
  const [myCount, setMyCount] = useState(0);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 付款前每人限1条
  const preChatUsedUp = !paid && myCount >= 1;

  const scrollToBottom = () => {
    setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, 50);
  };

  // 加载历史 + 订阅 Realtime
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    (async () => {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { setLoading(false); return; }
      // 历史消息
      const res = await fetch(`/api/commissions/${projectId}/messages`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); setMe(d.me || ''); setMyCount(d.myCount || 0); }
      setLoading(false);
      scrollToBottom();

      // Realtime 订阅新消息
      channel = sb!
        .channel(`chat:${projectId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'commission_messages', filter: `project_id=eq.${projectId}` },
          (payload: { new: Message }) => {
            const m = payload.new as Message;
            setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
            scrollToBottom();
          })
        .subscribe();
    })();
    return () => { if (channel) { const sb = createClient(); sb?.removeChannel(channel); } };
  }, [projectId]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const sb = createClient();
      const { data: { session } } = await sb!.auth.getSession();
      if (!session) { window.location.href = '/auth'; return; }
      const res = await fetch(`/api/commissions/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: text, reservationId }),
      });
      const d = await res.json();
      if (res.ok && d.message) {
        setInput('');
        setMyCount((c) => c + 1);
        // 乐观追加(Realtime 也会推,已去重)
        setMessages((prev) => prev.some((x) => x.id === d.message.id) ? prev : [...prev, d.message]);
        scrollToBottom();
        // 付款前创作者发完预沟通那条 → 触发付款弹窗
        if (d.triggerPay && onTriggerPay) setTimeout(() => onTriggerPay(), 400);
      } else {
        alert(d.error || '发送失败');
      }
    } catch (e: any) {
      alert(e.message || '发送失败');
    }
    setSending(false);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-sm font-semibold">实时沟通</div>

      {/* 消息区 */}
      <div ref={scrollRef} className="h-80 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="text-center text-zinc-500 text-sm py-10">加载中…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm py-10">还没有消息，发一条打个招呼吧</div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  mine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white/10 text-zinc-100 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 付款前提示 */}
      {!paid && (
        <div className="px-4 py-2 text-xs text-yellow-400/90 bg-yellow-500/10 border-t border-white/10">
          {preChatUsedUp
            ? '付款前每人可发1条消息，已用完。创作者支付介绍费后可无限沟通。'
            : '付款前每人可发1条试探消息（不能发联系方式）。支付介绍费后即可无限沟通、交换联系方式。'}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={preChatUsedUp ? '付款后可继续发送…' : '输入消息…'}
          disabled={preChatUsedUp}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25 disabled:opacity-50"
        />
        <button onClick={send} disabled={sending || !input.trim() || preChatUsedUp}
          className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40">
          发送
        </button>
      </div>
    </div>
  );
}
