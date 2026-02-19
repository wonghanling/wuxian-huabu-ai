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
    title: 'Welcome to Infinite Canvas',
    titleCn: '欢迎来到无限画布',
    description: "Let's learn the full workflow: cards, connections, character design, and director timeline.",
    descriptionCn: '让我们学习完整工作流：卡片、连接、角色设计和导演流程。',
    target: null as string | null,
    needsAction: false,
    action: '', actionCn: '',
  },

  // === 基础工作流 ===
  {
    id: 'create-text',
    title: 'Step 1 · Create a Text Card',
    titleCn: '第1步 · 创建文本卡片',
    description: 'Click the "Text" button in the toolbar on the left.',
    descriptionCn: '点击左侧工具栏中的"Text 文本生成"按钮。',
    action: 'Click Text button', actionCn: '点击 Text 按钮',
    target: '[data-tutorial="text-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'create-image',
    title: 'Step 2 · Create an Image Card',
    titleCn: '第2步 · 创建图片卡片',
    description: 'Click the "Image" button in the toolbar.',
    descriptionCn: '点击工具栏中的"Image 图片生成"按钮。',
    action: 'Click Image button', actionCn: '点击 Image 按钮',
    target: '[data-tutorial="image-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'connect-cards',
    title: 'Step 3 · Connect the Cards',
    titleCn: '第3步 · 连接卡片',
    description: 'Drag from the gray port (right) of the Text card to the blue port (left) of the Image card.',
    descriptionCn: '从文本卡片右边的灰色端口拖拽到图片卡片左边的蓝色端口。',
    action: 'Drag to connect', actionCn: '拖拽连接',
    target: null as string | null,
    needsAction: true,
  },

  // === 角色设计 ===
  {
    id: 'create-character',
    title: 'Step 4 · Create a Character Card',
    titleCn: '第4步 · 创建角色设计卡片',
    description: 'Click the "Character Design" button in the toolbar.',
    descriptionCn: '点击工具栏中的"Character Design 角色设计"按钮。',
    action: 'Click Character Design', actionCn: '点击角色设计按钮',
    target: '[data-tutorial="character-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'upload-and-analyze',
    title: 'Step 5 · Upload & Analyze',
    titleCn: '第5步 · 上传图片并分析',
    description: 'In the Character card: upload any image, then click "分析生成 Anchor JSON".',
    descriptionCn: '在角色设计卡片中：上传任意图片，然后点击"分析生成 Anchor JSON"按钮。',
    action: 'Upload → Click Analyze', actionCn: '上传图片 → 点击分析',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'three-view-json',
    title: 'Step 6 · Generate Three-View JSON',
    titleCn: '第6步 · 生成三视角 JSON',
    description: 'Switch to "2.三视角JSON" tab in the Character card, then click "生成三视角 JSON".',
    descriptionCn: '切换到角色卡片的"2.三视角JSON"标签，点击"生成三视角 JSON"按钮。',
    action: 'Click 生成三视角 JSON', actionCn: '点击生成三视角 JSON',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'generate-character-image',
    title: 'Step 7 · Generate Character Image',
    titleCn: '第7步 · 生成角色图片',
    description: 'Switch to "3.生成图片" tab, upload a reference image, then click "生成三视角图片".',
    descriptionCn: '切换到"3.生成图片"标签，上传参考图片，然后点击"生成三视角图片"按钮。',
    action: 'Upload → Click Generate', actionCn: '上传图片 → 点击生成',
    target: null as string | null,
    needsAction: true,
  },

  // === 卡片操作 ===
  {
    id: 'minimize-card',
    title: 'Step 8 · Minimize a Card',
    titleCn: '第8步 · 缩小卡片',
    description: 'Click the "−" button at the top-right corner of any card to minimize it.',
    descriptionCn: '点击任意卡片右上角的"−"按钮可以将卡片缩小收起。',
    action: 'Click − to minimize', actionCn: '点击右上角 − 缩小卡片',
    target: null as string | null,
    needsAction: true,
  },

  // === 导演流程 ===
  {
    id: 'create-director',
    title: 'Step 9 · Create Director Timeline',
    titleCn: '第9步 · 创建导演流程',
    description: 'Click the "Director Timeline" button in the toolbar.',
    descriptionCn: '点击工具栏中的"Director Timeline 导演流程"按钮。',
    action: 'Click Director Timeline', actionCn: '点击导演流程按钮',
    target: '[data-tutorial="director-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'director-connect-image',
    title: 'Step 10 · Connect Director → Image',
    titleCn: '第10步 · 导演流程连接图片卡片',
    description: 'Drag from the Director Timeline port to the left port of the Image card.',
    descriptionCn: '从导演流程的端口拖拽连接到图片生成卡片的左边端口。',
    action: 'Connect Director → Image card', actionCn: '连接导演流程到图片卡片',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'create-video',
    title: 'Step 11 · Create a Video Card',
    titleCn: '第11步 · 创建视频生成卡片',
    description: 'Click the "Video" button in the toolbar to create a video generation card.',
    descriptionCn: '点击工具栏中的"Video 视频生成"按钮，创建视频生成卡片。',
    action: 'Click Video button', actionCn: '点击 Video 按钮',
    target: '[data-tutorial="video-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'connect-image-video',
    title: 'Step 12 · Connect Image → Video',
    titleCn: '第12步 · 连接图片到视频卡片',
    description: 'Drag from the right port of the Image card to the left port of the Video card.',
    descriptionCn: '从图片生成卡片的右边端口拖拽连接到视频生成卡片的左边端口。',
    action: 'Connect Image → Video card', actionCn: '连接图片卡片到视频卡片',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'director-zoom',
    title: 'Step 13 · Director Timeline Controls',
    titleCn: '第13步 · 导演流程缩放控制',
    description: 'The Director Timeline has zoom in/out buttons to expand or compress the timeline view.',
    descriptionCn: '导演流程有缩小和放大按钮，可以压缩或展开时间轴视图，方便管理不同时长的场景。',
    action: 'Try the zoom buttons on the timeline', actionCn: '尝试点击时间轴上的缩放按钮',
    target: null as string | null,
    needsAction: false,
  },

  // === 电影控制器 ===
  {
    id: 'film-controller',
    title: 'Step 14 · Film Controller',
    titleCn: '第14步 · 电影控制器',
    description: 'Hover over "Film Controller" in the toolbar, then select "超远景" to create a shot card.',
    descriptionCn: '将鼠标悬停在工具栏的"Film Controller 电影控制器"上，然后选择"超远景"创建景别卡片。',
    action: 'Hover Film Controller → Select 超远景', actionCn: '悬停电影控制器 → 选择超远景',
    target: '[data-tutorial="film-controller-button"]' as string | null,
    needsAction: true,
  },
  {
    id: 'shot-camera-move',
    title: 'Step 15 · Select Camera Movement',
    titleCn: '第15步 · 选择运镜方式（必选）',
    description: 'In the Shot card, select a camera movement type. This is required for video generation.',
    descriptionCn: '在景别卡片中，选择一种运镜方式。这是视频生成的必选项，决定镜头的运动方式。',
    action: 'Select a camera movement', actionCn: '选择运镜方式（必选）',
    target: null as string | null,
    needsAction: true,
  },
  {
    id: 'director-mindset',
    title: 'Step 16 · Director Mindset (Optional)',
    titleCn: '第16步 · 导演思维侧重（可选）',
    description: 'You can optionally select one or more director mindset tags to guide the AI style. These are not required.',
    descriptionCn: '你可以选择一个或多个导演思维侧重标签来引导 AI 风格，这些是可选项，不是必须的。',
    action: 'Optionally select mindset tags', actionCn: '可选：选择导演思维标签',
    target: null as string | null,
    needsAction: false,
  },

  // === 完成 ===
  {
    id: 'complete',
    title: 'Tutorial Complete! 🎬',
    titleCn: '教程完成！',
    description: "You've mastered the full workflow: cards, connections, character design, director timeline, and film controller.",
    descriptionCn: '你已经掌握了完整工作流：卡片连接、角色设计、导演流程和电影控制器。开始创作吧！',
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
        case 'create-text':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'text').length > initialTextCount.current;
          break;
        case 'create-image':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'image').length > initialImageCount.current;
          break;
        case 'connect-cards':
        case 'director-connect-image':
        case 'connect-image-video':
          done = shapes.filter(s => s.type === 'connection').length > initialConnectionCount.current;
          if (done) initialConnectionCount.current = shapes.filter(s => s.type === 'connection').length;
          break;
        case 'create-character':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character').length > initialCharacterCount.current;
          break;
        case 'upload-and-analyze':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterAnchorJson).length > initialAnchorJsonCount.current;
          break;
        case 'three-view-json':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterThreeViewJson).length > initialThreeViewJsonCount.current;
          break;
        case 'generate-character-image':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'character' && s.props.characterGeneratedImage).length > initialThreeViewImageCount.current;
          break;
        case 'minimize-card':
          done = shapes.filter(s => (s as any).props?.isMinimized === true).length > initialMinimizedCount.current;
          break;
        case 'create-director':
          done = shapes.filter(s => s.type === 'timeline').length > initialDirectorCount.current;
          break;
        case 'create-video':
          done = shapes.filter(s => s.type === 'custom-card' && s.props.cardType === 'video').length > initialVideoCount.current;
          break;
        case 'film-controller':
          done = shapes.filter(s => s.type === 'shot-card').length > initialShotCount.current;
          break;
        case 'shot-camera-move':
          const shotCards = shapes.filter(s => s.type === 'shot-card');
          if (shotCards.length > 0) {
            const currentValue = shotCards[0].props?.cameraMovement || '';
            done = currentValue !== initialCameraMovementValue.current && currentValue !== 'Follow/Tracking';
          }
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
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
            borderRadius: 12,
            border: '3px solid #3b82f6',
          }}
        />
      )}
      {!highlightRect && (
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      )}

      {/* 教程卡片 */}
      <div className="absolute top-6 right-6 pointer-events-auto w-[360px]">
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
