'use client';

import Link from 'next/link';
import { Infinity, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { TemplateGallery } from './_components/TemplateGallery';
import { ScrollZoomShowcase } from './_components/ScrollZoomShowcase';
import { ModelsShowcase } from './_components/ModelsShowcase';
import { FeatureTabsShowcase } from './_components/FeatureTabsShowcase';
import { VideoModelsShowcase } from './_components/VideoModelsShowcase';
import { ScriptStudioDemo } from './_components/ScriptStudioDemo';
import { DoodleDemo } from './_components/DoodleDemo';
import { JsonConfigDemo } from './_components/JsonConfigDemo';
import { ShotboardDemo } from './_components/ShotboardDemo';
import { TryOnDemo } from './_components/TryOnDemo';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoSlide, setPromoSlide] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
    <div className="relative bg-[#09090b] text-white overflow-hidden">

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

            {/* 轮播图区域 */}
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div style={{
                display: 'flex', width: '400%', height: '100%',
                transform: `translateX(${-promoSlide * 25}%)`,
                transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)',
              }}>
                {[
                  'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/boluolab.com/huodongchuangkou1.webp',
                  '/xuanchuantanchuang1.webp',
                  '/xuanchuantanchuang2.webp',
                  '/xuanchuantanchuang3.webp',
                ].map((src, i) => (
                  <img key={i} src={src} alt={`宣传图${i + 1}`}
                    style={{ width: '25%', height: '100%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ))}
              </div>
              {promoSlide > 0 && (
                <button onClick={e => { e.stopPropagation(); setPromoSlide(s => s - 1); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white text-xl transition-all">‹</button>
              )}
              {promoSlide < 3 && (
                <button onClick={e => { e.stopPropagation(); setPromoSlide(s => s + 1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white text-xl transition-all">›</button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {[0, 1, 2, 3].map(i => (
                  <button key={i} onClick={e => { e.stopPropagation(); setPromoSlide(i); }}
                    style={{
                      width: promoSlide === i ? 20 : 6, height: 6, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                      background: promoSlide === i ? 'rgba(167,139,250,1)' : 'rgba(255,255,255,0.35)',
                      transition: 'all 0.3s',
                    }} />
                ))}
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
            <img src="/boluo-logo-nav.svg" alt="Boluolab" className="h-7 w-auto" />
            <span className="font-semibold text-base tracking-tight" style={{ color: 'rgb(238,238,238)' }}>Boluolab</span>
          </div>

          <div className="hidden md:flex items-center space-x-10 text-sm font-medium" style={{ color: 'rgb(180,180,180)' }}>
            <a href="/boluotv" className="transition-colors hover:text-white" style={{ color: 'rgb(180,180,180)' }}>
              作品广场
            </a>
            <a href="#" className="hover:text-white transition-colors">平台</a>
            <a href="#" className="hover:text-white transition-colors">案例展示</a>
            <a href="#" className="hover:text-white transition-colors">企业版</a>
            <a href="#pricing" className="hover:text-white transition-colors">定价</a>
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
            className="absolute rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '18%', left: '10%', width: 'min(220px, 20vw)', aspectRatio: '4/3', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
          >
            <div className="w-full h-full" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))' }} />
            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgb(238,238,238)', backdropFilter: 'blur(4px)' }}>海报设计</span>
          </div>
          <div
            className="absolute rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '62%', left: '7%', width: 'min(220px, 20vw)', aspectRatio: '4/3', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
          >
            <div className="w-full h-full" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))' }} />
            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgb(238,238,238)', backdropFilter: 'blur(4px)' }}>角色设计</span>
          </div>
          <div
            className="absolute rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '12%', right: '9%', width: 'min(260px, 22vw)', aspectRatio: '16/9', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
          >
            <div className="w-full h-full" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))' }} />
            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgb(238,238,238)', backdropFilter: 'blur(4px)' }}>视频生成</span>
          </div>
          <div
            className="absolute rounded-2xl overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-110 hover:z-20"
            style={{ zIndex: 2, top: '58%', right: '11%', width: 'min(170px, 16vw)', aspectRatio: '9/14', background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
          >
            <div className="w-full h-full" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))' }} />
            <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: 'rgba(0,0,0,0.6)', color: 'rgb(238,238,238)', backdropFilter: 'blur(4px)' }}>分镜脚本</span>
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
      </main>

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

      {/* 视频模型展示 */}
      <section className="py-24 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <VideoModelsShowcase />
      </section>

      {/* Workflow Templates Gallery */}
      <div id="workflow-templates">
        <TemplateGallery />
      </div>

      {/* 剧本工作室 · 重点功能介绍 */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Feature · 核心功能</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>剧本工作室</h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'rgb(180,180,180)' }}>
              从一个想法到一部可拍摄的电影,完整覆盖电影工业的每一道工序。点击下方任一阶段,看看它能产出什么。
            </p>
          </div>

          {/* 交互式演示:点击阶段切换右侧屏幕 */}
          <div className="reveal mb-12">
            <ScriptStudioDemo />
          </div>

          <div className="flex flex-col items-center gap-5 reveal">
            <div className="flex flex-wrap justify-center gap-3">
              {['资产连续性管理', '场景多视角', '服装装备表', '镜头级提示词', '一键发送到画布'].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 text-xs rounded-full font-medium"
                  style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c', color: 'rgb(180,180,180)' }}
                >{tag}</span>
              ))}
            </div>
            <Link href="/canvas?studio=true">
              <button
                className="px-8 py-3.5 rounded-full font-semibold text-sm transition-transform hover:scale-[1.03]"
                style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
              >
                进入剧本工作室 →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 涂鸦标注 · 功能介绍 */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <DoodleDemo />
        </div>
      </section>

      {/* JSON 配置 · 功能介绍 */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <JsonConfigDemo />
        </div>
      </section>

      {/* 分镜设计 Step2+Step4 · 功能介绍 */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <ShotboardDemo />
        </div>
      </section>

      {/* 角色换衣(虚拟试衣)· 功能介绍 */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <TryOnDemo />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 reveal">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Features · 核心能力</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
              你所需要的一切创作工具
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div
              className="rounded-2xl p-8 transition-all duration-300"
              style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(113,208,131,0.1)' }}>
                <Infinity className="w-6 h-6" style={{ color: 'rgb(113,208,131)' }} />
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'rgb(238,238,238)' }}>无限画布</h3>
              <p className="leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                为你的创意提供无限空间。自由拖拽、缩放，无边界地组织你的创作流程。
              </p>
            </div>

            {/* Feature 2 */}
            <div
              className="rounded-2xl p-8 transition-all duration-300"
              style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(113,208,131,0.1)' }}>
                <Sparkles className="w-6 h-6" style={{ color: 'rgb(113,208,131)' }} />
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'rgb(238,238,238)' }}>AI 驱动的卡片</h3>
              <p className="leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                每张卡片都是独立的 AI 智能体。使用自定义模型和参数生成图片、视频和内容。
              </p>
            </div>

            {/* Feature 3 */}
            <div
              className="rounded-2xl p-8 transition-all duration-300"
              style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ background: 'rgba(113,208,131,0.1)' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="rgb(113,208,131)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'rgb(238,238,238)' }}>卡片级控制</h3>
              <p className="leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                每张卡片独立选择模型、参数和执行方式。无全局设置，完全自治。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Card Types Section */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 reveal">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Card Types · 卡片类型</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
              强大的卡片类型
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '/book-business-guidelines-svgrepo-com.svg', name: '文本卡', desc: '撰写提示词与剧本' },
              { icon: '/juese-halloween-typical-character-bandaged-outline-svgrepo-com.svg', name: '角色卡', desc: '创建细节丰富的角色' },
              { icon: '/tupian-landscape-png-svgrepo-com.svg', name: '图片生成', desc: '文本转图片，AI 驱动' },
              { icon: '/jingtou-film-svgrepo-com.svg', name: '多镜头', desc: '多角度镜头一次生成' },
              { icon: '/jiandao-svgrepo-com.svg', name: '裁剪卡', desc: '裁剪与调整图片尺寸' },
              { icon: '/bianhuanka-camera-svgrepo-com.svg', name: '变换卡', desc: '旋转、缩放与翻转' },
              { icon: '/shipingshengchen-camera-filled-svgrepo-com.svg', name: '视频生成', desc: '创建 AI 视频' },
              { icon: '/zijing-svgrepo-com.svg', name: '资产卡', desc: '管理你的创作资产' },
            ].map((card) => (
              <div
                key={card.name}
                className="p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
              >
                <div className="w-8 h-8 mb-3">
                  <img src={card.icon} alt={card.name} className="w-full h-full" />
                </div>
                <h4 className="font-semibold mb-1" style={{ color: 'rgb(238,238,238)' }}>{card.name}</h4>
                <p className="text-sm" style={{ color: 'rgb(150,150,150)' }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 reveal">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>How it works · 工作原理</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>
              三步完成一次创作
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', title: '拖拽卡片', desc: '从卡片库中选择并拖拽到无限画布上。每张卡片都是你创作流程的构建模块。' },
              { n: '2', title: '配置与连接', desc: '为每张卡片设置专属的 AI 模型、参数和输入。连接卡片以引用其他卡片的输出。' },
              { n: '3', title: '运行与创作', desc: '点击任意卡片的运行按钮独立执行。结果直接显示在卡片上，随时用于下一步创作。' },
            ].map((step) => (
              <div key={step.n} className="relative">
                <div
                  className="absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'rgb(20,20,20)', border: '1px solid #ffffff2e' }}
                >
                  <span className="text-lg font-bold" style={{ color: 'rgb(113,208,131)' }}>{step.n}</span>
                </div>
                <div
                  className="rounded-2xl p-8 pt-12"
                  style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
                >
                  <h3 className="text-xl font-semibold mb-3" style={{ color: 'rgb(238,238,238)' }}>{step.title}</h3>
                  <p className="leading-relaxed" style={{ color: 'rgb(180,180,180)' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div
            className="relative rounded-3xl p-12 md:p-16 overflow-hidden"
            style={{ background: 'rgb(26,26,26)', border: '1px solid #ffffff1c' }}
          >
            {/* 视频背景 */}
            <video
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              src="https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/boluolab.com/hero.mp4"
            />
            {/* 内容叠在视频上 */}
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-5" style={{ color: 'rgb(238,238,238)' }}>
                准备开始创作了吗？
              </h2>
              <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'rgb(180,180,180)' }}>
                加入数千名创作者，使用 Boluolab 通过 AI 驱动的工作流将创意变为现实。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/canvas">
                  <button
                    className="px-10 py-4 rounded-full font-semibold text-lg transition-transform hover:scale-[1.03]"
                    style={{ background: 'rgb(113,208,131)', color: '#04170a' }}
                  >
                    免费开始
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 reveal">
            <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: 'rgb(96,96,96)' }}>Pricing · 定价</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: 'rgb(238,238,238)' }}>简单透明的定价</h2>
            <p className="text-lg" style={{ color: 'rgb(180,180,180)' }}>按需付费，无隐藏费用</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {/* 免费用户 */}
            <div className="rounded-2xl overflow-hidden flex flex-col bg-[#0d0d0f]" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="px-5 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-zinc-300" style={{ background: 'rgba(255,255,255,0.08)' }}>
                免费
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-3xl font-bold text-white mb-1">¥0</div>
                <div className="text-zinc-500 text-xs mb-5">注册即用</div>
                <ul className="space-y-2 text-sm text-zinc-400 mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-zinc-600 text-xs">✓</span> 无限画布创作</li>
                  <li className="flex items-center gap-2"><span className="text-zinc-600 text-xs">✓</span> 图片生成 ¥0.3–1.5</li>
                  <li className="flex items-center gap-2"><span className="text-zinc-600 text-xs">✓</span> 视频生成普通价</li>
                  <li className="flex items-center gap-2"><span className="text-zinc-600 text-xs">✗</span> 文本卡片 / 角色设计</li>
                  <li className="flex items-center gap-2"><span className="text-zinc-600 text-xs">✗</span> Prompt 优化</li>
                </ul>
                <a href="/auth" className="block w-full py-2.5 rounded-lg border border-white/12 text-white/60 text-sm font-medium text-center hover:bg-white/5 transition-all">
                  免费注册
                </a>
              </div>
            </div>

            {/* 月套餐 — 紫色 */}
            <div className="rounded-2xl overflow-hidden flex flex-col bg-[#0d0d0f]" style={{ border: '1px solid #8b5cf6' }}>
              <div className="px-5 py-2.5 flex items-center justify-between text-white" style={{ background: '#8b5cf6' }}>
                <span className="text-xs font-bold uppercase tracking-widest">月套餐</span>
                <span className="text-xs font-bold">推荐</span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-3xl font-bold text-white mb-0.5">¥39</div>
                <div className="text-zinc-500 text-xs mb-5">/月 · 不自动续费</div>
                <ul className="space-y-2 text-sm text-zinc-300 mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-violet-400 text-xs">✓</span> 无限文本大模型</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400 text-xs">✓</span> 导演引擎功能</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400 text-xs">✓</span> 视频生成每秒省 ¥0.2</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400 text-xs">✓</span> 设计师专业工具</li>
                </ul>
                <button onClick={() => handlePay('membership', 39)}
                  className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all">
                  立即开通
                </button>
              </div>
            </div>

            {/* 年套餐 — 蓝色 */}
            <div className="rounded-2xl overflow-hidden flex flex-col bg-[#0d0d0f]" style={{ border: '1px solid #3b82f6' }}>
              <div className="px-5 py-2.5 flex items-center justify-between text-white" style={{ background: '#3b82f6' }}>
                <span className="text-xs font-bold uppercase tracking-widest">年套餐</span>
                <span className="text-xs font-bold">省 ¥9/月</span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-3xl font-bold text-white mb-0.5">¥459</div>
                <div className="text-zinc-500 text-xs mb-1">/年 · ≈ ¥38.25/月</div>
                <div className="text-zinc-600 text-xs line-through mb-4">原价 ¥468</div>
                <ul className="space-y-2 text-sm text-zinc-300 mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-blue-400 text-xs">✓</span> 月套餐全部权益</li>
                  <li className="flex items-center gap-2"><span className="text-blue-400 text-xs">✓</span> 年费专属优先服务</li>
                  <li className="flex items-center gap-2"><span className="text-blue-400 text-xs">✓</span> 新功能优先体验</li>
                  <li className="flex items-center gap-2"><span className="text-blue-400 text-xs">✓</span> 一次付清省钱</li>
                </ul>
                <button onClick={() => handlePay('membership_yearly', 459)}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all">
                  立即开通
                </button>
              </div>
            </div>

            {/* 两年套餐 — 绿色 */}
            <div className="rounded-2xl overflow-hidden flex flex-col bg-[#0d0d0f]" style={{ border: '1px solid #10b981' }}>
              <div className="px-5 py-2.5 flex items-center justify-between text-white" style={{ background: '#10b981' }}>
                <span className="text-xs font-bold uppercase tracking-widest">两年套餐</span>
                <span className="text-xs font-bold">最划算</span>
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="text-3xl font-bold text-white mb-0.5">¥899</div>
                <div className="text-zinc-500 text-xs mb-1">/两年 · ≈ ¥37.42/月</div>
                <div className="text-zinc-600 text-xs line-through mb-4">原价 ¥936</div>
                <ul className="space-y-2 text-sm text-zinc-300 mb-6 flex-1">
                  <li className="flex items-center gap-2"><span className="text-emerald-400 text-xs">✓</span> 年套餐全部权益</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400 text-xs">✓</span> 两年锁定最低价</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400 text-xs">✓</span> 专属客服支持</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400 text-xs">✓</span> 未来功能永久享</li>
                </ul>
                <button onClick={() => handlePay('membership_2yearly', 899)}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all">
                  立即开通
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 relative z-10" style={{ borderTop: '1px solid #ffffff0d' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <img src="/boluo-logo-nav.svg" alt="Boluolab" className="h-8 w-auto" />
                <span className="font-semibold text-lg" style={{ color: 'rgb(238,238,238)' }}>Boluolab</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgb(150,150,150)' }}>
                AI 驱动的无限创作画布
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4 text-sm" style={{ color: 'rgb(238,238,238)' }}>产品</h4>
              <ul className="space-y-3 text-sm" style={{ color: 'rgb(150,150,150)' }}>
                <li><a href="#" className="hover:text-white transition-colors">功能</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">定价</a></li>
                <li><a href="#" className="hover:text-white transition-colors">路线图</a></li>
                <li><a href="#" className="hover:text-white transition-colors">更新日志</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold mb-4 text-sm" style={{ color: 'rgb(238,238,238)' }}>资源</h4>
              <ul className="space-y-3 text-sm" style={{ color: 'rgb(150,150,150)' }}>
                <li><a href="#" className="hover:text-white transition-colors">文档</a></li>
                <li><a href="#" className="hover:text-white transition-colors">教程</a></li>
                <li><a href="#workflow-templates" className="hover:text-white transition-colors">模板</a></li>
                <li><a href="#" className="hover:text-white transition-colors">社区</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-sm" style={{ color: 'rgb(238,238,238)' }}>公司</h4>
              <ul className="space-y-3 text-sm" style={{ color: 'rgb(150,150,150)' }}>
                <li><a href="#" className="hover:text-white transition-colors">关于</a></li>
                <li><a href="#" className="hover:text-white transition-colors">博客</a></li>
                <li><a href="#" className="hover:text-white transition-colors">招聘</a></li>
                <li><a href="#" className="hover:text-white transition-colors">联系</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: '1px solid #ffffff0d' }}>
            <p className="text-sm" style={{ color: 'rgb(96,96,96)' }}>
              © 2026 Boluolab. 保留所有权利
            </p>
            <div className="flex items-center space-x-6 text-sm" style={{ color: 'rgb(96,96,96)' }}>
              <a href="#" className="hover:text-white transition-colors">隐私</a>
              <a href="#" className="hover:text-white transition-colors">条款</a>
              <a href="#" className="hover:text-white transition-colors">Cookie</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
