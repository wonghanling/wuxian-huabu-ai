'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import { uploadImageToStorage } from '../canvas-v2/lib/api';

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
  src: string;
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

export function SceneEditor({
  onExport,
  onFuse,
}: {
  /** 导出 PNG（blob URL 已上传后的地址） */
  onExport?: (url: string) => void;
  /** AI 融合：把合成图当参考图交出去 */
  onFuse?: (url: string, note: string) => void;
}) {
  const [ratio, setRatio] = useState('4:5');
  const [bg, setBg] = useState<string | null>(null);
  const [els, setEls] = useState<SceneElement[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

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
        id, src: url,
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
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* 左:素材与操作 */}
      <div style={{ width: 210, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Slot label="背景" hint="整张铺满的底图" onPick={(f) => addImage(f, true)} />
        <Slot label="产品 / 道具" hint="可加多个，逐个摆放" onPick={(f) => addImage(f, false)} />

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
            <div style={{ fontSize: 11, color: '#a1a1a6' }}>点画布上的元素来选中</div>
          )}
        </div>
      </div>

      {/* 中:画布 */}
      <div style={{ flexShrink: 0 }}>
        <Stage
          ref={stageRef}
          width={W}
          height={H}
          style={{ borderRadius: 10, overflow: 'hidden', background: '#f5f5f7', border: '1px solid rgba(0,0,0,.08)' }}
          onMouseDown={(e) => {
            // 点空白取消选中 —— 点到 Stage 本身说明没命中任何图形
            if (e.target === e.target.getStage()) setSel(null);
          }}
        >
          <Layer>
            {bg && <BgImage src={bg} w={W} h={H} />}

            {els.map((el) => (
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
              keepRatio
              anchorSize={8}
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
              flex: 1, padding: '9px 11px', borderRadius: 10, background: '#f5f5f7',
              border: '1px solid transparent', fontSize: 12, color: '#1d1d1f',
              outline: 'none', resize: 'none', lineHeight: 1.6,
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

        <div style={{ marginTop: 8, fontSize: 10.5, color: '#a1a1a6', lineHeight: 1.6 }}>
          直接导出在浏览器合成，产品外形与文字不会被改动，不消耗额度。
          AI 融合会把合成图交给模型统一光影，消耗额度且可能改变产品细节。
        </div>

        {busy && <div style={{ marginTop: 6, fontSize: 11.5, color: '#6e6e73' }}>{busy}</div>}
      </div>
    </div>
  );
}

function Slot({ label: l, hint, onPick }: { label: string; hint: string; onPick: (f: File) => void }) {
  return (
    <div>
      <div style={label}>{l}</div>
      <label style={{
        display: 'block', padding: '13px 10px', borderRadius: 10, cursor: 'pointer',
        border: '1px dashed rgba(0,0,0,.18)', textAlign: 'center',
        fontSize: 12, color: '#424245',
      }}>
        上传图片
        <input type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ''; }} />
      </label>
      <div style={{ fontSize: 10, color: '#a1a1a6', marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function BgImage({ src, w, h }: { src: string; w: number; h: number }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { loadImage(src).then(setImg).catch(() => {}); }, [src]);
  if (!img) return null;
  // 铺满画布并保持比例，超出部分裁掉 —— 与 CSS 的 object-fit: cover 同理
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  return <KImage image={img} x={(w - dw) / 2} y={(h - dh) / 2} width={dw} height={dh} listening={false} />;
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

const label: React.CSSProperties = { fontSize: 11.5, color: '#6e6e73', marginBottom: 6 };
const chip: React.CSSProperties = {
  padding: '6px 11px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: '#f5f5f7', color: '#424245', fontSize: 11.5, whiteSpace: 'nowrap',
};
const chipOn: React.CSSProperties = { ...chip, background: '#1d1d1f', color: '#fff' };
const btnGhost: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 999, border: '1px solid rgba(0,0,0,.14)',
  background: '#fff', color: '#1d1d1f', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnSolid: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 999, border: 'none',
  background: '#1d1d1f', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
};
