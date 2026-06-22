'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { extractImage, getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// Extract 抠图工具 — 一键去背景，输出透明 PNG
// 使用 fal-ai/birefnet，无需涂抹无需 prompt
// ============================================================

export function ExtractTool(ctx: ToolContext) {
  const { imageUrl, panelSlot, busy, setBusy, pushVersion, setError } = ctx;
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setError('');
    setDone(false);
    setBusy(true);
    try {
      const userId = await getUserId();
      const newUrl = await extractImage({ imageUrl, userId });
      pushVersion(newUrl);
      setDone(true);
    } catch (e: any) {
      setError(e.message || '抠图失败');
    } finally {
      setBusy(false);
    }
  };

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f0f9ff', border: '1px solid rgba(14,165,233,0.2)', fontSize: 12, color: '#0c4a6e', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>一键抠图</div>
        AI 自动识别主体，移除背景，输出透明 PNG。
        适合产品图、人物、Logo 等需要去背景的场景。
      </div>

      {done && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, color: '#14532d' }}>
          ✓ 抠图完成，透明 PNG 已保存到版本历史
        </div>
      )}

      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '抠图中…' : '一键抠图（免费）'}
      </button>

      <p style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
        使用 BiRefNet V2 模型，边缘细节精准，支持复杂发丝抠图。
      </p>
    </div>,
    panelSlot
  );

  return <>{panel}</>;
}

const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
