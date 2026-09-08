'use client';

import { useEffect, useState } from 'react';

// ============================================================
// 转存失败提示
//
// 生成结果的原始地址是上游给的临时签名 URL(火山引擎等给 7 天)，必须转存到
// 自己的 Storage 才是永久地址。转存失败时原先只 console.warn 静默带过——
// 用户当时看图正常、以为已保存，一周后打开画布发现作品变成
// "Request has expired"，而且从头到尾没有任何提示。
//
// 这个组件监听 mirror-failed 事件把这件事说出来，让用户当场就能重新生成
// 或另存，而不是一周后才发现丢了。
//
// 纯新增:不改动任何生成流程，只是把已经发生的失败显示出来。
// ============================================================

export function MirrorFailToast() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onFail = () => {
      setCount((c) => c + 1);
      setVisible(true);
    };
    window.addEventListener('mirror-failed', onFail as EventListener);
    return () => window.removeEventListener('mirror-failed', onFail as EventListener);
  }, []);

  // 不自动消失 —— 这是数据可能丢失的警告，值得用户主动确认看到了
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        maxWidth: 460,
        padding: '12px 16px',
        borderRadius: 12,
        background: 'rgba(30,20,10,0.96)',
        border: '1px solid rgba(251,191,36,0.4)',
        boxShadow: '0 12px 32px -8px rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 16, lineHeight: '20px', color: '#fbbf24' }}>!</span>
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          有 {count} 个生成结果未能永久保存
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)' }}>
          这些作品的地址由模型方临时提供，数天后会失效。建议重新生成，
          或右键图片另存到本地。
        </div>
      </div>
      <button
        onClick={() => { setVisible(false); setCount(0); }}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'rgba(255,255,255,0.45)',
          fontSize: 16,
          cursor: 'pointer',
          lineHeight: '18px',
          padding: 0,
        }}
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}
