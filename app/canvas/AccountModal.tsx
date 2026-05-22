'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MEMBERSHIP_PRICE } from '@/lib/pricing';

interface AccountModalProps {
  onClose: () => void;
  onPay: (plan: 'membership' | 'recharge', amount: number) => void;
  balance: number;
  isMember: boolean;
  memberExpiresAt?: string | null;
}

type Tab = 'membership' | 'recharge' | 'promo' | 'history' | 'orders';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface Order {
  id: string;
  order_no: string;
  order_type: 'recharge' | 'membership';
  amount_rmb: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  trade_no: string | null;
  paid_at: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  recharge:       { label: '充值',     color: 'text-green-400' },
  membership:     { label: '开通会员', color: 'text-violet-400' },
  image_deduct:   { label: '图片生成', color: 'text-red-400' },
  video_deduct:   { label: '视频生成', color: 'text-red-400' },
  refund:         { label: '退款',     color: 'text-green-400' },
  promo:          { label: '兑换码',   color: 'text-yellow-400' },
};

export default function AccountModal({ onClose, onPay, balance, isMember, memberExpiresAt }: AccountModalProps) {
  const [tab, setTab] = useState<Tab>('membership');
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (tab === 'history') loadTransactions();
    if (tab === 'orders') loadOrders();
  }, [tab]);

  // 余额变化时自动刷新消费记录（生成扣费后余额会变）
  useEffect(() => {
    if (tab === 'history') loadTransactions();
  }, [balance]);

  // 弹窗打开时订阅 transactions 实时更新
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tx-modal-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        loadTransactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('transactions')
        .select('id, type, amount, balance_after, created_at, description')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) console.error('transactions query error:', error);
      setTransactions(data ?? []);
    } finally {
      setTxLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('payment_orders')
        .select('id, order_no, order_type, amount_rmb, status, trade_no, paid_at, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) console.error('orders query error:', error);
      setOrders(data ?? []);
    } finally {
      setOrdersLoading(false);
    }
  };

  const redeemPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoMsg(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setPromoMsg({ ok: false, text: '请先登录' }); return; }
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPromoMsg({ ok: true, text: data.message ?? '兑换成功！已激活30天会员' });
        setPromoCode('');
      } else {
        setPromoMsg({ ok: false, text: data.error ?? '兑换失败，请检查优惠码' });
      }
    } catch {
      setPromoMsg({ ok: false, text: '网络错误，请重试' });
    } finally {
      setPromoLoading(false);
    }
  };

  const rechargeAmounts = [
    { amount: 10,    label: '¥10' },
    { amount: 30,    label: '¥30' },
    { amount: 50,    label: '¥50' },
    { amount: 100,   label: '¥100' },
    { amount: 500,   label: '¥500' },
    { amount: 1000,  label: '¥1000' },
  ];

  const memberExpireText = memberExpiresAt
    ? `有效期至 ${new Date(memberExpiresAt).toLocaleDateString('zh-CN')}`
    : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
    >
      <div
        className="relative flex w-[820px] max-h-[640px] rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* 左侧导航 */}
        <div className="w-44 flex-shrink-0 bg-zinc-950/60 border-r border-white/8 flex flex-col py-6 px-3 gap-1">
          <div className="px-2 mb-4">
            <div className="text-white/40 text-xs mb-1">账户余额</div>
            <div className="text-white font-bold text-lg">¥{balance.toFixed(2)}</div>
            {isMember && (
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30">
                <span className="text-violet-300 text-xs">会员</span>
              </div>
            )}
          </div>

          {([
            { id: 'membership', icon: '✦', label: '会员订阅' },
            { id: 'recharge',   icon: '◈', label: '充值余额' },
            { id: 'promo',      icon: '◎', label: '兑换码' },
            { id: 'orders',     icon: '◻', label: '我的订单' },
            { id: 'history',    icon: '≡', label: '消费记录' },
          ] as { id: Tab; icon: string; label: string }[]).map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                tab === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <span className="text-base w-4 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 关闭按钮 */}
          <button
            className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
            onClick={onClose}
            onPointerDown={e => e.stopPropagation()}
          >✕</button>

          <div className="flex-1 overflow-y-auto p-7">

            {/* 会员订阅 */}
            {tab === 'membership' && (
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">会员订阅</h2>
                <p className="text-white/40 text-sm mb-6">解锁全部 AI 创作功能，视频生成享受会员折扣</p>

                {isMember && memberExpireText && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
                    当前会员有效 · {memberExpireText}
                  </div>
                )}

                {/* 套餐卡片 */}
                <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 p-6 mb-4">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <div className="text-white font-bold text-3xl">¥{MEMBERSHIP_PRICE}</div>
                      <div className="text-white/40 text-sm mt-0.5">/月 · 不自动续费</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-violet-500/30 border border-violet-400/30 text-violet-300 text-xs font-medium">
                      月付
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    {[
                      '无限文本生成（大模型）',
                      '角色设计 & 导演引擎功能',
                      '视频生成每秒省 ¥0.2',
                      '优先体验新功能',
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2 text-sm text-white/70">
                        <span className="text-violet-400 text-xs">✓</span> {item}
                      </div>
                    ))}
                  </div>
                  <button
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-violet-500/20"
                    onClick={() => { onClose(); onPay('membership', MEMBERSHIP_PRICE); }}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    {isMember ? '续费会员' : '立即开通'} · ¥{MEMBERSHIP_PRICE}/月
                  </button>
                </div>

                <p className="text-center text-xs text-white/25">支付宝付款 · 手动续费 · 随时停止</p>
              </div>
            )}

            {/* 充值余额 */}
            {tab === 'recharge' && (
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">充值余额</h2>
                <p className="text-white/40 text-sm mb-6">余额用于图片和视频生成消耗</p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {rechargeAmounts.map(({ amount, label }) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      onPointerDown={e => e.stopPropagation()}
                      className={`relative py-4 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                        selectedAmount === amount
                          ? 'bg-violet-500/20 border-violet-400/60 text-white'
                          : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20 text-white/80'
                      }`}
                    >
                      <span className="font-bold text-lg">{label}</span>
                    </button>
                  ))}
                </div>

                <button
                  disabled={!selectedAmount}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all"
                  onClick={() => { if (selectedAmount) { onClose(); onPay('recharge', selectedAmount); } }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {selectedAmount ? `充值 ¥${selectedAmount}` : '请选择金额'}
                </button>

                <p className="text-center text-xs text-white/25 mt-3">支付宝付款 · 到账后可立即使用</p>
              </div>
            )}

            {/* 兑换码 */}
            {tab === 'promo' && (
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">兑换码</h2>
                <p className="text-white/40 text-sm mb-6">输入优惠码即可激活会员或获得余额</p>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') redeemPromo(); }}
                    placeholder="输入优惠码，如 AURA-XXXXXX"
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 text-sm focus:outline-none focus:border-violet-500/50 transition-colors tracking-widest"
                    onPointerDown={e => e.stopPropagation()}
                  />
                  <button
                    onClick={redeemPromo}
                    disabled={promoLoading || !promoCode.trim()}
                    onPointerDown={e => e.stopPropagation()}
                    className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
                  >
                    {promoLoading ? '兑换中…' : '兑换'}
                  </button>
                </div>

                {promoMsg && (
                  <div className={`px-4 py-3 rounded-xl text-sm ${
                    promoMsg.ok
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {promoMsg.text}
                  </div>
                )}

                <div className="mt-8 p-4 rounded-xl bg-white/3 border border-white/8">
                  <div className="text-white/50 text-xs mb-2">如何获取优惠码？</div>
                  <div className="text-white/30 text-xs leading-relaxed">
                    注册账号后可在个人中心领取首月免费体验码，也可关注官方渠道获取最新活动码。
                  </div>
                </div>
              </div>
            )}

            {/* 订单记录 */}
            {tab === 'orders' && (
              <div>
                <h2 className="text-white font-semibold text-lg mb-1">我的订单</h2>
                <p className="text-white/40 text-sm mb-5">充值和会员购买记录</p>

                {ordersLoading ? (
                  <div className="flex items-center justify-center py-12 text-white/30 text-sm">加载中…</div>
                ) : orders.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-white/30 text-sm">暂无订单记录</div>
                ) : (
                  <div className="space-y-2">
                    {orders.map(order => {
                      const statusMap: Record<string, { text: string; color: string }> = {
                        pending:   { text: '待支付', color: 'text-yellow-400' },
                        paid:      { text: '已支付', color: 'text-green-400' },
                        cancelled: { text: '已取消', color: 'text-white/30' },
                        refunded:  { text: '已退款', color: 'text-red-400' },
                      };
                      const typeMap: Record<string, string> = {
                        membership: '开通会员',
                        recharge:   '余额充值',
                      };
                      const status = statusMap[order.status] ?? { text: order.status, color: 'text-white/40' };
                      return (
                        <div key={order.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-white text-sm font-medium">{typeMap[order.order_type] ?? order.order_type}</span>
                              <span className={`text-xs ${status.color}`}>{status.text}</span>
                            </div>
                            <div className="text-white/25 text-xs">
                              {new Date(order.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-semibold">¥{order.amount_rmb}</div>
                            {order.paid_at && (
                              <div className="text-white/25 text-xs">
                                {new Date(order.paid_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 消费记录 */}
            {tab === 'history' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-white font-semibold text-lg">消费记录</h2>
                  <button
                    onClick={loadTransactions}
                    onPointerDown={e => e.stopPropagation()}
                    className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/5 transition-all"
                  >↻ 刷新</button>
                </div>
                <p className="text-white/40 text-sm mb-5">最近 50 条记录</p>

                {txLoading ? (
                  <div className="flex items-center justify-center py-12 text-white/30 text-sm">加载中…</div>
                ) : transactions.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-white/30 text-sm">暂无记录</div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => {
                      const info = TYPE_LABEL[tx.type] ?? { label: tx.type, color: 'text-white/60' };
                      const isIncome = tx.amount > 0;
                      return (
                        <div key={tx.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/3 border border-white/6">
                          <div className="flex items-center gap-3">
                            <div className={`text-xs px-2 py-0.5 rounded-full bg-white/5 ${info.color}`}>
                              {info.label}
                            </div>
                            <div className="text-white/30 text-xs">
                              {new Date(tx.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-medium text-sm ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                              {isIncome ? '+' : ''}¥{Math.abs(tx.amount).toFixed(2)}
                            </span>
                            <span className="text-white/25 text-xs">余额 ¥{tx.balance_after.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
