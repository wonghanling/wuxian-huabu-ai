'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ============================================================
// 独立定价页 · 参照 flora.ai 定价页视觉（4列卡片，专业版绿色高亮）
// 价格/权益为本站自有内容。支付逻辑 handlePay 与原首页定价区完全一致，
// 调用同一个 /api/payment/alipay 接口，未做任何改动。
// ============================================================

type Plan = {
  key: string;
  name: string;
  badge?: string;
  price: string;
  original?: string;
  unit: string;
  desc: string;
  offer?: string; // 特惠上市高亮框文案
  features: { text: string; on: boolean }[];
  action: { type: 'pay'; plan: 'membership' | 'membership_yearly' | 'membership_2yearly'; amount: number } | { type: 'signup' };
  highlight?: boolean;
  accent: string; // 强调色
};

const PLANS: Plan[] = [
  {
    key: 'free',
    name: '免费',
    price: '¥0',
    unit: '注册即用',
    desc: '适合初次体验，无需付费即可上手无限画布',
    features: [
      { text: '无限画布创作', on: true },
      { text: '图片生成 ¥0.3–1.5', on: true },
      { text: '视频生成普通价', on: true },
      { text: '文本卡片 / 角色设计', on: false },
      { text: 'Prompt 优化', on: false },
    ],
    action: { type: 'signup' },
    accent: 'rgb(120,120,120)',
  },
  {
    key: 'monthly',
    name: '月套餐',
    badge: '推荐',
    price: '¥39',
    unit: '/月 · 不自动续费',
    desc: '适合高频创作者，解锁全部专业功能',
    features: [
      { text: '无限文本大模型', on: true },
      { text: '导演引擎功能', on: true },
      { text: '视频生成每秒省 ¥0.2', on: true },
      { text: '设计师专业工具', on: true },
    ],
    offer: '特惠上市 · 限时优惠价',
    action: { type: 'pay', plan: 'membership', amount: 39 },
    highlight: true,
    accent: 'rgb(113,208,131)',
  },
  {
    key: 'yearly',
    name: '年套餐',
    badge: '省 ¥9/月',
    price: '¥459',
    original: '原价 ¥468',
    unit: '/年 · ≈ ¥38.25/月',
    desc: '一次付清更省钱，享年费专属优先服务',
    features: [
      { text: '月套餐全部权益', on: true },
      { text: '专属 5 个并发生成', on: true },
      { text: '年费专属优先服务', on: true },
      { text: '新功能优先体验', on: true },
      { text: '一次付清省钱', on: true },
    ],
    action: { type: 'pay', plan: 'membership_yearly', amount: 459 },
    accent: 'rgb(96,165,250)',
  },
  {
    key: 'biennial',
    name: '两年套餐',
    badge: '最划算',
    price: '¥899',
    original: '原价 ¥936',
    unit: '/两年 · ≈ ¥37.42/月',
    desc: '锁定最低价，未来功能永久享',
    features: [
      { text: '年套餐全部权益', on: true },
      { text: '专属 10 个并发生成', on: true },
      { text: '两年锁定最低价', on: true },
      { text: '专属客服支持', on: true },
      { text: '未来功能永久享', on: true },
    ],
    action: { type: 'pay', plan: 'membership_2yearly', amount: 899 },
    accent: 'rgb(52,211,153)',
  },
];

export default function PricingPage() {
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then((res: { data: { session: { user?: { email?: string } } | null } }) => {
      setUser(res.data.session?.user ?? null);
    });
  }, [supabase]);

  // 支付逻辑与原首页定价区完全一致，未改动
  const handlePay = async (plan: 'membership' | 'membership_yearly' | 'membership_2yearly' | 'recharge', amount: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/auth/login'); return; }
    const res = await fetch('/api/payment/alipay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, amount }),
    });
    const data = await res.json();
    if (data.paymentForm) {
      const div = document.createElement('div');
      div.innerHTML = data.paymentForm;
      document.body.appendChild(div);
      const form = div.querySelector('form');
      form?.submit();
    } else {
      alert(data.error || '发起支付失败');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-black/70" style={{ borderBottom: '1px solid #ffffff14' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/filmavo-logo-primary.svg" alt="filmavo" className="h-7 w-auto" />
            <span className="font-semibold text-base tracking-tight" style={{ color: 'rgb(238,238,238)' }}>Filmavo</span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/" className="transition-colors hover:text-white" style={{ color: 'rgb(180,180,180)' }}>首页</Link>
            {user ? (
              <Link href="/orders" className="transition-colors hover:text-white" style={{ color: 'rgb(180,180,180)' }}>订单</Link>
            ) : (
              <Link href="/auth" className="transition-colors hover:text-white" style={{ color: 'rgb(180,180,180)' }}>登录</Link>
            )}
            <Link href="/canvas" className="px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-200 transition-colors">进入画布</Link>
          </div>
        </div>
      </nav>

      {/* 标题区 */}
      <section className="px-6 pt-20 pb-12 text-center">
        <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Pricing · 定价</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
          简单透明的定价
        </h1>
        <p className="text-lg" style={{ color: 'rgb(180,180,180)' }}>按需付费，无隐藏费用</p>
      </section>

      {/* 4列卡片 */}
      <section className="px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mx-auto items-stretch" style={{ maxWidth: 1200 }}>
          {PLANS.map((p) => {
            const action = p.action;
            return (
            <div
              key={p.key}
              className="overflow-hidden flex flex-col relative transition-all duration-[250ms] ease-out hover:-translate-y-1 group"
              style={{
                minHeight: 600,
                borderRadius: 30,
                // 对角渐变：左下角亮灰、右上角黑，对比拉开(45deg 起点=左下 终点=右上)
                background: 'linear-gradient(45deg, #4a4a4d 0%, #26262a 42%, #141416 70%, #08080a 100%)',
                // 边框统一深色淡白细线(Pro卡也一样，不通体亮绿)
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px -30px rgba(0,0,0,0.9)',
              }}
            >
              {/* Pro 卡：仅底部一小片很淡的绿色辉光(点缀，不刺眼、不在中间) */}
              {p.highlight && (
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none"
                  style={{ height: '38%', background: 'radial-gradient(ellipse at 50% 130%, rgba(104,211,125,0.14), transparent 70%)' }}
                />
              )}

              <div className="relative flex flex-col flex-1" style={{ padding: 28 }}>
                {/* 名称 + 徽标 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-semibold" style={{ color: 'rgb(238,238,238)' }}>{p.name}</span>
                  {p.badge && (
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        background: p.highlight ? 'rgb(113,208,131)' : '#ffffff14',
                        color: p.highlight ? '#04170a' : 'rgb(180,180,180)',
                      }}
                    >
                      {p.badge}
                    </span>
                  )}
                </div>
                <p className="text-[13px] mb-6 leading-relaxed" style={{ color: 'rgb(140,140,140)', minHeight: 40 }}>{p.desc}</p>

                {/* 价格 */}
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-5xl font-bold tracking-tight" style={{ color: 'rgb(245,245,245)' }}>{p.price}</span>
                  {p.original && <span className="text-sm line-through mb-2" style={{ color: 'rgb(96,96,96)' }}>{p.original}</span>}
                </div>
                <div className="text-[13px] mb-6" style={{ color: 'rgb(120,120,120)' }}>{p.unit}</div>

                {/* 特惠上市高亮框 */}
                {p.offer && (
                  <div
                    className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-5"
                    style={{ background: 'rgba(113,208,131,0.12)', border: '1px solid rgba(113,208,131,0.4)' }}
                  >
                    <span className="text-xs" style={{ color: 'rgb(113,208,131)' }}>✓</span>
                    <span className="text-[12.5px] font-medium" style={{ color: 'rgb(150,220,170)' }}>{p.offer}</span>
                  </div>
                )}

                {/* 分隔线 */}
                <div className="mb-5" style={{ borderTop: '1px solid #ffffff14' }} />

                {/* 功能列表 */}
                <ul className="space-y-3 text-sm mb-7 flex-1">
                  {p.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2.5">
                      <span className="text-xs mt-0.5" style={{ color: f.on ? p.accent : 'rgb(80,80,80)' }}>
                        {f.on ? '✓' : '✗'}
                      </span>
                      <span style={{ color: f.on ? 'rgb(210,210,210)' : 'rgb(110,110,110)' }}>{f.text}</span>
                    </li>
                  ))}
                </ul>

                {/* 底部整宽大按钮 */}
                {action.type === 'signup' ? (
                  <a
                    href="/auth"
                    className="block w-full py-3.5 rounded-xl text-sm font-semibold text-center transition-all"
                    style={{ border: '1px solid #ffffff2e', color: 'rgb(210,210,210)' }}
                  >
                    免费注册
                  </a>
                ) : (
                  <button
                    onClick={() => handlePay(action.plan, action.amount)}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                    style={
                      p.highlight
                        ? { background: 'rgb(113,208,131)', color: '#04170a', boxShadow: '0 8px 24px -8px rgba(113,208,131,0.6)' }
                        : { background: '#ffffff14', color: 'rgb(238,238,238)', border: '1px solid #ffffff2e' }
                    }
                  >
                    立即开通
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* 自带 API Key 说明：套餐与自带 Key 是两件事 */}
        <div className="max-w-3xl mx-auto mt-16">
          <div
            className="rounded-2xl p-7"
            style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff14' }}
          >
            <h3 className="text-base font-semibold mb-3" style={{ color: 'rgb(228,228,228)' }}>
              关于自带 API Key
            </h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgb(150,150,150)' }}>
              以上套餐与自带 API Key 无关。你可以在画布中连接自己的官方 API 账户（火山引擎方舟、
              阿里云百炼、即梦），这些模型的费用直接支付给官方，Filmavo 不收取模型调用费，
              也不占用平台并发额度。
            </p>
            <ul className="space-y-2">
              {[
                '自带 Key 的模型调用不扣画布余额，用量与账单在官方控制台查看',
                '图片生成等按量计费功能，不需要开通套餐',
                '套餐解锁的是剧本工作室、分镜脚本、导演引擎等文本创作功能',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgb(160,160,160)' }}>
                  <span className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'rgb(113,208,131)' }} />
                  <span className="leading-relaxed">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
