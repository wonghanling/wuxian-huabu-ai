'use client';

import { useEffect } from 'react';

// ============================================================
// 顶部垂下的书签 + 群二维码面板
//
// 与首页活动弹窗共用同一个二维码入口:弹窗的"扫码进群领取"按钮也会打开
// 这个面板，所以状态由首页统一持有(open / onOpen / onClose)，避免两处
// 各维护一份而出现同时弹两层。
//
// 会员在后台手动续 —— 这里只展示二维码，不碰计费逻辑。
// ============================================================

/** 群二维码。换群时只改这一处 */
const QR_URL = 'https://filmavo.blob.core.windows.net/assets/images/wechat-group-qr.png';

export function GroupQrRibbon({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  // 面板遮住整屏，留 Esc 作退路
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* 顶部垂下的丝带。深底 + 细描边，与首页玻璃卡片同一套语言 ——
          不用高饱和渐变，那在这个深色首页上会显得廉价。
          底部尖角靠 clip-path 切出，像一枚真实书签。 */}
      <button
        onClick={onOpen}
        aria-label="扫码进群领会员"
        style={{
          position: 'fixed',
          top: 0,
          right: 'clamp(20px, 6vw, 96px)',
          zIndex: 60,
          width: 44,
          paddingTop: 13,
          paddingBottom: 22,
          border: 'none',
          background: 'linear-gradient(180deg, rgba(32,28,42,0.97) 0%, rgba(20,18,26,0.97) 100%)',
          boxShadow: '0 8px 28px -10px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(167,139,250,0.2)',
          clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 9px), 50% 100%, 0 calc(100% - 9px))',
          cursor: 'pointer',
          transition: 'padding-bottom .22s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.paddingBottom = '28px'; }}
        onMouseLeave={(e) => { e.currentTarget.style.paddingBottom = '22px'; }}
      >
        {/* 顶部一道细光，呼应首页各处的高光线 */}
        <span
          style={{
            position: 'absolute', top: 0, left: 6, right: 6, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(196,181,253,0.85), transparent)',
          }}
        />
        <span
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            lineHeight: 1.45,
            color: 'rgba(237,233,254,0.92)',
            writingMode: 'vertical-rl',
            textOrientation: 'upright',
            margin: '0 auto',
          }}
        >
          进群领会员
        </span>
      </button>

      {/* 二维码面板 */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(372px, 100%)',
              padding: '30px 26px 24px',
              borderRadius: 22,
              background: 'linear-gradient(145deg, #1a1523 0%, #18181b 60%, #1a1523 100%)',
              boxShadow: '0 0 0 1px rgba(139,92,246,0.42), 0 0 60px rgba(139,92,246,0.14), 0 28px 70px rgba(0,0,0,0.75)',
              textAlign: 'center',
            }}
          >
            {/* 顶部光晕线，与活动弹窗一致 */}
            <span
              style={{
                position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.9), rgba(99,102,241,0.9), rgba(167,139,250,0.9), transparent)',
              }}
            />

            <button
              onClick={onClose}
              aria-label="关闭"
              style={{
                position: 'absolute', top: 13, right: 13,
                width: 28, height: 28, borderRadius: '50%',
                border: 'none', background: 'rgba(0,0,0,0.45)',
                color: 'rgba(255,255,255,0.65)', fontSize: 13, cursor: 'pointer',
              }}
            >✕</button>

            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 7, letterSpacing: 0.2 }}>
              扫码进群，领 1 个月会员
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.48)', marginBottom: 20, lineHeight: 1.65 }}>
              进群后在群里说一声，我们为你手动开通
            </div>

            <div
              style={{
                width: 224, height: 224, margin: '0 auto',
                borderRadius: 14, background: '#fff', padding: 9,
                boxShadow: '0 10px 30px -12px rgba(0,0,0,0.6)',
              }}
            >
              <img
                src={QR_URL}
                alt="微信群二维码"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.34)', marginTop: 16, lineHeight: 1.6 }}>
              群满或二维码失效时，可联系客服获取新的
            </div>
          </div>
        </div>
      )}
    </>
  );
}
