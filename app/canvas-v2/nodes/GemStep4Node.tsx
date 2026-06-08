'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { ratioToWH } from '../imageModels';
import { IconExpand, IconShrink, IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';
import { HoverZoomImg } from './RefThumb';
import { PromptTools } from './PromptTools';
import { uploadImageToStorage, generateGemStoryboardImage, mirrorOutput, getUserId } from '../lib/api';
import { useDebouncedField } from '../lib/useDebouncedField';
import { useUpstream } from '../lib/connections';

// ============================================================
// GEM 导演引擎 Step4 · 分镜图片生成
// 三种输入模式:单图(2张手动上传) / 4宫格(1张+内置模板) / 9宫格(1张+内置模板)
// 参数:时长 / 比例 / 脚本模式(4/9宫格) / 剧情引导
// 输出:分镜图片显示在卡片框
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type InputType = 'single' | '2x2' | '3x3';
type ScriptMode = 'normal' | 'detail';
type SubPanel = 'duration' | 'ratio' | 'ref' | 'mode' | 'script' | null;

const DURATIONS = ['4', '5', '6', '8', '10', '12', '15'];
const RATIOS = [
  { value: '16:9', label: '16:9', res: '2K 2048×1152', price: '¥1.2' },
  { value: '9:16', label: '9:16', res: '4K 2160×3840', price: '¥3.1' },
  { value: '1:1', label: '1:1', res: '2K 2048×2048', price: '¥1.7' },
];

function GemStep4NodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;
  const enlarged = data.enlarged ?? false;
  const hasOutput = data.status === 'done' && !!data.outputUrl;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [sub, setSub] = useState<SubPanel>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [modeTooltip, setModeTooltip] = useState<InputType | null>(null);
  const [uploading, setUploading] = useState(false);   // 上传中指示(照原网)
  const promptField = useDebouncedField(data.config.prompt ?? '', (v) => updateConfig(id, { prompt: v }));

  // 输入模式:存在 textDuration 字段里(复用)
  const inputType: InputType = (data.config.textDuration as InputType) ?? 'single';
  // 时长
  const duration = data.config.duration ?? 5;
  // 比例
  const ratio = data.config.ratio ?? '16:9';
  // 脚本模式(4/9宫格)
  const scriptMode: ScriptMode = (data.config.imageQuality as ScriptMode) ?? 'normal';
  // 剧情引导
  const actionSuggestion = data.config.prompt ?? '';
  // 上传的图片
  const refImages = data.config.refImages ?? [];
  // 单图模式:两张图; 4/9宫格:一张图
  const img1 = refImages[0];
  const img2 = refImages[1];

  const mult = enlarged ? 1.7 : 1;
  const dims = ratioToWH(ratio, 360 * mult);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  const uploadImg = async (index: number, fileList: FileList | null) => {
    const f = fileList?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(f);
      if (!url) return;
      const cur = [...(data.config.refImages ?? [])];
      cur[index] = url;
      updateConfig(id, { refImages: cur });
    } finally {
      setUploading(false);
    }
  };

  const clearImg = (index: number) => {
    const cur = [...(data.config.refImages ?? [])];
    cur[index] = '';
    updateConfig(id, { refImages: cur });
  };

  // 连线传参(响应式实时显示):
  //  单图模式:三视角(img1)+首帧(img2)都可连接,本地上传优先,缺的位置按上游图顺序补
  //  4/9宫格:连接1张上游图
  const upstreamImgs = useUpstream(id).images;
  const upstreamImg = inputType !== 'single' ? upstreamImgs[0] : undefined;
  // 单图:本地优先,空位用上游图顺序填(已被本地占用的上游图不重复用)
  let effImg1Single: string | undefined = img1, effImg2Single: string | undefined = img2;
  if (inputType === 'single') {
    const pool = [...upstreamImgs];
    if (!effImg1Single) effImg1Single = pool.shift();
    if (!effImg2Single) effImg2Single = pool.shift();
  }
  const effImg1 = inputType === 'single' ? effImg1Single : (img1 || upstreamImg);
  const canGenerate = inputType === 'single' ? !!(effImg1Single && effImg2Single) : !!effImg1;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    updateCard(id, { status: 'generating', progress: 10 });
    try {
      const userId = await getUserId();
      const userImages = inputType === 'single' ? [effImg1Single!, effImg2Single!] : [effImg1!];
      const imageUrl = await generateGemStoryboardImage(
        {
          inputType,
          scriptMode,
          duration: Number(duration),
          ratio,
          actionSuggestion,
          userImages,
          userId,
        },
        (progress) => updateCard(id, { progress }),
      );
      // 立即显示成品(不等大图下载完),宽高异步补上
      updateCard(id, { status: 'done', progress: 100, outputUrl: imageUrl });
      const probe = new Image();
      probe.onload = () => updateCard(id, { aspectW: probe.naturalWidth, aspectH: probe.naturalHeight });
      probe.src = imageUrl;
      mirrorOutput(imageUrl, 'image').then((permUrl) => {
        if (permUrl && permUrl !== imageUrl) updateCard(id, { outputUrl: permUrl });
        (window as any).saveCanvasV2Now?.();
      });
    } catch (err: any) {
      updateCard(id, { status: 'error', progress: 0 });
      alert('分镜图生成失败: ' + (err?.message || err));
    }
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>导演引擎 Step4</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>分镜图片生成</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn}><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  return (
    <>
      <Ports />

      {/* 卡片框 */}
      <div style={{
        width: dims.w, height: dims.h,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20, overflow: 'hidden',
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        position: 'relative',
        transition: 'border-color .25s, box-shadow .25s, width .3s, height .3s',
      }}>
        <button onClick={toggleCollapse} style={floatMinus}><IconMinus /></button>

        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {data.status === 'generating' ? (
            <div style={{ width: '70%' }}>
              <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8, textAlign: 'center' }}>分镜生成中…</div>
              <div style={track}><div style={{ height: '100%', width: `${data.progress ?? 0}%`, background: 'linear-gradient(90deg,#a0a0a0,#fff)', borderRadius: 99, transition: 'width .3s' }} /></div>
            </div>
          ) : hasOutput ? (
            <img src={data.outputUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#71717a', marginBottom: 6 }}>GEM 导演引擎 · Step 4</div>
              <span style={{ fontSize: 12, color: '#5a5a5f' }}>选择输入模式 → 上传图片 → 生成分镜</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部弹窗 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !hasOutput} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>

          {/* 剧情引导(大 prompt 区域) */}
          <PromptTools value={actionSuggestion} onPaste={(t) => updateConfig(id, { prompt: t })} />
          <textarea
            className="nodrag nopan nowheel cv2-scroll"
            value={promptField.value}
            {...promptField.bind}
            placeholder="剧情引导（可选）：他很害怕然后逃跑、慢慢转身离开..."
            rows={3}
            style={promptInput}
          />

          {/* 参数按钮行 */}
          <div style={tagsRow}>
            {/* 输入模式(ParamTag弹窗选择，hover 显示完整说明) */}
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={() => setSub(sub === 'mode' ? null : 'mode')}
                style={{ ...tagBtn, ...(sub === 'mode' ? tagActive : {}) }}>
                {inputType === 'single' ? '单图' : inputType === '2x2' ? '4宫格' : '9宫格'} ▾
              </button>
              {sub === 'mode' && (
                <div style={{ ...popPanel, width: 320 }} className="cv2-scroll" onWheelCapture={(e) => e.stopPropagation()}>
                  {([
                    { key: 'single', label: '单图', desc: '上传2张图：人物三视角（保持角色一致）+ 剧情首帧（定义场景构图），AI 生成4个连续电影级分镜画面，第1格还原首帧，第2-4格按剧情推进。' },
                    { key: '2x2', label: '4宫格', desc: '上传4宫格分镜图，内置模板自动叠加。AI 将4格画面嵌入分镜脚本，填写镜头号、时间轴、景别、运镜、动作说明、音效，生成完整电影级分镜脚本。' },
                    { key: '3x3', label: '9宫格', desc: '上传9宫格分镜图，内置模板自动叠加。9个宫格为细化动作分解，AI 跳过重复帧，按实际动作节奏分配时间轴，生成高密度动作分镜脚本。' },
                  ] as { key: InputType; label: string; desc: string }[]).map((opt) => (
                    <button key={opt.key}
                      onClick={() => { updateConfig(id, { textDuration: opt.key }); setSub(null); }}
                      onMouseEnter={() => setModeTooltip(opt.key)}
                      onMouseLeave={() => setModeTooltip(null)}
                      style={{ ...subItemStyle, ...(inputType === opt.key ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}), position: 'relative' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', width: '100%' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                        {modeTooltip === opt.key && (
                          <span style={{ fontSize: 11, color: '#e4e4e7', background: '#000', padding: '6px 8px', borderRadius: 6, lineHeight: 1.5, display: 'block', whiteSpace: 'normal' }}>
                            {opt.desc}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 参考图按钮(ParamTag弹窗) */}
            <ParamTag
              label={<>参考图{(img1 || img2 || effImg1) ? <span style={greenDot} /> : ''}</>}
              open={sub === 'ref'}
              onToggle={() => setSub(sub === 'ref' ? null : 'ref')}
              width={inputType === 'single' ? 320 : 200}
            >
              {inputType === 'single' ? (
                <div style={{ display: 'flex', gap: 10, padding: 6 }}>
                  <SlotOrConn label="人物三视角" local={img1} conn={!img1 ? effImg1Single : undefined} onUpload={(fl) => uploadImg(0, fl)} onClear={() => clearImg(0)} uploading={uploading} />
                  <SlotOrConn label="剧情首帧" local={img2} conn={!img2 ? effImg2Single : undefined} onUpload={(fl) => uploadImg(1, fl)} onClear={() => clearImg(1)} uploading={uploading} />
                </div>
              ) : (
                <div style={{ padding: 6 }}>
                  {/* 4/9宫格:本地上传优先,否则显示连接来的上游图(只读,不可清除) */}
                  {img1 ? (
                    <ImgSlot label={`${inputType === '2x2' ? '4' : '9'}宫格分镜图`} url={img1} onUpload={(fl) => uploadImg(0, fl)} onClear={() => clearImg(0)} wide uploading={uploading} />
                  ) : upstreamImg ? (
                    <div style={{ flex: 'unset', width: '100%' }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>{inputType === '2x2' ? '4' : '9'}宫格分镜图 <span style={{ color: '#60a5fa' }}>· 来自连接</span></div>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(0,0,0,0.3)' }}>
                        <HoverZoomImg url={upstreamImg} />
                      </div>
                    </div>
                  ) : (
                    <ImgSlot label={`${inputType === '2x2' ? '4' : '9'}宫格分镜图`} url={undefined} onUpload={(fl) => uploadImg(0, fl)} onClear={() => clearImg(0)} wide uploading={uploading} />
                  )}
                </div>
              )}
            </ParamTag>

            {/* 脚本模式(4/9宫格才有,弹窗选择) */}
            {(inputType === '2x2' || inputType === '3x3') && (
              <ParamTag
                label={`${scriptMode === 'normal' ? '普通分镜' : '细化动作'} ▾`}
                open={sub === 'script'}
                onToggle={() => setSub(sub === 'script' ? null : 'script')}
                width={300}
              >
                {([
                  { key: 'normal', label: '普通分镜', desc: '按宫格画面顺序生成标准分镜脚本,每格一个镜头,适合常规叙事节奏。' },
                  { key: 'detail', label: '细化动作', desc: '把宫格画面拆解为更细的动作分解,跳过重复帧,按实际动作节奏分配时间轴,适合高密度动作戏。' },
                ] as { key: ScriptMode; label: string; desc: string }[]).map((opt) => (
                  <button key={opt.key}
                    onClick={() => { updateConfig(id, { imageQuality: opt.key }); setSub(null); }}
                    style={{ ...subItemStyle, ...(scriptMode === opt.key ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', width: '100%' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, whiteSpace: 'normal' }}>{opt.desc}</span>
                    </div>
                  </button>
                ))}
              </ParamTag>
            )}

            {/* 时长 */}
            <ParamTag label={`时长 ${duration}s`} open={sub === 'duration'} onToggle={() => setSub(sub === 'duration' ? null : 'duration')} width={220}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 4 }}>
                {DURATIONS.map((d) => (
                  <button key={d}
                    onClick={() => { updateConfig(id, { duration: Number(d) }); setSub(null); }}
                    style={{ ...durationBtn, ...(String(duration) === d ? durationBtnActive : {}) }}>
                    {d}s
                  </button>
                ))}
              </div>
            </ParamTag>

            {/* 比例(含价格) */}
            <ParamTag label={`比例 ${ratio}`} open={sub === 'ratio'} onToggle={() => setSub(sub === 'ratio' ? null : 'ratio')} width={220}>
              {RATIOS.map((r) => (
                <SubItem key={r.value} active={r.value === ratio} onClick={() => { updateConfig(id, { ratio: r.value }); updateCard(id, { aspectW: undefined, aspectH: undefined }); setSub(null); }}>
                  <span>{r.label}</span>
                  <span style={{ fontSize: 10, color: '#71717a' }}>{r.res} · {r.price}</span>
                </SubItem>
              ))}
            </ParamTag>
          </div>

          {/* 底行:当前价格 + Generate */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: 12, color: '#71717a' }}>
              {RATIOS.find((r) => r.value === ratio)?.price ?? '¥1.2'} · {RATIOS.find((r) => r.value === ratio)?.res}
            </span>
            <button onClick={handleGenerate} disabled={!canGenerate}
              style={{ ...generateBtn, opacity: canGenerate ? 1 : 0.4 }}>
              Generate
            </button>
          </div>
        </div>
      </NodeToolbar>
      {/* 顶部工具栏 */}
      <NodeToolbar isVisible={selected && !spawnOpen && !sub} position={Position.Top} offset={12}>
        <div style={toolRow} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => updateCard(id, { enlarged: !enlarged })} style={toolBtnWide}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enlarged ? <IconShrink size={16} /> : <IconExpand size={16} />}
              {enlarged ? '还原' : '放大'}
            </span>
          </button>
        </div>
      </NodeToolbar>
    </>
  );

  function Ports() {
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        {/* Step4 照原网无"+"号下游菜单,仅可拖线连接 */}
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }} />
      </>
    );
  }
}

// ===== 单图槽:本地上传优先,否则只读显示连接来的上游图 =====
function SlotOrConn({ label, local, conn, onUpload, onClear, uploading }: {
  label: string; local?: string; conn?: string;
  onUpload: (fl: FileList | null) => void;
  onClear: () => void;
  uploading?: boolean;
}) {
  // 本地有图 → 正常可上传/清除;无本地但有连接 → 只读显示;都没有 → 上传占位
  if (!local && conn) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>{label} <span style={{ color: '#60a5fa' }}>· 来自连接</span></div>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(0,0,0,0.3)', minHeight: 80 }}>
          <HoverZoomImg url={conn} />
        </div>
      </div>
    );
  }
  return <ImgSlot label={label} url={local} onUpload={onUpload} onClear={onClear} uploading={uploading} />;
}

// ===== 图片上传槽 =====
function ImgSlot({ label, url, onUpload, onClear, wide, uploading }: {
  label: string; url?: string;
  onUpload: (fl: FileList | null) => void;
  onClear: () => void;
  wide?: boolean;
  uploading?: boolean;
}) {
  return (
    <div style={{ flex: wide ? 'unset' : 1, width: wide ? '100%' : undefined }}>
      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>{label}{uploading && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· 上传中…</span>}</div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: wide ? '16/9' : '1', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', minHeight: wide ? undefined : 80 }}>
        {url ? (
          <>
            <HoverZoomImg url={url} />
            <button style={imgDel} onClick={onClear}>×</button>
          </>
        ) : (
          <label style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'default' : 'pointer', color: '#6b7280', minHeight: 80, opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
            <IconPlus size={16} />
            <span style={{ fontSize: 10, marginTop: 3 }}>{uploading ? '上传中…' : '上传'}</span>
            <input type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}

// ===== 小组件 =====
function ParamTag({ label, open, onToggle, width = 200, children }: {
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
  return (
    <button onClick={onClick} style={{ ...subItem, ...(active ? { background: 'rgba(192,192,192,0.16)', color: '#fff' } : {}) }}>
      {children}
    </button>
  );
}

// ===== 样式 =====
function portCircle(c: string): React.CSSProperties {
  return {
    width: 20, height: 20, minWidth: 20, minHeight: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
    background: 'rgba(24,24,27,0.95)', border: `2px solid ${c}`,
    boxShadow: `0 0 10px ${c}, 0 0 0 4px rgba(0,0,0,0.25)`, color: '#e4e4e7', zIndex: 5,
  };
}
const portPlusIcon: React.CSSProperties = { pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' };
function collapsedCard(selected: boolean): React.CSSProperties {
  return {
    width: 200, padding: '20px 18px',
    background: GLASS_BG, backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
    border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`, borderRadius: 18,
    backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
    transition: 'all .3s cubic-bezier(.4,0,.2,1)',
  };
}
const collapsedIconWrap: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 12,
  background: 'linear-gradient(135deg, rgba(192,192,192,0.18), rgba(128,128,128,0.10))',
  border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
const pillBtn: React.CSSProperties = {
  width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: '#a1a1aa', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const floatMinus: React.CSSProperties = {
  position: 'absolute', top: 8, right: 8, zIndex: 10,
  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 8, border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
  color: '#e4e4e7', fontSize: 15, lineHeight: 1, cursor: 'pointer',
};
const track: React.CSSProperties = { height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' };
const promptBar: React.CSSProperties = {
  width: 520, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const modeBtn: React.CSSProperties = {
  flex: 1, padding: '8px 4px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', fontSize: 13, cursor: 'pointer',
};
const modeBtnActive: React.CSSProperties = { background: 'rgba(139,92,246,0.25)', color: '#c4b5fd', borderColor: 'rgba(139,92,246,0.4)' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: '#d4d4d8', fontSize: 12,
  outline: 'none', fontFamily: 'inherit',
};
const promptInput: React.CSSProperties = {
  width: '100%', padding: '36px 12px 8px', border: 'none', background: 'transparent',
  color: '#e4e4e7', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
  lineHeight: 1.55, userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text',
};
const greenDot: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', marginLeft: 4 };
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 8px 4px' };
const tagBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
const durationBtn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: '#d4d4d8', fontSize: 12, cursor: 'pointer',
};
const durationBtnActive: React.CSSProperties = { background: 'rgba(14,165,233,0.25)', color: '#7dd3fc', borderColor: 'rgba(14,165,233,0.4)' };
const popPanel: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, maxHeight: 300, overflowY: 'auto',
  background: 'rgba(28,28,32,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: 8,
  boxShadow: '0 18px 55px rgba(0,0,0,0.65)', zIndex: 9999,
};
const subItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
  padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 13, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap',
};
const imgDel: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const subItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%',
  padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent',
  color: '#d4d4d8', fontSize: 13, cursor: 'pointer', textAlign: 'left',
};
const generateBtn: React.CSSProperties = {
  marginLeft: 'auto', padding: '11px 26px', border: 'none', borderRadius: 12,
  background: 'linear-gradient(135deg, #f4f4f5, #c0c0c0)', color: '#18181b', fontWeight: 700,
  fontSize: 13, cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 4px 16px rgba(192,192,192,0.25)',
};
const toolRow: React.CSSProperties = { display: 'flex', gap: 8 };
const toolBtnWide: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 12, border: `1px solid ${GLASS_BORDER}`,
  background: 'rgba(24,24,27,0.85)', backdropFilter: 'blur(20px)',
  color: '#e4e4e7', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

export const GemStep4Node = memo(GemStep4NodeComponent);
