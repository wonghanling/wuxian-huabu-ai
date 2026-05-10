'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Editor } from 'tldraw';

interface TutorialOverlayProps {
  editor: Editor;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to FanBu 帆布',
    titleCn: '欢迎使用帆布',
    description: "Follow 7 steps to learn the full workflow. Each step highlights the next button — just click and go.",
    descriptionCn: '跟着 7 步学会完整工作流。每步高亮下一个按钮，跟着点就行。',
    target: null as string | null,
    needsAction: false,
    action: '', actionCn: '',
  },
  {
    id: 'create-image',
    title: 'Step 1 · Create Image Card',
    titleCn: '第 1 步 · 创建图片生成卡片',
    description: 'Click the highlighted "Image" button.',
    descriptionCn: '点击高亮的 "Image 图片生成" 按钮。',
    action: 'Click Image', actionCn: '点击 Image',
    target: '[data-tutorial="image-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'open-preset',
    title: 'Step 2 · Open Preset Panel',
    titleCn: '第 2 步 · 打开预设浮板',
    description: 'Click the "预设 ◀" button on the image card. Inside you can pick a style or one-click character design.',
    descriptionCn: '点击图片卡片上的 "预设 ◀" 按钮。浮板里可以选风格，或一键套用"角色设计"预设 prompt。',
    action: 'Click 预设', actionCn: '点击预设按钮',
    target: '[data-tutorial="preset-button"]' as string | null,
    needsAction: false,
  },
  {
    id: 'open-settings',
    title: 'Step 3 · Expand Settings',
    titleCn: '第 3 步 · 展开参数设置',
    description: 'Click "展开参数设置". The right panel shows model / aspect ratio / quality.',
    descriptionCn: '点击"展开参数设置"。右侧浮板出现：模型选择、比例、清晰度。',
    action: 'Click Settings', actionCn: '点击参数设置',
    target: '[data-tutorial="image-settings-button"]' as string | null,
    needsAction: false,
  },
  {
    id: 'create-video',
    title: 'Step 4 · Create Video Card',
    titleCn: '第 4 步 · 创建视频生成卡片',
    description: 'Click the highlighted "Video" button. Three types: General video, Seedance, Kling lip-sync.',
    descriptionCn: '点击高亮的 "Video 视频生成" 按钮。有通用视频、Seedance、Kling 对口型三种类型。',
    action: 'Click Video', actionCn: '点击 Video',
    target: '[data-tutorial="video-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'create-director',
    title: 'Step 5 · Open Director Engine',
    titleCn: '第 5 步 · 打开导演引擎',
    description: 'Click "Director Timeline" to create storyboard cards (Step 0 / Step 2 / Step 3 / Step 3-Solo).',
    descriptionCn: '点击 "Director Timeline 导演引擎"。会生成分镜卡片组（Step 0 / Step 2 / Step 3 / Step 3-Solo）。',
    action: 'Click Director', actionCn: '点击导演引擎',
    target: '[data-tutorial="director-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'connect-cards',
    title: 'Step 6 · Connect Cards',
    titleCn: '第 6 步 · 连接卡片',
    description: 'Drag from the right port of a card to the left port of another. Image → Step 2 → Video is the common path.',
    descriptionCn: '从一张卡片右侧端口拖到另一张卡片左侧端口。常用路径：图片 → Step 2 → 视频。',
    action: 'Drag to connect', actionCn: '拖拽端口连接',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'pro-tips',
    title: 'Pro Tips',
    titleCn: '小贴士',
    description: 'Minimize cards with the + button. Delete connections by hovering and clicking the red ✕.',
    descriptionCn: '完成的卡片点右上角 + 号缩小。连接线悬停中点出现红色 ✕，点击删除。',
    action: '', actionCn: '',
    target: null as string | null,
    needsAction: false,
  },
  {
    id: 'complete',
    title: 'Done! 🎬',
    titleCn: '教程完成',
    description: "You've learned the full workflow. Have fun creating!",
    descriptionCn: '你已经学会完整工作流。开始创作吧！',
    action: '', actionCn: '',
    target: null as string | null,
    needsAction: false,
  },
];

export default function TutorialOverlay({ editor, onComplete, onSkip }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const initialTextCount = useRef(0);
  const initialImageCount = useRef(0);
  const initialVideoCount = useRef(0);
  const initialConnectionCount = useRef(0);
  const initialCharacterCount = useRef(0);
  const initialAnchorJsonCount = useRef(0);
  const initialThreeViewJsonCount = useRef(0);
  const initialThreeViewImageCount = useRef(0);
  const initialMinimizedCount = useRef(0);
  const initialDirectorCount = useRef(0);
  const initialShotCount = useRef(0);
  const initialShotWithCameraCount = useRef(0);
  const initialCameraMovementValue = useRef<string>('');

  useEffect(() => {
    const shapes = editor.getCurrentPageShapes() as any[];
    initialTextCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'text').length;
    initialImageCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'image').length;
    initialVideoCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'video').length;
    initialConnectionCount.current = shapes.filter(s => s.type === 'connection').length;
    initialCharacterCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character').length;
    initialAnchorJsonCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterAnchorJson).length;
    initialThreeViewJsonCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterThreeViewJson).length;
    initialThreeViewImageCount.current = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterGeneratedImage).length;
    initialMinimizedCount.current = shapes.filter(s => (s as any).props?.isMinimized === true).length;
    initialDirectorCount.current = shapes.filter(s => s.type === 'timeline').length;
    initialShotCount.current = shapes.filter(s => s.type === 'shot-card').length;
    const shotCards = shapes.filter(s => s.type === 'shot-card');
    if (shotCards.length > 0) {
      initialCameraMovementValue.current = shotCards[0].props?.cameraMovement || '';
    }
  }, []);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  // 检测用户操作
  useEffect(() => {
    if (!step.needsAction || stepDone) return;

    const interval = setInterval(() => {
      const shapes = editor.getCurrentPageShapes() as any[];
      let done = false;

      switch (step.id) {
        case 'create-image':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'image').length > initialImageCount.current;
          break;
        case 'create-video':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'video').length > initialVideoCount.current;
          break;
        case 'create-director':
          done = shapes.filter(s => s.type === 'timeline' || s.type === 'gem-step2-card' || s.type === 'gem-step4-card').length > initialDirectorCount.current;
          break;
        case 'connect-cards':
          done = shapes.filter(s => s.type === 'connection').length > initialConnectionCount.current;
          if (done) initialConnectionCount.current = shapes.filter(s => s.type === 'connection').length;
          break;
      }

      if (done) {
        setStepDone(true);
        setTimeout(() => {
          setCurrentStep(s => s + 1);
          setStepDone(false);
        }, 800);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [currentStep, stepDone, step]);

  // 高亮目标元素
  useEffect(() => {
    if (!step.target) {
      setHighlightRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(step.target!);
      if (el) setHighlightRect(el.getBoundingClientRect());
    };
    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [step.target]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* 高亮遮罩 */}
      {highlightRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: highlightRect.left - 8,
            top: highlightRect.top - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            borderRadius: 12,
            border: '3px solid #3b82f6',
          }}
        />
      )}

      {/* 教程卡片 - 跟随高亮元素位置 */}
      <div
        className="absolute pointer-events-auto w-[360px] transition-all duration-300"
        style={(() => {
          if (!highlightRect) {
            // 无高亮：默认右上角
            return { top: 24, right: 24 };
          }
          // 有高亮：优先放在高亮元素右侧，超出屏幕则放左侧，再不行放下方
          const panelW = 360;
          const panelH = 280; // 估算高度
          const margin = 20;
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          let left = highlightRect.right + margin;
          let top = highlightRect.top;
          // 右侧放不下 → 左侧
          if (left + panelW > vw - 16) {
            left = highlightRect.left - panelW - margin;
          }
          // 左侧也放不下 → 放下方
          if (left < 16) {
            left = Math.min(Math.max(highlightRect.left, 16), vw - panelW - 16);
            top = highlightRect.bottom + margin;
          }
          // 垂直方向超出 → 往上调
          if (top + panelH > vh - 16) {
            top = Math.max(16, vh - panelH - 16);
          }
          return { left, top };
        })()}
      >
        <div
          className="rounded-2xl p-5 shadow-2xl"
          style={{
            background: 'rgba(24,24,27,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* 标题栏 */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-white">{step.title}</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{step.titleCn}</p>
            </div>
            <button onClick={onSkip} className="text-zinc-500 hover:text-white transition-colors ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 描述 */}
          <p className="text-sm text-zinc-300 mb-1">{step.description}</p>
          <p className="text-xs text-zinc-500 mb-4">{step.descriptionCn}</p>

          {/* 操作提示 */}
          {step.needsAction && (
            <div className={`flex items-center gap-2 p-2.5 rounded-lg mb-4 ${
              stepDone
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-blue-500/10 border border-blue-500/30'
            }`}>
              {stepDone
                ? <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-blue-400 flex-shrink-0 animate-pulse" />
              }
              <div>
                <p className={`text-xs font-semibold ${stepDone ? 'text-green-400' : 'text-blue-400'}`}>
                  {stepDone ? 'Done! / 完成！' : step.action}
                </p>
                {!stepDone && <p className="text-[10px] text-zinc-500">{step.actionCn}</p>}
              </div>
            </div>
          )}

          {/* 可选步骤提示 */}
          {!step.needsAction && !isFirst && !isLast && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg mb-4 bg-zinc-800/50 border border-white/5">
              <div className="w-4 h-4 rounded-full bg-zinc-600 flex-shrink-0 flex items-center justify-center">
                <span className="text-[8px] text-zinc-300 font-bold">i</span>
              </div>
              <p className="text-xs text-zinc-400">This step is informational. Click Next when ready.</p>
            </div>
          )}

          {/* 进度条 */}
          <div className="flex gap-0.5 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < currentStep ? 'bg-green-500' : i === currentStep ? 'bg-blue-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* 按钮 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{currentStep + 1} / {STEPS.length}</span>
            {(isFirst || isLast || (!step.needsAction && !isFirst)) && (
              <button
                onClick={() => isLast ? onComplete() : setCurrentStep(s => s + 1)}
                className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-all"
              >
                {isLast ? 'Finish / 完成' : isFirst ? 'Start / 开始' : 'Next / 下一步'}
              </button>
            )}
          </div>

          <button
            onClick={onSkip}
            className="w-full mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Skip Tutorial / 跳过教程
          </button>
        </div>
      </div>
    </div>
  );
}
