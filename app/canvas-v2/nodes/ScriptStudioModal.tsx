'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCanvasStore } from '../store';
import { getUserId } from '../lib/api';
import {
  PHASE_LABELS, PHASE_LABELS_CN, emptyProject, loadDraftLocal, saveDraftLocal,
  loadProject, saveProject, generatePhase, generateAssetBible, generateAssetSheet,
  generateCostume, parseAssets, parseCharacters,
  type ScriptProject, type ParsedAsset, type ParsedCharacter,
} from '../lib/scriptStudio';

// ============================================================
// 剧本工作室 · 全屏弹窗(画布内,共享同一个 store,发送到画布零跨页)
// 6 阶段 AI 电影管线:Novel/Beat/Character/Environment/Screenplay/Shooting Script
// ④Environment Bible 含资产清单,可点单个资产按需钻取 Asset Bible
// 双存:localStorage 即时草稿 + Supabase 云端永久
// 发送到画布:统一发文本卡(整段),用户自己选择性复制到角色/图片卡
// ============================================================

const ENV_PHASE = 4; // ④ Environment Bible(1基)
const CHAR_PHASE = 3; // ③ Character Bible(1基)

// 各阶段输入框占位提示(6 阶段)
const PHASE_PLACEHOLDERS = [
  '输入你的故事想法、题材或一句话梗概,AI 按专业框架扩写成完整小说…',
  '已生成小说后点生成,AI 提炼为专业电影 Beat Sheet(15拍结构)。也可补充结构要求…',
  '已生成小说后点生成,AI 设计角色资产(故事功能/视觉/心理/一致性)。也可补充选角方向…',
  '已生成小说后点生成,AI 构建场景世界(地点体系+分类资产清单)。也可补充世界方向…',
  '需先有小说+Beat+人物+场景世界,AI 综合生成正式电影剧本。也可补充剧本要求…',
  '需先有正式剧本(及前置素材),AI 生成拍摄剧本(含Shot/关键帧/图片提示词/视频提示词)。也可补充导演风格时长…',
];

// 依赖链(1基阶段号 → 它依赖的前置阶段号)
// ②←① ③④←① ⑤←①②③④ ⑥←①②⑤③④;① 无前置
const DEPENDS_ON: Record<number, number[]> = {
  1: [], 2: [1], 3: [1], 4: [1], 5: [1, 2, 3, 4], 6: [1, 2, 5, 3, 4],
};

export function ScriptStudioModal({ onClose }: { onClose: () => void }) {
  const addCardFromStudio = useCanvasStore((s) => s.addCardFromStudio);
  const [project, setProject] = useState<ScriptProject>(emptyProject);
  const [active, setActive] = useState(0);            // 当前阶段 0..5
  const [generating, setGenerating] = useState(false);
  const [sentTip, setSentTip] = useState('');         // 发送/复制提示
  const [openAsset, setOpenAsset] = useState<string | null>(null); // 展开查看的资产 key
  const [assetBusy, setAssetBusy] = useState<string | null>(null); // 正在生成 Asset Bible 的资产 key
  const [sheetBusy, setSheetBusy] = useState<string | null>(null); // 正在生成 Sheet 的 key:`${assetKey}|breakdown|exploration`
  const [openChar, setOpenChar] = useState<string | null>(null);   // 展开查看的角色 key
  const [costumeBusy, setCostumeBusy] = useState<string | null>(null); // 正在生成服装的 key:`${charName}|bible|sheet`
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
    const prev: Record<number, string> = {};
    for (let i = 0; i < 6; i++) {
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

  // ④Environment Bible 的资产清单(从输出文本解析)
  const assets: ParsedAsset[] = active + 1 === ENV_PHASE ? parseAssets(project.phases[active] || '') : [];

  // 生成单个资产的 Asset Bible(按需钻取)
  const handleAssetBible = async (asset: ParsedAsset) => {
    const key = asset.id || asset.name;
    if (assetBusy) return;
    setAssetBusy(key);
    try {
      const result = await generateAssetBible(
        `${asset.id} ${asset.name}（${asset.note}）`,
        project.phases[ENV_PHASE - 1] || '',
        '',
        userIdRef.current,
      );
      setProject((p) => {
        const next = { ...p, assetBibles: { ...p.assetBibles, [key]: result } };
        persist(next);
        return next;
      });
      setOpenAsset(key);
    } catch (e: any) {
      alert('生成 Asset Bible 失败: ' + (e?.message || e));
    } finally {
      setAssetBusy(null);
    }
  };

  // 更新某资产 Asset Bible 文本(可编辑)
  const updateAssetBible = (key: string, v: string) => {
    setProject((p) => {
      const next = { ...p, assetBibles: { ...p.assetBibles, [key]: v } };
      if (!composing.current) persist(next);
      return next;
    });
  };

  const sendAssetToCanvas = (key: string) => {
    const text = project.assetBibles[key] || '';
    if (!text.trim()) return;
    addCardFromStudio('text', text.trim(), 0);
    (window as any).saveCanvasV2Now?.();
    flashTip('Asset Bible 已发送到画布');
  };

  // 生成资产的 Breakdown(技术拆解) / Exploration(9宫格多角度)Sheet
  const handleAssetSheet = async (asset: ParsedAsset, kind: 'breakdown' | 'exploration') => {
    const key = asset.id || asset.name;
    const busyKey = `${key}|${kind}`;
    if (sheetBusy) return;
    const bible = project.assetBibles[key] || '';
    if (!bible.trim()) { alert('请先生成 Asset Bible'); return; }
    setSheetBusy(busyKey);
    try {
      const result = await generateAssetSheet(
        kind, `${asset.id} ${asset.name}`, bible,
        project.phases[ENV_PHASE - 1] || '', userIdRef.current,
      );
      setProject((p) => {
        const field = kind === 'breakdown' ? 'assetBreakdowns' : 'assetExplorations';
        const next = { ...p, [field]: { ...(p as any)[field], [key]: result } };
        persist(next);
        return next;
      });
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setSheetBusy(null);
    }
  };

  // 角色清单(③Character Bible 解析)
  const characters: ParsedCharacter[] = active + 1 === CHAR_PHASE ? parseCharacters(project.phases[active] || '') : [];

  // 生成角色的 Costume & Equipment Bible
  const handleCostumeBible = async (ch: ParsedCharacter) => {
    const key = ch.name;
    if (costumeBusy) return;
    setCostumeBusy(`${key}|bible`);
    try {
      const result = await generateCostume('costumeBible', ch.name, project.phases[CHAR_PHASE - 1] || '', '', userIdRef.current);
      setProject((p) => {
        const next = { ...p, costumeBibles: { ...p.costumeBibles, [key]: result } };
        persist(next);
        return next;
      });
      setOpenChar(key);
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setCostumeBusy(null);
    }
  };

  // 生成角色的 Costume Sheet(动态格数,需先有 Costume Bible)
  const handleCostumeSheet = async (ch: ParsedCharacter) => {
    const key = ch.name;
    if (costumeBusy) return;
    const cb = project.costumeBibles[key] || '';
    if (!cb.trim()) { alert('请先生成 Costume & Equipment Bible'); return; }
    setCostumeBusy(`${key}|sheet`);
    try {
      const result = await generateCostume('costumeSheet', ch.name, '', cb, userIdRef.current);
      setProject((p) => {
        const next = { ...p, costumeSheets: { ...p.costumeSheets, [key]: result } };
        persist(next);
        return next;
      });
    } catch (e: any) {
      alert('生成失败: ' + (e?.message || e));
    } finally {
      setCostumeBusy(null);
    }
  };

  // 通用:更新某 Record 字段的文本(可编辑)
  const updateRecordField = (field: 'assetBreakdowns' | 'assetExplorations' | 'costumeBibles' | 'costumeSheets', key: string, v: string) => {
    setProject((p) => {
      const next = { ...p, [field]: { ...(p as any)[field], [key]: v } };
      if (!composing.current) persist(next);
      return next;
    });
  };

  const sendTextToCanvas = (text: string, tip: string) => {
    if (!text.trim()) return;
    addCardFromStudio('text', text.trim(), 0);
    (window as any).saveCanvasV2Now?.();
    flashTip(tip);
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
              阶段 {active + 1} / 6 · <span style={{ color: '#e4e4e7', fontWeight: 600 }}>{PHASE_LABELS[active]}</span>
              <span style={{ color: '#71717a', marginLeft: 6 }}>{PHASE_LABELS_CN[active]}</span>
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

            {/* ④ Environment Bible:资产清单 + 按需钻取 Asset Bible */}
            {active + 1 === ENV_PHASE && assets.length > 0 && (
              <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, marginBottom: 4 }}>
                  资产清单 Asset Registry
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400, marginLeft: 8 }}>
                    点资产按需生成 Asset Bible(不会一次性全生成)
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {assets.map((a) => {
                    const key = a.id || a.name;
                    const bible = project.assetBibles[key];
                    const isOpen = openAsset === key;
                    const busy = assetBusy === key;
                    return (
                      <div key={key} style={assetRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.id && a.id !== a.name && (
                            <span style={assetId}>{a.id}</span>
                          )}
                          <span style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 500 }}>{a.name}</span>
                          {a.category && <span style={{ fontSize: 10, color: '#71717a' }}>{a.category}</span>}
                          {a.note && <span style={{ fontSize: 11, color: '#8b8b92', flex: 1 }}>· {a.note}</span>}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            {bible ? (
                              <button style={assetSmallBtn} onClick={() => setOpenAsset(isOpen ? null : key)}>
                                {isOpen ? '收起' : '查看 Bible'}
                              </button>
                            ) : (
                              <button style={{ ...assetSmallBtn, color: busy ? '#c4b5fd' : '#a78bfa', cursor: busy ? 'wait' : 'pointer' }}
                                onClick={() => handleAssetBible(a)} disabled={!!assetBusy}>
                                {busy ? '生成中…' : '生成 Asset Bible'}
                              </button>
                            )}
                          </div>
                        </div>
                        {bible && isOpen && (
                          <div style={{ marginTop: 8 }}>
                            <textarea
                              className="cv2-scroll"
                              value={bible}
                              onChange={(e) => updateAssetBible(key, e.target.value)}
                              onCompositionStart={() => { composing.current = true; }}
                              onCompositionEnd={(e) => { composing.current = false; updateAssetBible(key, (e.target as HTMLTextAreaElement).value); }}
                              style={{ ...outputArea, minHeight: 180, flex: 'none' }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button style={assetSmallBtn} onClick={() => { navigator.clipboard.writeText(bible).then(() => flashTip('已复制')).catch(() => {}); }}>复制</button>
                              <button style={assetSmallBtn} onClick={() => sendAssetToCanvas(key)}>➤ 发送到画布</button>
                              <button style={{ ...assetSmallBtn, color: '#a78bfa' }} onClick={() => handleAssetBible(a)} disabled={!!assetBusy}>重新生成</button>
                            </div>

                            {/* 下游两个 Sheet:技术拆解 + 多角度探索 */}
                            {(['breakdown', 'exploration'] as const).map((sk) => {
                              const field = sk === 'breakdown' ? 'assetBreakdowns' : 'assetExplorations';
                              const label = sk === 'breakdown' ? 'Breakdown Sheet 拆解图(技术验证)' : 'Exploration Sheet 探索图(9宫格多角度)';
                              const sheet = (project as any)[field][key] as string | undefined;
                              const sbusy = sheetBusy === `${key}|${sk}`;
                              return (
                                <div key={sk} style={{ marginTop: 10, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.3)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 12, color: '#c4b5fd' }}>{label}</span>
                                    <button style={{ ...assetSmallBtn, marginLeft: 'auto', color: sbusy ? '#c4b5fd' : '#a78bfa', cursor: sbusy ? 'wait' : 'pointer' }}
                                      onClick={() => handleAssetSheet(a, sk)} disabled={!!sheetBusy}>
                                      {sbusy ? '生成中…' : (sheet ? '重新生成' : '生成')}
                                    </button>
                                  </div>
                                  {sheet && (
                                    <div style={{ marginTop: 6 }}>
                                      <textarea className="cv2-scroll" value={sheet}
                                        onChange={(e) => updateRecordField(field as any, key, e.target.value)}
                                        onCompositionStart={() => { composing.current = true; }}
                                        onCompositionEnd={(e) => { composing.current = false; updateRecordField(field as any, key, (e.target as HTMLTextAreaElement).value); }}
                                        style={{ ...outputArea, minHeight: 140, flex: 'none' }} />
                                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                        <button style={assetSmallBtn} onClick={() => { navigator.clipboard.writeText(sheet).then(() => flashTip('已复制')).catch(() => {}); }}>复制</button>
                                        <button style={assetSmallBtn} onClick={() => sendTextToCanvas(sheet, '已发送到画布')}>➤ 发送到画布</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ③ Character Bible:角色清单 + 按需钻取 Costume & Equipment Bible → Costume Sheet */}
            {active + 1 === CHAR_PHASE && characters.length > 0 && (
              <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 600, marginBottom: 4 }}>
                  角色服装装备 Costume & Equipment
                  <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400, marginLeft: 8 }}>
                    管服装/装备连续性(不管长相);先生成 Bible 再生成 Sheet
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {characters.map((ch) => {
                    const key = ch.name;
                    const cb = project.costumeBibles[key];
                    const cs = project.costumeSheets[key];
                    const isOpen = openChar === key;
                    const bbusy = costumeBusy === `${key}|bible`;
                    const sbusy = costumeBusy === `${key}|sheet`;
                    return (
                      <div key={key} style={assetRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 500 }}>{ch.name}</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            {cb ? (
                              <button style={assetSmallBtn} onClick={() => setOpenChar(isOpen ? null : key)}>
                                {isOpen ? '收起' : '查看服装装备'}
                              </button>
                            ) : (
                              <button style={{ ...assetSmallBtn, color: bbusy ? '#c4b5fd' : '#a78bfa', cursor: bbusy ? 'wait' : 'pointer' }}
                                onClick={() => handleCostumeBible(ch)} disabled={!!costumeBusy}>
                                {bbusy ? '生成中…' : '生成 Costume & Equipment Bible'}
                              </button>
                            )}
                          </div>
                        </div>
                        {cb && isOpen && (
                          <div style={{ marginTop: 8 }}>
                            {/* Costume & Equipment Bible */}
                            <div style={{ fontSize: 12, color: '#c4b5fd', marginBottom: 4 }}>Costume & Equipment Bible(服装装备定义)</div>
                            <textarea className="cv2-scroll" value={cb}
                              onChange={(e) => updateRecordField('costumeBibles', key, e.target.value)}
                              onCompositionStart={() => { composing.current = true; }}
                              onCompositionEnd={(e) => { composing.current = false; updateRecordField('costumeBibles', key, (e.target as HTMLTextAreaElement).value); }}
                              style={{ ...outputArea, minHeight: 160, flex: 'none' }} />
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button style={assetSmallBtn} onClick={() => { navigator.clipboard.writeText(cb).then(() => flashTip('已复制')).catch(() => {}); }}>复制</button>
                              <button style={assetSmallBtn} onClick={() => sendTextToCanvas(cb, '已发送到画布')}>➤ 发送到画布</button>
                              <button style={{ ...assetSmallBtn, color: '#a78bfa' }} onClick={() => handleCostumeBible(ch)} disabled={!!costumeBusy}>重新生成</button>
                            </div>

                            {/* Costume Sheet(动态格数) */}
                            <div style={{ marginTop: 10, paddingLeft: 10, borderLeft: '2px solid rgba(124,58,237,0.3)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#c4b5fd' }}>Costume Sheet 服装装备表(动态格数)</span>
                                <button style={{ ...assetSmallBtn, marginLeft: 'auto', color: sbusy ? '#c4b5fd' : '#a78bfa', cursor: sbusy ? 'wait' : 'pointer' }}
                                  onClick={() => handleCostumeSheet(ch)} disabled={!!costumeBusy}>
                                  {sbusy ? '生成中…' : (cs ? '重新生成' : '生成')}
                                </button>
                              </div>
                              {cs && (
                                <div style={{ marginTop: 6 }}>
                                  <textarea className="cv2-scroll" value={cs}
                                    onChange={(e) => updateRecordField('costumeSheets', key, e.target.value)}
                                    onCompositionStart={() => { composing.current = true; }}
                                    onCompositionEnd={(e) => { composing.current = false; updateRecordField('costumeSheets', key, (e.target as HTMLTextAreaElement).value); }}
                                    style={{ ...outputArea, minHeight: 140, flex: 'none' }} />
                                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                    <button style={assetSmallBtn} onClick={() => { navigator.clipboard.writeText(cs).then(() => flashTip('已复制')).catch(() => {}); }}>复制</button>
                                    <button style={assetSmallBtn} onClick={() => sendTextToCanvas(cs, '已发送到画布')}>➤ 发送到画布</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
const assetRow: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10, padding: '8px 12px',
};
const assetId: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#a78bfa', background: 'rgba(124,58,237,0.16)',
  border: '1px solid rgba(124,58,237,0.35)', borderRadius: 5, padding: '1px 6px', flexShrink: 0,
};
const assetSmallBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.05)', color: '#d4d4d8', cursor: 'pointer', fontSize: 11,
};

