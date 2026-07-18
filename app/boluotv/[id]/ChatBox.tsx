'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 独家沟通实时聊天(Supabase Realtime)
type Message = { id: string; sender_id: string; content: string; created_at: string };

export function ChatBox({ projectId, reservationId }: { projectId: string; reservationId: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string>('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); setMe(d.me || ''); }
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
        // 乐观追加(Realtime 也会推,已去重)
        setMessages((prev) => prev.some((x) => x.id === d.message.id) ? prev : [...prev, d.message]);
        scrollToBottom();
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

      {/* 输入区 */}
      <div className="flex gap-2 p-3 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入消息…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/25"
        />
        <button onClick={send} disabled={sending || !input.trim()}
          className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40">
          发送
        </button>
      </div>
    </div>
  );
}
