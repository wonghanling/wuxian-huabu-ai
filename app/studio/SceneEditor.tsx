'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Text as KText, Rect, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import { uploadImageToStorage } from '../canvas-v2/lib/api';
import { GenElementModal } from './GenElementModal';

// ============================================================
// 场景编排
//
// 在浏览器里把背景、产品、道具摆成一张图 —— 拖动缩放旋转、调层级，
// 然后两种出图方式:
//   直接导出  浏览器合成 PNG，产品外形与 Logo 不会被 AI 改掉，不花钱
//   AI 融合   把合成图当参考图交给模型统一光影，会扣费也可能改产品细节
//
// 为什么用 Konva 而不是无限画布那套 React Flow:两者解决的问题不同 ——
// React Flow 管的是节点与连线，这里要的是固定画布内的图层变换(缩放、
// 旋转、层级、导出位图)，Konva 正是为此设计的。
//
// Konva 依赖浏览器 canvas API，服务端渲染会直接报错 —— 所以本组件必须
// 由调用方用 next/dynamic + ssr:false 引入。那样也顺带让它只在打开这个
// 标签页时才加载，生图页与其他页面的首屏包不受影响。
// ============================================================

export type SceneElement = {
  id: string;
  /** image = 图片素材，text = 文字 */
  kind: 'image' | 'text';
  /** kind=image 时是图片地址；kind=text 时忽略 */
  src: string;
  /** kind=text 时的文字内容与样式 */
  text?: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

const RATIOS = [
  { key: '1:1', w: 1, h: 1 },
  { key: '4:5', w: 4, h: 5 },
  { key: '3:4', w: 3, h: 4 },
  { key: '16:9', w: 16, h: 9 },
];

/** 画布长边的显示像素。导出时按这个尺寸的 2 倍出图，避免成品发虚。 */
const BASE = 720;
/** 安全边距占比 —— 印刷与社媒都习惯留边，重要内容不要压到边缘 */
const SAFE = 0.06;
/** 吸附阈值(像素):离中线或边距这么近就贴上去 */
const SNAP = 8;
/** 背景的固定 id。让它和普通元素共用选中/变换/删除那套逻辑，
 *  不必为背景单独写一份。 */
const BG_ID = '__bg__';

/** 字体模板。用系统字体栈而不是加载 Web Font ——
 *  Konva 导出时若字体还没加载完会退回默认字体，成品与预览不一致。
 *  系统字体没有这个风险。 */
const FONTS = [
  { label: '黑体', value: '"PingFang SC","Microsoft YaHei",sans-serif' },
  { label: '宋体', value: '"Songti SC","SimSun",serif' },
  { label: '楷体', value: '"Kaiti SC","KaiTi",serif' },
  { label: '圆体', value: '"Yuanti SC","YouYuan",sans-serif' },
  { label: '等宽', value: '"SF Mono",Consolas,monospace' },
];

/** 常用文字色。黑白为主 —— 商业海报上的文字极少用鲜艳色。 */
const COLORS = ['#ffffff', '#000000', '#f5f5f7', '#1d1d1f', '#f97316', '#dc2626', '#0ea5e9', '#facc15'];

/** 场景状态。由父层持有 —— 切到生图标签再切回来时内容不能丢。 */
export type SceneState = {
  ratio: string;
  bg: string | null;
  els: SceneElement[];
};

export const EMPTY_SCENE: SceneState = { ratio: '4:5', bg: null, els: [] };

export function SceneEditor({
  state,
  setState,
  onExport,
  onFuse,
  assets,
  onNewAsset,
}: {
  state: SceneState;
  setState: (patch: Partial<SceneState>) => void;
  /** 导出 PNG（blob URL 已上传后的地址） */
  onExport?: (url: string) => void;
  /** AI 融合：把合成图当参考图交出去 */
  onFuse?: (url: string, note: string) => void;
  /** 生成过的透明素材，供重复使用 */
  assets?: string[];
  onNewAsset?: (url: string) => void;
}) {
  const { ratio, bg, els } = state;
  const setRatio = (v: string) => setState({ ratio: v });
  const setBg = (v: string | null) => setState({ bg: v });
  const setEls = (fn: SceneElement[] | ((cur: SceneElement[]) => SceneElement[])) =>
    setState({ els: typeof fn === 'function' ? fn(els) : fn });
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  // 生成透明元素的弹窗。target 决定生成结果放哪:
  // 'bg' 当背景铺满，'el' 作为可摆放的元素。
  const [genFor, setGenFor] = useState<null | 'bg' | 'el'>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Image | null>>({});

  const r = RATIOS.find((x) => x.key === ratio)!;
  const W = r.w >= r.h ? BASE : Math.round((r.w / r.h) * BASE);
  const H = r.h > r.w ? BASE : Math.round((r.h / r.w) * BASE);

  // 选中变化时把 Transformer 挂到对应图形上
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = sel ? shapeRefs.current[sel] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [sel, els.length]);

  // ── 上传:图片进画布，按比例缩到合适大小 ──
  const addImage = useCallback(async (file: File, asBackground: boolean) => {
    setBusy(asBackground ? '上传背景…' : '上传素材…');
    try {
      const url = await uploadImageToStorage(file);
      if (!url) throw new Error('上传失败');
      if (asBackground) {
        setBg(url);
        return;
      }
      // 探测原始宽高，让新元素保持原比例、占画布约四成宽
      const img = await loadImage(url);
      const targetW = W * 0.4;
      const scale = targetW / img.naturalWidth;
      const id = `el${Date.now()}${Math.floor(Math.random() * 100)}`;
      setEls((cur) => [...cur, {
        id, kind: 'image', src: url,
        x: (W - targetW) / 2,
        y: (H - img.naturalHeight * scale) / 2,
        width: targetW,
        height: img.naturalHeight * scale,
        rotation: 0,
      }]);
      setSel(id);
    } catch (e: any) {
      alert((e?.message || e) + '');
    } finally {
      setBusy('');
    }
  }, [W, H]);

  // 把一个已有地址放进画布 —— 生成透明元素后走这条，不必再上传一遍
  const addUrl = useCallback(async (url: string) => {
    try {
      const img = await loadImage(url);
      const targetW = W * 0.4;
      const scale = targetW / img.naturalWidth;
      const id = `el${Date.now()}${Math.floor(Math.random() * 100)}`;
      setEls((cur) => [...cur, {
        id, kind: 'image', src: url,
        x: (W - targetW) / 2,
        y: (H - img.naturalHeight * scale) / 2,
        width: targetW,
        height: img.naturalHeight * scale,
        rotation: 0,
      }]);
      setSel(id);
    } catch (e: any) {
      alert('放入失败: ' + (e?.message || e));
    }
  }, [W, H]);

  // 加一段文字。宽度给足画布六成 —— 文字元素的 width 决定换行位置，
  // 太窄会挤成一列。
  const addText = () => {
    const id = `tx${Date.now()}${Math.floor(Math.random() * 100)}`;
    setEls((cur) => [...cur, {
      id, kind: 'text', src: '',
      text: '双击编辑文字',
      fontSize: Math.round(W * 0.06),
      color: '#ffffff',
      fontFamily: FONTS[0].value,
      x: W * 0.2, y: H * 0.5,
      width: W * 0.6, height: Math.round(W * 0.06) * 1.4,
      rotation: 0,
    }]);
    setSel(id);
  };

  // ── 拖动时的吸附与辅助线 ──
  const onDragMove = (id: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const cx = node.x() + node.width() * node.scaleX() / 2;
    const cy = node.y() + node.height() * node.scaleY() / 2;
    let v = false, h = false;

    if (Math.abs(cx - W / 2) < SNAP) {
      node.x(W / 2 - node.width() * node.scaleX() / 2);
      v = true;
    }
    if (Math.abs(cy - H / 2) < SNAP) {
      node.y(H / 2 - node.height() * node.scaleY() / 2);
      h = true;
    }
    setGuides({ v, h });
  };

  const commit = (id: string) => (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target as Konva.Image;
    setEls((cur) => cur.map((el) => el.id === id ? {
      ...el,
      x: n.x(), y: n.y(),
      // Transformer 改的是 scale，存进数据时折算回 width/height ——
      // 否则同一个元素会同时有两套尺寸信息，日后恢复场景容易错
      width: Math.max(20, n.width() * n.scaleX()),
      height: Math.max(20, n.height() * n.scaleY()),
      rotation: n.rotation(),
    } : el));
    n.scaleX(1);
    n.scaleY(1);
    setGuides({ v: false, h: false });
  };

  /** 改选中文字的样式 */
  const patchSel = (patch: Partial<SceneElement>) => {
    if (!sel) return;
    setEls((cur) => cur.map((e) => e.id === sel ? { ...e, ...patch } : e));
  };

  const selEl = els.find((e) => e.id === sel);

  // ── 层级 ──
  const move = (dir: -1 | 1) => {
    if (!sel) return;
    setEls((cur) => {
      const i = cur.findIndex((e) => e.id === sel);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // 一步置顶 / 置底。逐层移动在道具多了以后要点很多次 ——
  // 用户真正想的往往是"把这个拿到最前面"。
  const toEdge = (front: boolean) => {
    if (!sel) return;
    setEls((cur) => {
      const t = cur.find((e) => e.id === sel);
      if (!t) return cur;
      const rest = cur.filter((e) => e.id !== sel);
      // 数组顺序即层级:靠后的画在上面
      return front ? [...rest, t] : [t, ...rest];
    });
  };

  const duplicate = () => {
    if (!sel) return;
    const src = els.find((e) => e.id === sel);
    if (!src) return;
    const id = `el${Date.now()}${Math.floor(Math.random() * 100)}`;
    setEls((cur) => [...cur, { ...src, id, x: src.x + 24, y: src.y + 24 }]);
    setSel(id);
  };

  const remove = () => {
    if (!sel) return;
    if (sel === BG_ID) { setBg(null); setSel(null); return; }
    setEls((cur) => cur.filter((e) => e.id !== sel));
    setSel(null);
  };

  // ── 导出:先取消选中，否则选择框会被画进成品 ──
  const render = async (): Promise<string | null> => {
    setSel(null);
    setGuides({ v: false, h: false });
    await new Promise((res) => requestAnimationFrame(() => res(null)));
    const stage = stageRef.current;
    if (!stage) return null;
    // 2 倍像素比:BASE 是显示尺寸，直接导出会偏软
    return stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' });
  };

  const doExport = async () => {
    setBusy('导出中…');
    try {
      const dataUrl = await render();
      if (!dataUrl) throw new Error('导出失败');
      // 下载给用户，同时把地址交回上层(存历史或当参考图)
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `scene-${Date.now()}.png`;
      a.click();
      onExport?.(dataUrl);
    } catch (e: any) {
      alert((e?.message || e) + '');
    } finally {
      setBusy('');
    }
  };

  const doFuse = async () => {
    setBusy('准备融合…');
    try {
      const dataUrl = await render();
      if (!dataUrl) throw new Error('合成失败');
      // 转成文件上传 —— 生图接口要的是 URL，data URL 太长塞不进请求
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `scene-${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadImageToStorage(file);
      if (!url) throw new Error('上传合成图失败');
      onFuse?.(url, note.trim());
    } catch (e: any) {
      alert((e?.message || e) + '');
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', minHeight: 0, height: '100%' }}>
      {/* 左:素材与操作。占一半宽 —— 原先固定 210px，右边留一大片空白浪费。 */}
      <div style={{
        flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 13,
        overflowY: 'auto', paddingRight: 4,
      }}>
        <Row
          label="背景"
          hint="整张铺满的底图"
          onPick={(f) => addImage(f, true)}
          onGen={() => setGenFor('bg')}
        />
        <Row
          label="产品"
          hint="主体，通常放中下方"
          onPick={(f) => addImage(f, false)}
          onGen={() => setGenFor('el')}
        />
        <Row
          label="道具 / 人物"
          hint="可加多个，逐个摆放"
          onPick={(f) => addImage(f, false)}
          onGen={() => setGenFor('el')}
        />

        <div>
          <div style={label}>文字</div>
          <button onClick={addText} style={{ ...uploadBtn, width: '100%' }}>添加文字</button>
          <div style={{ fontSize: 10, color: '#8b8b90', marginTop: 4 }}>双击画布上的文字可改内容</div>
        </div>

        <div>
          <div style={label}>画布比例</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RATIOS.map((x) => (
              <button key={x.key} onClick={() => setRatio(x.key)}
                style={ratio === x.key ? chipOn : chip}>{x.key}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={label}>选中元素</div>
          {sel ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => toEdge(true)} style={chip}>移到最前</button>
              <button onClick={() => toEdge(false)} style={chip}>移到最后</button>
              <button onClick={() => move(1)} style={chip}>上移一层</button>
              <button onClick={() => move(-1)} style={chip}>下移一层</button>
              <button onClick={duplicate} style={chip}>复制</button>
              <button onClick={remove} style={chip}>删除</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#8b8b90' }}>点画布上的元素来选中</div>
          )}
        </div>

        {/* 文字样式。只在选中文字时出现 —— 图片没有字体颜色可调。 */}
        {selEl?.kind === 'text' && (
          <>
            <div>
              <div style={label}>字体</div>
              <select
                value={selEl.fontFamily ?? FONTS[0].value}
                onChange={(e) => patchSel({ fontFamily: e.target.value })}
                style={selectSm}
              >
                {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
              </select>
            </div>

            <div>
              <div style={label}>字号 {selEl.fontSize ?? 32}</div>
              <input
                type="range" min={12} max={Math.round(W * 0.2)} step={1}
                value={selEl.fontSize ?? 32}
                onChange={(e) => patchSel({ fontSize: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#fff' }}
              />
            </div>

            <div>
              <div style={label}>颜色</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patchSel({ color: c })}
                    title={c}
                    style={{
                      width: 22, height: 22, borderRadius: 6, cursor: 'pointer', background: c,
                      border: (selEl.color ?? '#ffffff') === c
                        ? '2px solid #f97316'
                        : '1px solid rgba(255,255,255,.25)',
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右:画布。与左栏各占一半。 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Stage
          ref={stageRef}
          width={W}
          height={H}
          style={{
            borderRadius: 10, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,.12)',
            // 棋盘格:透明元素在纯色底上看不出哪里是透明的，这是图像软件的通用做法
            backgroundColor: '#2a2a2e',
            backgroundImage:
              'linear-gradient(45deg, #35353a 25%, transparent 25%),' +
              'linear-gradient(-45deg, #35353a 25%, transparent 25%),' +
              'linear-gradient(45deg, transparent 75%, #35353a 75%),' +
              'linear-gradient(-45deg, transparent 75%, #35353a 75%)',
            backgroundSize: '18px 18px',
            backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0',
          }}
          onMouseDown={(e) => {
            // 点空白取消选中 —— 点到 Stage 本身说明没命中任何图形
            if (e.target === e.target.getStage()) setSel(null);
          }}
        >
          <Layer>
            {bg && (
              <BgImage
                src={bg} w={W} h={H}
                onRef={(n) => { shapeRefs.current[BG_ID] = n; }}
                onSelect={() => setSel(BG_ID)}
                onDragMove={onDragMove(BG_ID)}
                onCommit={() => { /* 背景不写回 els，位置由用户自由拖动即可 */ }}
              />
            )}

            {els.map((el) => el.kind === 'text' ? (
              <ElText
                key={el.id}
                el={el}
                onRef={(n) => { shapeRefs.current[el.id] = n as any; }}
                onSelect={() => setSel(el.id)}
                onDragMove={onDragMove(el.id)}
                onCommit={commit(el.id)}
                onEdit={() => {
                  // 双击改文字。用 prompt 而不是自绘输入框 —— Konva 里做
                  // 富文本编辑要叠一层 DOM 并同步坐标，那是另一个量级的工作，
                  // 对"加一行标题"这个需求不值得。
                  const v = window.prompt('文字内容', el.text ?? '');
                  if (v != null) setEls((cur) => cur.map((x) => x.id === el.id ? { ...x, text: v } : x));
                }}
              />
            ) : (
              <ElImage
                key={el.id}
                el={el}
                onRef={(n) => { shapeRefs.current[el.id] = n; }}
                onSelect={() => setSel(el.id)}
                onDragMove={onDragMove(el.id)}
                onCommit={commit(el.id)}
              />
            ))}

            {/* 安全边距:虚线框提示重要内容别压到边上 */}
            <Rect
              x={W * SAFE} y={H * SAFE}
              width={W * (1 - SAFE * 2)} height={H * (1 - SAFE * 2)}
              stroke="rgba(0,0,0,.16)" strokeWidth={1} dash={[5, 5]} listening={false}
            />
            {/* 居中线:只在吸附命中时出现，平时不干扰 */}
            {guides.v && <Line points={[W / 2, 0, W / 2, H]} stroke="#f97316" strokeWidth={1} listening={false} />}
            {guides.h && <Line points={[0, H / 2, W, H / 2]} stroke="#f97316" strokeWidth={1} listening={false} />}

            <Transformer
              ref={trRef}
              rotateEnabled
              // 默认自由缩放，按住 Shift 锁比例 —— 与设计软件习惯一致。
              // 原先写死 keepRatio，道具没法拉扁或拉长。
              keepRatio={false}
              anchorSize={9}
              borderStroke="#1d1d1f"
              anchorStroke="#1d1d1f"
              boundBoxFunc={(_, box) => (box.width < 20 || box.height < 20 ? _ : box)}
            />
          </Layer>
        </Stage>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="AI 融合时的补充说明，如:统一为暖色调影棚光，产品保持原样"
            rows={2}
            style={{
              flex: 1, padding: '9px 11px', borderRadius: 10,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)',
              fontSize: 12, color: '#f5f5f7', outline: 'none', resize: 'none', lineHeight: 1.6,
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
            <button onClick={doExport} disabled={!!busy} style={btnGhost}>
              直接导出
            </button>
            <button onClick={doFuse} disabled={!!busy} style={btnSolid}>
              AI 融合
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 10.5, color: '#8b8b90', lineHeight: 1.6 }}>
          直接导出在浏览器合成，产品外形与文字不会被改动，不消耗额度。
          AI 融合会把合成图交给模型统一光影，消耗额度且可能改变产品细节。
        </div>

        {busy && <div style={{ marginTop: 6, fontSize: 11.5, color: '#d4d4d8' }}>{busy}</div>}
      </div>

      {/* 最右:素材历史。生成一个透明元素要花 ¥0.3~0.63，只用一次太浪费 ——
          存起来能反复摆进不同场景。窄栏可滑动，不占主视野。 */}
      <div style={{
        width: 76, flexShrink: 0, overflowY: 'auto',
        borderLeft: '1px solid rgba(255,255,255,.1)', paddingLeft: 10,
      }}>
        <div style={{ fontSize: 10.5, color: '#8b8b90', marginBottom: 8 }}>素材</div>
        {(assets ?? []).length === 0 ? (
          <div style={{ fontSize: 10, color: '#6b6b70', lineHeight: 1.6 }}>
            生成过的透明元素会留在这里
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {(assets ?? []).map((u) => (
              <button
                key={u}
                onClick={() => addUrl(u)}
                title="点击加入画布"
                style={{
                  width: '100%', aspectRatio: '1', padding: 0, cursor: 'pointer',
                  borderRadius: 7, border: '1px solid rgba(255,255,255,.14)',
                  overflow: 'hidden',
                  // 缩略图也用棋盘格 —— 否则透明素材在深色底上看不清边界
                  backgroundColor: '#2a2a2e',
                  backgroundImage:
                    'linear-gradient(45deg, #3a3a40 25%, transparent 25%),' +
                    'linear-gradient(-45deg, #3a3a40 25%, transparent 25%),' +
                    'linear-gradient(45deg, transparent 75%, #3a3a40 75%),' +
                    'linear-gradient(-45deg, transparent 75%, #3a3a40 75%)',
                  backgroundSize: '10px 10px',
                  backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
                }}
              >
                <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 生成透明元素。target 决定结果放哪 —— 背景铺满，元素可摆放。 */}
      {genFor && (
        <GenElementModal
          onClose={() => setGenFor(null)}
          onDone={(url) => {
            if (genFor === 'bg') setBg(url);
            else addUrl(url);
            // 无论用作背景还是元素都记进素材库 —— 花过钱的东西不该用一次就丢
            onNewAsset?.(url);
          }}
        />
      )}
    </div>
  );
}

/** 一行素材槽:上传与生成并列 —— 用户手里有图就上传，没有就让模型生成一个 */
function Row({
  label: l, hint, onPick, onGen,
}: {
  label: string; hint: string; onPick: (f: File) => void; onGen: () => void;
}) {
  return (
    <div>
      <div style={label}>{l}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <label style={{ ...uploadBtn, flex: 1 }}>
          上传
          <input type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ''; }} />
        </label>
        <button onClick={onGen} style={{ ...uploadBtn, flex: 1.4 }}>生成透明元素</button>
      </div>
      <div style={{ fontSize: 10, color: '#8b8b90', marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function BgImage({
  src, w, h, onRef, onSelect, onDragMove, onCommit,
}: {
  src: string; w: number; h: number;
  onRef: (n: Konva.Image | null) => void;
  onSelect: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onCommit: (e: Konva.KonvaEventObject<Event>) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { loadImage(src).then(setImg).catch(() => {}); }, [src]);
  if (!img) return null;
  // 默认铺满并保持比例(等同 CSS object-fit: cover)，但可以被选中后自由调整 ——
  // 原先 listening={false} 让用户既点不到也删不掉，是个明显的缺陷。
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  return (
    <KImage
      ref={onRef}
      image={img}
      x={(w - dw) / 2} y={(h - dh) / 2} width={dw} height={dh}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onCommit}
      onTransformEnd={onCommit}
    />
  );
}

function ElImage({
  el, onRef, onSelect, onDragMove, onCommit,
}: {
  el: SceneElement;
  onRef: (n: Konva.Image | null) => void;
  onSelect: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onCommit: (e: Konva.KonvaEventObject<Event>) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { loadImage(el.src).then(setImg).catch(() => {}); }, [el.src]);
  if (!img) return null;
  return (
    <KImage
      ref={onRef}
      image={img}
      x={el.x} y={el.y} width={el.width} height={el.height} rotation={el.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragMove={onDragMove}
      onDragEnd={onCommit}
      onTransformEnd={onCommit}
    />
  );
}

function ElText({
  el, onRef, onSelect, onDragMove, onCommit, onEdit,
}: {
  el: SceneElement;
  onRef: (n: Konva.Text | null) => void;
  onSelect: () => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onCommit: (e: Konva.KonvaEventObject<Event>) => void;
  onEdit: () => void;
}) {
  return (
    <KText
      ref={onRef}
      text={el.text ?? ''}
      x={el.x} y={el.y} width={el.width} rotation={el.rotation}
      fontSize={el.fontSize ?? 32}
      fill={el.color ?? '#ffffff'}
      fontFamily={el.fontFamily ?? FONTS[0].value}
      fontStyle="bold"
      align="center"
      // 描边让文字在任何底色上都读得清 —— 白字压在浅色背景上会看不见
      stroke="rgba(0,0,0,.35)"
      strokeWidth={1}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDblClick={onEdit}
      onDblTap={onEdit}
      onDragMove={onDragMove}
      onDragEnd={onCommit}
      onTransformEnd={onCommit}
    />
  );
}

/** crossOrigin 必须设 —— 不设的话导出时 canvas 被跨域图污染，toDataURL 抛错 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('图片加载失败'));
    im.src = src;
  });
}

const label: React.CSSProperties = { fontSize: 11.5, color: '#a1a1aa', marginBottom: 6 };
const selectSm: React.CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 8, fontSize: 11.5,
  background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)',
  color: '#f5f5f7', outline: 'none',
};

const uploadBtn: React.CSSProperties = {
  display: 'block', padding: '9px 8px', borderRadius: 9, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.06)',
  textAlign: 'center', fontSize: 11.5, color: '#f5f5f7', whiteSpace: 'nowrap',
};
const chip: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)',
  cursor: 'pointer', background: 'rgba(255,255,255,.06)', color: '#d4d4d8',
  fontSize: 11.5, whiteSpace: 'nowrap',
};
const chipOn: React.CSSProperties = { ...chip, background: '#fff', color: '#1d1d1f', borderColor: '#fff' };
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.2)',
  background: 'transparent', color: '#f5f5f7', fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnSolid: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 999, border: 'none',
  background: '#fff', color: '#1d1d1f', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
