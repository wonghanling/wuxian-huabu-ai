'use client';

import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, type NodeProps } from '@xyflow/react';
import { useCanvasStore, type CardNode } from '../store';
import { IconMinus, IconPlus } from './icons';
import { SpawnMenu } from './SpawnMenu';

// ============================================================
// 电影控制器卡片(复刻原网 ShotCard / shot-card)
// 景别 + 运镜(随景别变) + 7个导演思维维度
// 把参数拼成"[电影镜头指令] …"文本存到 data.text
// 下游通过 useUpstream 的 texts 读到 → 自动进 prompt
// ============================================================

const GLASS_BG = 'rgba(24,24,27,0.55)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const SEL_BORDER = 'rgba(192,192,192,0.45)';
const INPUT_PORT = 'rgba(59,130,246,0.9)';
const OUTPUT_PORT = 'rgba(156,163,175,0.9)';

type Opt = { en: string; zh: string };

const SHOT_TYPES = ['超远景', '远景', '全景', '中远景', '中景', '中近景', '特写'] as const;

// 7个导演思维维度 — key 存 config 字段,main 对应原网主选项名(取子选项用),label 拼 prompt 用
const DIMENSIONS = [
  { key: 'composition',  main: '主体位置',  label: '构图' },
  { key: 'subjectScale', main: '主体比例',  label: '主体比例' },
  { key: 'spaceType',    main: '空间类型',  label: '空间类型' },
  { key: 'timeFeeling',  main: '时间感',    label: '时间感' },
  { key: 'lighting',     main: '光影/天气', label: '光影/天气' },
  { key: 'motionSource', main: '动态来源',  label: '动态来源' },
  { key: 'semantic',     main: '语义',      label: '语义' },
] as const;

// 根据景别类型获取运镜选项(照原网 getCameraMovementOptions)
function getCameraMovementOptions(shotType: string): Opt[] {
  switch (shotType) {
    case '超远景':
      return [
        { en: 'Static', zh: '固定' },
        { en: 'Slow Push In', zh: '缓慢推进' },
        { en: 'Pull Out', zh: '拉远' },
        { en: 'Lateral Move/Pan', zh: '横移' },
        { en: 'Aerial/Top-down', zh: '俯视/航拍' },
      ];
    case '远景':
    case '全景':
      return [
        { en: 'Follow/Tracking', zh: '跟拍' },
        { en: 'Lateral Move', zh: '平移' },
        { en: 'Static', zh: '固定' },
        { en: 'Slow Push In', zh: '推进' },
        { en: 'Light Handheld', zh: '轻手持' },
      ];
    case '中远景':
      return [
        { en: 'Follow', zh: '跟拍' },
        { en: 'Pan', zh: '摇移' },
        { en: 'Push In', zh: '推进' },
        { en: 'Static', zh: '固定' },
        { en: 'Smooth Drift', zh: '稳定器微移' },
      ];
    case '中景':
      return [
        { en: 'Static', zh: '固定' },
        { en: 'Micro Push', zh: '微推进' },
        { en: 'OTS', zh: '过肩' },
        { en: 'Dual Pan', zh: '双人平移' },
        { en: 'Stable Handheld', zh: '稳定手持' },
      ];
    case '中近景':
      return [
        { en: 'Static', zh: '静止' },
        { en: 'Slow Push', zh: '慢推' },
        { en: 'Subtle Pan', zh: '轻摇' },
        { en: 'Breathing Handheld', zh: '呼吸感手持' },
        { en: 'Cut-in Editing', zh: '切入剪辑' },
      ];
    case '特写':
      return [
        { en: 'Absolute Static', zh: '绝对静止' },
        { en: 'Micro Push', zh: '微距推进' },
        { en: 'Cut-in', zh: '瞬间切入' },
        { en: 'Focus Shift', zh: '焦点变化' },
        { en: 'Flash Insert', zh: '瞬闪' },
      ];
    default:
      return [{ en: 'Static', zh: '固定' }];
  }
}

// 根据景别类型和维度主选项获取子选项(照原网 getDirectorThinkingSubOptions)
function getDimensionOptions(shotType: string, main: string): Opt[] {
  switch (shotType) {
    case '超远景':
      switch (main) {
        case '主体位置':
          return [{ en: 'Bottom Left', zh: '左下' }, { en: 'Bottom Center', zh: '下中' }, { en: 'Bottom Right', zh: '右下' }, { en: 'Center', zh: '中心' }];
        case '主体比例':
          return [{ en: '0%', zh: '无人' }, { en: '<5%', zh: '极小' }, { en: '5-10%', zh: '很小' }];
        case '空间类型':
          return [{ en: 'Open Natural', zh: '开放自然' }, { en: 'Empty Vast', zh: '空旷辽阔' }, { en: 'Urban Geometry', zh: '城市几何' }, { en: 'Atmospheric Void', zh: '大气虚空' }, { en: 'Industrial Large', zh: '工业大场景' }];
        case '时间感':
          return [{ en: 'Slow', zh: '缓慢' }, { en: 'Frozen', zh: '停滞' }];
        case '光影/天气':
          return [{ en: 'Backlight', zh: '逆光' }, { en: 'Fog', zh: '雾' }, { en: 'Overcast', zh: '阴天' }, { en: 'Sunrise-Sunset', zh: '日出日落' }, { en: 'Neon Night', zh: '霓虹夜景' }];
        case '动态来源':
          return [{ en: 'Environment', zh: '环境' }, { en: 'Crowd/Traffic', zh: '人群/交通' }];
        case '语义':
          return [{ en: 'Establish', zh: '建立世界观' }, { en: 'Pressure', zh: '压力' }, { en: 'Release', zh: '释放' }];
        default:
          return [];
      }
    case '远景':
    case '全景':
      switch (main) {
        case '主体位置':
          return [{ en: 'Middle Left', zh: '左中' }, { en: 'Center', zh: '中心' }, { en: 'Middle Right', zh: '右中' }, { en: 'Bottom Left', zh: '左下' }, { en: 'Bottom Center', zh: '下中' }, { en: 'Bottom Right', zh: '右下' }];
        case '主体比例':
          return [{ en: '20-40%', zh: '正常' }, { en: '10-20%', zh: '略小' }];
        case '空间类型':
          return [{ en: 'Urban Geometry', zh: '城市几何' }, { en: 'Open Natural', zh: '开放自然' }, { en: 'Crowded Public', zh: '拥挤公共' }, { en: 'Empty Vast', zh: '空旷辽阔' }, { en: 'Corridor', zh: '走廊' }];
        case '时间感':
          return [{ en: 'Normal', zh: '正常' }, { en: 'Rushed', zh: '急促' }];
        case '光影/天气':
          return [{ en: 'Soft Daylight', zh: '柔和日光' }, { en: 'Overcast', zh: '阴天' }, { en: 'Neon Night', zh: '霓虹夜景' }];
        case '动态来源':
          return [{ en: 'Subject Walk/Run', zh: '人物行走/奔跑' }, { en: 'Crowd/Traffic', zh: '人群/交通' }];
        case '语义':
          return [{ en: 'Advance', zh: '推进' }, { en: 'Establish', zh: '建立' }];
        default:
          return [];
      }
    case '中远景':
      switch (main) {
        case '主体位置':
          return [{ en: 'Middle Left', zh: '左中' }, { en: 'Center', zh: '中心' }, { en: 'Middle Right', zh: '右中' }, { en: 'Bottom Center', zh: '下中' }];
        case '主体比例':
          return [{ en: '40-60%', zh: '正常' }, { en: '20-40%', zh: '略小' }];
        case '空间类型':
          return [{ en: 'Corridor', zh: '走廊' }, { en: 'Interior Room', zh: '室内房间' }, { en: 'Street', zh: '街道' }, { en: 'Vehicle Interior', zh: '车内' }];
        case '时间感':
          return [{ en: 'Normal', zh: '正常' }, { en: 'Slight Slow', zh: '略慢' }];
        case '光影/天气':
          return [{ en: 'Practical Interior', zh: '实用室内光' }, { en: 'Overcast', zh: '阴天' }, { en: 'Neon Night', zh: '霓虹夜景' }];
        case '动态来源':
          return [{ en: 'Subject Walk/Run', zh: '人物行走/奔跑' }, { en: 'Camera Motion', zh: '镜头运动' }];
        case '语义':
          return [{ en: 'Advance', zh: '推进' }, { en: 'Pressure', zh: '压力' }];
        default:
          return [];
      }
    case '中景':
      switch (main) {
        case '主体位置':
          return [{ en: 'Left Third', zh: '左中（三分线）' }, { en: 'Center', zh: '中心' }, { en: 'Right Third', zh: '右中' }];
        case '主体比例':
          return [{ en: '60-80%', zh: '正常' }];
        case '空间类型':
          return [{ en: 'Interior Room', zh: '室内房间' }, { en: 'Corridor', zh: '走廊' }, { en: 'Crowded Public', zh: '拥挤公共' }];
        case '时间感':
          return [{ en: 'Normal', zh: '正常' }];
        case '光影/天气':
          return [{ en: 'Practical Interior', zh: '实用室内光' }, { en: 'Soft Daylight', zh: '柔和日光' }];
        case '动态来源':
          return [{ en: 'Subject Micro+Dialogue', zh: '微动作+对话' }];
        case '语义':
          return [{ en: 'Pressure', zh: '压力' }, { en: 'Advance', zh: '推进' }];
        default:
          return [];
      }
    case '中近景':
      switch (main) {
        case '主体位置':
          return [{ en: 'Left Third', zh: '左三分' }, { en: 'Center', zh: '中心' }, { en: 'Right Third', zh: '右三分' }];
        case '主体比例':
          return [{ en: '60-80%', zh: '正常' }, { en: '80-90%', zh: '更贴脸' }];
        case '空间类型':
          return [{ en: 'Interior Room', zh: '室内房间' }, { en: 'Vehicle Interior', zh: '车内' }];
        case '时间感':
          return [{ en: 'Stretched', zh: '拉长' }, { en: 'Slow', zh: '缓慢' }];
        case '光影/天气':
          return [{ en: 'Soft Daylight', zh: '柔和日光' }, { en: 'Backlight', zh: '逆光' }, { en: 'Neon Night', zh: '霓虹夜景' }];
        case '动态来源':
          return [{ en: 'Subject Micro', zh: '微表情' }];
        case '语义':
          return [{ en: 'Approach', zh: '靠近' }, { en: 'Pressure', zh: '压力' }];
        default:
          return [];
      }
    case '特写':
      switch (main) {
        case '主体位置':
          return [{ en: 'Center', zh: '中心' }, { en: 'Left Third', zh: '左三分' }, { en: 'Right Third', zh: '右三分' }];
        case '主体比例':
          return [{ en: '>90%', zh: '极大' }];
        case '空间类型':
          return [{ en: 'Atmospheric Void', zh: '大气虚空' }];
        case '时间感':
          return [{ en: 'Instant', zh: '瞬间' }];
        case '光影/天气':
          return [{ en: 'High Contrast', zh: '高对比' }, { en: 'Symbolic light', zh: '符号化光影' }];
        case '动态来源':
          return [{ en: 'None', zh: '无' }, { en: 'Subject Micro', zh: '微表情' }];
        case '语义':
          return [{ en: 'Reveal', zh: '揭示真相' }];
        default:
          return [];
      }
    default:
      return [];
  }
}

// 把参数拼成"[电影镜头指令] …"文本(格式与原网 getShotCardPrompt 完全一致)
function buildShotPrompt(c: any): string {
  const parts: string[] = [];
  if (c.shotType) parts.push(`景别：${c.shotType}`);
  if (c.cameraMovement && c.cameraMovement !== 'Follow/Tracking') parts.push(`运镜：${c.cameraMovement}`);
  if (c.composition) parts.push(`构图：${c.composition}`);
  if (c.subjectScale) parts.push(`主体比例：${c.subjectScale}`);
  if (c.spaceType) parts.push(`空间类型：${c.spaceType}`);
  if (c.timeFeeling) parts.push(`时间感：${c.timeFeeling}`);
  if (c.lighting) parts.push(`光影/天气：${c.lighting}`);
  if (c.motionSource) parts.push(`动态来源：${c.motionSource}`);
  if (c.semantic) parts.push(`语义：${c.semantic}`);
  return parts.length > 0 ? `[电影镜头指令] ${parts.join('，')}。` : '';
}

function ShotNodeComponent({ id, data, selected }: NodeProps<CardNode>) {
  const collapsed = data.collapsed ?? false;

  const updateCard = useCanvasStore((s) => s.updateCard);
  const updateConfig = useCanvasStore((s) => s.updateConfig);

  const [sub, setSub] = useState<string | null>(null);
  const [spawnOpen, setSpawnOpen] = useState(false);

  const cfg = data.config as any;
  const shotType: string = cfg.shotType || '全景';
  const cameraMovement: string = cfg.cameraMovement || 'Follow/Tracking';

  const cameraOptions = getCameraMovementOptions(shotType);
  const selectedCount = DIMENSIONS.filter((d) => cfg[d.key]).length;

  // 改参数 → 合并 config → 同步重算 data.text(下游连线读 texts)
  const applyPatch = (patch: any) => {
    const next = { ...cfg, ...patch };
    updateConfig(id, patch);
    const text = buildShotPrompt(next);
    updateCard(id, { text, status: text ? 'done' : 'empty' });
    (window as any).saveCanvasV2Now?.();
  };

  // 切换景别:运镜重置为新景别的首个选项(避免残留无效运镜)
  const pickShotType = (st: string) => {
    const opts = getCameraMovementOptions(st);
    applyPatch({ shotType: st, cameraMovement: opts[0]?.en ?? 'Static' });
    setSub(null);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCard(id, { collapsed: !collapsed });
  };

  // ===== 收起态 =====
  if (collapsed) {
    return (
      <>
        <Ports />
        <div onClick={toggleCollapse} style={collapsedCard(selected)}>
          <div style={collapsedIconWrap}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>电影控制器</div>
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{shotType} · 点击展开</div>
          </div>
          <button onClick={toggleCollapse} style={pillBtn}><IconPlus /></button>
        </div>
      </>
    );
  }

  // ===== 展开态 =====
  const promptText = buildShotPrompt(cfg);

  return (
    <>
      <Ports />

      {/* 卡片框 */}
      <div style={{
        width: 260, minHeight: 150,
        background: GLASS_BG,
        backgroundImage: 'linear-gradient(135deg, rgba(192,192,192,0.10) 0%, rgba(128,128,128,0.04) 100%)',
        border: `1px solid ${selected ? SEL_BORDER : GLASS_BORDER}`,
        borderRadius: 20,
        backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: selected ? '0 0 0 4px rgba(192,192,192,0.12), 0 18px 50px rgba(0,0,0,0.55)' : '0 10px 36px rgba(0,0,0,0.42)',
        transition: 'border-color .25s, box-shadow .25s',
        position: 'relative', padding: '14px 16px 16px', boxSizing: 'border-box',
      }}>
        <button onClick={toggleCollapse} style={floatMinus}><IconMinus /></button>

        {/* 标题 + 景别徽章 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-3v10l-6-3" />
          </svg>
          <span style={{ color: '#f4f4f5', fontSize: 13, fontWeight: 600 }}>电影控制器</span>
          <span style={shotBadge}>{shotType}</span>
        </div>

        {/* 参数摘要 / 提示 */}
        {promptText ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={summaryChip}>景别 {shotType}</span>
              {cameraMovement && cameraMovement !== 'Follow/Tracking' && (
                <span style={summaryChip}>运镜 {cameraMovement}</span>
              )}
              {selectedCount > 0 && <span style={summaryChip}>维度 {selectedCount}/7</span>}
            </div>
            <div style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.5, wordBreak: 'break-all' }}>
              {promptText}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#5a5a5f', lineHeight: 1.6 }}>
            选择镜头参数 → 连接到视频/图片卡
          </div>
        )}
      </div>

      {/* 底部弹窗 — 参数选择 */}
      <NodeToolbar isVisible={selected && !spawnOpen} position={Position.Bottom} offset={16}>
        <div className="nodrag nopan" style={promptBar} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <div style={tagsRow}>
            {/* 景别(必选) */}
            <ParamTag label={`景别 ${shotType}`} open={sub === 'shotType'} onToggle={() => setSub(sub === 'shotType' ? null : 'shotType')} width={200}>
              {SHOT_TYPES.map((st) => (
                <SubItem key={st} active={st === shotType} onClick={() => pickShotType(st)}>
                  <span>{st}</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 运镜(随景别变) */}
            <ParamTag label={`运镜 ${cameraMovement}`} open={sub === 'camera'} onToggle={() => setSub(sub === 'camera' ? null : 'camera')} width={240}>
              {cameraOptions.map((opt) => (
                <SubItem key={opt.en} active={opt.en === cameraMovement} onClick={() => { applyPatch({ cameraMovement: opt.en }); setSub(null); }}>
                  <span>{opt.en}</span><span style={subPrice}>{opt.zh}</span>
                </SubItem>
              ))}
            </ParamTag>

            {/* 7个导演思维维度(可选) */}
            {DIMENSIONS.map((dim) => {
              const cur = cfg[dim.key] || '';
              const opts = getDimensionOptions(shotType, dim.main);
              return (
                <ParamTag
                  key={dim.key}
                  label={<>{dim.label}{cur ? <span style={greenDot} /> : ''}</>}
                  open={sub === dim.key}
                  onToggle={() => setSub(sub === dim.key ? null : dim.key)}
                  width={240}
                >
                  {cur && (
                    <SubItem active={false} onClick={() => { applyPatch({ [dim.key]: '' }); setSub(null); }}>
                      <span style={{ color: '#f87171' }}>清除选择</span>
                    </SubItem>
                  )}
                  {opts.length === 0 ? (
                    <div style={{ padding: '9px 12px', fontSize: 12, color: '#71717a' }}>该景别无可选项</div>
                  ) : opts.map((opt) => (
                    <SubItem key={opt.en} active={opt.en === cur} onClick={() => { applyPatch({ [dim.key]: opt.en }); setSub(null); }}>
                      <span>{opt.en}</span><span style={subPrice}>{opt.zh}</span>
                    </SubItem>
                  ))}
                </ParamTag>
              );
            })}
          </div>

          <div style={{ padding: '4px 10px 8px', fontSize: 11, color: '#71717a' }}>
            指令实时输出 · 连接到视频/图片卡使用
          </div>
        </div>
      </NodeToolbar>
    </>
  );

  function Ports() {
    return (
      <>
        <Handle type="target" position={Position.Left} className="rf-port" style={{ ...portCircle(INPUT_PORT), left: -16 }} />
        <Handle type="source" position={Position.Right} className="rf-port rf-port-out"
          style={{ ...portCircle(OUTPUT_PORT), right: -16 }}
          onClick={(e) => { e.stopPropagation(); setSpawnOpen((v) => !v); }}>
          <span style={portPlusIcon}><IconPlus size={11} /></span>
        </Handle>
        {spawnOpen && <SpawnMenu sourceId={id} onClose={() => setSpawnOpen(false)} />}
      </>
    );
  }
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

// ===== 样式(照 ExtendNode) =====
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
const shotBadge: React.CSSProperties = {
  marginLeft: 'auto', padding: '2px 8px', borderRadius: 7,
  background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)',
  color: '#fbbf24', fontSize: 11, fontWeight: 700,
};
const summaryChip: React.CSSProperties = {
  padding: '3px 9px', borderRadius: 8, background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', fontSize: 11, whiteSpace: 'nowrap',
};
const promptBar: React.CSSProperties = {
  width: 520, background: 'rgba(24,24,27,0.92)',
  backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  border: `1px solid ${GLASS_BORDER}`, borderRadius: 18, padding: 10,
  boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative',
};
const tagsRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 8px 4px' };
const tagBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: '#e4e4e7', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
};
const tagActive: React.CSSProperties = { background: 'rgba(192,192,192,0.18)', color: '#fff', borderColor: 'rgba(192,192,192,0.4)' };
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
const subPrice: React.CSSProperties = { fontSize: 11, color: '#71717a', flexShrink: 0 };
const greenDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%', background: '#34d399',
  display: 'inline-block', marginLeft: 4,
};

export const ShotNode = memo(ShotNodeComponent);
