'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store';

export function DirectorDesk3DModal({ onClose }: { onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const addImageCard = useCanvasStore((s) => s.addImageCardWithRef);
  // 每次打开用新 key 强制 iframe 全新加载，避免 WebGL context 残留导致黑屏
  const [iframeKey] = useState(() => Date.now());

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 监听 3D 导演台 postMessage
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const { type, payload } = e.data ?? {};
      // 只处理 3D 导演台的消息（同域 iframe，按消息类型前缀过滤，不依赖 origin 精确匹配）
      if (typeof type !== 'string' || !type.startsWith('storyai:director-desk')) return;

      // 关闭
      if (type === 'storyai:director-desk-close') {
        onClose();
        return;
      }

      // 截图发送到画布（作为图片节点）
      if (type === 'storyai:director-desk-captures-sent' && payload?.captures?.length) {
        let added = 0;
        for (const cap of payload.captures) {
          if (cap?.dataUrl) {
            addImageCard(cap.dataUrl, '', '');
            added++;
          }
        }
        if (added > 0) {
          (window as any).saveCanvasV2Now?.();
          // 提示用户已发送
          alert(`已发送 ${added} 张截图到画布`);
        }
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
        key={iframeKey}
        ref={iframeRef}
        src="/director-desk/index.html"
        style={{ flex: 1, border: 'none', width: '100%' }}
        allow="accelerometer; gyroscope"
      />
    </div>
  );
}
