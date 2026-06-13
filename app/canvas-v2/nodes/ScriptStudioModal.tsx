'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../store';
import { getUserId } from '../lib/api';
import {
  PHASE_LABELS, emptyProject, loadDraftLocal, saveDraftLocal,
  loadProject, saveProject, generatePhase, type ScriptProject,
} from '../lib/scriptStudio';

// ============================================================
// 剧本工作室 · 全屏弹窗(画布内,共享同一个 store,发送到画布零跨页)
// 7 阶段独立文字生成:①小说 ②BeatSheet ③正式剧本 ④人物 ⑤场景 ⑥道具 ⑦拍摄剧本
// 双存:localStorage 即时草稿 + Supabase 云端永久
// 发送到画布:④⑤⑥按 ===xxx=== 拆多卡;人物→角色卡、场景/道具→图片卡、其余→文本卡
// ============================================================

// 各阶段输入框占位提示(新顺序:小说→Beat→人物→场景→道具→正式剧本→拍摄剧本)
const PHASE_PLACEHOLDERS = [
  '输入你的故事想法、题材或一句话梗概,AI 按专业框架扩写成完整小说…',
  '已生成小说后点生成,AI 提炼为专业电影 Beat Sheet(15拍结构)。也可在此补充结构要求…',
  '已生成小说后点生成,AI 设计角色资产(故事功能/视觉/心理/一致性)。也可补充选角方向…',
  '已生成小说后点生成,AI 设计场景资产(世界观/空间/视觉/灯光)。也可补充场景方向…',
  '已生成小说后点生成,AI 设计道具资产(故事功能/象征/视觉/一致性)。也可补充道具方向…',
  '需先有小说+Beat+人物+场景+道具,AI 综合生成正式电影剧本。也可补充剧本要求…',
  '需先有正式剧本(及前置素材),AI 生成可拍摄的镜头列表。也可补充导演/风格/时长要求…',
];

// 依赖链(1基阶段号 → 它依赖的前置阶段号):后端据此自动拼前置上下文
// ②←① ③④⑤←① ⑥←①②③④⑤ ⑦←①②⑥③④⑤;① 无前置
const DEPENDS_ON: Record<number, number[]> = {
  1: [], 2: [1], 3: [1], 4: [1], 5: [1], 6: [1, 2, 3, 4, 5], 7: [1, 2, 6, 3, 4, 5],
};

export function ScriptStudioModal({ onClose }: { onClose: () => void }) {
  const addCardFromStudio = useCanvasStore((s) => s.addCardFromStudio);
  const [project, setProject] = useState<ScriptProject>(emptyProject);
  const [active, setActive] = useState(0);            // 当前阶段 0..6
  const [generating, setGenerating] = useState(false);
  const [sentTip, setSentTip] = useState('');         // 发送/复制提示
  const composing = useRef(false);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);

  // 打开:先读本地草稿秒显,再拉云端覆盖
  useEffect(() => {
    const local = loadDraftLocal();
    if (local) setProject(local);
    (async () => {
      userIdRef.current = await getUserId();
      const cloud = await loadProject();
      if (cloud) {
        // 云端有则用云端(更权威),同时刷新本地
        setProject(cloud);
        saveDraftLocal(cloud);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 改动:立即存本地 + 防抖 3s 同步云端
  const persist = useCallback((next: ScriptProject) => {
    saveDraftLocal(next);
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(async () => {
      const id = await saveProject(next);
      if (id && !next.id) {
        setProject((p) => { const np = { ...p, id }; saveDraftLocal(np); return np; });
      }
    }, 3000);
  }, []);

  const updateInput = (v: string) => {
    setProject((p) => {
      const inputs = [...p.inputs]; inputs[active] = v;
      const next = { ...p, inputs };
      if (!composing.current) persist(next);
      return next;
    });
  };
  const updateOutput = (v: string) => {
    setProject((p) => {
      const phases = [...p.phases]; phases[active] = v;
      const next = { ...p, phases };
      if (!composing.current) persist(next);
      return next;
    });
  };

  const handleGenerate = async () => {
    const input = project.inputs[active]?.trim();
    // 依赖链:把已生成的前置阶段内容传给后端(1基阶段号→内容)
    // ②←① ③←①② ④⑤⑥←③ ⑦←③④⑤⑥;① 不需前置
    const prev: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      const v = project.phases[i]?.trim();
      if (v) prev[i + 1] = v;
    }
    // ① 必须有输入;其余阶段:有输入 或 有可用前置 即可
    const phaseNo = active + 1;
    const depReady = DEPENDS_ON[phaseNo].some((d) => prev[d]);
    if (phaseNo === 1 && !input) { alert('请先输入你的故事想法'); return; }
    if (phaseNo !== 1 && !input && !depReady) {
      alert(`请先生成${DEPENDS_ON[phaseNo].map((d) => PHASE_LABELS[d - 1]).join('/')},或在输入框补充内容`);
      return;
    }
    if (generating) return;
    setGenerating(true);
    try {
      const result = await generatePhase(phaseNo, input || '', prev, userIdRef.current);
      setProject((p) => {
        const phases = [...p.phases]; phases[active] = result;
        const next = { ...p, phases };
        persist(next);
        return next;
      });
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const flashTip = (msg: string) => { setSentTip(msg); setTimeout(() => setSentTip(''), 2000); };

  const handleCopy = async () => {
    const text = project.phases[active] || '';
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); flashTip('已复制'); } catch {}
  };

  const handleSend = () => {
    const text = project.phases[active] || '';
    if (!text.trim()) return;
    // 全部阶段统一发文本卡(整段),用户自己在文本卡里选择性复制到角色/图片卡
    addCardFromStudio('text', text.trim(), 0);
    (window as any).saveCanvasV2Now?.();
    flashTip('已发送到画布(文本卡)');
  };

  const output = project.phases[active] || '';
  const hasOutput = !!output.trim();
  // 能否生成:①需输入;其余 有输入 或 有可用前置 即可
  const phaseNo = active + 1;
  const depReady = DEPENDS_ON[phaseNo].some((d) => project.phases[d - 1]?.trim());
  const hasInput = !!project.inputs[active]?.trim();
  const canGenerate = !generating && (phaseNo === 1 ? hasInput : (hasInput || depReady));
  // 依赖未就绪的提示
  const depHint = phaseNo !== 1 && !depReady && !hasInput
    ? `需先生成 ${DEPENDS_ON[phaseNo].map((d) => PHASE_LABELS[d - 1]).join(' / ')}，或在下方输入框补充`
    : '';

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>剧本工作室</span>
            <span style={{ fontSize: 12, color: '#71717a' }}>从想法到拍摄剧本 · 自动保存</span>
          </div>
          <button onClick={onClose} style={closeBtn} title="关闭(Esc)">✕</button>
        </div>

        {/* 主体:左 stepper + 右编辑区 */}
        <div style={body}>
          {/* 左侧阶段列表 */}
          <div style={stepper} className="cv2-scroll">
            {PHASE_LABELS.map((label, i) => {
              const done = !!project.phases[i]?.trim();
              const isActive = i === active;
              return (
                <button key={i} onClick={() => setActive(i)}
                  style={{ ...stepItem, ...(isActive ? stepActive : {}) }}>
                  <span style={{ ...stepNum, ...(done ? stepNumDone : {}) }}>{done ? '✓' : i + 1}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                </button>
              );
            })}
          </div>

          {/* 右侧当前阶段 */}
          <div style={editor}>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 8 }}>
              阶段 {active + 1} / 7 · <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{PHASE_LABELS[active]}</span>
            </div>

            {/* 输入框 */}
            <textarea
              className="cv2-scroll"
              value={project.inputs[active] || ''}
              onChange={(e) => updateInput(e.target.value)}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={(e) => { composing.current = false; updateInput((e.target as HTMLTextAreaElement).value); }}
              placeholder={PHASE_PLACEHOLDERS[active]}
              style={inputArea}
            />

            {/* 生成按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
              <button onClick={handleGenerate} disabled={!canGenerate}
                style={{ ...genBtn, opacity: canGenerate ? 1 : 0.45, cursor: generating ? 'wait' : (canGenerate ? 'pointer' : 'not-allowed') }}>
                {generating ? '生成中…' : `生成${PHASE_LABELS[active]}`}
              </button>
              {depHint && <span style={{ fontSize: 12, color: '#a78bfa' }}>{depHint}</span>}
              {sentTip && <span style={{ fontSize: 12, color: '#86efac' }}>{sentTip}</span>}
            </div>

            {/* 输出区 */}
            <div style={{ fontSize: 12, color: '#71717a', margin: '4px 0' }}>生成结果(可直接编辑)</div>
            <textarea
              className="cv2-scroll"
              value={output}
              onChange={(e) => updateOutput(e.target.value)}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={(e) => { composing.current = false; updateOutput((e.target as HTMLTextAreaElement).value); }}
              placeholder="点上方按钮生成,或直接在这里手写…"
              style={outputArea}
            />

            {/* 输出区底部操作 */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={handleCopy} disabled={!hasOutput}
                style={{ ...actBtn, opacity: hasOutput ? 1 : 0.4 }}>复制</button>
              <button onClick={handleSend} disabled={!hasOutput}
                style={{ ...sendBtn, opacity: hasOutput ? 1 : 0.4 }}>
                ➤ 发送到画布
                <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 6 }}>(文本卡)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 样式 =====
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 99999,
  background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};
const panel: React.CSSProperties = {
  width: 'min(1100px, 95vw)', height: 'min(760px, 92vh)',
  background: '#18181b', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const closeBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', cursor: 'pointer', fontSize: 14,
};
const body: React.CSSProperties = { flex: 1, display: 'flex', minHeight: 0 };
const stepper: React.CSSProperties = {
  width: 180, flexShrink: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 4,
  borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto',
};
const stepItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderRadius: 10, border: '1px solid transparent', background: 'transparent',
  color: '#a1a1aa', cursor: 'pointer', fontSize: 13, transition: 'background .15s',
};
const stepActive: React.CSSProperties = {
  background: 'rgba(124,58,237,0.16)', border: '1px solid rgba(124,58,237,0.4)', color: '#fff',
};
const stepNum: React.CSSProperties = {
  width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: '#a1a1aa',
};
const stepNumDone: React.CSSProperties = { background: 'rgba(34,197,94,0.85)', color: '#fff' };
const editor: React.CSSProperties = {
  flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', overflowY: 'auto',
};
const inputArea: React.CSSProperties = {
  width: '100%', minHeight: 70, maxHeight: 140, resize: 'vertical',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
  padding: 12, color: '#e4e4e7', fontSize: 13, lineHeight: 1.6, outline: 'none',
  boxSizing: 'border-box',
};
const outputArea: React.CSSProperties = {
  width: '100%', flex: 1, minHeight: 240, resize: 'vertical',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
  padding: 12, color: '#e4e4e7', fontSize: 13, lineHeight: 1.65, outline: 'none',
  whiteSpace: 'pre-wrap', boxSizing: 'border-box', fontFamily: 'inherit',
};
const genBtn: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, border: 'none',
  background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
  fontSize: 13, fontWeight: 600,
};
const actBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#e4e4e7', cursor: 'pointer', fontSize: 13,
};
const sendBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)',
  background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
