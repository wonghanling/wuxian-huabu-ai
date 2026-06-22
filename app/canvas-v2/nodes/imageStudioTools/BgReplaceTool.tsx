'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// Background Replace 换背景工具
// 不需要涂抹，传图 + 背景描述 → 一步换背景
// 使用 fal-ai/bria/product-shot（专为产品/人像换背景设计）
// ============================================================

const EXAMPLES = [
  '简洁白色展台，专业产品摄影',
  '海边沙滩，自然阳光',
  '高端奢华展厅，大理石地板',
  '森林绿植背景，自然清新',
  '城市夜景，霓虹灯光',
  '纯白背景，电商标准拍摄',
  '咖啡馆木质桌面，温暖氛围',
];

export function BgReplaceTool(ctx: ToolContext) {
  const { imageUrl, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const [scene, setScene] = useState('');

  const handleGenerate = async () => {
    setError('');
    if (!scene.trim()) { setError('请描述新背景'); return; }
    setBusy(true);
    try {
      const userId = await getUserId();
      const res = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: scene.trim(),
          mode: 'bg-replace',
          provider: 'fal',
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '换背景失败');

      const { requestId, endpoint } = data;
      if (!requestId) throw new Error('未返回 requestId');
      let attempts = 0;
      const poll = async (): Promise<string> => {
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
        const qData = await qRes.json();
        if (qData.success && qData.imageUrl) return qData.imageUrl;
        if (qData.error) throw new Error(qData.error);
        if (attempts > 60) throw new Error('换背景超时');
        return poll();
      };
      const newUrl = await poll();
      pushVersion(newUrl);
    } catch (e: any) {
      setError(e.message || '换背景失败');
    } finally {
      setBusy(false);
    }
  };

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid rgba(34,197,94,0.15)', fontSize: 12, color: '#14532d', lineHeight: 1.6 }}>
        AI 自动识别主体，替换背景。无需涂抹选区。
      </div>

      <div>
        <div style={lbl}>新背景描述</div>
        <textarea
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          placeholder="例如：简洁白色展台，专业产品摄影"
          rows={3}
          style={textarea}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setScene(ex)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                border: '1px solid rgba(0,0,0,0.1)', background: '#f4f4f5', color: '#52525b',
              }}
            >{ex}</button>
          ))}
        </div>
      </div>

      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {busy ? '换背景中…' : '换背景（0.3元/次）'}
      </button>

      <p style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 1.6, margin: 0 }}>
        适合产品图、人像、素材图换背景。支持中文描述。
      </p>
    </div>,
    panelSlot
  );

  return <>{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const textarea: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: 10, color: '#18181b', fontSize: 13, resize: 'vertical', outline: 'none',
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
