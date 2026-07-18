'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Order = {
  id: string;
  order_no: string;
  order_type: 'recharge' | 'membership';
  amount_rmb: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  trade_no: string | null;
  paid_at: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending:   { text: '待支付', color: 'text-yellow-400' },
  paid:      { text: '已支付', color: 'text-green-400' },
  cancelled: { text: '已取消', color: 'text-zinc-500' },
  refunded:  { text: '已退款', color: 'text-red-400' },
};

const TYPE_LABEL: Record<string, string> = {
  membership:         '开通会员（月付）',
  membership_yearly:  '开通会员（年付）',
  membership_2yearly: '开通会员（两年付）',
  recharge:           '余额充值',
  commission_intro:   '创作服务',
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [balance, setBalance] = useState(0);
  const [memberExpires, setMemberExpires] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const [{ data: ordersData }, { data: userData }] = await Promise.all([
        supabase
          .from('payment_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('balance, is_member, member_expires_at')
          .eq('id', user.id)
          .single(),
      ]);

      setOrders(ordersData || []);
      setBalance(userData?.balance || 0);
      setIsMember(!!(userData?.is_member && userData?.member_expires_at && new Date(userData.member_expires_at) > new Date()));
      setMemberExpires(userData?.member_expires_at || null);
      setLoading(false);
    };
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* 顶部导航 */}
      <nav className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-white font-semibold">← 返回首页</Link>
          <Link href="/canvas" className="text-sm text-zinc-400 hover:text-white transition-colors">进入画布</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-8">我的订单</h1>

        {/* 账户状态 */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="rounded-2xl bg-zinc-900 border border-white/8 p-6">
            <p className="text-zinc-400 text-sm mb-1">账户余额</p>
            <p className="text-3xl font-bold text-white">¥{balance.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-zinc-900 border border-white/8 p-6">
            <p className="text-zinc-400 text-sm mb-1">会员状态</p>
            {isMember ? (
              <>
                <p className="text-xl font-bold text-violet-400">会员有效</p>
                {memberExpires && (
                  <p className="text-xs text-zinc-500 mt-1">
                    到期：{new Date(memberExpires).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xl font-bold text-zinc-500">未开通</p>
            )}
          </div>
        </div>

        {/* 订单列表 */}
        {loading ? (
          <div className="text-center text-zinc-500 py-20">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-zinc-500 py-20">暂无订单记录</div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id} className="rounded-xl bg-zinc-900 border border-white/8 p-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{TYPE_LABEL[order.order_type] || order.order_type}</span>
                    <span className={`text-xs ${STATUS_LABEL[order.status]?.color || 'text-zinc-400'}`}>
                      {STATUS_LABEL[order.status]?.text || order.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    订单号：{order.order_no}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {new Date(order.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">¥{order.amount_rmb}</p>
                  {order.paid_at && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(order.paid_at).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
