'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const supabase = createClient();

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
      // 先验证 OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      // OTP 验证成功后，使用密码注册
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      setMessage('注册成功！正在跳转...');
      setTimeout(() => router.push('/canvas'), 1500);
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
      setTimeout(() => router.push('/canvas'), 1500);
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
      setTimeout(() => router.push('/canvas'), 1500);
    } catch (error: any) {
      setMessage(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white overflow-hidden">
      {/* Animated Grid Background */}
      <div className="infinite-grid absolute inset-0 opacity-50" />

      {/* Glowing Orbs */}
      <div className="orb orb-blue" />
      <div className="orb orb-purple" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo-transparent.png" alt="BOLUO.1971" className="w-8 h-8" />
            <span className="font-semibold text-lg tracking-tight">BOLUO.1971</span>
          </Link>
        </div>
      </nav>

      {/* Auth Form */}
      <main className="relative pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-screen">
        <div className="relative z-10 w-full max-w-md">
          {/* Glass Card */}
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
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white'
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
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    验证码登录
                  </button>
                </div>

                {/* Password Login Form */}
                {loginMethod === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        邮箱 / Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="your@email.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        密码 / Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="••••••••"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? '登录中...' : '登录 / Login'}
                    </button>
                  </form>
                )}

                {/* OTP Login Form */}
                {loginMethod === 'otp' && (
                  <form onSubmit={handleOTPLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        邮箱 / Email
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="your@email.com"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          disabled={loading || otpSent}
                          className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {otpSent ? '已发送' : '发送验证码'}
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">
                          验证码 / OTP Code
                        </label>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="输入6位验证码"
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !otpSent}
                      className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    邮箱 / Email
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                      placeholder="your@email.com"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={loading || otpSent}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {otpSent ? '已发送' : '发送验证码'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        验证码 / OTP Code
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="输入6位验证码"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        密码 / Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="至少6位密码"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">
                        确认密码 / Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="再次输入密码"
                        required
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading || !otpSent}
                  className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← 返回首页 / Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
