'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// 8 张卡片，4列x2行，结构对齐 flora.ai Featured Techniques
// 每张卡: image=卡槽封面图；workflow=点击后打开的完整工作流大图(可整体拖动平移查看)
// 未配图的仍显示占位块，等后续替换
const CARDS: { key: string; title: string; desc: string; note?: string; image?: string; video?: string; aspect?: string; workflow?: string | string[]; audios?: { label: string; src: string }[] }[] = [
  {
    key: 'card-1',
    title: '角色设计',
    desc: '根据人物图片快速生成多视角的角色',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/5f4604d9-8f1e-43c4-9ca2-dc994ca08848/1779675071210-crb634hpttj.jpg?quality=80',
    aspect: '16/9',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/20ce33c8-6a71-41a1-804e-4997b4d95476/1783649211596-zq4lqg589z.jpg?quality=80',
  },
  {
    key: 'card-2',
    title: '真人过审设定图',
    desc: '一键生成过审合规人物角色图',
    note: '用户自带 Key 不含此商业人脸过审工作流；Filmavo 通道快速生成真人视频，无需审核',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783580645778.jpg?quality=80',
    aspect: '16/9',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783651713030-tvdhe5cr0of.jpg?quality=80',
  },
  {
    key: 'card-3',
    title: '时空镜头调整',
    desc: '镜头前后穿梭并且可控制摄像机位',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783658185613.jpg?quality=80',
    workflow: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783658509346-kjx0xq784p.jpg?quality=80',
  },
  {
    key: 'card-4',
    title: 'step2 生成多宫格提示词',
    desc: '一键根据多图生成专业的多宫格电影广告生成词',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783660122809.jpg?quality=80',
    workflow: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/kendeji2.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/kendeji3.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/kendeji4.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/kendeji5.png?quality=80',
    ],
  },
  {
    key: 'card-5',
    title: 'step3 首尾帧过渡生成词',
    desc: '上传两张图片首帧和尾帧生成专业的过渡视频生成词',
    video: 'https://filmavo.blob.core.windows.net/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783662982357.mp4',
    aspect: '16/9',
    workflow: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/shouwei1.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/shouwei2.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/shouwei3.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/shouwei4.png?quality=80',
    ],
  },
  {
    key: 'card-6',
    title: '导演分镜表 step4',
    desc: '专业的导演拍摄语言用于完整的传输生成可控画面',
    video: 'https://filmavo.blob.core.windows.net/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781873531149.mp4',
    aspect: '16/9',
    workflow: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781869076179.jpg?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/Step4-4.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1781873096752.jpg?quality=80',
    ],
  },
  {
    key: 'card-7',
    title: '配音场景音效',
    desc: '多功能语音生成用于配音视频画面',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783667137447.jpg?quality=80',
    aspect: '16/9',
    workflow: [
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/yuyin1.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/yuyin2.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/yuyin3.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/yuyin4.png?quality=80',
      'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/yuyin5.png?quality=80',
    ],
    audios: [
      { label: '战斗机作战场景音效', src: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets/audio/59bde757-0c1f-49ef-b078-6b3ea6a5ac91/1783666568825-3gecbsfa6kx.mp3' },
    ],
  },
  {
    key: 'card-8',
    title: '3D 导演预览台',
    desc: '可以快速解决画面人物结构问题，精准控制视频走向',
    image: 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/render/image/public/assets/images/3Ddaoyantai.png?quality=80',
    aspect: '16/9',
  },
];

export function FeatureTabsShowcase() {
  // 当前打开的工作流大图(null 表示未打开)
  const [openCard, setOpenCard] = useState<{ workflow: string | string[]; audios?: { label: string; src: string }[] } | null>(null);

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
              onClick={clickable ? () => setOpenCard({ workflow: f.workflow!, audios: f.audios }) : undefined}
              className={`rounded-2xl overflow-hidden flex flex-col transition-transform duration-300 ${clickable ? 'cursor-pointer hover:-translate-y-1' : ''}`}
              style={{ background: 'linear-gradient(160deg, rgb(30,30,30), rgb(14,14,14))' }}
            >
              {/* 封面区：铺满卡槽顶部，支持图片/视频，比例可按卡片自定义(默认4:3) */}
              <div
                className="w-full flex items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: f.aspect || '4/3',
                  background: (f.image || f.video) ? 'transparent' : 'linear-gradient(160deg, rgb(70,70,70), rgb(32,32,32))',
                }}
              >
                {f.video ? (
                  <video src={f.video} className="w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" />
                ) : f.image ? (
                  <img src={f.image} alt={f.title} className="w-full h-full object-cover" draggable={false} loading="lazy" />
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
                {/* 附加说明:自带 Key 与 Filmavo 通道的差异 */}
                {f.note && (
                  <p
                    className="text-[10.5px] leading-relaxed mt-2 pt-2"
                    style={{ color: 'rgb(120,120,120)', borderTop: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {f.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 工作流查看弹窗：整张流程图，可整体拖动平移(不是真画布，不能单独拖节点) */}
      {openCard && (
        <WorkflowViewer src={openCard.workflow} audios={openCard.audios} onClose={() => setOpenCard(null)} />
      )}
    </div>
  );
}

// 工作流查看器：全屏遮罩 + 可拖动平移的大图。支持单图或多图(带左右切换)。
function WorkflowViewer({ src, audios, onClose }: { src: string | string[]; audios?: { label: string; src: string }[]; onClose: () => void }) {
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

  // 查看器仅在用户点击后(纯客户端)渲染，document 必然存在；SSR 兜底判断
  if (typeof document === 'undefined') return null;

  // 用 Portal 渲染到 body，脱离任何带 transform 的祖先，保证 fixed 相对视口铺满、不与首页重叠
  return createPortal(
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

      {/* 试听语音面板：固定在底部，不随大图拖动 */}
      {audios && audios.length > 0 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-2 rounded-2xl p-4"
          style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', maxWidth: '90vw' }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {audios.map((a) => (
            <div key={a.src} className="flex items-center gap-3">
              <span className="text-xs whitespace-nowrap" style={{ color: 'rgb(200,200,200)' }}>{a.label}</span>
              <audio src={a.src} controls className="h-8" style={{ maxWidth: 260 }} />
            </div>
          ))}
        </div>
      )}

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
    </div>,
    document.body
  );
}
