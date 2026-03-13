'use client';

import { useEffect } from 'react';
import { MEMBERSHIP_PRICE } from '@/lib/pricing';

interface MembershipModalProps {
  onClose: () => void;
  onPay: () => void;
}

export default function MembershipModal({ onClose, onPay }: MembershipModalProps) {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
    >
      <div
        className="relative w-[360px] rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-2xl"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* 关闭 */}
        <button
          className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
        >
          ✕
        </button>

        {/* 图标 */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3l14 9-14 9V3z" />
            </svg>
          </div>
        </div>

        <h2 className="text-center text-xl font-semibold text-white mb-1">解锁会员功能</h2>
        <p className="text-center text-sm text-white/50 mb-6">
          文本生成、角色设计、Prompt 优化需要会员才能使用
        </p>

        {/* 价格 */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 mb-6">
          <div className="flex items-end justify-between mb-3">
            <span className="text-white/60 text-sm">会员月付</span>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-white">¥{MEMBERSHIP_PRICE}</span>
              <span className="text-white/40 text-sm mb-1">/月</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-center gap-2">
              <span className="text-violet-400">✓</span> 无限使用文本卡片（大模型）
            </li>
            <li className="flex items-center gap-2">
              <span className="text-violet-400">✓</span> 角色设计 & Prompt 优化
            </li>
            <li className="flex items-center gap-2">
              <span className="text-violet-400">✓</span> 视频生成每秒少 ¥0.2
            </li>
          </ul>
        </div>

        {/* 按钮 */}
        <button
          className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-lg shadow-violet-500/20"
          onClick={onPay}
          onPointerDown={e => e.stopPropagation()}
        >
          立即开通 ¥{MEMBERSHIP_PRICE}/月
        </button>

        <p className="text-center text-xs text-white/30 mt-3">随时可取消，不自动续费</p>
        <p className="text-center text-xs text-white/50 mt-2 border border-white/10 rounded-lg py-1.5">按 ESC 键关闭</p>
      </div>
    </div>
  );
}
