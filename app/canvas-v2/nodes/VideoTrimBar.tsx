'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================
// 视频剪辑条(方案A:区间标记 + 按区间下载)
// - 双把手拖选 [start, end] 区间;不裁切原文件,只标记
// - 播放时由调用方让视频只循环此段
// - 「导出片段」用 MediaRecorder 录制该区间输出新 mp4/webm(纯前端,不耗API)
// 复用于 视频卡 / Seedance 卡
// ============================================================

export function VideoTrimBar({
  videoEl,
  duration,
  trimStart,
  trimEnd,
  onChange,
  onExport,
  exporting,
}: {
  videoEl: HTMLVideoElement | null;
  duration: number;                 // 视频总时长(秒)
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
  onExport: () => void;
  exporting?: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<'start' | 'end' | null>(null);
  const [playhead, setPlayhead] = useState(0);

  // 跟随播放进度显示游标
  useEffect(() => {
    if (!videoEl) return;
    const onTime = () => setPlayhead(videoEl.currentTime);
    videoEl.addEventListener('timeupdate', onTime);
    return () => videoEl.removeEventListener('timeupdate', onTime);
  }, [videoEl]);

  // 拖动把手
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const t = +(ratio * duration).toFixed(2);
      if (drag === 'start') onChange(Math.min(t, trimEnd - 0.1), trimEnd);
      else onChange(trimStart, Math.max(t, trimStart + 0.1));
      // 拖把手时把视频跳到对应位置预览
      if (videoEl) videoEl.currentTime = t;
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, duration, trimStart, trimEnd, onChange, videoEl]);

  const pct = (t: number) => `${(t / Math.max(0.01, duration)) * 100}%`;

  return (
    <div className="nodrag nopan" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
      style={{
        marginTop: 8, padding: '10px 12px', borderRadius: 12,
        background: 'rgba(24,24,27,0.92)', border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(20px)', minWidth: 280, boxShadow: '0 10px 36px rgba(0,0,0,0.5)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#a1a1aa' }}>剪辑区间</span>
        <span style={{ fontSize: 11, color: '#e4e4e7' }}>{trimStart.toFixed(1)}s — {trimEnd.toFixed(1)}s · 共 {(trimEnd - trimStart).toFixed(1)}s</span>
      </div>

      {/* 轨道 */}
      <div ref={barRef} style={{ position: 'relative', height: 28, background: 'rgba(255,255,255,0.08)', borderRadius: 6, cursor: 'pointer' }}>
        {/* 选中区间 */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(trimStart), width: `calc(${pct(trimEnd)} - ${pct(trimStart)})`, background: 'rgba(96,165,250,0.3)', border: '1px solid rgba(96,165,250,0.6)', borderRadius: 6 }} />
        {/* 播放游标 */}
        {playhead >= trimStart && playhead <= trimEnd && (
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: pct(playhead), width: 2, background: '#fff' }} />
        )}
        {/* 起点把手 */}
        <div onMouseDown={(e) => { e.stopPropagation(); setDrag('start'); }}
          style={{ position: 'absolute', top: -3, left: pct(trimStart), width: 12, height: 34, marginLeft: -6, background: '#60a5fa', borderRadius: 4, cursor: 'ew-resize', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
        {/* 终点把手 */}
        <div onMouseDown={(e) => { e.stopPropagation(); setDrag('end'); }}
          style={{ position: 'absolute', top: -3, left: pct(trimEnd), width: 12, height: 34, marginLeft: -6, background: '#60a5fa', borderRadius: 4, cursor: 'ew-resize', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => { if (videoEl) { videoEl.currentTime = trimStart; videoEl.play().catch(() => {}); } }}
          style={trimBtn}>▶ 预览片段</button>
        <button onClick={onExport} disabled={exporting}
          style={{ ...trimBtn, background: exporting ? 'rgba(96,165,250,0.3)' : 'rgba(96,165,250,0.85)', color: '#fff', opacity: exporting ? 0.7 : 1 }}>
          {exporting ? '导出中…' : '导出片段'}
        </button>
      </div>
    </div>
  );
}

const trimBtn: React.CSSProperties = {
  flex: 1, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontSize: 12, cursor: 'pointer',
};

// ============================================================
// 按区间录制导出新视频片段(MediaRecorder,纯前端)
// 返回 Blob;调用方负责上传 Supabase / 新建卡片
// ============================================================
export async function exportVideoSegment(
  sourceUrl: string,
  start: number,
  end: number,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  // 独立 video 元素播放区间,captureStream 录制
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.src = sourceUrl;
  v.muted = false;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error('视频加载失败(可能跨域)'));
  });

  const stream = (v as any).captureStream?.() as MediaStream | undefined;
  if (!stream) throw new Error('当前浏览器不支持 captureStream 录制');

  // 选可用的 mime
  const mime = ['video/mp4;codecs=h264', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  v.currentTime = start;
  await new Promise<void>((res) => { v.onseeked = () => res(); });

  recorder.start();
  await v.play();

  // 播到 end 停止
  await new Promise<void>((res) => {
    const tick = () => {
      if (v.currentTime >= end || v.ended) { res(); return; }
      onProgress?.(Math.min(99, ((v.currentTime - start) / Math.max(0.1, end - start)) * 100));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  v.pause();
  recorder.stop();
  return done;
}
