'use client';

import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Editor } from 'tldraw';

interface TutorialStep {
  id: string;
  title: string;
  titleCn: string;
  description: string;
  descriptionCn: string;
  action: string; // 需要完成的动作
  actionCn: string;
  target?: string; // CSS selector for highlighting
  checkComplete: (editor: Editor) => boolean; // 检查是否完成
}

interface TutorialOverlayProps {
  editor: Editor;
  onComplete: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ editor, onComplete, onSkip }: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [initialShapeCount, setInitialShapeCount] = useState(0);
  const [hasTextCard, setHasTextCard] = useState(false);
  const [hasImageCard, setHasImageCard] = useState(false);
  const [hasConnection, setHasConnection] = useState(false);

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Infinite Canvas',
      titleCn: '欢迎来到无限画布',
      description: 'Let\'s learn how to use the canvas by creating your first workflow.',
      descriptionCn: '让我们通过创建你的第一个工作流来学习如何使用画布。',
      action: 'Click "Next" to start',
      actionCn: '点击"下一步"开始',
      checkComplete: () => true,
    },
    {
      id: 'create-text',
      title: 'Create a Text Card',
      titleCn: '创建文本卡片',
      description: 'Click the "Text" button in the toolbar to create your first card.',
      descriptionCn: '点击工具栏中的"文本"按钮创建你的第一张卡片。',
      action: 'Click the Text button',
      actionCn: '点击 Text 按钮',
      target: '[data-tutorial="text-button"]',
      checkComplete: (editor) => {
        const shapes = editor.getCurrentPageShapes();
        return shapes.some((s: any) => s.type === 'custom-card' && s.props.cardType === 'text');
      },
    },
    {
      id: 'create-image',
      title: 'Create an Image Card',
      titleCn: '创建图片卡片',
      description: 'Great! Now click the "Image" button to create an image generation card.',
      descriptionCn: '很好！现在点击"图片"按钮创建一个图片生成卡片。',
      action: 'Click the Image button',
      actionCn: '点击 Image 按钮',
      target: '[data-tutorial="image-button"]',
      checkComplete: (editor) => {
        const shapes = editor.getCurrentPageShapes();
        return shapes.some((s: any) => s.type === 'custom-card' && s.props.cardType === 'image');
      },
    },
    {
      id: 'connect-cards',
      title: 'Connect Cards',
      titleCn: '连接卡片',
      description: 'Now drag from the right port (output) of the Text card to the left port (input) of the Image card.',
      descriptionCn: '现在从文本卡片的右边端口（输出）拖拽到图片卡片的左边端口（输入）。',
      action: 'Drag to connect the cards',
      actionCn: '拖拽连接卡片',
      checkComplete: (editor) => {
        const bindings = editor.getBindings();
        return bindings.length > 0;
      },
    },
    {
      id: 'complete',
      title: 'You\'re Ready!',
      titleCn: '准备就绪！',
      description: 'Excellent! You\'ve learned the basics. Now you can create more cards and build complex AI workflows.',
      descriptionCn: '太棒了！你已经学会了基础操作。现在你可以创建更多卡片，构建复杂的 AI 工作流。',
      action: 'Click "Finish" to start creating',
      actionCn: '点击"完成"开始创作',
      checkComplete: () => true,
    },
  ];

  const step = tutorialSteps[currentStep];
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  // 初始化
  useEffect(() => {
    setInitialShapeCount(editor.getCurrentPageShapes().length);
  }, []);

  // 监听编辑器变化，检查是否完成当前步骤
  useEffect(() => {
    if (isFirstStep || isLastStep) return;

    const checkInterval = setInterval(() => {
      if (step.checkComplete(editor)) {
        // 完成当前步骤
        if (!completedSteps.includes(currentStep)) {
          setCompletedSteps([...completedSteps, currentStep]);
          // 自动进入下一步
          setTimeout(() => {
            setCurrentStep(currentStep + 1);
          }, 500);
        }
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [currentStep, editor, completedSteps, step, isFirstStep, isLastStep]);

  // 更新高亮位置
  useEffect(() => {
    if (step.target) {
      const updateHighlight = () => {
        const element = document.querySelector(step.target!);
        if (element) {
          const rect = element.getBoundingClientRect();
          setHighlightRect(rect);
        }
      };

      updateHighlight();
      const interval = setInterval(updateHighlight, 100);
      return () => clearInterval(interval);
    } else {
      setHighlightRect(null);
    }
  }, [step.target]);

  const handleNext = () => {
    if (isFirstStep) {
      setCurrentStep(currentStep + 1);
    } else if (isLastStep) {
      onComplete();
    }
  };

  const isStepCompleted = completedSteps.includes(currentStep);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark Overlay with Spotlight */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none">
        {highlightRect && (
          <div
            className="absolute border-4 border-blue-500 rounded-lg pointer-events-none animate-pulse"
            style={{
              left: highlightRect.left - 8,
              top: highlightRect.top - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
              transition: 'all 0.3s ease',
            }}
          />
        )}
      </div>

      {/* Tutorial Card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="glass-card p-6 max-w-md w-[90vw] sm:w-[450px] shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold text-white">{step.title}</h3>
                {isStepCompleted && !isFirstStep && !isLastStep && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
              </div>
              <p className="text-sm text-zinc-400">{step.titleCn}</p>
            </div>
            <button
              onClick={onSkip}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-white mb-2">{step.description}</p>
            <p className="text-sm text-zinc-400 mb-4">{step.descriptionCn}</p>

            {/* Action Required */}
            {!isFirstStep && !isLastStep && (
              <div className={`p-3 rounded-lg border-2 ${
                isStepCompleted
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-blue-500/10 border-blue-500/30 animate-pulse'
              }`}>
                <div className="flex items-center gap-2">
                  {isStepCompleted ? (
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex-shrink-0" />
                  )}
                  <div>
                    <p className={`font-semibold ${isStepCompleted ? 'text-green-400' : 'text-blue-400'}`}>
                      {isStepCompleted ? 'Completed!' : step.action}
                    </p>
                    <p className={`text-xs ${isStepCompleted ? 'text-green-500/70' : 'text-blue-500/70'}`}>
                      {isStepCompleted ? '已完成！' : step.actionCn}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1 mb-4">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-500'
                    : completedSteps.includes(index) || index < currentStep
                    ? 'bg-green-500'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              {currentStep + 1} / {tutorialSteps.length}
            </div>
            {(isFirstStep || isLastStep) && (
              <button
                onClick={handleNext}
                className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-all"
              >
                {isLastStep ? 'Finish / 完成' : 'Next / 下一步'}
              </button>
            )}
          </div>

          {/* Skip */}
          <button
            onClick={onSkip}
            className="w-full mt-3 text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            Skip Tutorial / 跳过教程
          </button>
        </div>
      </div>
    </div>
  );
}
