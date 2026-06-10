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
        marginTop: 8, padding: '14px 16px', borderRadius: 16, minWidth: 320,
        background: 'linear-gradient(135deg, rgba(28,28,32,0.96) 0%, rgba(20,20,23,0.96) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a1a1aa' }} />
          视频剪辑
        </span>
        <span style={{ fontSize: 12, color: '#d4d4d8', fontFamily: 'monospace', fontWeight: 600 }}>
          {trimStart.toFixed(1)}s – {trimEnd.toFixed(1)}s
          <span style={{ color: '#52525b', marginLeft: 8, fontWeight: 400 }}>共 {(trimEnd - trimStart).toFixed(1)}s</span>
        </span>
      </div>

      {/* 轨道 */}
      <div ref={barRef} style={{ position: 'relative', height: 34, background: 'rgba(0,0,0,0.35)', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
        {/* 选中区间 */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(trimStart), width: `calc(${pct(trimEnd)} - ${pct(trimStart)})`, background: 'linear-gradient(180deg, rgba(212,212,216,0.28), rgba(161,161,170,0.16))', borderTop: '2px solid #d4d4d8', borderBottom: '2px solid #d4d4d8', borderRadius: 4 }} />
        {/* 播放游标 */}
        {playhead >= trimStart && playhead <= trimEnd && (
          <div style={{ position: 'absolute', top: -3, bottom: -3, left: pct(playhead), width: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,0.8)' }} />
        )}
        {/* 起点把手 */}
        <div onMouseDown={(e) => { e.stopPropagation(); setDrag('start'); }}
          style={{ position: 'absolute', top: -4, left: pct(trimStart), width: 14, height: 42, marginLeft: -7, background: 'linear-gradient(180deg, #e4e4e7, #a1a1aa)', borderRadius: 5, cursor: 'ew-resize', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 2, height: 16, background: 'rgba(0,0,0,0.35)', borderRadius: 2 }} />
        </div>
        {/* 终点把手 */}
        <div onMouseDown={(e) => { e.stopPropagation(); setDrag('end'); }}
          style={{ position: 'absolute', top: -4, left: pct(trimEnd), width: 14, height: 42, marginLeft: -7, background: 'linear-gradient(180deg, #e4e4e7, #a1a1aa)', borderRadius: 5, cursor: 'ew-resize', boxShadow: '0 2px 10px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 2, height: 16, background: 'rgba(0,0,0,0.35)', borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={() => { if (videoEl) { videoEl.currentTime = trimStart; videoEl.play().catch(() => {}); } }}
          style={previewBtn}>▶ 预览片段</button>
        <button onClick={onExport} disabled={exporting} style={{ ...exportBtn, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'default' : 'pointer' }}>
          {exporting ? '导出中…' : '✓ 导出片段'}
        </button>
      </div>
    </div>
  );
}

const previewBtn: React.CSSProperties = {
  flex: 1, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
};
const exportBtn: React.CSSProperties = {
  flex: 1, height: 34, borderRadius: 9, border: 'none',
  background: 'linear-gradient(180deg, #e4e4e7, #a1a1aa)', color: '#18181b', fontSize: 12.5, fontWeight: 700,
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
};
