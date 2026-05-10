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
    description: "Follow this tutorial to build a complete AI workflow: image generation, video generation, and storyboard design.",
    descriptionCn: '跟着教程做一遍，搭建完整的 AI 工作流：图片生成、视频生成、分镜设计。',
    target: null as string | null,
    needsAction: false,
    action: '', actionCn: '',
  },

  // === 图片生成卡片 ===
  {
    id: 'create-image',
    title: 'Step 1 · Create an Image Card',
    titleCn: '第 1 步 · 创建图片生成卡片',
    description: 'Click the "Image" button in the toolbar on the left.',
    descriptionCn: '点击左侧工具栏的 "Image 图片生成" 按钮。',
    action: 'Click Image button', actionCn: '点击 Image 按钮',
    target: '[data-tutorial="image-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'open-preset',
    title: 'Step 2 · Open Preset Panel',
    titleCn: '第 2 步 · 打开预设浮板',
    description: 'In the Image card, click the "预设 ◀" button. A panel opens on the left.',
    descriptionCn: '在图片生成卡片上点击"预设 ◀"按钮，左侧会弹出预设浮板。提示：有参考图时无需选择风格；角色设计按钮专门用于角色多细节设定。',
    action: 'Click 预设', actionCn: '点击预设按钮',
    target: null as string | null,
    needsAction: false,
  },
  {
    id: 'open-settings',
    title: 'Step 3 · Open Settings Panel',
    titleCn: '第 3 步 · 展开参数设置',
    description: 'Click "展开参数设置" to open the right panel — model, aspect ratio, quality.',
    descriptionCn: '点击图片卡片的"展开参数设置"按钮，右侧浮板出现：模型选择 / 比例选择 / 清晰度选择。',
    action: 'Click Settings', actionCn: '展开参数设置',
    target: null as string | null,
    needsAction: false,
  },

  // === 时空镜头延展 ===
  {
    id: 'open-camera-control',
    title: 'Step 4 · Time-Space Camera Extension',
    titleCn: '第 4 步 · 时空镜头延展',
    description: 'Click the "⋯" button on the right edge of the Image card, then click "时空镜头延展". You can generate the future 5s or past 5s of that image. Drag the camera to pick angle.',
    descriptionCn: '点击图片卡片右侧的"⋯"三点按钮，选择"时空镜头延展"。可以生成这张图画面的未来 5 秒 / 过去 5 秒。拖动摄像头图标选择角度。',
    action: 'Open Camera Control', actionCn: '打开时空镜头延展',
    target: null as string | null,
    needsAction: true,
  },

  // === 视频生成 ===
  {
    id: 'create-video',
    title: 'Step 5 · Create a Video Card',
    titleCn: '第 5 步 · 创建视频生成卡片',
    description: 'Click "Video" in the toolbar. Three types available: Video (general), Seedance, and Kling.',
    descriptionCn: '点击工具栏的"Video"按钮创建视频生成卡片。类型有：通用视频、Seedance、Kling。',
    action: 'Click Video button', actionCn: '点击 Video 按钮',
    target: '[data-tutorial="video-button"]' as string | null,
    needsAction: true,
  },

  // === 分镜工作流 ===
  {
    id: 'create-director',
    title: 'Step 6 · Open Director Engine',
    titleCn: '第 6 步 · 打开导演引擎',
    description: 'Click "Director Timeline" in the toolbar. This creates Step 0 / Step 2 / Step 3 / Step 3-Solo cards.',
    descriptionCn: '点击工具栏的"Director Timeline 导演引擎"按钮。会生成 Step 0 / Step 2 / Step 3 / Step 3-Solo 几张分镜卡片。',
    action: 'Click Director Timeline', actionCn: '点击导演引擎',
    target: '[data-tutorial="director-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'cleanup-storyboard',
    title: 'Step 7 · Keep What You Need',
    titleCn: '第 7 步 · 整理分镜卡片',
    description: 'Click Step 0 card, press Delete to remove. Keep Step 2 (storyboard JSON) and Step 3-Solo (storyboard image).',
    descriptionCn: '点击 Step 0 卡片，按键盘 Delete 删除。保留 Step 2（分镜 JSON）和 Step 3-Solo（分镜脚本图）。',
    action: 'Delete Step 0', actionCn: '删除 Step 0',
    target: null as string | null,
    needsAction: false,
  },
  {
    id: 'step2-intro',
    title: 'Step 8 · Step 2 Storyboard JSON',
    titleCn: '第 8 步 · Step 2 分镜 JSON',
    description: 'In Step 2 card: the left field is for story script. Click "时空" button for time-space hints.',
    descriptionCn: '在 Step 2 卡片中填写"故事/剧本"，点击"时空"按钮可查看时空场景提示。生成后会得到分镜 JSON。',
    action: '', actionCn: '',
    target: null as string | null,
    needsAction: false,
  },

  // === 连接工作流 ===
  {
    id: 'connect-to-step2',
    title: 'Step 9 · Connect Image → Step 2',
    titleCn: '第 9 步 · 图片卡片 → Step 2',
    description: 'Drag from the right port of the Image card to the left port of Step 2. Provides reference image for storyboard.',
    descriptionCn: '从图片卡片右侧的端口拖到 Step 2 左侧端口。为分镜 JSON 生成提供参考图。',
    action: 'Drag to connect', actionCn: '拖拽连接',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'connect-step2-to-video',
    title: 'Step 10 · Connect Step 2 → Video',
    titleCn: '第 10 步 · Step 2 → 通用视频',
    description: 'Drag from Step 2 right port to Video card left port. The JSON becomes the video prompt.',
    descriptionCn: '从 Step 2 右侧端口拖到通用视频卡片左侧端口。Step 2 生成的 JSON 会作为视频卡片的 prompt。',
    action: 'Drag to connect', actionCn: '拖拽连接',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'connect-to-solo',
    title: 'Step 11 · Connect Image → Step 3-Solo',
    titleCn: '第 11 步 · 图片卡片 → Step 3-Solo',
    description: 'Drag Image card right port to Step 3-Solo left port. Solo uses the image as reference for storyboard sheet.',
    descriptionCn: '从图片卡片右侧端口拖到 Step 3-Solo 左侧端口。Step 3-Solo 会用这张图生成分镜脚本图。',
    action: 'Drag to connect', actionCn: '拖拽连接',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'connect-solo-to-video',
    title: 'Step 12 · Connect Step 3-Solo → Video',
    titleCn: '第 12 步 · Step 3-Solo → 通用视频',
    description: 'Drag Step 3-Solo right port to a Video card left port. The storyboard image becomes the first frame.',
    descriptionCn: '从 Step 3-Solo 右侧端口拖到通用视频卡片左侧端口。分镜脚本图会作为视频首帧。',
    action: 'Drag to connect', actionCn: '拖拽连接',
    target: null as string | null,
    needsAction: true,
  },

  // === 小贴士 ===
  {
    id: 'minimize-tip',
    title: 'Pro Tip · Minimize Finished Cards',
    titleCn: '小贴士 · 完成的卡片记得缩小',
    description: 'When an image or video is done, click the "+" at the top-right to minimize. Click "+" again to expand when needed.',
    descriptionCn: '生成好的图片或视频卡片，点击右上角的"+"按钮缩小，需要时再次点击展开。让画布保持整洁。',
    action: '', actionCn: '',
    target: null as string | null,
    needsAction: false,
  },
  {
    id: 'delete-connection',
    title: 'Pro Tip · Delete a Connection',
    titleCn: '小贴士 · 删除连接线',
    description: 'Hover any connection line, a red ✕ appears at the middle. Click to delete. Or select and press Del.',
    descriptionCn: '鼠标悬停任何连接线，中点会出现红色 ✕，点击删除。也可以点选连接线后按 Del 键删除。',
    action: '', actionCn: '',
    target: null as string | null,
    needsAction: false,
  },
  {
    id: 'complete',
    title: 'Tutorial Complete! 🎬',
    titleCn: '教程完成！',
    description: "You've mastered the full workflow. Go create something amazing!",
    descriptionCn: '你已经掌握了完整工作流——图片生成、时空镜头、视频生成、分镜连接。开始创作吧！',
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
        case 'open-camera-control':
          done = shapes.filter(s => s.type === 'camera-control-card').length > 0;
          break;
        case 'create-video':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'video').length > initialVideoCount.current;
          break;
        case 'create-director':
          done = shapes.filter(s => s.type === 'timeline' || s.type === 'gem-step2-card' || s.type === 'gem-step4-card').length > initialDirectorCount.current;
          break;
        case 'connect-to-step2':
        case 'connect-step2-to-video':
        case 'connect-to-solo':
        case 'connect-solo-to-video':
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
