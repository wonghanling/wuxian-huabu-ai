'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store';
import { getOrCreateCanvas, loadSnapshot, saveSnapshot } from '@/lib/canvas-storage';
import { createClient } from '@/lib/supabase/client';
import type { CardNode } from '../store';
import type { Edge } from '@xyflow/react';

// ============================================================
// canvas-v2 画布持久化 — 完整复刻原网逻辑
// 进页面 isRestoring 上锁 → 加载快照 → 灌入 nodes/edges → 延迟解锁
// 空画布保护:nodes 为空不保存,防止加载未完成时覆盖历史数据
// 保存触发:生成后(2秒节流)+ beforeunload/visibilitychange/pagehide
// 存的内容是 React Flow 的 { nodes, edges }
// ============================================================

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export function useCanvasPersistence() {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [loading, setLoading] = useState(true);
  const canvasIdRef = useRef<string | null>(null);
  const isRestoringRef = useRef(true);   // 加载期间锁住,禁止保存
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 加载 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      isRestoringRef.current = true;
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // 未登录:不跳转(canvas-v2 调试期),仅停在空画布
          isRestoringRef.current = false;
          setLoading(false);
          return;
        }

        const canvasId = await getOrCreateCanvas(user.id);
        if (cancelled) return;
        canvasIdRef.current = canvasId;

        const snapshot = await loadSnapshot(canvasId);
        if (cancelled) return;
        if (snapshot && snapshot.nodes) {
          // 历史数据去重保护:旧 bug 期可能存过撞 ID 的卡片,
          // 同 ID 只保留第一个(React 用 id 做 key,重复会渲染错乱/顶掉)
          const seen = new Set<string>();
          const cleanNodes = (snapshot.nodes as CardNode[]).filter((n) => {
            if (!n?.id || seen.has(n.id)) return false;
            seen.add(n.id);
            return true;
          });
          const cleanEdges = ((snapshot.edges ?? []) as Edge[]).filter(
            (e) => seen.has(e.source) && seen.has(e.target)
          );
          // 灌入 React Flow 数据
          useCanvasStore.setState({
            nodes: cleanNodes,
            edges: cleanEdges,
            selectedId: null,
          });
        }
        // 延迟解锁,让 setState 批量写入完成
        setTimeout(() => { isRestoringRef.current = false; }, 500);
      } catch (err) {
        console.error('加载画布失败:', err);
        isRestoringRef.current = false;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── 核心保存(空画布保护 + 节流) ──
  const doSave = async () => {
    if (!canvasIdRef.current) return;
    if (isRestoringRef.current) return;          // 恢复期不保存
    const { nodes, edges } = useCanvasStore.getState();
    // 空画布保护:防止加载未完成时用空快照覆盖历史
    if (!nodes || nodes.length === 0) {
      console.warn('保存跳过:画布为空,可能是加载未完成');
      return;
    }
    try {
      setStatus('saving');
      await saveSnapshot(canvasIdRef.current, { nodes, edges });
      setStatus('saved');
    } catch (err) {
      console.error('保存失败:', err);
      setStatus('unsaved');
    }
  };

  // ── 节流保存(2秒内只触发一次,照原网 saveCanvasNow) ──
  const saveNow = () => {
    if (!canvasIdRef.current || isRestoringRef.current) return;
    setStatus('unsaved');
    if (saveTimerRef.current) return;            // 节流
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      doSave();
    }, 2000);
  };

  // ── 退出保存:beforeunload / visibilitychange / pagehide ──
  useEffect(() => {
    const onExit = () => {
      if (!canvasIdRef.current || isRestoringRef.current) return;
      const { nodes, edges } = useCanvasStore.getState();
      if (!nodes || nodes.length === 0) return;  // 空画布保护
      // 退出时直接异步保存(不阻塞)
      saveSnapshot(canvasIdRef.current, { nodes, edges }).catch(() => {});
    };
    const onVis = () => { if (document.visibilityState === 'hidden') onExit(); };
    window.addEventListener('beforeunload', onExit);
    window.addEventListener('pagehide', onExit);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('beforeunload', onExit);
      window.removeEventListener('pagehide', onExit);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // 暴露给全局,卡片生成完成后调用(照原网 window.saveCanvasNow)
  useEffect(() => {
    (window as any).saveCanvasV2Now = saveNow;
    return () => { if ((window as any).saveCanvasV2Now === saveNow) delete (window as any).saveCanvasV2Now; };
  });

  return { status, loading, saveNow };
}
