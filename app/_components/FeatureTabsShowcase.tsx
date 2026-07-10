'use client';

import { useState, useRef, useEffect } from 'react';

// 8 张卡片，4列x2行，结构对齐 flora.ai Featured Techniques
// 每张卡: image=卡槽封面图；workflow=点击后打开的完整工作流大图(可整体拖动平移查看)
// 未配图的仍显示占位块，等后续替换
const CARDS: { key: string; title: string; desc: string; image?: string; workflow?: string | string[] }[] = [
  {
    key: 'card-1',
    title: '角色设计',
    desc: '根据人物图片快速生成多视角的角色',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/20ce33c8-6a71-41a1-804e-4997b4d95476/1783646629738.jpg',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/20ce33c8-6a71-41a1-804e-4997b4d95476/1783649211596-zq4lqg589z.jpg',
  },
  {
    key: 'card-2',
    title: 'seedance 真人过审设定图',
    desc: '一键生成过审合规人物角色图',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783580645778.jpg',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783651713030-tvdhe5cr0of.jpg',
  },
  {
    key: 'card-3',
    title: '时空镜头调整',
    desc: '镜头前后穿梭并且可控制摄像机位',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783658185613.jpg',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783658509346-kjx0xq784p.jpg',
  },
  {
    key: 'card-4',
    title: '智能多宫格分镜生成词',
    desc: '一键根据多图生成专业的多宫格电影广告生成词',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783660122809.jpg',
    workflow: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/kendeji2.png',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/kendeji3.png',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/kendeji4.png',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/images/kendeji5.png',
    ],
  },
  ...Array.from({ length: 4 }, (_, i) => ({
    key: `card-${i + 5}`,
    title: `占位标题 ${i + 5}`,
    desc: '占位描述文字，后续替换为真实功能说明。',
  })),
];

export function FeatureTabsShowcase() {
  // 当前打开的工作流大图(null 表示未打开)
  const [openWorkflow, setOpenWorkflow] = useState<string | string[] | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-6">

      {/* 顶部：左侧标题+副标题，右侧链接 */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: 'rgb(238,238,238)' }}>
            核心功能
          </h2>
          <p className="text-base" style={{ color: 'rgb(150,150,150)' }}>
            一个画布，覆盖创作全流程
          </p>
        </div>
        <a
          href="/canvas"
          className="flex items-center gap-1 text-sm font-medium mt-1 hover:opacity-70 transition-opacity"
          style={{ color: 'rgb(238,238,238)' }}
        >
          进入画布 <span style={{ fontSize: 16 }}>↗</span>
        </a>
      </div>

      {/* 4列×2行卡片网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((f) => {
          const clickable = !!f.workflow;
          return (
            <div
              key={f.key}
              onClick={clickable ? () => setOpenWorkflow(f.workflow!) : undefined}
              className={`rounded-2xl overflow-hidden flex flex-col transition-transform duration-300 ${clickable ? 'cursor-pointer hover:-translate-y-1' : ''}`}
              style={{ background: 'linear-gradient(160deg, rgb(30,30,30), rgb(14,14,14))' }}
            >
              {/* 图片区：铺满卡槽顶部 */}
              <div
                className="w-full flex items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: '4/3',
                  background: f.image ? 'transparent' : 'linear-gradient(160deg, rgb(70,70,70), rgb(32,32,32))',
                }}
              >
                {f.image ? (
                  <img src={f.image} alt={f.title} className="w-full h-full object-cover" draggable={false} />
                ) : (
                  <span className="text-sm" style={{ color: 'rgb(120,120,120)' }}>占位图片</span>
                )}
              </div>

              {/* 文字区 */}
              <div className="px-4 pt-3 pb-4 flex flex-col gap-1">
                <h3 className="text-base font-bold leading-snug" style={{ color: 'rgb(238,238,238)' }}>
                  {f.title}
                </h3>
                <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgb(150,150,150)' }}>
                  {f.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 工作流查看弹窗：整张流程图，可整体拖动平移(不是真画布，不能单独拖节点) */}
      {openWorkflow && (
        <WorkflowViewer src={openWorkflow} onClose={() => setOpenWorkflow(null)} />
      )}
    </div>
  );
}

// 工作流查看器：全屏遮罩 + 可拖动平移的大图。支持单图或多图(带左右切换)。
function WorkflowViewer({ src, onClose }: { src: string | string[]; onClose: () => void }) {
  const images = Array.isArray(src) ? src : [src];
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });

  // Esc 关闭 + 打开时锁定页面滚动
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragState.current = { dragging: true, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d.dragging) return;
    setPos({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
  };
  const onPointerUp = () => { dragState.current.dragging = false; setDragging(false); };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors z-10"
        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
      >
        ✕
      </button>

      {/* 提示 */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-xs" style={{ color: 'rgb(150,150,150)' }}>
        拖动查看完整工作流 · 浏览器缩放可放大细节
        {images.length > 1 && ` · ${idx + 1} / ${images.length}`}
      </div>

      {/* 多图时左右切换按钮 */}
      {images.length > 1 && (
        <>
          <button
            className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-lg z-10"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', opacity: idx === 0 ? 0.3 : 1 }}
            onClick={(e) => { e.stopPropagation(); if (idx > 0) { setIdx(idx - 1); setPos({ x: 0, y: 0 }); } }}
          >
            ‹
          </button>
          <button
            className="absolute right-16 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-lg z-10"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', opacity: idx === images.length - 1 ? 0.3 : 1 }}
            onClick={(e) => { e.stopPropagation(); if (idx < images.length - 1) { setIdx(idx + 1); setPos({ x: 0, y: 0 }); } }}
          >
            ›
          </button>
        </>
      )}

      {/* 可拖动平移的工作流大图容器(点击图区不关闭，只有点遮罩才关) */}
      <div
        className="select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={images[idx]}
          alt="完整工作流"
          draggable={false}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            maxWidth: 'none',
            maxHeight: '90vh',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
