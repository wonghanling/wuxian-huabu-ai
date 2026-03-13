'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('orderId');
  const status = searchParams.get('status');
  const [checking, setChecking] = useState(true);
  const [orderType, setOrderType] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'error') { setChecking(false); return; }
    if (!orderId) { setChecking(false); return; }

    // 轮询订单状态，最多等 30 秒
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const supabase = createClient();
      const { data } = await supabase
        .from('payment_orders')
        .select('status, order_type')
        .eq('order_no', orderId)
        .single();

      if (data?.status === 'paid') {
        setOrderType(data.order_type);
        setChecking(false);
      } else if (attempts < 15) {
        setTimeout(poll, 2000);
      } else {
        setChecking(false);
      }
    };
    poll();
  }, [orderId, status]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-[360px] rounded-2xl bg-zinc-900 border border-white/10 p-8 text-center shadow-2xl">
        {checking ? (
          <>
            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">确认支付中...</h2>
            <p className="text-white/40 text-sm">正在确认支付结果，请稍候</p>
          </>
        ) : status === 'error' ? (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">支付失败</h2>
            <p className="text-white/40 text-sm mb-6">请重试或联系客服</p>
            <button
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition-all"
              onClick={() => router.push('/canvas')}
            >返回画布</button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">支付成功</h2>
            <p className="text-white/40 text-sm mb-6">
              {orderType === 'membership' ? '会员已开通，有效期 1 个月' : '余额已到账，可立即使用'}
            </p>
            <button
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all"
              onClick={() => router.push('/canvas')}
            >返回画布</button>
          </>
        )}
      </div>
    </div>
  );
}
