'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PeekingBuddies } from '../_components/PeekingBuddies';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // 已登录用户显示提示
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (user) setAlreadyLoggedIn(true);
    });
  }, []);

  // 检查 Supabase 是否配置
  const isSupabaseConfigured = !!supabase;

  // 发送验证码
  const handleSendOTP = async () => {
    if (!isSupabaseConfigured) {
      setMessage('Supabase 未配置，请在 Vercel 设置环境变量');
      return;
    }

    if (!email) {
      setMessage('请输入邮箱');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: mode === 'signup',
        },
      });

      if (error) throw error;

      setOtpSent(true);
      setMessage('验证码已发送到您的邮箱');
    } catch (error: any) {
      setMessage(error.message || '发送验证码失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册（邮箱+密码+验证码）
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 未配置，请在 Vercel 设置环境变量');
      return;
    }

    if (!email || !password || !confirmPassword || !otp) {
      setMessage('请填写所有字段');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('两次密码不一致');
      return;
    }

    if (password.length < 6) {
      setMessage('密码至少6位');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      // 使用 OTP 验证并同时设置密码
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
        options: {
          // 验证成功后自动设置密码
          data: {
            password: password,
          },
        },
      });

      if (error) throw error;

      // 验证成功后，更新用户密码
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) throw updateError;

      setMessage('注册成功！正在跳转...');
      setTimeout(() => router.push('/?welcome=1'), 1500);
    } catch (error: any) {
      setMessage(error.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 未配置，请在 Vercel 设置环境变量');
      return;
    }

    if (!email || !password) {
      setMessage('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setMessage('登录成功！正在跳转...');
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setMessage(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证码登录
  const handleOTPLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured) {
      setMessage('Supabase 未配置，请在 Vercel 设置环境变量');
      return;
    }

    if (!email || !otp) {
      setMessage('请输入邮箱和验证码');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      setMessage('登录成功！正在跳转...');
      setTimeout(() => router.push('/'), 1500);
    } catch (error: any) {
      setMessage(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    // 左右各半分栏:左侧浅灰承载品牌与步骤说明，右侧纯白只放表单。
    // 用背景色差分区而非描边或网格 —— 网格线在白底上只会让页面显脏，
    // 原先那层淡灰网格已去掉。
    <div className="relative min-h-screen bg-white text-slate-900 overflow-hidden">

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/filmavo-logo-primary.svg" alt="filmavo" className="h-8 w-auto" />
            <span className="font-semibold text-lg tracking-tight">Filmavo</span>
          </Link>
        </div>
      </nav>

      {/* Main - 左右各半 */}
      <main className="relative pt-16 min-h-screen flex flex-col lg:flex-row">

        {/* 左侧:浅灰底承载品牌与步骤，怪物贴底探出 */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#f5f5f7] px-14 xl:px-20 pt-20 pb-0 relative">
          <div>
            <h1 className="text-[44px] xl:text-[52px] font-semibold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4">
              AI 驱动的<br />无限创作画布
            </h1>
            <p className="text-[#6e6e73] text-[15px] mb-14">
              AI-Powered Infinite Creative Canvas
            </p>

            {/* 编号步骤代替原先那四条功能卖点 —— 卖点是首页的事，
                这里说"接下来会发生什么"更贴合登录场景 */}
            <ol className="space-y-7">
              {[
                ['注册账号', '邮箱注册，无需信用卡'],
                ['选择业务', '无限画布 · AI 生图 · 创作接单'],
                ['开始创作', '数十种模型，按次计费'],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1d1d1f] text-white text-[12.5px] font-medium flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-[#1d1d1f] leading-6">{title}</span>
                    <span className="block text-[13px] text-[#86868b] mt-0.5">{desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* 怪物贴左栏底部 —— 下半身被容器裁掉，做"探出来看你"的姿态 */}
          <div className="mt-16">
            <PeekingBuddies />
          </div>
        </div>

        {/* 右侧 - 表单。纯白，与左侧浅灰形成分区 */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 lg:px-14">
          <div className="w-full max-w-[400px]">

            {/* 移动端 title（lg 以下显示） */}
            <div className="lg:hidden text-center mb-8">
              <div className="text-xs tracking-[0.3em] text-slate-500 font-semibold mb-2 uppercase">
                FILMAVO
              </div>
              <h2 className="text-2xl font-bold tracking-tight">AI 创作画布</h2>
            </div>

            {/* 已登录提示 */}
            {alreadyLoggedIn && (
              <div className="glass-card p-8 text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-green-400 text-xl">✓</span>
                </div>
                <h2 className="text-slate-900 font-bold text-lg mb-2">您已登录</h2>
                <p className="text-slate-400 text-sm mb-6">该账号已注册并登录，无需重复注册</p>
                <button
                  onClick={() => router.push('/canvas')}
                  className="w-full py-3 rounded-lg font-semibold btn-primary transition-all"
                >
                  进入画布 / Canvas
                </button>
                <Link href="/" className="block mt-3 text-slate-300 hover:text-slate-400 text-sm transition-colors">
                  返回首页 / Back to Home
                </Link>
              </div>
            )}

            {/* 未登录时显示表单 */}
            {!alreadyLoggedIn && (
            <>
            <div className="glass-card p-8">
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-8">
                <button
                  onClick={() => {
                    setMode('login');
                    setMessage('');
                    setOtpSent(false);
                  }}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    mode === 'login'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  登录 / Login
                </button>
                <button
                  onClick={() => {
                    setMode('signup');
                    setMessage('');
                    setOtpSent(false);
                  }}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    mode === 'signup'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  注册 / Sign up
                </button>
              </div>

              {/* Login Mode */}
              {mode === 'login' && (
                <>
                  {/* Login Method Toggle */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => {
                        setLoginMethod('password');
                        setMessage('');
                        setOtpSent(false);
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        loginMethod === 'password'
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      密码登录
                    </button>
                    <button
                      onClick={() => {
                        setLoginMethod('otp');
                        setMessage('');
                        setOtpSent(false);
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        loginMethod === 'otp'
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      验证码登录
                    </button>
                  </div>

                  {/* Password Login Form */}
                  {loginMethod === 'password' && (
                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          邮箱 / Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                          placeholder="your@email.com"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          密码 / Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                            placeholder="••••••••"
                            required
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showPassword
                              ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg font-semibold btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? '登录中...' : '登录 / Login'}
                      </button>
                    </form>
                  )}

                  {/* OTP Login Form */}
                  {loginMethod === 'otp' && (
                    <form onSubmit={handleOTPLogin} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          邮箱 / Email
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                            placeholder="your@email.com"
                            required
                          />
                          <button
                            type="button"
                            onClick={handleSendOTP}
                            disabled={loading || otpSent}
                            className="px-4 py-3 bg-slate-100 hover:bg-slate-900 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {otpSent ? '已发送' : '发送验证码'}
                          </button>
                        </div>
                      </div>

                      {otpSent && (
                        <div>
                          <label className="block text-sm font-medium text-slate-500 mb-2">
                            验证码 / OTP Code
                          </label>
                          <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                            placeholder="输入6位验证码"
                            required
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !otpSent}
                        className="w-full py-3 rounded-lg font-semibold btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? '登录中...' : '登录 / Login'}
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* Signup Mode */}
              {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">
                      邮箱 / Email
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                        placeholder="your@email.com"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={loading || otpSent}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-900 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {otpSent ? '已发送' : '发送验证码'}
                      </button>
                    </div>
                  </div>

                  {otpSent && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          验证码 / OTP Code
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                          placeholder="输入6位验证码"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          密码 / Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                            placeholder="至少6位密码"
                            required
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showPassword
                              ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-500 mb-2">
                          确认密码 / Confirm Password
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-slate-900 transition-all"
                            placeholder="再次输入密码"
                            required
                          />
                          <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                            {showConfirmPassword
                              ? <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                              : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            }
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !otpSent}
                    className="w-full py-3 rounded-lg font-semibold btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? '注册中...' : '注册 / Sign up'}
                  </button>
                </form>
              )}

              {/* Message */}
              {message && (
                <div
                  className={`mt-4 p-3 rounded-lg text-sm ${
                    message.includes('成功')
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  }`}
                >
                  {message}
                </div>
              )}
            </div>

            {/* Back to Home */}
            <div className="text-center mt-6">
              <a
                href="/"
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                ← 返回首页 / Back to Home
              </a>
            </div>
            </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
