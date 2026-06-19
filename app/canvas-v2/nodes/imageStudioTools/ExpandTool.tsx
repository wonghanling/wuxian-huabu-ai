'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// Expand 扩图工具 — 选目标比例，自动扩边补全内容
// 无需涂抹，只有比例选择器 + 生成按钮
// 后端用 fal-ai/bria/expand（专为 aspect_ratio 扩图设计）
// ============================================================

const RATIOS = [
  { label: '16:9 横版', value: '16:9', desc: '视频封面、横幅广告' },
  { label: '9:16 竖版', value: '9:16', desc: '手机壁纸、短视频封面' },
  { label: '1:1 方形', value: '1:1', desc: '社交媒体帖子' },
  { label: '4:3', value: '4:3', desc: '传统横版' },
  { label: '3:4', value: '3:4', desc: '传统竖版' },
  { label: '2:1 超宽', value: '2:1', desc: '横幅、海报' },
  { label: '3:2', value: '3:2', desc: '摄影标准比例' },
];

export function ExpandTool(ctx: ToolContext) {
  const { imageUrl, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const [ratio, setRatio] = useState('16:9');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setError('');
    setBusy(true);
    setGenerating(true);
    try {
      const userId = await getUserId();
      // 调 /api/design/edit，mode=expand，传 ratio
      const res = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: '',   // expand 不需要 prompt
          mode: 'expand',
          provider: 'fal',
          ratio,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '扩图失败');

      // 异步轮询 fal-query
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
        if (attempts > 60) throw new Error('扩图超时');
        return poll();
      };

      const newUrl = await poll();
      pushVersion(newUrl);
    } catch (e: any) {
      setError(e.message || '扩图失败');
    } finally {
      setBusy(false);
      setGenerating(false);
    }
  };

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={lbl}>目标比例</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RATIOS.map((r) => (
            <button
              key={r.value}
              onClick={() => setRatio(r.value)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid ' + (ratio === r.value ? 'rgba(45,140,90,0.5)' : 'rgba(0,0,0,0.1)'),
                background: ratio === r.value ? 'rgba(45,140,90,0.08)' : '#fff',
                color: ratio === r.value ? '#2d8c5a' : '#18181b',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: ratio === r.value ? 600 : 400 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>{r.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f4f4f5', fontSize: 12, color: '#52525b', lineHeight: 1.6 }}>
        原图会居中放置在新画布中，周围空白区域由 AI 自动补全内容。
      </div>

      <button onClick={handleGenerate} disabled={busy} style={genBtn(busy)}>
        {generating ? '扩图中…' : `扩图至 ${ratio}（0.3元/次）`}
      </button>
    </div>,
    panelSlot
  );

  return <>{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 8, fontWeight: 500 };
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b', color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
