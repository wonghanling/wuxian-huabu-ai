'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlibabaCloud, Microsoft, Gemini, BAAI, ByteDance, Adobe, TencentCloud, Fal, Midjourney, Minimax, Aws, LongCat, Jimeng, NanoBanana } from '@lobehub/icons';
import { ScrollZoomShowcase } from './_components/ScrollZoomShowcase';
import { ModelsShowcase } from './_components/ModelsShowcase';
import { FeatureTabsShowcase } from './_components/FeatureTabsShowcase';
import { WorkflowScrollShowcase } from './_components/WorkflowScrollShowcase';
import { ScriptStudioDemo } from './_components/ScriptStudioDemo';
import { UpcomingModels } from './_components/UpcomingModels';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // 检查登录状态
    const checkUser = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      // 先读本地 session（瞬间返回，不发网络请求）
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);

      // 未登录用户首次访问自动弹出活动弹窗
      if (!session?.user && !sessionStorage.getItem('promo-modal-shown')) {
        setTimeout(() => setShowPromoModal(true), 800);
        sessionStorage.setItem('promo-modal-shown', '1');
      }
    };

    checkUser();

    // 监听登录状态变化
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // 鼠标跟随柔光 + 滚动淡入 + 导航滚动态(全部纯 transform/opacity,GPU 合成,零重排)
  useEffect(() => {
    // 1) 光晕跟随鼠标:rAF 节流 + 缓动,只写 transform
    const orb = document.getElementById('cursor-orb');
    const dotGrid = document.getElementById('hero-dot-grid-bright');
    let targetX = window.innerWidth / 2, targetY = window.innerHeight / 2;
    let curX = targetX, curY = targetY, raf = 0;
    const onMove = (e: MouseEvent) => { targetX = e.clientX; targetY = e.clientY; };
    const tick = () => {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      if (orb) orb.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      // 点阵发亮层：跟随鼠标在其所在容器内的相对坐标
      if (dotGrid) {
        const rect = dotGrid.getBoundingClientRect();
        dotGrid.style.setProperty('--mx', `${curX - rect.left}px`);
        dotGrid.style.setProperty('--my', `${curY - rect.top}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    // 2) 滚动淡入:一次性触发即解绑,无持续开销
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    // 3) 导航滚动态
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  // 登出
  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <div className="relative bg-[#09090b] text-white">

      {/* 活动弹窗 - 仅未登录用户自动弹出 */}
      {showPromoModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowPromoModal(false)}
        >
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              width: 'min(760px, 92vw)',
              boxShadow: '0 0 0 1px rgba(139,92,246,0.5), 0 0 0 4px rgba(139,92,246,0.1), 0 0 60px rgba(139,92,246,0.2), 0 30px 80px rgba(0,0,0,0.8)',
              background: 'linear-gradient(145deg, #1a1523 0%, #18181b 60%, #1a1523 100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 顶部光晕线 */}
            <div style={{
              position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, zIndex: 20,
              background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.9), rgba(99,102,241,0.9), rgba(167,139,250,0.9), transparent)',
            }} />

            {/* 关闭按钮 */}
            <button
              onClick={() => setShowPromoModal(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-all"
            >✕</button>

            {/* 宣传图片区域 */}
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <img
                src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/seedancexuanchuantanchuang.png?quality=80"
                alt="Seedance 2.0"
                className="w-full h-full object-cover"
              />
              {/* 图片上叠加文案 */}
              <div
                className="absolute inset-x-0 bottom-0 px-6 pt-12 pb-5"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
              >
                <div className="text-white font-bold text-xl mb-1">Seedance 2.0 · 让想象动起来</div>
                <div className="text-white/70 text-sm">新一代 AI 视频生成模型</div>
              </div>
            </div>

            {/* 底部按钮区域 */}
            <div className="px-7 py-6">
              <div className="text-center mb-4">
                <div className="text-white font-semibold text-lg mb-1">🎁 新用户注册即送 1 个月会员</div>
                <div className="text-white/50 text-sm">注册成功后进入画布即可领取，限时活动</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPromoModal(false); window.location.href = '/auth'; }}
                  className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20"
                >立即注册领取</button>
                <button
                  onClick={() => setShowPromoModal(false)}
                  className="flex-1 py-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-white/60 hover:text-white font-medium text-sm transition-all"
                >稍后再说</button>
              </div>
              <div className="text-center mt-3">
                <button onClick={() => { setShowPromoModal(false); window.location.href = '/auth?mode=login'; }}
                  className="text-white/30 hover:text-white/60 text-xs transition-colors">
                  已有账号？直接登录
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Grid Background */}
      <div className="infinite-grid absolute inset-0 opacity-30" />

      {/* Glowing Orbs */}
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />
      {/* 跟随鼠标的柔光 */}
      <div id="cursor-orb" className="orb-cursor" />

      {/* Navigation */}
      <nav
        className="fixed top-0 w-full z-50 border-b transition-all duration-500"
        style={{
          borderColor: navScrolled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          background: navScrolled ? 'rgba(10,10,10,0.92)' : 'rgba(10,10,10,0.55)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-[72px] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <img src="/filmavo-logo-primary.svg" alt="filmavo" className="h-7 w-auto" />
            <span className="font-semibold text-base tracking-tight" style={{ color: 'rgb(238,238,238)' }}>Filmavo</span>
          </div>

          <div className="hidden md:flex items-center space-x-10 text-sm font-medium" style={{ color: 'rgb(180,180,180)' }}>
            <a href="/boluotv" className="transition-colors hover:text-white" style={{ color: 'rgb(180,180,180)' }}>
              作品广场<span className="text-emerald-500">｜接单</span>
            </a>
            <a href="/filmavo-tv" className="hover:text-white transition-colors">Filmavo TV</a>
            <a href="#" className="hover:text-white transition-colors">平台</a>
            <a href="#" className="hover:text-white transition-colors">案例展示</a>
            <a href="#" className="hover:text-white transition-colors">企业版</a>
            <a href="/pricing" className="hover:text-white transition-colors">定价</a>
          </div>

          <div className="flex items-center space-x-5">
            {loading ? (
              <div className="text-sm" style={{ color: 'rgb(96,96,96)' }}>加载中...</div>
            ) : user ? (
              <>
                <div className="hidden sm:block text-sm" style={{ color: 'rgb(96,96,96)' }}>
                  {user.email}
                </div>
                <Link href="/orders" className="text-sm font-medium hover:text-white transition-colors" style={{ color: 'rgb(180,180,180)' }}>
                  订单
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium hover:text-white transition-colors"
                  style={{ color: 'rgb(180,180,180)' }}
                >
                  登出
                </button>
                <Link href="/canvas">
                  <button
                    className="px-5 py-2.5 text-sm font-semibold rounded-full transition-transform hover:scale-[1.03]"
                    style={{ background: 'rgb(238,238,238)', color: '#000' }}
                  >
                    进入画布
                  </button>
                </Link>
              </>
            ) : (
              <>
                <a href="/auth" className="text-sm font-medium hover:text-white transition-colors" style={{ color: 'rgb(180,180,180)' }}>
                  登录
                </a>
                <a
                  href="/auth"
                  className="px-5 py-2.5 text-sm font-semibold rounded-full transition-transform hover:scale-[1.03]"
                  style={{ background: 'rgb(238,238,238)', color: '#000' }}
                >
                  注册
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section：全宽画布，中间文案节点 + 四周素材节点 + 光流动连线 */}
      <main className="relative pt-28 pb-16">
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 'min(92vh, 780px)', minHeight: 560 }}
        >
          {/* 点阵背景：暗层 + 鼠标跟随发亮层 */}
          <div className="hero-dot-grid" />
          <div id="hero-dot-grid-bright" className="hero-dot-grid-bright" />

          {/* 连线层（光沿线流动） */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1600 780" preserveAspectRatio="none" style={{ zIndex: 2 }}>
            <path id="hero-line-1" d="M 260 190 Q 600 190 780 390" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" pathLength="1" />
            <path id="hero-line-2" d="M 1340 160 Q 1000 190 820 390" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" pathLength="1" />
            <path id="hero-line-3" d="M 300 610 Q 600 590 780 400" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" pathLength="1" />
            <path id="hero-line-4" d="M 1320 630 Q 1000 590 820 400" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" fill="none" pathLength="1" />
            <use href="#hero-line-1" className="hero-line-glow" stroke="rgb(238,238,238)" strokeWidth="2" fill="none" pathLength="1" style={{ animationDelay: '0s' }} />
            <use href="#hero-line-2" className="hero-line-glow" stroke="rgb(238,238,238)" strokeWidth="2" fill="none" pathLength="1" style={{ animationDelay: '0.7s' }} />
            <use href="#hero-line-3" className="hero-line-glow" stroke="rgb(238,238,238)" strokeWidth="2" fill="none" pathLength="1" style={{ animationDelay: '1.4s' }} />
            <use href="#hero-line-4" className="hero-line-glow" stroke="rgb(238,238,238)" strokeWidth="2" fill="none" pathLength="1" style={{ animationDelay: '2.1s' }} />
          </svg>

          {/* 中间文案节点 */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center px-6"
            style={{ zIndex: 3, width: 'min(640px, 88vw)' }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.12] mb-5" style={{ color: 'rgb(238,238,238)' }}>
              The AI workspace for <span className="hero-flow italic">infinite</span> creative flow.
            </h1>
            <p className="text-base md:text-lg mb-8 leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
              为无限创作流而生的 AI 工作空间。一个为高效团队打造的非线性画布，
              在你的工作流中直接与 AI 智能体协作。
            </p>
            <Link href="/canvas">
              <button
                className="px-8 py-3.5 rounded-full font-semibold text-sm transition-transform hover:scale-[1.03]"
                style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
              >
                立即创作
              </button>
            </Link>
          </div>

          {/* 四周素材节点卡片：左二图片(4:3)，右上视频(16:9)，右下竖版(9:14)，hover 放大 */}
          <div
            className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '18%', left: '10%', width: 'min(220px, 20vw)' }}
          >
            <span className="block mb-1.5 text-[12px] font-medium" style={{ color: 'rgb(160,160,160)' }}>产品设计</span>
            <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}>
              <img src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783578531053.jpg?quality=80" alt="产品设计" className="w-full h-full object-cover" draggable={false} />
            </div>
          </div>
          <div
            className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '62%', left: '7%', width: 'min(220px, 20vw)' }}
          >
            <span className="block mb-1.5 text-[12px] font-medium" style={{ color: 'rgb(160,160,160)' }}>角色设计</span>
            <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '4/3', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}>
              <img src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783579669557.jpg?quality=80" alt="角色设计" className="w-full h-full object-cover" draggable={false} />
            </div>
          </div>
          <div
            className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '12%', right: '9%', width: 'min(260px, 22vw)' }}
          >
            <span className="block mb-1.5 text-[12px] font-medium" style={{ color: 'rgb(160,160,160)' }}>视频生成</span>
            <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}>
              <video
                src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/videos/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/clip-1783582208638-tp8y4hee20l.mp4"
                className="w-full h-full object-cover"
                autoPlay muted loop playsInline
                preload="metadata"
              />
            </div>
          </div>
          <div
            className="absolute cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '58%', right: '9%', width: 'min(260px, 22vw)' }}
          >
            <span className="block mb-1.5 text-[12px] font-medium" style={{ color: 'rgb(160,160,160)' }}>分镜设计</span>
            <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}>
              <img src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783580645778.jpg?quality=80" alt="分镜设计" className="w-full h-full object-cover" draggable={false} />
            </div>
          </div>
        </div>

        {/* 信任标签行 */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5 mt-14 max-w-3xl mx-auto px-6">
          {['30+ AI 模型', '文生图', '文生视频', '角色设计', '分镜脚本', '无限画布节点'].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c', color: 'rgb(180,180,180)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 合作品牌 logo 行 */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-6 mt-10 max-w-4xl mx-auto px-6 opacity-60">
          <AlibabaCloud.Combine size={38} />
          <Microsoft.Combine size={38} />
          <Gemini.Combine size={38} />
          <BAAI.Combine size={38} />
          <ByteDance.BrandColor size={38} />
          <Adobe.Combine size={38} />
          <TencentCloud.Combine size={38} />
          <Fal.Combine size={38} />
          <Midjourney.Combine size={38} />
          <Minimax.Combine size={38} />
          <Aws.Color size={38} />
          <LongCat.Combine size={38} />
          <Jimeng.Combine size={38} />
          <NanoBanana.Combine size={38} />
        </div>
      </main>

      {/* 活动区：新模型上线倒计时(紧跟 Hero) */}
      <section className="py-24 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <UpcomingModels />
      </section>

      {/* 滚动缩放展示区(占位版，先验证交互效果) */}
      <ScrollZoomShowcase />

      {/* 业务模块：左侧点击切换 / 右侧预览联动 */}
      <section className="py-24 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <FeatureTabsShowcase />
      </section>

      {/* 顶尖模型展示 */}
      <section className="py-24 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <ModelsShowcase />
      </section>

      {/* 自带 API Key(BYOK)：官方原版模型 · 官方原价 */}
      <section className="py-24 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Bring Your Own Key</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
              官方原版模型，官方原价使用
            </h2>
            <p className="text-base max-w-2xl mx-auto leading-relaxed" style={{ color: 'rgb(150,150,150)' }}>
              连接你自己的官方 API 账户，直连模型官方提供的原版服务。
              模型费用直接支付给官方，Filmavo 不收取模型调用费。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {[
              { title: '官方直连', desc: '请求直达模型官方，不经中转，原版能力与画质' },
              { title: '费用透明', desc: '用量与账单在官方控制台，Filmavo 不加价、不抽成' },
              { title: '不限并发', desc: '用自己的账户额度，不受平台队列与并发限制' },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-6"
                style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
              >
                <h3 className="text-base font-semibold mb-2" style={{ color: 'rgb(228,228,228)' }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgb(150,150,150)' }}>{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-lg font-medium" style={{ color: 'rgb(210,210,210)' }}>
            把预算，留给创作
          </p>
        </div>
      </section>

      {/* 功能演示区：Sticky Scroll Showcase(左侧文案滚动/右侧sticky联动切换) */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <WorkflowScrollShowcase />
      </section>

      {/* 剧本工作室 · 重点功能介绍(左侧阶段点击/右侧大屏切换+自动轮播) */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Feature · 剧本工作室</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: 'rgb(238,238,238)' }}>
              从一个想法到一部可拍摄的电影
            </h2>
            <p className="text-base max-w-2xl mx-auto" style={{ color: 'rgb(150,150,150)' }}>
              点击左侧任一阶段，看它如何一步步产出——完整覆盖电影工业的每一道工序
            </p>
          </div>
          <ScriptStudioDemo />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 border-t border-white/5 relative z-10 bg-zinc-950/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl"></div>
            <div className="relative glass-card p-12 md:p-16 overflow-hidden">
              {/* 视频背景 */}
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/boluolab.com/hero.mp4"
              />
              {/* 内容叠在视频上 */}
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  Ready to start creating?
                </h2>
                <p className="text-xl text-zinc-500 mb-8">
                  准备开始创作了吗？
                </p>
                <p className="text-lg text-zinc-400 mb-10 max-w-2xl mx-auto">
                  Join thousands of creators using filmavo to bring their ideas to life with AI-powered workflows.
                </p>
                <p className="text-sm text-zinc-200 mb-10 max-w-2xl mx-auto">
                  加入数千名创作者，使用 filmavo 通过 AI 驱动的工作流将创意变为现实。
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/canvas">
                    <button className="px-10 py-5 rounded-full font-semibold btn-primary text-lg min-w-[240px] flex flex-col items-center">
                      <span>Get Started Free</span>
                      <span className="text-sm opacity-80">免费开始</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <img src="/filmavo-logo-primary.svg" alt="filmavo" className="h-8 w-auto" />
                <span className="font-semibold text-lg">Filmavo</span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
                The infinite canvas for AI-powered creative workflows.
              </p>
              <p className="text-xs text-zinc-600 mt-1">AI 驱动的无限创作画布</p>
            </div>
            {/* 有效链接 */}
            <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
              <a href="/pricing" className="hover:text-white transition-colors">定价</a>
              <a href="/boluotv" className="hover:text-white transition-colors">作品广场<span className="text-emerald-500">｜接单</span></a>
              <a href="/canvas" className="hover:text-white transition-colors">进入画布</a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-zinc-500">
              © 2026 Filmavo. All rights reserved. <span className="text-xs text-zinc-600">保留所有权利</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
