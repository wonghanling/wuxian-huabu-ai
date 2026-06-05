'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { TEXT_MODELS, groupedTextModels, type TextModel } from '../models';
import { IconText, IconModel, IconExpand, IconShrink, IconSplit, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { RefThumb } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, generateText, optimizePrompt, getUserId } from '../lib/api';

// ============================================================
// 文本卡片 · 超现代高端风格
// 磨砂玻璃半透明 · 圆润 · 端口悬浮卡外 · 收起小卡片(带标题)
// 双击编辑 · 底部宽 prompt 栏 · 右侧工具弹窗(放大 + 剧情分段)
// ============================================================

const ACCENT = '#c0c0c0';            // 银
const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';   // 蓝=输入
const OUTPUT_PORT = 'rgba(156,163,175,0.9)'; // 灰=输出

function TextNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasText = data.status === 'done' && !!data.text;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);
  const splitStory = useCanvasStore((s) => s.splitStory);

  const [editing, setEditing] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [sub, setSub] = useState<'duration' | 'ref' | null>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)
  const editRef = useRef<HTMLTextAreaElement>(null);

  const currentModel = TEXT_MODELS.find((m) => m.id === data.config.model) ?? TEXT_MODELS[0];
  // 模式:普通文本 / 提示词优化(用 preset 字段存)
  const optimizeMode = data.config.preset === 'optimize';
  const duration = data.config.textDuration ?? '13-15秒';
  const refImages = data.config.refImages ?? [];
  const TEXT_REF_MAX = 9;
  const DURATIONS = ['4-8秒', '9-12秒', '13-15秒', '>15秒'];
  // 放大=真实尺寸×1.7(连线/按钮自动跟随,不用 transform scale)
  const mult = enlarged ? 1.7 : 1;
  const baseW = 248 * mult;
  const baseH = 232 * mult;

  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus();
  }, [editing]);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  // 参考图上传(最多 9 张,给模型看图写文案,真实上传)
  const addRefImages = async (fileList: FileList | null) => {
    if (!fileList) return;
    const cur = data.config.refImages ?? [];
    const room = Math.max(0, TEXT_REF_MAX - cur.length);
    const files = Array.from(fileList).slice(0, room);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const url = await uploadImageToStorage(f);
        if (url) {
          const latest = useCanvasStore.getState().nodes.find((n) => n.id === id)?.data.config.refImages ?? [];
          updateConfig(id, { refImages: [...latest, url] });
        }
      }
    } finally {
      setUploading(false);
    }
  };
  const removeRefImage = (i: number) => {
    const cur = [...(data.config.refImages ?? [])];
    cur.splice(i, 1);
    updateConfig(id, { refImages: cur });
  };

  const handleGenerate = async () => {
    if (!data.config.prompt.trim()) return;
    updateCard(id, { status: 'generating', progress: 20 });
    let p = 20;
    const timer = setInterval(() => { p = Math.min(90, p + 10); updateCard(id, { progress: p }); }, 600);
    try {
      const userId = await getUserId();
      const firstRef = refImages[0];   // 参考图(给模型看图,storage URL)
      let result: string;
      if (optimizeMode) {
        // 提示词优化模式
        result = await optimizePrompt({
          userInput: data.config.prompt,
          duration,
          uploadedImage: firstRef,
          userId,
        });
      } else {
        // 普通文本生成
        result = await generateText({
          model: currentModel.id,
          prompt: data.config.prompt,
          imageUrl: firstRef,
          userId,
        });
      }
      clearInterval(timer);
      updateCard(id, { status: 'done', progress: 100, text: result });
      (window as any).saveCanvasV2Now?.();
    } catch (err: any) {
      clearInterval(timer);
      updateCard(id, { status: 'error', progress: 0 });
      alert((optimizeMode ? '提示词优化' : '文本生成') + '失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态：居中带标题副标题的小卡片 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div
          onClick={toggleCollapse}
          style={{
            width: 200,
            padding: '20px 18px',
            background: GLASS_BG,
            backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
            border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
            borderRadius: 18,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: selected
              ? '0 0 0 4px rgba(192,192,192,0.12), 0 14px 40px rgba(0,0,0,0.5)'
              : '0 8px 28px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            transform: 'translateZ(0)',
            transition: 'all .3s cubic-bezier(.4,0,.2,1)',
          }}
        >
          {/* 图标圆 */}
          <div style={collapsedIconWrap}>
            <span style={{ color: '#d4d4d8', display: 'flex' }}><IconText size={18} /></span>
          </div>
          {/* 标题 + 副标题 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              文本生成
            </div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>点击展开</div>
          </div>
          {/* 展开 + */}
          <button onClick={toggleCollapse} style={pillBtn} title="展开"><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      <div
        onDoubleClick={() => setEditing(true)}
        style={{
          width: baseW,
          height: baseH,
          background: GLASS_BG,
          backgroundImage:
            'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
          border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
          borderRadius: 20,
          overflow: 'hidden',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: selected
            ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)'
            : '0 10px 36px rgba(0,0,0,0.42)',
          transition: 'border-color .25s, box-shadow .25s, width .3s cubic-bezier(.34,1.2,.4,1), height .3s cubic-bezier(.34,1.2,.4,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 标题栏 */}
        <div style={titleBar}>
          <span style={{ color: '#a1a1aa', display: 'flex' }}><IconText /></span>
          <span style={{ color: '#e4e4e7', fontWeight: 600, fontSize: 12 }}>文本</span>
          <button onClick={toggleCollapse} style={iconBtn} title="收起"><IconMinus /></button>
        </div>

        {/* 内容区 */}
        <div style={contentArea}>
          {data.status === 'generating' ? (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>生成中…</div>
              <div style={track}>
                <div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} />
              </div>
            </div>
          ) : editing ? (
            <textarea
              ref={editRef}
              className="nodrag nopan nowheel"
              value={data.text ?? ''}
              onChange={(e) => updateCard(id, { text: e.target.value })}
              onBlur={() => {
                setEditing(false);
                // 有文字则标记为已有内容(底部 prompt 不再出现);清空则回到空态
                updateCard(id, { status: (data.text && data.text.trim()) ? 'done' : 'empty' });
              }}
              onWheelCapture={(e) => e.stopPropagation()}
              placeholder="输入文本…"
              style={inlineEdit}
            />
          ) : hasText ? (
            <p style={textContent}>{data.text}</p>
          ) : (
            <span style={{ fontSize: 12, color: '#5a5a5f' }}>双击编辑 · 或点击下方输入</span>
          )}
        </div>
      </div>

      {/* ===== 底部 prompt 栏(仅空卡片出现;已有文字内容则不出,一个卡片只显示一个画面) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen && !hasText} position={Position.Bottom} offset={16}>
        {/* 一体式输入框:文字在上,模型按钮+Generate 嵌在框内底部 */}
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <PromptTools value={data.config.prompt} onPaste={(t) => updateConfig(id, { prompt: t })} />
          <textarea
            className="nodrag nopan nowheel"
            value={data.config.prompt}
            onChange={(e) => updateConfig(id, { prompt: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
            placeholder={optimizeMode ? '简单描述你的想法,AI 帮你优化成专业提示词…' : '描述你想要的文本内容…'}
            rows={2}
            style={promptInput}
          />


          {/* 底部参数行(模式/时长/参考图/模型) */}
          <div style={paramsRow}>
            <button onClick={() => updateConfig(id, { preset: optimizeMode ? undefined : 'optimize' })}
              style={{ ...modeToggleBtn, ...(optimizeMode ? modeToggleActive : {}) }}>
              {optimizeMode ? '提示词优化' : '普通文本'}
            </button>
            {optimizeMode && (
              <ParamTag label={<>时长 {duration}</>} open={sub === 'duration'} onToggle={() => setSub(sub === 'duration' ? null : 'duration')} width={160}>
                {DURATIONS.map((d) => (
                  <SubItem key={d} active={d === duration} onClick={() => { updateConfig(id, { textDuration: d }); setSub(null); }}>
                    <span>{d}</span>
                  </SubItem>
                ))}
              </ParamTag>
            )}
            <ParamTag label={<>参考图{refImages.length > 0 ? ` ${refImages.length}` : ''}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</>} open={sub === 'ref'} onToggle={() => setSub(sub === 'ref' ? null : 'ref')} width={280}>
              <label style={{ ...uploadBtn, ...(uploading ? { opacity: 0.6, pointerEvents: 'none' } : {}) }}>
                <IconPlus size={13} /> <span>{uploading ? '上传中…' : `上传图片(还能传 ${Math.max(0, TEXT_REF_MAX - refImages.length)} 张)`}</span>
                <input type="file" accept="image/*" multiple disabled={uploading} style={{ display: 'none' }} onChange={(e) => { addRefImages(e.target.files); e.currentTarget.value = ''; }} />
              </label>
              <div style={{ fontSize: 10, color: '#71717a', marginBottom: 6 }}>给模型看图写文案(最多9张)</div>
              {refImages.length > 0 && (
                <div style={refGrid}>
                  {refImages.map((url, i) => (
                    <RefThumb key={i} url={url} index={i} onRemove={() => removeRefImage(i)} />
                  ))}
                </div>
              )}
            </ParamTag>
            {!optimizeMode && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setModelOpen((v) => !v)} style={modelBtn}>
                  <span style={{ color: '#9ca3af', display: 'flex' }}><IconModel /></span>
                  {currentModel.label}
                  <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
                </button>
                {modelOpen && (
                  <div style={dropdown} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
                    {Object.entries(groupedTextModels()).map(([group, models]) => (
                      <div key={group}>
                        <div style={groupLabel}>{group}</div>
                        {models.map((m: TextModel) => (
                          <button key={m.id}
                            onClick={() => { updateConfig(id, { model: m.id }); setModelOpen(false); }}
                            style={{ ...dropItem, background: m.id === data.config.model ? 'rgba(192,192,192,0.16)' : 'transparent', color: m.id === data.config.model ? '#fff' : '#d4d4d8' }}>
                            {m.label}
                            {m.tier === 'basic' && <span style={tierTag}>基础</span>}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={handleGenerate} style={generateBtn}>Generate</button>
            {optimizeMode && <span style={{ fontSize: 11, color: '#71717a' }}>专有模型</span>}
          </div>
        </div>
      </NodeToolbar>

      {/* ===== 顶部工具栏(选中浮现:放大 + 剧情分段) ===== */}
      <NodeToolbar isVisible={selected && !editing && !spawnOpen} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => updateCard(id, { enlarged: !enlarged })}
            style={toolBtnWide}
            title={enlarged ? '还原' : '放大卡片'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
          </button>
          <button
            onClick={() => splitStory(id)}
            style={toolBtnWide}
            title="剧情分段"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconSplit size={16} /> 剧情分段
            </span>
          </button>
        </div>
      </NodeToolbar>
    </>
  );

  // 端口:圆圈本身就是 Handle(能拖、能连、能吸附),离卡片很近
  // hover 才显隐。左=输入(蓝,接收)  右=输出(灰,加号:点击弹菜单/拖拽拉线)
  // 放大态隐藏,避免端口挡住放大的卡片
  function Ports() {
    // 放大改真实尺寸,端口正常跟随,无需隐藏
    return (
      <>
        {/* 输入端口(左,蓝) */}
        <Handle
          type="target"
          position={Position.Left}
          className="rf-port"
          style={{ ...portCircle(INPUT_PORT), left: -16 }}
        />

        {/* 输出端口(右,灰)—— 文本卡照原网无"+"号下游菜单,仅可拖线连接 */}
        <Handle
          type="source"
          position={Position.Right}
          className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
        />
      </>
    );
  }
}

// ===== 小组件 =====
// 参数按钮 + 从按钮正上方弹出的二级弹窗
function ParamTag({ label, open, onToggle, width = 240, children }: {
  label: React.ReactNode; open: boolean; onToggle: () => void; width?: number; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={onToggle} style={{ ...tagBtn, ...(open ? tagActive : {}) }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{label}</span>
      </button>
      {open && (
        <div style={{ ...popPanel, width }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}
function SubItem({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...subItem, ...(active ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>{children}</button>;
}

// ===== 样式 =====
// 端口圆圈 = Handle 本体(能拖能连),离卡片很近,left/right 由调用处设
function portCircle(c: string): React.CSSProperties {
  return {
    width: 20, height: 20,
    minWidth: 20, minHeight: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%',
    background: 'rgba(24,24,27,0.95)',
    border: `2px solid ${c}`,
    boxShadow: `0 0 10px ${c}, 0 0 0 4px rgba(0,0,0,0.25)`,
    color: '#e4e4e7',
    zIndex: 5,
  };
}
// 加号图标:纯视觉,不拦截指针
const portPlusIcon: React.CSSProperties = {
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const collapsedIconWrap: React.CSSProperties = {
  width: 40, height: 40,
  borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(128,128,128,0.10))',
  border: '1px solid rgba(255,255,255,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};
const titleBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '9px 13px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};
const iconBtn: React.CSSProperties = {
  marginLeft: 'auto', width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#a1a1aa',
  fontSize: 15, lineHeight: 1, cursor: 'pointer',
  transition: 'background .2s, transform .15s',
};
const pillBtn: React.CSSProperties = {
  width: 22, height: 22,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#a1a1aa',
  fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const contentArea: React.CSSProperties = {
  flex: 1, padding: 15, display: 'flex',
  alignItems: 'center', justifyContent: 'center', minHeight: 0,
};
const track: React.CSSProperties = {
  height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden',
};
const textContent: React.CSSProperties = {
  margin: 0, fontSize: 12.5, color: '#e4e4e7', lineHeight: 1.65,
  whiteSpace: 'pre-wrap', maxHeight: '100%', overflow: 'auto', width: '100%',
};
const inlineEdit: React.CSSProperties = {
  width: '100%', height: '100%', resize: 'none',
  background: 'transparent', border: 'none', outline: 'none',
  color: '#e4e4e7', fontSize: 12.5, lineHeight: 1.65, fontFamily: 'inherit',
  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const promptBar: React.CSSProperties = {
  width: 680,
  background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`,
  borderRadius: 18,
  padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
};
// 文字区:透明融入容器,无独立边框
const promptInput: React.CSSProperties = {
  width: '100%', padding: '14px 12px 10px', borderRadius: 12,
  border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
  lineHeight: 1.65, minHeight: 160,
  userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
// 框内底部一行:模型(左) + Generate(右)
const promptFooter: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 8px 8px',
};
const modelBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '12px 20px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)',
  color: '#e4e4e7', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '13px 30px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)',
  color: '#18181b', fontWeight: 700, fontSize: 15, cursor: 'pointer',
  letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
// Generate 独占一行时用(宽度撑满)
const generateBtnFull: React.CSSProperties = {
  width: '100%', padding: '15px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)',
  color: '#18181b', fontWeight: 700, fontSize: 16, cursor: 'pointer',
  letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
// 参数按钮行(模式/时长/参考图/模型)
const paramsRow: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
  padding: '6px 8px 4px',
};
const dropdown: React.CSSProperties = {
  position: 'absolute', bottom: '120%', left: 0, width: 230,
  maxHeight: 280, overflowY: 'auto',
  background: 'rgba(28,28,32,0.97)', backdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13,
  padding: 10, boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 70,
};
const groupLabel: React.CSSProperties = {
  fontSize: 9, color: '#52525b', padding: '6px 8px 3px',
  textTransform: 'uppercase', letterSpacing: '0.08em',
};
const dropItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '7px 10px', borderRadius: 8, border: 'none',
  fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
};
const tierTag: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 9, padding: '1px 6px', borderRadius: 99,
  background: 'rgba(255,255,255,0.08)', color: '#71717a',
};
const toolRow: React.CSSProperties = {
  display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center',
};
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12,
  border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  transition: 'transform .15s, background .2s',
};

// ===== 提示词优化模式样式 =====
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 6px 6px' };
const tagBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#e4e4e7', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
// 模式切换按钮
const modeToggleBtn: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)', color: '#d4d4d8', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
};
const modeToggleActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#e4e4e7', borderColor: 'rgba(192,192,192,0.4)' };
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '8px 11px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 12.5, cursor: 'pointer', textAlign: 'left',
};
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 10,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const uploadBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', marginBottom: 6,
  borderRadius: 8, border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.04)',
  color: '#d4d4d8', fontSize: 11, cursor: 'pointer',
};
const refGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 };
const refThumb: React.CSSProperties = {
  position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', cursor: 'zoom-in' };
const refDel: React.CSSProperties = {
  position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const refIdx: React.CSSProperties = {
  position: 'absolute', bottom: 2, left: 2, fontSize: 9, color: '#fff',
  background: 'rgba(0,0,0,0.7)', padding: '0 4px', borderRadius: 4,
};

export const TextNode = memo(TextNodeComponent);
