'use client';

import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../store';

export function DirectorDesk3DModal({ onClose }: { onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const addImageCard = useCanvasStore((s) => s.addImageCardWithRef);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 监听 3D 导演台 postMessage
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const { type, payload } = e.data ?? {};

      // 关闭
      if (type === 'storyai:director-desk-close') {
        onClose();
        return;
      }

      // 截图发送到画布（作为图片节点）
      if (type === 'storyai:director-desk-captures-sent' && payload?.captures?.length) {
        for (const cap of payload.captures) {
          if (cap.dataUrl) {
            // dataUrl → 直接作为图片节点插入画布
            addImageCard(cap.dataUrl, '', '');
          }
        }
        (window as any).saveCanvasV2Now?.();
        onClose();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onClose, addImageCard]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {/* 顶部栏 */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: '#111', borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>3D 导演台</span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#888', cursor: 'pointer',
            fontSize: 18, padding: '4px 8px', borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={e => (e.currentTarget.style.color = '#888')}
        >✕</button>
      </div>
      {/* iframe 加载 3D 导演台 */}
      <iframe
        ref={iframeRef}
        src="/director-desk/index.html"
        style={{ flex: 1, border: 'none', width: '100%' }}
        allow="accelerometer; gyroscope"
      />
    </div>
  );
}
