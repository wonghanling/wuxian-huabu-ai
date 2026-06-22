'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getUserId } from '../../lib/api';
import type { ToolContext } from './types';

// ============================================================
// 海报文字编辑工具 — fal-ai/ideogram/v3/layerize-text
// 流程：上传有文字的海报 → AI 拆层（背景 + 文字结构）
//       → 前端显示可编辑文字框 → 可 AI 翻译 → 合成导出
// ============================================================

interface TextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  font_size?: number;
  color?: { r: number; g: number; b: number };
}

interface TextItem {
  spans: TextSpan[];
}

interface TextContainer {
  type?: string;       // h1 / h2 / body / small
  items: TextItem[];
  x?: number;          // 0-1 比例坐标
  y?: number;
  width?: number;
  height?: number;
  text_align?: string;
  color?: { r: number; g: number; b: number };
  font_size?: number;
}

interface LayerizeResult {
  backgroundUrl: string;
  textContainers: TextContainer[];
  textHtml: string;
}

// 把 textContainers 里的文字全部提取成可编辑的字符串数组
function extractTexts(containers: TextContainer[]): string[] {
  return containers.map((c) =>
    c.items.map((item) => item.spans.map((s) => s.text).join('')).join('\n')
  );
}

export function TextLayerTool(ctx: ToolContext) {
  const { imageUrl, panelSlot, busy, setBusy, pushVersion, setError } = ctx;

  const [step, setStep] = useState<'idle' | 'layerizing' | 'editing' | 'compositing'>('idle');
  const [result, setResult] = useState<LayerizeResult | null>(null);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);
  const [translating, setTranslating] = useState(false);
  const compositeRef = useRef<HTMLCanvasElement>(null);

  // 图片变化时重置
  useEffect(() => {
    setStep('idle');
    setResult(null);
    setEditedTexts([]);
  }, [imageUrl]);

  // Step 1: 提交 layerize-text
  const handleLayerize = async () => {
    setError('');
    setBusy(true);
    setStep('layerizing');
    try {
      const userId = await getUserId();
      const res = await fetch('/api/design/layerize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '拆层失败');

      const { requestId, endpoint } = data;
      if (!requestId) throw new Error('未返回 requestId');

      // 轮询 fal-query
      let attempts = 0;
      const poll = async (): Promise<any> => {
        attempts++;
        await new Promise((r) => setTimeout(r, 3000));
        const qRes = await fetch(
          `/api/image/fal-query?requestId=${encodeURIComponent(requestId)}&endpoint=${encodeURIComponent(endpoint)}`
        );
        const qData = await qRes.json();
        // 504 下游不可用 — fal 服务问题，给用户友好提示
        if (qData.error && qData.error.includes('504')) {
          throw new Error('fal.ai 服务暂时不可用，请稍后重试');
        }
        if (qData.error && qData.error.includes('downstream')) {
          throw new Error('AI 服务暂时不可用，请稍后重试');
        }
        if (qData.error) throw new Error(qData.error);
        if (qData.success && qData.raw) return qData.raw;
        if (qData.success && qData.imageUrl) return { image: { url: qData.imageUrl } };
        if (attempts > 60) throw new Error('拆层超时，请重试');
        return poll();
      };

      const raw = await poll();
      const bgUrl = raw?.image?.url || raw?.imageUrl;
      if (!bgUrl) throw new Error('未获取到背景图');

      const containers: TextContainer[] = raw?.text_containers ?? [];
      const html: string = raw?.text_html ?? '';

      setResult({ backgroundUrl: bgUrl, textContainers: containers, textHtml: html });
      setEditedTexts(extractTexts(containers));
      setStep('editing');
    } catch (e: any) {
      setError(e.message || '拆层失败');
      setStep('idle');
    } finally {
      setBusy(false);
    }
  };

  // Step 2: AI 翻译（把提取的文字批量翻译成中文）
  const handleTranslate = async () => {
    if (!editedTexts.length) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/text/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: editedTexts, targetLang: 'zh' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '翻译失败');
      if (Array.isArray(data.texts)) setEditedTexts(data.texts);
    } catch (e: any) {
      setError(e.message || 'AI 翻译失败');
    } finally {
      setTranslating(false);
    }
  };

  // Step 3: 合成导出（背景图 + 用户编辑后的文字层）
  const handleCompose = async () => {
    if (!result) return;
    setError('');
    setBusy(true);
    setStep('compositing');
    try {
      // 用 canvas 合成：背景图 + 文字
      const canvas = compositeRef.current;
      if (!canvas) throw new Error('canvas 未初始化');

      // 加载背景图
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('背景图加载失败'));
        img.src = result.backgroundUrl;
      });

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx2 = canvas.getContext('2d')!;
      ctx2.drawImage(img, 0, 0);

      // 叠加文字（根据 textContainers 坐标 + editedTexts）
      result.textContainers.forEach((container, i) => {
        const text = editedTexts[i] ?? '';
        if (!text.trim()) return;

        const x = (container.x ?? 0.5) * canvas.width;
        const y = (container.y ?? 0.5) * canvas.height;
        const fontSize = container.font_size
          ? Math.round(container.font_size * canvas.height)
          : 32;
        const color = container.color
          ? `rgb(${container.color.r},${container.color.g},${container.color.b})`
          : '#ffffff';
        const align = (container.text_align as CanvasTextAlign) || 'center';

        ctx2.font = `${fontSize}px sans-serif`;
        ctx2.fillStyle = color;
        ctx2.textAlign = align;
        ctx2.textBaseline = 'top';

        // 多行文字
        const lines = text.split('\n');
        lines.forEach((line, li) => {
          ctx2.fillText(line, x, y + li * (fontSize * 1.3));
        });
      });

      // 导出为 blob → 上传 → 推入版本
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('合成失败'));
        }, 'image/png');
      });

      // 上传到 fal storage（走现有 /api/image/upload 路由）
      const formData = new FormData();
      formData.append('file', blob, 'poster.png');
      const upRes = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.url) throw new Error(upData.error || '上传失败');

      pushVersion(upData.url);
      setStep('idle');
      setResult(null);
    } catch (e: any) {
      setError(e.message || '合成失败');
      setStep('editing');
    } finally {
      setBusy(false);
    }
  };

  const panel = panelSlot && createPortal(
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 说明 */}
      <div style={infoBox}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>海报文字编辑</div>
        <div style={{ fontSize: 11, lineHeight: 1.7, color: '#52525b' }}>
          上传含文字的海报 / 广告图 → AI 自动去除文字，提取文字层 → 前端可编辑文字内容 → 支持 AI 翻译成中文 → 重新合成导出
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#a1a1aa' }}>¥0.7 / 次</div>
      </div>

      {step === 'idle' && (
        <button onClick={handleLayerize} disabled={busy} style={genBtn(busy)}>
          {busy ? '拆层中…' : '开始拆层（¥0.7）'}
        </button>
      )}

      {step === 'layerizing' && (
        <div style={statusBox}>
          <div style={spinner} />
          <span style={{ fontSize: 13, color: '#52525b' }}>AI 正在拆解文字层…</span>
        </div>
      )}

      {step === 'editing' && result && (
        <>
          {/* 背景预览 */}
          <div>
            <div style={lbl}>去文字背景图</div>
            <img
              src={result.backgroundUrl}
              alt="背景"
              style={{ width: '100%', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)' }}
            />
          </div>

          {/* 文字容器编辑 */}
          {editedTexts.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={lbl}>识别到的文字（可直接编辑）</div>
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  style={secondaryBtn}
                >
                  {translating ? '翻译中…' : 'AI 翻译成中文'}
                </button>
              </div>
              {editedTexts.map((text, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 3 }}>
                    文字块 {i + 1}
                    {result.textContainers[i]?.type ? ` · ${result.textContainers[i].type}` : ''}
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => {
                      const next = [...editedTexts];
                      next[i] = e.target.value;
                      setEditedTexts(next);
                    }}
                    rows={3}
                    style={textarea}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#a1a1aa', padding: '8px 0' }}>
              未识别到可编辑文字块（可能是纯图形设计）
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setStep('idle'); setResult(null); }}
              disabled={busy}
              style={secondaryBtn}
            >
              重新拆层
            </button>
            <button
              onClick={handleCompose}
              disabled={busy}
              style={{ ...genBtn(busy), flex: 1 }}
            >
              {busy ? '合成中…' : '合成导出'}
            </button>
          </div>
        </>
      )}

      {step === 'compositing' && (
        <div style={statusBox}>
          <div style={spinner} />
          <span style={{ fontSize: 13, color: '#52525b' }}>正在合成图片…</span>
        </div>
      )}

      {/* 隐藏的合成 canvas */}
      <canvas ref={compositeRef} style={{ display: 'none' }} />
    </div>,
    panelSlot
  );

  return <>{panel}</>;
}

const lbl: React.CSSProperties = { color: '#52525b', fontSize: 12, marginBottom: 6, fontWeight: 500 };
const infoBox: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 10,
  background: '#f0f9ff', border: '1px solid rgba(14,165,233,0.2)',
  fontSize: 12, color: '#0c4a6e',
};
const statusBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '12px 14px', borderRadius: 10,
  background: '#fafafa', border: '1px solid rgba(0,0,0,0.06)',
};
const spinner: React.CSSProperties = {
  width: 16, height: 16, borderRadius: '50%',
  border: '2px solid #e4e4e7', borderTopColor: '#18181b',
  animation: 'spin 0.8s linear infinite', flexShrink: 0,
};
const textarea: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8, padding: 8, color: '#18181b', fontSize: 12,
  resize: 'vertical', outline: 'none', lineHeight: 1.6,
};
const genBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', padding: 12, borderRadius: 10, border: 'none',
  cursor: busy ? 'wait' : 'pointer',
  background: busy ? '#d4d4d8' : '#18181b',
  color: busy ? '#71717a' : '#fff', fontWeight: 600, fontSize: 14,
});
const secondaryBtn: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
  border: '1px solid rgba(0,0,0,0.12)', background: '#fff',
  color: '#52525b', cursor: 'pointer',
};
