'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../store';
import { getOrCreateCanvas, canvasBelongsTo, loadSnapshot, saveSnapshot } from '@/lib/canvas-storage';
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
          // 未登录:跳登录注册页。
          // 原来停在空画布(canvas-v2 调试期遗留),导致未登录也能进画布并生成 ——
          // 生成接口是 `if (userId) 才扣费`,无身份就变成免费放行、烧平台额度。
          // 登录页登录成功后本身就会跳回 /canvas,无需额外传回跳参数。
          if (typeof window !== 'undefined') window.location.replace('/auth');
          return;
        }

        // 带 templateId:从模板创建新画布并加载(照旧版数据流,快照换成 React Flow 格式)
        const templateId = new URLSearchParams(window.location.search).get('templateId');
        if (templateId) {
          try {
            const tRes = await fetch(`/api/templates/${templateId}`);
            const tData = await tRes.json();
            const snap = tData?.template?.snapshot_json;
            // 只认 React Flow 格式({nodes,edges});旧 tldraw 模板没有 .nodes,跳过(空画布)
            const isReactFlow = snap && Array.isArray(snap.nodes);
            // 建一个副本画布存这次创作
            const { data: { session } } = await supabase.auth.getSession();
            const newCanvasId = await getOrCreateCanvas(user.id);
            canvasIdRef.current = newCanvasId;
            if (isReactFlow) {
              const seen = new Set<string>();
              const cleanNodes = (snap.nodes as CardNode[]).filter((n) => {
                if (!n?.id || seen.has(n.id)) return false; seen.add(n.id); return true;
              });
              const cleanEdges = ((snap.edges ?? []) as Edge[]).filter((e) => seen.has(e.source) && seen.has(e.target));
              useCanvasStore.setState({ nodes: cleanNodes, edges: cleanEdges, selectedId: null });
            } else {
              // 旧 tldraw 模板:无法复原,提示并留空画布
              useCanvasStore.setState({ nodes: [], edges: [], selectedId: null });
              console.warn('该模板是旧引擎(tldraw)格式,新版无法加载,已留空画布');
            }
            void session;
            // 清掉 URL 的 templateId,避免刷新重复创建
            window.history.replaceState({}, '', '/canvas');
            setLoading(false);
            setTimeout(() => { isRestoringRef.current = false; }, 500);
            return;
          } catch (e) {
            console.error('从模板加载失败:', e);
            // 失败也别卡住,走正常流程
          }
        }

        // 带 ?canvas=<id>:从项目页点进来,打开指定项目。
        // 必须先验归属,否则改 URL 就能读别人的画布。
        // 无参数/不属于本人时回退 getOrCreateCanvas(改动前的行为)。
        const wantCanvasId = new URLSearchParams(window.location.search).get('canvas');
        let canvasId: string;
        if (wantCanvasId && await canvasBelongsTo(wantCanvasId, user.id)) {
          canvasId = wantCanvasId;
        } else {
          canvasId = await getOrCreateCanvas(user.id);
        }
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

  // ── 切换画布(多画布):先存当前,切 ID,重载目标快照 ──
  const switchCanvas = async (targetId: string) => {
    if (!targetId || targetId === canvasIdRef.current) return;
    // 先保存当前画布(非空)
    const cur = useCanvasStore.getState();
    if (canvasIdRef.current && !isRestoringRef.current && cur.nodes.length > 0) {
      try { await saveSnapshot(canvasIdRef.current, { nodes: cur.nodes, edges: cur.edges }); } catch {}
    }
    // 上锁,切 ID,重载
    isRestoringRef.current = true;
    setLoading(true);
    canvasIdRef.current = targetId;
    try {
      const snapshot = await loadSnapshot(targetId);
      const seen = new Set<string>();
      const cleanNodes = ((snapshot?.nodes ?? []) as CardNode[]).filter((n) => {
        if (!n?.id || seen.has(n.id)) return false; seen.add(n.id); return true;
      });
      const cleanEdges = ((snapshot?.edges ?? []) as Edge[]).filter((e) => seen.has(e.source) && seen.has(e.target));
      useCanvasStore.setState({ nodes: cleanNodes, edges: cleanEdges, selectedId: null });
    } catch (err) {
      console.error('切换画布失败:', err);
    } finally {
      setLoading(false);
      setTimeout(() => { isRestoringRef.current = false; }, 500);
    }
  };

  const getCurrentCanvasId = () => canvasIdRef.current;

  return { status, loading, saveNow, switchCanvas, getCurrentCanvasId };
}
