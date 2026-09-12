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
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-900 overflow-hidden">
      {/* 背景装饰。
          原来用的全局 .infinite-grid / .orb 是给深色底设计的（亮线条 + 高亮光晕），
          放在白底上会发灰、发脏。那两个 class 首页还在用，不能改全局样式，
          所以这里换成本页自绘的浅色版：淡蓝网格 + 两团很轻的蓝色光斑。 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(37,99,235,.055) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(37,99,235,.055) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, #000 40%, transparent 100%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-12%', left: '-8%', width: 520, height: 520, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,.16) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-16%', right: '-6%', width: 460, height: 460, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,.13) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/filmavo-logo-primary.svg" alt="filmavo" className="h-8 w-auto" />
            <span className="font-semibold text-lg tracking-tight">Filmavo</span>
          </Link>
        </div>
      </nav>

      {/* Main - 左右分栏 */}
      <main className="relative pt-16 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-24 px-6 py-12">

        {/* 左侧 - 品牌 + 卖点（lg 以上显示） */}
        <div className="hidden lg:flex flex-1 flex-col relative z-10">
          <div>
            <div className="text-xs tracking-[0.4em] text-blue-600 font-semibold mb-6 uppercase">
              FILMAVO
            </div>
            <h1 className="text-5xl xl:text-6xl font-bold leading-[1.1] mb-5 tracking-tight">
              AI 驱动的<br />无限创作画布
            </h1>
            <p className="text-slate-500 text-base mb-8 tracking-wide">
              AI-Powered Infinite Creative Canvas
            </p>

            {/* 眼睛跟着鼠标转的小角色。放在卖点列表之前 —— 视线自上而下，
                先被这排动的东西吸住，再往下读文字 */}
            <div className="mb-11">
              <PeekingBuddies />
            </div>

            <ul className="space-y-4">
              <li className="flex items-center gap-4 text-slate-700">
                <span className="text-blue-500 text-lg">✦</span>
                <span className="text-[15px]">Seedance 2.0 图生视频</span>
              </li>
              <li className="flex items-center gap-4 text-slate-700">
                <span className="text-blue-500 text-lg">✦</span>
                <span className="text-[15px]">角色设计 / 故事板</span>
              </li>
              <li className="flex items-center gap-4 text-slate-700">
                <span className="text-blue-500 text-lg">✦</span>
                <span className="text-[15px]">实时协作画布</span>
              </li>
              <li className="flex items-center gap-4 text-slate-700">
                <span className="text-blue-500 text-lg">✦</span>
                <span className="text-[15px]">AI 助手对话</span>
              </li>
            </ul>
            <p className="mt-16 text-xs text-slate-400 tracking-wide">
              © 2026 Filmavo · 一站式 AI 创作平台
            </p>
          </div>
        </div>

        {/* 右侧 - 表单 */}
        <div className="w-full lg:w-[420px] flex-shrink-0 relative z-10">
          <div className="w-full">

            {/* 移动端 title（lg 以下显示） */}
            <div className="lg:hidden text-center mb-8">
              <div className="text-xs tracking-[0.3em] text-blue-600 font-semibold mb-2 uppercase">
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
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
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
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
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
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
                            placeholder="your@email.com"
                            required
                          />
                          <button
                            type="button"
                            onClick={handleSendOTP}
                            disabled={loading || otpSent}
                            className="px-4 py-3 bg-slate-100 hover:bg-blue-600 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
                        placeholder="your@email.com"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        disabled={loading || otpSent}
                        className="px-4 py-3 bg-slate-100 hover:bg-blue-600 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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
                            className="w-full px-4 py-3 pr-11 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-all"
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

        </div>
      </main>
    </div>
  );
}
