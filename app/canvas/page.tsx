'use client';

import { Tldraw, TLComponents, Editor, useEditor, createShapeId, getSnapshot, loadSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import { useState, useEffect, useRef, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { CustomCardShapeUtil } from './CustomCard';
import { ConnectionShapeUtil } from './ConnectionShapeUtil';
import { ConnectionBindingUtil } from './ConnectionBindingUtil';
import { PortTool } from './PortTool';
import { TimelineShapeUtil } from './TimelineShape';
import { ShotCardShapeUtil } from './ShotCard';
import { PromptOptimizerCardUtil } from './PromptOptimizerCard';
import { GemStep0CardUtil } from './GemStoryboardStep0Card';
import { GemStep2CardUtil } from './GemStoryboardStep2Card';
import { GemStep3CardUtil } from './GemStoryboardStep3Card';
import { GemStep4CardUtil } from './GemStoryboardStep4Card';
import { AudioCardUtil } from './AudioCard';
import { CameraControlCardUtil } from './CameraControlCard';
import { SeedanceCardUtil } from './SeedanceCard';
import { MediaUploadCardUtil } from './MediaUploadCard';
import TutorialOverlay from './TutorialOverlay';
import { SaveTemplateModal } from './SaveTemplateModal';
import AccountModal from './AccountModal';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateCanvas, loadSnapshot as loadCanvasSnapshot, saveSnapshot } from '@/lib/canvas-storage';
import { useMembership } from '@/lib/useMembership';
import { MEMBERSHIP_PRICE } from '@/lib/pricing';

function WelcomeModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [msg, setMsg] = useState('');

  const handleClaim = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg('请先登录'); return; }
      const res = await fetch('/api/promo/claim', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setClaimed(true);
        setMsg(data.message);
        onRefresh();
      } else {
        setMsg(data.error ?? '领取失败，请重试');
      }
    } catch {
      setMsg('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onPointerDown={e => e.stopPropagation()}
    >
      <div
        className="relative w-[400px] rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-2xl text-center"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
        >✕</button>

        <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-5">
          <img src="/Boluolab_logo.svg" alt="Boluolab" className="w-7 h-7" />
        </div>

        <h2 className="text-white font-bold text-xl mb-2">欢迎加入 Boluolab</h2>
        <p className="text-white/50 text-sm mb-6">新用户注册领取一个月会员，解锁全部 AI 创作功能</p>

        {!claimed ? (
          <>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6 text-left space-y-2">
              {['无限文本生成（大模型）', '角色设计 & 导演引擎功能', '视频生成每秒省 ¥0.2', '优先体验新功能'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/70">
                  <span className="text-violet-400">✓</span> {item}
                </div>
              ))}
            </div>
            {msg && <p className="text-red-400 text-sm mb-4">{msg}</p>}
            <button
              onClick={handleClaim}
              disabled={loading}
              onPointerDown={e => e.stopPropagation()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold transition-all"
            >
              {loading ? '领取中…' : '立即领取 30 天会员'}
            </button>
            <button onClick={onClose} onPointerDown={e => e.stopPropagation()} className="mt-3 text-white/30 text-xs hover:text-white/50 transition-colors">
              稍后领取
            </button>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 mb-6 text-green-400 text-sm">
              {msg}
            </div>
            <button
              onClick={onClose}
              onPointerDown={e => e.stopPropagation()}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all"
            >
              开始创作
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 自定义缩放控制器组件 - 外部版本
const MINIMIZABLE_TYPES = ['custom-card', 'seedance-card', 'camera-control-card', 'shot-card', 'audio-card', 'prompt-optimizer-card', 'gem-step0-card', 'gem-step1-card', 'gem-step2-card', 'gem-step3-card', 'gem-step4-card'];

function ZoomControlsExternal({ editor }: { editor: Editor }) {
  const [zoom, setZoom] = useState(100);

  const COLLAPSIBLE_TYPES = new Set(['custom-card', 'seedance-card', 'camera-control-card', 'gem-step4-card']);

  const collapseAllCards = () => {
    const shapes = editor.getCurrentPageShapes();
    shapes
      .filter((s) => MINIMIZABLE_TYPES.includes((s as any).type))
      .forEach((s) => {
        const type = (s as any).type;
        const w = type === 'camera-control-card' ? 160 : 150;
        const h = type === 'camera-control-card' ? 60 : 80;
        const patch: Record<string, unknown> = { w, h, isMinimized: true };
        if (COLLAPSIBLE_TYPES.has(type)) patch.isCollapsed = false;
        editor.updateShape({ id: s.id, type, props: patch });
      });
  };

  const foldAllCards = () => {
    const shapes = editor.getCurrentPageShapes();
    shapes
      .filter((s) => COLLAPSIBLE_TYPES.has((s as any).type))
      .forEach((s) => {
        const type = (s as any).type;
        editor.updateShape({ id: s.id, type, props: { w: 150, h: 80, isCollapsed: true, isMinimized: false } });
      });
  };

  // 用 store.listen 替代 setInterval，避免标签页切回时积压回调卡顿
  useEffect(() => {
    const update = () => {
      const currentZoom = Math.round(editor.getCamera().z * 100);
      setZoom(prev => prev !== currentZoom ? currentZoom : prev);
    };
    update();
    const unsub = editor.store.listen(update, { scope: 'session' });
    return () => unsub();
  }, [editor]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('滑块改变');
    const newZoom = parseInt(e.target.value);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
  };

  const handleZoomIn = () => {
    console.log('点击放大按钮，当前缩放:', zoom);
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('新缩放:', newZoom);
  };

  const handleZoomOut = () => {
    console.log('点击缩小按钮，当前缩放:', zoom);
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('新缩放:', newZoom);
  };

  const handleResetZoom = () => {
    console.log('重置缩放');
    setZoom(100);
    editor.setCamera({ ...editor.getCamera(), z: 1 });
  };

  const handleFitToScreen = () => {
    console.log('适应屏幕');
    editor.zoomToFit();
    setTimeout(() => {
      const newZoom = Math.round(editor.getCamera().z * 100);
      setZoom(newZoom);
    }, 100);
  };

  return (
    <div
      className="fixed bottom-6 left-6 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5 shadow-xl"
      style={{ zIndex: 99999 }}
    >
      {/* 适应屏幕 */}
      <button
        onClick={handleFitToScreen}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white transition-all"
        title="适应屏幕"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* 重置缩放 */}
      <button
        onClick={handleResetZoom}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white transition-all"
        title="重置缩放"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 缩小按钮 */}
      <button
        onClick={handleZoomOut}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-bold transition-all"
        title="缩小"
      >
        −
      </button>

      {/* 滑块 */}
      <input
        type="range"
        min="25"
        max="200"
        value={zoom}
        onChange={handleZoomChange}
        className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer zoom-slider"
        title={`${zoom}%`}
      />

      {/* 放大按钮 */}
      <button
        onClick={handleZoomIn}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-bold transition-all"
        title="放大"
      >
        +
      </button>

      {/* 缩放百分比显示 */}
      <div className="min-w-[2rem] text-center text-white text-xs font-medium">
        {zoom}%
      </div>

      {/* 分隔线 */}
      <div className="w-px h-4 bg-white/20 mx-0.5"></div>

      {/* 全部折叠（-号操作） */}
      <button
        onClick={collapseAllCards}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-bold transition-all"
        title="全部折叠卡片（隐藏浮板）"
      >
        −
      </button>

      {/* 全部收起（▲操作，浮板保留） */}
      <button
        onClick={foldAllCards}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-xs transition-all"
        title="全部收起卡片（浮板保留）"
      >
        ▲
      </button>

      <style jsx>{`
        .zoom-slider::-webkit-slider-thumb {
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          background: #e5e5e5;
        }

        .zoom-slider::-moz-range-thumb:hover {
          background: #e5e5e5;
        }
      `}</style>
    </div>
  );
}

// 底部工具栏 - 外部版本（重新设计 - 可折叠抽屉式）
function BottomToolbarExternal({ editor, onOpenAssetPanel, onOpenImageSplit }: { editor: Editor; onOpenAssetPanel: () => void; onOpenImageSplit: () => void }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showShotTypePanel, setShowShotTypePanel] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);

  const createTextCard = () => {
    console.log('点击文本生成按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'text',
          title: 'Text Generation',
          prompt: '',
          model: 'gpt-5.2',
        },
      });

      console.log('文本卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建卡片失败:', error);
    }
  };

  const createImageCard = () => {
    console.log('点击图片生成按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'image',
          title: 'Image Generation',
          prompt: '',
          model: 'nano-banana-pro',
        },
      });

      console.log('图片卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建图片卡片失败:', error);
    }
  };

  const createVideoCard = () => {
    console.log('点击视频生成按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'video',
          title: 'Video Generation',
          prompt: '',
          model: 'veo3.1-fast-t2v',
        },
      });

      console.log('视频卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建视频卡片失败:', error);
    }
  };

  const createKlingCard = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();
      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 480,
          cardType: 'kling',
          title: 'Kling',
          prompt: '',
          model: 'kling-v2-master',
        },
      });
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建Kling卡片失败:', error);
    }
  };

  const createSeedanceCard = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();
      editor.createShape({
        id,
        type: 'seedance-card' as any,
        x: centerX - 210,
        y: centerY - 280,
        props: { w: 420, h: 560 },
      });
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建Seedance卡片失败:', error);
    }
  };

  const createCharacterCard = () => {
    console.log('点击角色设计按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: centerX - 190,
        y: centerY - 250,
        props: {
          w: 380,
          h: 500,
          cardType: 'character',
          title: 'Character Design',
          prompt: '',
          model: '',
        },
      });

      console.log('角色卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建角色卡片失败:', error);
    }
  };

  const createAssetCard = () => {
    onOpenAssetPanel();
  };

  const createDirectorTimeline = () => {
    console.log('点击导演流程按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'timeline' as any,
        x: centerX - 400,
        y: centerY - 50,
        props: {
          w: 800,
          h: 100,
          duration: 60,
          zoom: 1,
          shotType: '全景',
        },
      });

      console.log('导演流程创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建导演流程失败:', error);
    }
  };

  // 处理景别类型选择（创建景别卡片）
  const handleShotTypeSelect = (shotType: '超远景' | '远景' | '全景' | '中远景' | '中景' | '中近景' | '特写') => {
    console.log('选择了景别类型:', shotType);
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      // 根据景别类型设置默认值
      let defaultCameraMovement = 'Static';

      switch (shotType) {
        case '超远景':
          defaultCameraMovement = 'Static';
          break;
        case '远景':
        case '全景':
          defaultCameraMovement = 'Follow/Tracking';
          break;
        case '中远景':
          defaultCameraMovement = 'Follow';
          break;
        case '中景':
          defaultCameraMovement = 'Static';
          break;
        case '中近景':
          defaultCameraMovement = 'Static';
          break;
        case '特写':
          defaultCameraMovement = 'Absolute Static';
          break;
      }

      editor.createShape({
        id,
        type: 'shot-card' as any,
        x: centerX - 110,
        y: centerY - 80,
        props: {
          w: 220,
          h: 160,
          shotType: shotType,
          cameraMovement: defaultCameraMovement,
          directorThinking: '未完成',
          composition: '',
          subjectScale: '',
          spaceType: '',
          timeFeeling: '',
          lighting: '',
          motionSource: '',
          semantic: '',
          isMinimized: false,
        },
      });

      console.log('景别卡片创建成功，景别:', shotType);
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建景别卡片失败:', error);
    }
    setShowShotTypePanel(false);
  };

  const createPromptOptimizerCard = () => {
    console.log('点击Prompt优化器按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'prompt-optimizer-card' as any,
        x: centerX - 190,
        y: centerY - 240,
        props: {
          w: 380,
          h: 480,
          userInput: '',
          duration: '13-15秒',
          ratio: '16:9',
          optimizedPrompt: '',
          isGenerating: false,
          isMinimized: false,
        },
      });

      console.log('Prompt优化卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建Prompt优化卡片失败:', error);
    }
  };

  const createGemDirectorCard = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const cardW = 400;
      const gap = 20;
      const totalW = cardW * 4 + gap * 3;
      const startX = centerX - totalW / 2;
      const startY = centerY - 260;
      const id0 = createShapeId();
      const id2 = createShapeId();
      const id3 = createShapeId();
      const id4 = createShapeId();

      editor.createShape({ id: id0, type: 'gem-step0-card' as any, x: startX, y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id2, type: 'gem-step2-card' as any, x: startX + (cardW + gap), y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id3, type: 'gem-step3-card' as any, x: startX + (cardW + gap) * 2, y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id4, type: 'gem-step4-card' as any, x: startX + (cardW + gap) * 3, y: startY, props: { w: cardW, h: 520 } });

      editor.select(id0);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建导演引擎卡片失败:', error);
    }
  };

  const createGemStoryboardCards = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id2 = createShapeId();

      editor.createShape({
        id: id2,
        type: 'gem-step2-card' as any,
        x: centerX - 200,
        y: centerY - 280,
        props: { w: 400, h: 560 },
      });

      editor.select(id2);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建GEM分镜卡片失败:', error);
    }
  };

  const createAudioCard = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();
      editor.createShape({
        id,
        type: 'audio-card' as any,
        x: centerX - 200,
        y: centerY - 260,
        props: { w: 400, h: 520 },
      });
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建音频卡片失败:', error);
    }
  };

  return (
    <div
      className="fixed bottom-32 left-4 transition-all duration-300"
      style={{ zIndex: 9998 }}
      data-tutorial="toolbar"
    >
      <div
        className="relative flex flex-row items-stretch gap-0"
        onMouseLeave={() => setShowShotTypePanel(false)}
      >
        {/* 工具栏内容 - 可折叠 */}
        <div
          className={`flex flex-col gap-1 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-l-2xl p-1.5 shadow-xl transition-all duration-300 origin-left ${
            isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none w-0 overflow-hidden p-0 border-0'
          }`}
        >
        {/* 文本生成按钮 */}
        <button
          onClick={createTextCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Text Generation"
          data-tutorial="text-button"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-all flex-shrink-0">
            <span className="text-gray-300 text-sm font-bold">T</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Text</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">文本生成</span>
          </div>
        </button>

        {/* 图片生成按钮 */}
        <button
          onClick={createImageCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Image Generation"
          data-tutorial="image-button"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-600/20 flex items-center justify-center group-hover:bg-gray-600/30 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Image</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">图片生成</span>
          </div>
        </button>

        {/* 视频生成按钮 - 下拉菜单 */}
        <div className="relative" data-tutorial="video-button">
          <button
            onClick={() => setShowVideoMenu(!showVideoMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group w-full"
            title="Video Generation"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-700/20 flex items-center justify-center group-hover:bg-gray-700/30 transition-all flex-shrink-0">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex flex-col items-start flex-1">
              <span className="text-sm text-gray-300 whitespace-nowrap">Video</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">视频生成</span>
            </div>
            <svg className={`w-3 h-3 text-gray-500 transition-transform ${showVideoMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showVideoMenu && (
            <div className="ml-11 mt-1 flex flex-col gap-1">
              <button
                onClick={() => { createVideoCard(); setShowVideoMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all text-left"
              >
                <span className="text-xs text-gray-300 whitespace-nowrap">通用视频</span>
              </button>
              <button
                onClick={() => { createKlingCard(); setShowVideoMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all text-left"
              >
                <span className="text-xs text-gray-300 whitespace-nowrap">Kling 视频配音</span>
              </button>
              <button
                onClick={() => { createSeedanceCard(); setShowVideoMenu(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all text-left"
              >
                <span className="text-xs text-gray-300 whitespace-nowrap">Seedance 2.0</span>
              </button>
            </div>
          )}
        </div>

        {/* 角色设计按钮 */}
        <button
          onClick={createCharacterCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Character Design"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Character Design</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">角色设计</span>
          </div>
        </button>

        {/* 资产库按钮 - 暂时隐藏（用户隔离 + 性能未确认） */}
        {false && (
        <button
          onClick={createAssetCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Assets"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Assets</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">资产库</span>
          </div>
        </button>
        )}

        {/* 导演流程按钮 */}
        <button
          onClick={createDirectorTimeline}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Director Timeline"
          data-tutorial="director-button"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Director Timeline</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">导演流程</span>
          </div>
        </button>

        {/* 电影控制器按钮 */}
        <button
          onMouseEnter={() => setShowShotTypePanel(true)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Film Controller"
          data-tutorial="film-controller-button"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Film Controller</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">电影控制器</span>
          </div>
        </button>

        {/* Prompt按钮 */}
        <button
          onClick={createPromptOptimizerCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Prompt"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Prompt</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">快速编译视频生成词</span>
          </div>
        </button>

        {/* GEM分镜设计按钮 */}
        <button
          onClick={createGemStoryboardCards}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="GEM分镜设计"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">GEM 分镜设计</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">25格分镜生成</span>
          </div>
        </button>

        {/* 导演引擎按钮 */}
        <button
          onClick={createGemDirectorCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="导演引擎"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">导演引擎</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">视频过渡指令</span>
          </div>
        </button>

        {/* 语音生成按钮 */}
        <button
          onClick={createAudioCard}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="语音生成"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">语音生成</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">MiniMax TTS</span>
          </div>
        </button>

        {/* 图片切割按钮 */}
        <button
          onClick={onOpenImageSplit}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="Image Split"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4v16M12 4v16M18 4v16" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Image Split</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">图片切割</span>
          </div>
        </button>

        {/* 分隔线 */}
        <div className="h-px bg-white/10 my-1"></div>

        {/* 更多按钮 */}
        <button
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all group"
          title="More Options"
        >
          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap">More</span>
        </button>
        </div>

        {/* 收起按钮 - 工具栏右侧中间 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`self-center w-5 h-10 bg-zinc-900/90 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-zinc-800/90 transition-all shadow-xl ${
            isExpanded ? 'rounded-r-xl border-l-0' : 'rounded-xl ml-0'
          }`}
          title={isExpanded ? '收起工具栏' : '展开工具栏'}
        >
          <svg
            className={`w-3 h-3 text-white transition-transform duration-300 ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

      {/* 景别类型选择面板 */}
      {showShotTypePanel && (
        <div className="absolute left-full bottom-0 z-50">
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 w-64">
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">选择景别类型</h3>
              <button
                onClick={() => setShowShotTypePanel(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 景别选项列表 */}
            <div className="space-y-2">
              {(['超远景', '远景', '全景', '中远景', '中景', '中近景', '特写'] as const).map((shotType) => (
                <button
                  key={shotType}
                  onClick={() => handleShotTypeSelect(shotType)}
                  className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-sm font-medium transition-all text-left border border-white/5 hover:border-white/20"
                >
                  {shotType}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// 自定义缩放控制器组件 - 滑块样式
function ZoomControls() {
  const editor = useEditor();
  const [zoom, setZoom] = useState(100);

  // 用 store.listen 替代 setInterval，避免标签页切回时积压回调卡顿
  useEffect(() => {
    const update = () => {
      const currentZoom = Math.round(editor.getCamera().z * 100);
      setZoom(prev => prev !== currentZoom ? currentZoom : prev);
    };
    update();
    const unsub = editor.store.listen(update, { scope: 'session' });
    return () => unsub();
  }, [editor]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseInt(e.target.value);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
  };

  const handleZoomIn = () => {
    console.log('点击放大按钮，当前缩放:', zoom);
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('新缩放:', newZoom);
  };

  const handleZoomOut = () => {
    console.log('点击缩小按钮，当前缩放:', zoom);
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('新缩放:', newZoom);
  };

  const handleResetZoom = () => {
    setZoom(100);
    editor.resetZoom();
  };

  const handleFitToScreen = () => {
    editor.zoomToFit();
    setTimeout(() => {
      const newZoom = Math.round(editor.getZoomLevel() * 100);
      setZoom(newZoom);
    }, 100);
  };

  return (
    <div
      className="fixed bottom-6 left-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 shadow-xl"
      style={{ zIndex: 9999, pointerEvents: 'auto' }}
    >
      {/* 适应屏幕 */}
      <button
        onClick={handleFitToScreen}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
        title="适应屏幕"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* 重置缩放 */}
      <button
        onClick={handleResetZoom}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
        title="重置缩放"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 缩小按钮 */}
      <button
        onClick={handleZoomOut}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white text-lg font-bold transition-all"
        title="缩小"
      >
        −
      </button>

      {/* 滑块 */}
      <input
        type="range"
        min="25"
        max="200"
        value={zoom}
        onChange={handleZoomChange}
        className="w-32 h-1 bg-white/20 rounded-full appearance-none cursor-pointer zoom-slider"
        style={{ pointerEvents: 'auto' }}
        title={`${zoom}%`}
      />

      {/* 放大按钮 */}
      <button
        onClick={handleZoomIn}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white text-lg font-bold transition-all"
        title="放大"
      >
        +
      </button>

      {/* 缩放百分比显示 */}
      <div className="min-w-[3rem] text-center text-white text-sm font-medium">
        {zoom}%
      </div>

      <style jsx>{`
        .zoom-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          background: #e5e5e5;
        }

        .zoom-slider::-moz-range-thumb:hover {
          background: #e5e5e5;
        }
      `}</style>
    </div>
  );
}

// 底部工具栏 - 生成按钮（现代化设计）
function BottomToolbar() {
  const editor = useEditor();

  const createTextCard = () => {
    console.log('点击文本生成按钮');
    try {
      const viewportCenter = editor.getViewportScreenCenter();
      console.log('视口中心:', viewportCenter);
      const id = createShapeId();
      console.log('生成的ID:', id);

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 380,
          h: 380,
          cardType: 'text',
          title: 'Text Generation',
          prompt: '',
          model: 'gpt-5.2',
        },
      });

      console.log('卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
      console.log('已选中卡片并切换到选择工具');
    } catch (error) {
      console.error('创建卡片失败:', error);
    }
  };

  const createImageCard = () => {
    console.log('点击图片生成按钮');
    try {
      const viewportCenter = editor.getViewportScreenCenter();
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 380,
          h: 380,
          cardType: 'image',
          title: 'Image Generation',
          prompt: '',
          model: 'nano-banana-pro',
        },
      });

      console.log('图片卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建图片卡片失败:', error);
    }
  };

  const createVideoCard = () => {
    console.log('点击视频生成按钮');
    try {
      const viewportCenter = editor.getViewportScreenCenter();
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card' as any,
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 380,
          h: 380,
          cardType: 'video',
          title: 'Video Generation',
          prompt: '',
          model: 'veo3.1-fast-t2v',
        },
      });

      console.log('视频卡片创建成功');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建视频卡片失败:', error);
    }
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4"
      style={{ zIndex: 9999, pointerEvents: 'auto' }}
    >
      {/* 文本生成按钮 */}
      <button
        onClick={createTextCard}
        className="group relative px-8 py-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 backdrop-blur-xl border border-blue-400/30 rounded-2xl text-white font-medium transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:shadow-2xl hover:-translate-y-0.5"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">文本生成</div>
            <div className="text-xs text-blue-200/70">Text Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/10 group-hover:to-cyan-400/10 transition-all duration-300"></div>
      </button>

      {/* 图片生成按钮 */}
      <button
        onClick={createImageCard}
        className="group relative px-8 py-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 hover:from-violet-500/30 hover:to-purple-500/30 backdrop-blur-xl border border-violet-400/30 rounded-2xl text-white font-medium transition-all duration-300 shadow-lg hover:shadow-violet-500/25 hover:shadow-2xl hover:-translate-y-0.5"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">图片生成</div>
            <div className="text-xs text-violet-200/70">Image Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/0 to-purple-400/0 group-hover:from-violet-400/10 group-hover:to-purple-400/10 transition-all duration-300"></div>
      </button>

      {/* 视频生成按钮 */}
      <button
        onClick={createVideoCard}
        className="group relative px-8 py-4 bg-gradient-to-br from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 backdrop-blur-xl border border-rose-400/30 rounded-2xl text-white font-medium transition-all duration-300 shadow-lg hover:shadow-rose-500/25 hover:shadow-2xl hover:-translate-y-0.5"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold">视频生成</div>
            <div className="text-xs text-rose-200/70">Video Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-400/0 to-orange-400/0 group-hover:from-rose-400/10 group-hover:to-orange-400/10 transition-all duration-300"></div>
      </button>
    </div>
  );
}

// 图片切割弹窗组件
function ImageSplitModal({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [mode, setMode] = useState<'grid' | 'custom' | 'select'>('grid');
  // 自定义切线
  const [hLines, setHLines] = useState<number[]>([]);
  const [vLines, setVLines] = useState<number[]>([]);
  const [draggingLine, setDraggingLine] = useState<{ type: 'h' | 'v'; idx: number } | null>(null);
  // 框选模式
  const [boxes, setBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = URL.createObjectURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadImage(file);
  };

  // 切线模式
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingLine) return;
    const rect = previewRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const threshold = 0.02;
    const nearH = hLines.findIndex(l => Math.abs(l - y) < threshold);
    const nearV = vLines.findIndex(l => Math.abs(l - x) < threshold);
    if (nearH >= 0 || nearV >= 0) return;
    if (e.shiftKey) {
      setVLines(prev => [...prev, x].sort((a, b) => a - b));
    } else {
      setHLines(prev => [...prev, y].sort((a, b) => a - b));
    }
  };

  const handleLineMouseDown = (e: React.MouseEvent, type: 'h' | 'v', idx: number) => {
    e.stopPropagation();
    setDraggingLine({ type, idx });
  };

  const handleCustomMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingLine) return;
    const rect = previewRef.current!.getBoundingClientRect();
    if (draggingLine.type === 'h') {
      const y = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));
      setHLines(prev => { const n = [...prev]; n[draggingLine.idx] = y; return [...n].sort((a, b) => a - b); });
    } else {
      const x = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      setVLines(prev => { const n = [...prev]; n[draggingLine.idx] = x; return [...n].sort((a, b) => a - b); });
    }
  };

  const handleLineContextMenu = (e: React.MouseEvent, type: 'h' | 'v', idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'h') setHLines(prev => prev.filter((_, i) => i !== idx));
    else setVLines(prev => prev.filter((_, i) => i !== idx));
  };

  // 框选模式
  const getRelPos = (e: React.MouseEvent) => {
    const rect = previewRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleSelectMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pos = getRelPos(e);
    setDrawing(pos);
    setCurrentBox(null);
  };

  const handleSelectMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const pos = getRelPos(e);
    setCurrentBox({
      x: Math.min(drawing.x, pos.x),
      y: Math.min(drawing.y, pos.y),
      w: Math.abs(pos.x - drawing.x),
      h: Math.abs(pos.y - drawing.y),
    });
  };

  const handleSelectMouseUp = () => {
    if (currentBox && currentBox.w > 0.01 && currentBox.h > 0.01) {
      setBoxes(prev => [...prev, currentBox]);
    }
    setDrawing(null);
    setCurrentBox(null);
  };

  const handleSplit = async () => {
    if (!image) return;
    setIsSplitting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const W = image.naturalWidth;
      const H = image.naturalHeight;

      if (mode === 'grid') {
        const cellW = Math.floor(W / cols);
        const cellH = Math.floor(H / rows);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const canvas = document.createElement('canvas');
            canvas.width = cellW; canvas.height = cellH;
            canvas.getContext('2d')!.drawImage(image, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
            const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
            zip.file(`${r + 1}-${c + 1}.png`, blob);
          }
        }
      } else if (mode === 'custom') {
        const xs = [0, ...vLines.map(v => Math.round(v * W)), W];
        const ys = [0, ...hLines.map(h => Math.round(h * H)), H];
        let idx = 1;
        for (let r = 0; r < ys.length - 1; r++) {
          for (let c = 0; c < xs.length - 1; c++) {
            const x = xs[c], y = ys[r], w = xs[c + 1] - xs[c], h = ys[r + 1] - ys[r];
            if (w <= 0 || h <= 0) continue;
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(image, x, y, w, h, 0, 0, w, h);
            const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
            zip.file(`${idx++}.png`, blob);
          }
        }
      } else {
        // 框选模式
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          const x = Math.round(b.x * W), y = Math.round(b.y * H);
          const w = Math.round(b.w * W), h = Math.round(b.h * H);
          if (w <= 0 || h <= 0) continue;
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')!.drawImage(image, x, y, w, h, 0, 0, w, h);
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          zip.file(`${i + 1}.png`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mode === 'grid' ? `split_${rows}x${cols}.zip` : 'split_custom.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsSplitting(false);
    }
  };

  const PRESETS = [
    { label: '2×2', r: 2, c: 2 },
    { label: '3×3', r: 3, c: 3 },
    { label: '4×4', r: 4, c: 4 },
    { label: '5×5', r: 5, c: 5 },
  ];

  const customPieceCount = (hLines.length + 1) * (vLines.length + 1);
  const splitDisabled = !image || isSplitting ||
    (mode === 'custom' && hLines.length === 0 && vLines.length === 0) ||
    (mode === 'select' && boxes.length === 0);
  const splitLabel = isSplitting ? '切割中...' :
    mode === 'grid' ? `切割并下载 (${rows * cols} 张)` :
    mode === 'custom' ? `切割并下载 (${customPieceCount} 张)` :
    `切割并下载 (${boxes.length} 张)`;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[9999]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-[520px] max-h-[90vh] overflow-y-auto bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">图片切割</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-4">
          {(['grid', 'custom', 'select'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode === m ? 'bg-blue-500/80 text-white border border-blue-400/50' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
            >{m === 'grid' ? '等分切割' : m === 'custom' ? '自定义切线' : '框选切割'}</button>
          ))}
        </div>

        {/* 上传区域 */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-4 ${isDragging ? 'border-white/40 bg-white/5' : 'border-white/15 hover:border-white/30'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} />
          {image ? (
            <div className="flex items-center gap-3">
              <img src={image.src} className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
              <div className="text-left">
                <p className="text-white text-sm truncate max-w-[280px]">{imageFile?.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{image.naturalWidth} × {image.naturalHeight}px · 点击更换</p>
              </div>
            </div>
          ) : (
            <div>
              <svg className="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-sm">点击或拖拽上传图片</p>
            </div>
          )}
        </div>

        {/* 等分模式 */}
        {mode === 'grid' && (
          <div className="mb-4">
            <div className="flex gap-2 mb-3">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => { setRows(p.r); setCols(p.c); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${rows === p.r && cols === p.c ? 'bg-white/20 text-white border border-white/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'}`}
                >{p.label}</button>
              ))}
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-gray-500 text-xs mb-1">列数</p>
                <input type="number" min={1} max={20} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
              <div className="flex-1">
                <p className="text-gray-500 text-xs mb-1">行数</p>
                <input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30" />
              </div>
            </div>
            {image && <p className="text-gray-600 text-xs mt-2">每张 {Math.floor(image.naturalWidth / cols)} × {Math.floor(image.naturalHeight / rows)}px，共 {rows * cols} 张</p>}
          </div>
        )}

        {/* 自定义切线模式 */}
        {mode === 'custom' && image && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-1">点击添加横线，Shift+点击添加竖线，拖动调整，右键删除</p>
            <p className="text-gray-600 text-xs mb-2">{hLines.length} 横线 · {vLines.length} 竖线 · 共 {customPieceCount} 块</p>
            <div ref={previewRef} className="relative w-full bg-black/30 rounded-lg overflow-hidden cursor-crosshair select-none"
              style={{ aspectRatio: `${image.naturalWidth}/${image.naturalHeight}` }}
              onClick={handlePreviewClick} onMouseMove={handleCustomMouseMove}
              onMouseUp={() => setDraggingLine(null)} onMouseLeave={() => setDraggingLine(null)}
            >
              <img src={image.src} className="w-full h-full object-fill pointer-events-none" draggable={false} />
              {hLines.map((y, i) => (
                <div key={`h-${i}`} className="absolute left-0 right-0 cursor-row-resize group"
                  style={{ top: `${y * 100}%`, height: '10px', transform: 'translateY(-50%)', zIndex: 10 }}
                  onMouseDown={(e) => handleLineMouseDown(e, 'h', i)} onContextMenu={(e) => handleLineContextMenu(e, 'h', i)}>
                  <div className="absolute left-0 right-0 bg-yellow-400/80 group-hover:bg-yellow-300" style={{ height: '2px', top: '4px' }} />
                </div>
              ))}
              {vLines.map((x, i) => (
                <div key={`v-${i}`} className="absolute top-0 bottom-0 cursor-col-resize group"
                  style={{ left: `${x * 100}%`, width: '10px', transform: 'translateX(-50%)', zIndex: 10 }}
                  onMouseDown={(e) => handleLineMouseDown(e, 'v', i)} onContextMenu={(e) => handleLineContextMenu(e, 'v', i)}>
                  <div className="absolute top-0 bottom-0 bg-blue-400/80 group-hover:bg-blue-300" style={{ width: '2px', left: '4px' }} />
                </div>
              ))}
            </div>
            <button onClick={() => { setHLines([]); setVLines([]); }} className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">清除所有切线</button>
          </div>
        )}

        {/* 框选模式 */}
        {mode === 'select' && image && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-1">在图片上拖动鼠标框选要切割的区域，右键删除框</p>
            <p className="text-gray-600 text-xs mb-2">已框选 {boxes.length} 个区域</p>
            <div ref={previewRef} className="relative w-full bg-black/30 rounded-lg overflow-hidden select-none"
              style={{ aspectRatio: `${image.naturalWidth}/${image.naturalHeight}`, cursor: 'crosshair' }}
              onMouseDown={handleSelectMouseDown} onMouseMove={handleSelectMouseMove}
              onMouseUp={handleSelectMouseUp} onMouseLeave={handleSelectMouseUp}
            >
              <img src={image.src} className="w-full h-full object-fill pointer-events-none" draggable={false} />
              {/* 已保存的框 */}
              {boxes.map((b, i) => (
                <div key={i} className="absolute border-2 border-green-400/80 bg-green-400/10 group"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
                  onContextMenu={(e) => { e.preventDefault(); setBoxes(prev => prev.filter((_, j) => j !== i)); }}
                >
                  <span className="absolute top-0.5 left-1 text-green-300 text-[10px] font-bold">{i + 1}</span>
                </div>
              ))}
              {/* 正在画的框 */}
              {currentBox && (
                <div className="absolute border-2 border-blue-400/80 bg-blue-400/10 pointer-events-none"
                  style={{ left: `${currentBox.x * 100}%`, top: `${currentBox.y * 100}%`, width: `${currentBox.w * 100}%`, height: `${currentBox.h * 100}%` }}
                />
              )}
            </div>
            <button onClick={() => setBoxes([])} className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors">清除所有框</button>
          </div>
        )}

        {mode !== 'grid' && !image && (
          <p className="text-gray-500 text-xs mb-4">请先上传图片</p>
        )}

        <button onClick={handleSplit} disabled={splitDisabled}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >{splitLabel}</button>
      </div>
    </>
  );
}
// 资产面板组件
function AssetPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const imgs: string[] = [];
        const vids: string[] = [];

        // 读用户目录下的图片
        const { data: userFiles } = await supabase.storage
          .from('assets')
          .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        userFiles?.forEach((file: any) => {
          const url = supabase.storage.from('assets').getPublicUrl(`${user.id}/${file.name}`).data.publicUrl;
          if (file.name.endsWith('.mp4')) {
            vids.push(url);
          } else if (file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
            imgs.push(url);
          }
        });

        // 读 videos/{userId}/ 目录下的视频
        const { data: videoFiles } = await supabase.storage
          .from('assets')
          .list(`videos/${user.id}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        videoFiles?.forEach((file: any) => {
          if (file.name.endsWith('.mp4')) {
            const url = supabase.storage.from('assets').getPublicUrl(`videos/${user.id}/${file.name}`).data.publicUrl;
            vids.push(url);
          }
        });

        setImages(imgs);
        setVideos(vids);
      } catch (err) {
        console.error('加载资产失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-zinc-900 border-l border-white/10 z-[9999] shadow-2xl flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">资产库</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab 切换 */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('images')}
          className={`flex-1 py-3 text-sm font-medium transition-all ${
            activeTab === 'images'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          图片 ({images.length})
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-3 text-sm font-medium transition-all ${
            activeTab === 'videos'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          视频 ({videos.length})
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : activeTab === 'images' ? (
          images.length === 0 ? (
            <div className="text-center text-gray-400 py-16">暂无图片</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative group aspect-square bg-black/20 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a href={url} download className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          videos.length === 0 ? (
            <div className="text-center text-gray-400 py-16">暂无视频</div>
          ) : (
            <div className="space-y-3">
              {videos.map((url, i) => (
                <div key={i} className="relative group bg-black/20 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all">
                  <video src={url} controls crossOrigin="anonymous" className="w-full" />
                  <a href={url} download className="absolute top-2 right-2 p-2 bg-blue-500 hover:bg-blue-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CanvasPageContent() {
  const searchParams = useSearchParams();
  const isTutorial = searchParams.get('tutorial') === 'true';
  const templateId = searchParams.get('templateId');
  const isWelcome = searchParams.get('welcome') === '1';

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const cameraZoomRef = useRef(1);
  const cameraPosRef = useRef({ x: 0, y: 0 });
  const gridBgRef = useRef<HTMLStyleElement | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showTutorial, setShowTutorial] = useState(isTutorial);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('unsaved');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [canvasList, setCanvasList] = useState<{id: string; title: string}[]>([]);
  const [showCanvasList, setShowCanvasList] = useState(false);
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showImageSplitModal, setShowImageSplitModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState<{ x: number; y: number; shapeId: string; type: 'image-card' | 'step2-card' | 'media-upload-card' | 'image-output' | 'video-output' } | null>(null);
  const { isMember, balance, memberExpiresAt, refresh: refreshMembership } = useMembership();

  // 检查是否需要弹出领取会员弹窗（未领取过的用户每次进画布都弹）
  useEffect(() => {
    const checkWelcome = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('promo_codes')
        .select('id, used_by_user_id')
        .eq('created_for_user_id', session.user.id)
        .single();
      // 没有记录（从未领取）或有记录但未使用，都弹出
      if (!data || !data.used_by_user_id) {
        setTimeout(() => setShowWelcomeModal(true), 1000);
      }
    };
    checkWelcome();
  }, []);

  // 暴露给所有扣费卡片调用，用于生成成功后立即刷新余额
  useEffect(() => {
    (window as any).refreshBalance = refreshMembership;
    return () => { delete (window as any).refreshBalance; };
  }, [refreshMembership]);

  const handlePay = async (plan: 'membership' | 'recharge', amount: number) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('请先登录'); return; }
    const res = await fetch('/api/payment/alipay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, amount }),
    });
    const data = await res.json();
    if (data.paymentForm) {
      const div = document.createElement('div');
      div.innerHTML = data.paymentForm;
      document.body.appendChild(div);
      const form = div.querySelector('form');
      form?.submit();
    } else {
      alert(data.error || '发起支付失败');
    }
  };

  const canvasIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const hasUnsavedRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const mountCleanupRef = useRef<(() => void) | null>(null);

  // 退出页面自动保存（改用异步直写 Supabase，去掉同步 XHR 阻塞主线程）
  useEffect(() => {
    const doSaveAsync = () => {
      if (!canvasIdRef.current || !editorRef.current) return;
      if (!hasUnsavedRef.current) return;
      if (isRestoringRef.current) return;
      const snapshot = getSnapshot(editorRef.current.store);
      const shapeCount = Object.keys(snapshot?.document?.store ?? {}).filter(k => k.startsWith('shape:')).length;
      if (shapeCount === 0) return;
      saveSnapshot(canvasIdRef.current, snapshot).catch(e => console.error('退出保存失败:', e));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') doSaveAsync();
    };

    window.addEventListener('beforeunload', doSaveAsync);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', doSaveAsync);

    return () => {
      window.removeEventListener('beforeunload', doSaveAsync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', doSaveAsync);
    };
  }, []);

  // 自定义形状工具和绑定工具
  const customShapeUtils = [CustomCardShapeUtil, ConnectionShapeUtil, TimelineShapeUtil, ShotCardShapeUtil, PromptOptimizerCardUtil, GemStep0CardUtil, GemStep2CardUtil, GemStep3CardUtil, GemStep4CardUtil, AudioCardUtil, SeedanceCardUtil, CameraControlCardUtil, MediaUploadCardUtil];
  const customBindingUtils = [ConnectionBindingUtil];
  const customTools = [PortTool];

  // 隐藏所有默认UI组件
  const components: TLComponents = {
    Toolbar: null,
    StylePanel: null,
    PageMenu: null,
    NavigationPanel: null,
    Minimap: null,
    DebugPanel: null,
    DebugMenu: null,
    MenuPanel: null,
    TopPanel: null,
    SharePanel: null,
    ActionsMenu: null,
    HelpMenu: null,
    MainMenu: null,
    QuickActions: null,
    HelperButtons: null,
    ZoomMenu: null,
  };

  // 当编辑器加载完成时的设置
  const handleMount = (editor: Editor) => {
    console.log('编辑器已加载');

    // 先清理上一次 mount 留下的监听器
    if (mountCleanupRef.current) {
      mountCleanupRef.current();
      mountCleanupRef.current = null;
    }

    setEditorInstance(editor);
    editorRef.current = editor;

    // 立即设置初始缩放为 80%
    setTimeout(() => {
      editor.setCamera({ x: 0, y: 0, z: 0.8 });
    }, 0);

    // 暴露给卡片输出浮板的 ➕ 按钮调用
    (window as any).openOutputMenu = (shapeId: string, clientX: number, clientY: number, kind: 'image-output' | 'video-output') => {
      setFloatingMenu({ x: clientX, y: clientY, shapeId, type: kind });
    };

    // 3秒后隐藏介绍动画
    setTimeout(() => setShowIntro(false), 3000);

    // ── 加载用户画布 ──────────────────────────────────────────────
    (async () => {
      isRestoringRef.current = true; // 加载开始就锁住，防止期间任何操作触发保存
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          window.location.replace('/auth');
          return;
        }

        setIsLoggedIn(true);
        userIdRef.current = user.id;
        setUserEmail(user.email || '');

        // 带 templateId：从模板创建新画布
        if (templateId) {
          try {
            const tRes = await fetch(`/api/templates/${templateId}`);
            const tData = await tRes.json();
            if (tData.template) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                const createRes = await fetch('/api/canvas/create-from-template', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    title: `${tData.template.title}（副本）`,
                    snapshot: tData.template.snapshot_json,
                  }),
                });
                const createData = await createRes.json();
                if (createData.canvasId) {
                  canvasIdRef.current = createData.canvasId;
                  loadSnapshot(editor.store, tData.template.snapshot_json);
                  // 刷新画布列表
                  const { data: refreshed } = await supabase
                    .from('canvases')
                    .select('id, title')
                    .eq('user_id', user.id)
                    .order('updated_at', { ascending: false });
                  if (refreshed) setCanvasList(refreshed);
                  // 清掉 URL 里的 templateId
                  window.history.replaceState({}, '', '/canvas');
                  setTimeout(() => { isRestoringRef.current = false; }, 500);
                  return;
                }
              }
            }
          } catch (e) {
            console.error('从模板创建画布失败:', e);
          }
        }

        // 加载画布列表
        const { data: canvases } = await supabase
          .from('canvases')
          .select('id, title')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        if (canvases) setCanvasList(canvases);

        // 用已有的第一个画布，没有才创建
        const canvasId = canvases && canvases.length > 0
          ? canvases[0].id
          : await getOrCreateCanvas(user.id);
        canvasIdRef.current = canvasId;

        const snapshot = await loadCanvasSnapshot(canvasId);
        if (snapshot) {
          loadSnapshot(editor.store, snapshot);
          console.log('画布已恢复');
        }
        // 加载完成后延迟解锁，让 store 批量写入完成
        setTimeout(() => { isRestoringRef.current = false; }, 500);
      } catch (err) {
        console.error('加载画布失败:', err);
        isRestoringRef.current = false; // 出错也要解锁
      }
    })();

    // ── 监听变化标记未保存（只监听用户操作，忽略 loadSnapshot 的批量写入）──
    const unsubscribeUnsaved = editor.store.listen(() => {
      if (!canvasIdRef.current) return;
      if (isRestoringRef.current) return; // 恢复期间忽略
      hasUnsavedRef.current = true;
      setSaveStatus('unsaved');
    }, { source: 'user', scope: 'document' });

    // ── 自动保存：进入后30/60/90分钟各保存一次 ──────────────────
    const doAutoSave = async () => {
      if (!canvasIdRef.current || !hasUnsavedRef.current) return;
      if (isRestoringRef.current) return; // 恢复期间不保存
      try {
        const snapshot = getSnapshot(editor.store);
        // 空画布保护：shapes 数量为0时拒绝保存，避免覆盖历史数据
        const shapeCount = Object.keys(snapshot?.document?.store ?? {}).filter(k => k.startsWith('shape:')).length;
        if (shapeCount === 0) {
          console.warn('自动保存跳过：画布为空，可能是加载未完成');
          return;
        }
        setSaveStatus('saving');
        await saveSnapshot(canvasIdRef.current!, snapshot);
        hasUnsavedRef.current = false;
        setSaveStatus('saved');
      } catch (err) {
        console.error('自动保存失败:', err);
        setSaveStatus('unsaved');
      }
    };

    const t1 = setTimeout(doAutoSave, 30 * 60 * 1000);
    const t2 = setTimeout(doAutoSave, 60 * 60 * 1000);
    const t3 = setTimeout(doAutoSave, 90 * 60 * 1000);

    // ── 调试工具：window.debugCanvasSnapshotSize() 查看 snapshot 大小 ──
    (window as any).debugCanvasSnapshotSize = () => {
      const snapshot = getSnapshot(editor.store);
      const json = JSON.stringify(snapshot);
      const totalBytes = new Blob([json]).size;
      const mb = (totalBytes / 1024 / 1024).toFixed(2);
      const kb = (totalBytes / 1024).toFixed(0);

      console.log(`%c[Snapshot 大小]`, 'color: #3b82f6; font-weight: bold; font-size: 14px;');
      console.log(`总大小：${mb} MB (${kb} KB)`);

      // 统计每个 shape 的大小
      const records = (snapshot as any)?.document?.store || {};
      const shapes = Object.entries(records)
        .filter(([k]) => k.startsWith('shape:'))
        .map(([id, rec]: [string, any]) => {
          const shapeJson = JSON.stringify(rec);
          const bytes = new Blob([shapeJson]).size;
          return {
            id: id.slice(0, 30),
            type: rec.type,
            cardType: rec.props?.cardType,
            bytes,
            kb: (bytes / 1024).toFixed(1),
          };
        })
        .sort((a, b) => b.bytes - a.bytes);

      console.log(`共 ${shapes.length} 个 shape，按大小排序：`);
      console.table(shapes.slice(0, 20).map(s => ({
        type: s.cardType ? `${s.type}(${s.cardType})` : s.type,
        size: `${s.kb} KB`,
        id: s.id,
      })));

      // 找出含 base64 的字段
      console.log(`%c[Base64 字段排查]`, 'color: #ef4444; font-weight: bold; font-size: 14px;');
      const base64Fields: Array<{ shape: string; field: string; sizeKb: string }> = [];
      Object.entries(records).forEach(([id, rec]: [string, any]) => {
        if (!id.startsWith('shape:') || !rec.props) return;
        Object.entries(rec.props).forEach(([key, val]) => {
          if (typeof val === 'string' && val.startsWith('data:') && val.length > 10000) {
            base64Fields.push({
              shape: `${rec.type}(${rec.props.cardType || ''}) ${id.slice(-6)}`,
              field: key,
              sizeKb: (new Blob([val]).size / 1024).toFixed(1),
            });
          }
          // JSON 字段里的 base64 数组
          if (typeof val === 'string' && val.startsWith('[') && val.includes('data:') && val.length > 10000) {
            base64Fields.push({
              shape: `${rec.type}(${rec.props.cardType || ''}) ${id.slice(-6)}`,
              field: `${key}[]`,
              sizeKb: (new Blob([val]).size / 1024).toFixed(1),
            });
          }
        });
      });
      if (base64Fields.length === 0) {
        console.log('✅ 没有发现大 base64 字段');
      } else {
        console.table(base64Fields.sort((a, b) => parseFloat(b.sizeKb) - parseFloat(a.sizeKb)));
      }

      console.log(`%c诊断结论`, 'color: #10b981; font-weight: bold; font-size: 14px;');
      if (totalBytes < 1 * 1024 * 1024) console.log('✅ snapshot < 1MB，无需优化');
      else if (totalBytes < 3 * 1024 * 1024) console.log('⚠️ snapshot 1-3MB，建议但不紧急');
      else if (totalBytes < 4.5 * 1024 * 1024) console.log('🔶 snapshot 3-4.5MB，接近 Vercel 413 临界，建议尽快优化');
      else console.log('🚨 snapshot > 4.5MB，可能已触发 413 错误，必须立即优化');

      return { totalMb: parseFloat(mb), shapeCount: shapes.length, base64Fields };
    };

    // ── 生成成功触发保存（全局方法，节流 2 秒） ──────────────
    let generationSaveTimer: ReturnType<typeof setTimeout> | null = null;
    const saveCanvasNow = () => {
      if (!canvasIdRef.current) return;
      if (isRestoringRef.current) return; // 恢复期不保存
      if (generationSaveTimer) return;    // 节流：2 秒内只触发一次
      generationSaveTimer = setTimeout(async () => {
        generationSaveTimer = null;
        try {
          const snapshot = getSnapshot(editor.store);
          const shapeCount = Object.keys(snapshot?.document?.store ?? {}).filter(k => k.startsWith('shape:')).length;
          if (shapeCount === 0) return; // 空画布保护
          setSaveStatus('saving');
          await saveSnapshot(canvasIdRef.current!, snapshot);
          hasUnsavedRef.current = false;
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('unsaved'), 2000);
        } catch (err) {
          console.error('生成后自动保存失败:', err);
          setSaveStatus('unsaved');
        }
      }, 2000);
    };
    (window as any).saveCanvasNow = saveCanvasNow;

    // 监听相机变化，直接更新 DOM 样式（避免 React 重渲染）
    let rafId: number | null = null;
    const updateCamera = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const camera = editor.getCamera();
        cameraZoomRef.current = camera.z;
        cameraPosRef.current = { x: camera.x, y: camera.y };
        const bgEl = document.querySelector('.tl-background') as HTMLElement | null;
        if (bgEl) {
          const size = 60 * camera.z;
          bgEl.style.backgroundSize = `${size}px ${size}px`;
          bgEl.style.backgroundPosition = `${-camera.x * camera.z}px ${-camera.y * camera.z}px`;
        }
      });
    };
    updateCamera();
    const unsubscribe = editor.store.listen(updateCamera, { scope: 'session' });

    // 监听鼠标事件，实现右键拖动画布
    let isDraggingCanvas = false;
    let lastX = 0;
    let lastY = 0;

    const handleContextMenu = (e: MouseEvent) => {
      // 阻止右键菜单
      e.preventDefault();
    };

    const handlePointerDown = (e: PointerEvent) => {
      // 右键按下（button === 2）
      if (e.button === 2) {
        const target = e.target as HTMLElement;

        // 检查是否点击了卡片
        const clickedOnShape = target.closest('.tl-shape') !== null;

        if (!clickedOnShape) {
          // 点击空白处，拖动画布
          isDraggingCanvas = true;
          lastX = e.clientX;
          lastY = e.clientY;
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingCanvas) {
        const deltaX = e.clientX - lastX;
        const deltaY = e.clientY - lastY;

        const camera = editor.getCamera();
        editor.setCamera({
          x: camera.x + deltaX / camera.z,
          y: camera.y + deltaY / camera.z,
          z: camera.z,
        });

        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 2 && isDraggingCanvas) {
        isDraggingCanvas = false;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 添加事件监听，使用 capture 阶段
    const container = editor.getContainer();
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove, { capture: true });
    container.addEventListener('pointerup', handlePointerUp, { capture: true });
    const handlePointerLeave = () => { isDraggingCanvas = false; };
    container.addEventListener('pointerleave', handlePointerLeave);

    // 监听卡片悬浮菜单事件
    const handleCardMenu = (e: Event) => {
      const ce = e as CustomEvent;
      setFloatingMenu({ x: ce.detail.x, y: ce.detail.y, shapeId: ce.detail.shapeId, type: ce.detail.type });
    };
    window.addEventListener('card-menu-open', handleCardMenu);

    // 双击空白画布创建上传卡片
    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.tl-shape')) return;
      const camera = editor.getCamera();
      const x = (e.clientX - camera.x * camera.z) / camera.z - 160;
      const y = (e.clientY - camera.y * camera.z) / camera.z - 110;
      editor.createShape({
        id: createShapeId(),
        type: 'media-upload-card' as any,
        x, y,
        props: { w: 320, h: 220, mediaType: 'none', imageData: '', videoUrl: '', videoName: '', isUploading: false, isMinimized: false },
      });
    };
    container.addEventListener('dblclick', handleDblClick);

    mountCleanupRef.current = () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (generationSaveTimer) clearTimeout(generationSaveTimer);
      if ((window as any).saveCanvasNow === saveCanvasNow) delete (window as any).saveCanvasNow;
      delete (window as any).debugCanvasSnapshotSize;
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsubscribe();
      unsubscribeUnsaved();
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove, { capture: true });
      container.removeEventListener('pointerup', handlePointerUp, { capture: true });
      container.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('card-menu-open', handleCardMenu);
      container.removeEventListener('dblclick', handleDblClick);
    };
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* 介绍动画 */}
      {showIntro && (
        <div className="fixed inset-0 z-[100000] bg-black flex items-center justify-center animate-intro">
          <div className="text-center">
            <h1 className="text-6xl font-bold text-white mb-4 animate-fade-in-up">
              Boluolab
            </h1>
            <div className="flex items-center justify-center gap-2 animate-fade-in-up-delay">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
              <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-100"></div>
              <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse delay-200"></div>
            </div>
          </div>
        </div>
      )}

      <Tldraw
        components={components}
        shapeUtils={customShapeUtils}
        bindingUtils={customBindingUtils}
        tools={customTools}
        onMount={handleMount}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY || ''}
      />

      {/* 将控件放在 Tldraw 外面 */}
      {editorInstance && (
        <>
          {/* 未登录提示 */}
          {isLoggedIn === false && (
            <div className="fixed inset-0 z-[200000] bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-white text-lg font-semibold mb-2">登录后使用画布</h2>
                <p className="text-gray-400 text-sm mb-6">登录后可保存画布、生成图片和视频</p>
                <a
                  href="/auth"
                  className="block w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-all"
                >
                  去登录
                </a>
              </div>
            </div>
          )}

          {/* 保存状态 + 画布切换 */}
          {isLoggedIn && (
            <div className="fixed top-4 right-4 flex items-center gap-2" style={{ zIndex: 99999 }}>

              {/* 余额 + 会员状态 */}
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300">
                {isMember ? (
                  <span className="text-violet-400 font-semibold cursor-pointer hover:text-violet-300 transition-colors" onClick={() => setShowAccountModal(true)}>会员</span>
                ) : (
                  <button
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                    onClick={() => setShowAccountModal(true)}
                  >
                    开通会员
                  </button>
                )}
                <span className="text-white/20">|</span>
                <span className="text-white/60">¥{balance.toFixed(2)}</span>
                <button
                  className="text-blue-400 hover:text-blue-300 transition-colors ml-0.5"
                  onClick={() => setShowAccountModal(true)}
                >
                  充值
                </button>
              </div>

              {/* 保存为模板（仅管理员） */}
              {['1825221780@qq.com', '3866855423@qq.com'].includes(userEmail || '') && editorInstance && (
                <button
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600/30 backdrop-blur-md border border-purple-500/40 text-purple-200 hover:bg-purple-600/50 hover:border-purple-500/60 transition-all"
                  title="保存当前画布为工作流模板"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  保存为模板
                </button>
              )}

              {/* 画布列表按钮 */}
              <div className="relative">
                <button
                  onClick={() => setShowCanvasList(!showCanvasList)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  画布
                </button>

                {showCanvasList && (
                  <div className="absolute top-8 right-0 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-white/5">
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-white/5 rounded-lg transition-all"
                        onClick={async () => {
                          const supabase = createClient();
                          const title = `画布 ${new Date().toLocaleDateString('zh-CN')}`;
                          const { data } = await supabase
                            .from('canvases')
                            .insert({ user_id: userIdRef.current, title })
                            .select('id, title')
                            .single();
                          if (data) {
                            setCanvasList(prev => [data, ...prev]);
                            canvasIdRef.current = data.id;
                            if (editorInstance) {
                              isRestoringRef.current = true;
                              editorInstance.selectAll();
                              editorInstance.deleteShapes(editorInstance.getSelectedShapeIds());
                              isRestoringRef.current = false;
                            }
                            setShowCanvasList(false);
                          }
                        }}
                      >
                        + 新建画布
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {canvasList.map((c) => (
                        <div key={c.id} className={`flex items-center gap-1 px-2 py-1 hover:bg-white/5 ${canvasIdRef.current === c.id ? 'bg-white/5' : ''}`}>
                          {renamingId === c.id ? (
                            <input
                              autoFocus
                              className="flex-1 bg-black/40 border border-white/20 rounded px-2 py-1 text-xs text-white outline-none"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  const supabase = createClient();
                                  await supabase.from('canvases').update({ title: renameValue }).eq('id', c.id);
                                  setCanvasList(prev => prev.map(x => x.id === c.id ? { ...x, title: renameValue } : x));
                                  setRenamingId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingId(null);
                                }
                              }}
                              onBlur={async () => {
                                const supabase = createClient();
                                await supabase.from('canvases').update({ title: renameValue }).eq('id', c.id);
                                setCanvasList(prev => prev.map(x => x.id === c.id ? { ...x, title: renameValue } : x));
                                setRenamingId(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              onPointerDown={e => e.stopPropagation()}
                            />
                          ) : (
                            <button
                              className={`flex-1 text-left text-xs py-1 px-1 truncate ${canvasIdRef.current === c.id ? 'text-white' : 'text-gray-400'}`}
                              onClick={async () => {
                                canvasIdRef.current = c.id;
                                if (editorInstance) {
                                  const snapshot = await loadCanvasSnapshot(c.id);
                                  isRestoringRef.current = true;
                                  if (snapshot) {
                                    loadSnapshot(editorInstance.store, snapshot);
                                  } else {
                                    editorInstance.selectAll();
                                    editorInstance.deleteShapes(editorInstance.getSelectedShapeIds());
                                  }
                                  isRestoringRef.current = false;
                                }
                                setShowCanvasList(false);
                              }}
                            >
                              {canvasIdRef.current === c.id ? '● ' : '○ '}{c.title}
                            </button>
                          )}
                          {/* 重命名按钮 */}
                          <button
                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white rounded transition-all flex-shrink-0"
                            title="重命名"
                            onClick={e => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                            onPointerDown={e => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* 删除按钮 - 至少保留一个画布 */}
                          {canvasList.length > 1 && (
                            <button
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 rounded transition-all flex-shrink-0"
                              title="删除画布"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`确定删除画布「${c.title}」？`)) return;
                                const supabase = createClient();
                                await supabase.from('canvas_snapshots').delete().eq('canvas_id', c.id);
                                await supabase.from('canvases').delete().eq('id', c.id);
                                const newList = canvasList.filter(x => x.id !== c.id);
                                setCanvasList(newList);
                                // 如果删的是当前画布，切换到第一个
                                if (canvasIdRef.current === c.id && newList.length > 0) {
                                  canvasIdRef.current = newList[0].id;
                                  const snapshot = await loadCanvasSnapshot(newList[0].id);
                                  if (editorInstance) {
                                    isRestoringRef.current = true;
                                    if (snapshot) {
                                      loadSnapshot(editorInstance.store, snapshot);
                                    } else {
                                      editorInstance.selectAll();
                                      editorInstance.deleteShapes(editorInstance.getSelectedShapeIds());
                                    }
                                    isRestoringRef.current = false;
                                  }
                                }
                              }}
                              onPointerDown={e => e.stopPropagation()}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 手动保存按钮 */}
              <button
                onClick={async () => {
                  if (!canvasIdRef.current || !editorInstance) return;
                  try {
                    flushSync(() => setSaveStatus('saving'));
                    const snapshot = getSnapshot(editorInstance.store);
                    await saveSnapshot(canvasIdRef.current, snapshot);
                    hasUnsavedRef.current = false;
                    setSaveStatus('saved');
                    setTimeout(() => setSaveStatus('unsaved'), 2000);
                  } catch (err) {
                    console.error('保存失败:', err);
                    setSaveStatus('unsaved');
                  }
                }}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving' ? (
                  <><div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /><span className="text-yellow-400">保存中...</span></>
                ) : saveStatus === 'saved' ? (
                  <><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-green-400">已保存</span></>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg><span>保存</span></>
                )}
              </button>

              {/* 返回主页按钮 */}
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>主页</span>
              </button>
            </div>
          )}

          <ZoomControlsExternal editor={editorInstance} />
          <BottomToolbarExternal editor={editorInstance} onOpenAssetPanel={() => setShowAssetPanel(true)} onOpenImageSplit={() => setShowImageSplitModal(true)} />
        </>
      )}

      {/* Tutorial Overlay */}
      {showTutorial && editorInstance && (
        <TutorialOverlay
          editor={editorInstance}
          onComplete={() => setShowTutorial(false)}
          onSkip={() => setShowTutorial(false)}
        />
      )}

      {/* 资产面板 */}
      {showAssetPanel && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={() => setShowAssetPanel(false)} />
          <AssetPanel onClose={() => setShowAssetPanel(false)} />
        </>
      )}

      {/* 图片切割弹窗 */}
      {showImageSplitModal && (
        <ImageSplitModal onClose={() => setShowImageSplitModal(false)} />
      )}

      {/* 卡片悬浮菜单 */}
      {floatingMenu && editorInstance && (() => {
        const editor = editorInstance;

        // 创建连接线（使用正确的 binding 方式）
        const createConnection = (fromShapeId: string, toShapeId: string) => {
          const fromShape = editor.getShape(fromShapeId as any);
          if (!fromShape) return;
          const fromBounds = editor.getShapePageBounds(fromShapeId as any);
          if (!fromBounds) return;

          // 计算起始端口位置（右侧输出端口）
          const portX = fromBounds.maxX;
          const portY = fromBounds.midY;

          const connId = createShapeId();
          editor.createShape({
            id: connId,
            type: 'connection' as any,
            x: portX,
            y: portY,
            props: { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }
          });
          editor.createBinding({
            type: 'connection',
            fromId: connId,
            toId: fromShapeId as any,
            props: { terminal: 'start', portId: 'output' }
          });
          editor.createBinding({
            type: 'connection',
            fromId: connId,
            toId: toShapeId as any,
            props: { terminal: 'end', portId: 'input' }
          });
        };

        // 获取卡片右侧位置（用于新卡片放置）
        const getShapeRight = (shapeId: string) => {
          const shape = editor.getShape(shapeId as any) as any;
          if (!shape) return { x: 400, y: 300 };
          return { x: shape.x + (shape.props?.w ?? 380) + 40, y: shape.y };
        };

        // 图片卡片菜单选项
        const imageCardOptions: { label: string; desc?: string; onClick: () => void }[] = [
          {
            label: '图片生成',
            onClick: () => {
              const srcShape = editor.getShape(floatingMenu.shapeId as any) as any;
              if (!srcShape) return;
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'custom-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  cardType: 'image',
                  title: 'Image Generation',
                  prompt: '',
                  model: 'nano-banana-pro',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
          {
            label: '视频生成',
            desc: '默认 Veo 3.1 Fast 图生视频（可在卡片内切换其他视频模型）',
            onClick: () => {
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'custom-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  cardType: 'video',
                  title: 'Video Generation',
                  prompt: '',
                  model: 'veo3.1-fast-i2v',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
          {
            label: 'Seedance 视频',
            desc: '豆包 Seedance 2.0 视频生成（图生视频 / 多模态）',
            onClick: () => {
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'seedance-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  mode: 'i2v',
                  model: 'doubao-seedance-2-0-260128',
                  prompt: '',
                  ratio: '16:9',
                  duration: '5',
                  resolution: '720p',
                  generateAudio: true,
                  firstFrameImage: '',
                  lastFrameImage: '',
                  refImages: '[]',
                  refVideoUrl: '',
                  refVideoName: '',
                  refAudioBase64: '',
                  refAudioName: '',
                  generatedVideo: '',
                  capturedFrame: '',
                  isGenerating: false,
                  generationProgress: 0,
                  generationStatus: '',
                  showSettings: false,
                  isMinimized: false,
                  showPromptPanel: false,
                  showRefContentPanel: false,
                  isCollapsed: false,
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
          {
            label: '角色设计',
            onClick: () => {
              const srcShape = editor.getShape(floatingMenu.shapeId as any) as any;
              if (!srcShape) return;
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'custom-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  cardType: 'character',
                  title: 'Character Design',
                  prompt: '',
                  model: 'nano-banana-pro',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
          {
            label: 'GEM 分镜设计',
            desc: '故事模式：输入剧本，AI 按叙事节奏拆解为分镜\n时空模式：上传首帧和尾帧，AI 生成两帧之间的过渡中间镜头',
            onClick: () => {
              const srcShape = editor.getShape(floatingMenu.shapeId as any) as any;
              if (!srcShape) return;
              const baseX = srcShape.x + (srcShape.props?.w ?? 380) + 40;
              const baseY = srcShape.y;
              const step2Id = createShapeId();
              editor.createShape({ id: step2Id, type: 'gem-step2-card' as any, x: baseX, y: baseY, props: { w: 400, h: 580 } });
              createConnection(floatingMenu.shapeId, step2Id as any);
              editor.select(step2Id);
            },
          },
          {
            label: '时空镜头延展',
            desc: '时空后退 −5s：生成画面前5秒的场景\n时空前进 +5s：生成画面后5秒的场景',
            onClick: () => {
              const srcShape = editor.getShape(floatingMenu.shapeId as any) as any;
              if (!srcShape) return;
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'camera-control-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 360, h: 520,
                  sourceShapeId: floatingMenu.shapeId,
                  cameraVertical: 0,
                  cameraHorizontal: 0,
                  generatedImage: '',
                  isGenerating: false,
                  isMinimized: false,
                  model: srcShape.props?.model ?? 'nano-banana-pro',
                  prompt: srcShape.props?.prompt ?? '',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
        ];

        // 视频输出菜单（来自视频卡 / Seedance 输出）
        const videoOutputOptions: { label: string; desc?: string; onClick: () => void }[] = [
          {
            label: 'Seedance 多模态',
            desc: '把视频作为多模态参考输入到 Seedance 2.0',
            onClick: () => {
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'seedance-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  mode: 'multimodal',
                  model: 'doubao-seedance-2-0-260128',
                  prompt: '',
                  ratio: '16:9',
                  duration: '5',
                  resolution: '720p',
                  generateAudio: true,
                  firstFrameImage: '',
                  lastFrameImage: '',
                  refImages: '[]',
                  refVideoUrl: '',
                  refVideoName: '',
                  refAudioBase64: '',
                  refAudioName: '',
                  generatedVideo: '',
                  capturedFrame: '',
                  isGenerating: false,
                  generationProgress: 0,
                  generationStatus: '',
                  showSettings: false,
                  isMinimized: false,
                  showPromptPanel: false,
                  showRefContentPanel: false,
                  isCollapsed: false,
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
          {
            label: 'Kling 视频配音',
            desc: '把视频作为对口型输入到 Kling（lip-sync 模式）',
            onClick: () => {
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'custom-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  cardType: 'kling',
                  title: 'Kling Video',
                  prompt: '',
                  model: 'kling',
                  klingMode: 'lip-sync',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
        ];

        // Step2 菜单选项
        const step2CardOptions: { label: string; desc?: string; onClick: () => void }[] = [
          {
            label: '图片生成卡片',
            onClick: () => {
              const srcShape = editor.getShape(floatingMenu.shapeId as any) as any;
              if (!srcShape) return;
              const pos = getShapeRight(floatingMenu.shapeId);
              const newId = createShapeId();
              editor.createShape({
                id: newId,
                type: 'custom-card' as any,
                x: pos.x,
                y: pos.y,
                props: {
                  w: 380, h: 380,
                  cardType: 'image',
                  title: 'Image Generation',
                  prompt: srcShape.props?.result ?? '',
                  model: 'nano-banana-pro',
                },
              });
              createConnection(floatingMenu.shapeId, newId as any);
              editor.select(newId);
            },
          },
        ];

        // 素材上传卡片菜单 = 图片卡片菜单（保持同步）
        const mediaUploadCardOptions = imageCardOptions;

        const options =
          floatingMenu.type === 'image-card' || floatingMenu.type === 'image-output' ? imageCardOptions :
          floatingMenu.type === 'video-output' ? videoOutputOptions :
          floatingMenu.type === 'media-upload-card' ? mediaUploadCardOptions :
          step2CardOptions;

        return (
          <div
            className="fixed bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl py-1.5 px-1 flex flex-col gap-0.5"
            style={{ left: floatingMenu.x, top: floatingMenu.y, zIndex: 100000, minWidth: '140px' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((opt, idx) => (
              <div key={idx} className="relative group">
                <button
                  onClick={() => { opt.onClick(); setFloatingMenu(null); }}
                  className="w-full flex items-center px-3 py-2 rounded-lg hover:bg-white/8 transition-all text-left"
                >
                  <span className="text-white text-xs font-medium">{opt.label}</span>
                </button>
                {opt.desc && (
                  <div className="absolute right-full top-0 mr-2 z-[100001] w-52 bg-white rounded-xl shadow-2xl overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="h-1 w-full bg-blue-500" />
                    <div className="p-3">
                      <div className="font-black text-gray-950 text-sm mb-1.5 tracking-tight">{opt.label}</div>
                      <div className="font-medium text-gray-900 text-[12px] leading-5">
                        {opt.desc.split('\n').map((line, i) => <div key={i}>• {line}</div>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* 点击空白关闭悬浮菜单的遮罩 */}
      {floatingMenu && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 99999 }}
          onClick={() => setFloatingMenu(null)}
        />
      )}

      {/* 离开确认弹窗 */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-80 shadow-2xl flex flex-col gap-4">
            <div className="text-white font-semibold text-base">离开画布？</div>
            <div className="text-gray-400 text-sm">离开前将自动保存画布内容。</div>
            <div className="flex flex-col gap-2">
              <button
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  btn.textContent = '保存中...';
                  if (canvasIdRef.current && editorInstance) {
                    try {
                      const snapshot = getSnapshot(editorInstance.store);
                      await saveSnapshot(canvasIdRef.current, snapshot);
                    } catch {}
                  }
                  window.location.href = '/';
                }}
              >保存并离开</button>
              <button
                className="w-full py-2 rounded-xl text-gray-500 text-sm hover:text-gray-300 transition-all"
                onClick={() => setShowLeaveConfirm(false)}
              >取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义样式 - 纯黑色主题 */}
      <style jsx global>{`
        /* tldraw 画布背景 - 点状网格，随缩放和位置变化 */
        .tl-background {
          background-color: #000000 !important;
          background-image: radial-gradient(circle, rgba(120, 120, 120, 0.35) 1px, transparent 1px);
          background-size: 60px 60px;
          background-position: 0px 0px;
        }

        /* 网格颜色 */
        .tl-grid {
          opacity: 0 !important;
        }

        /* 淡入动画 */
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        /* 隐藏所有默认UI */
        .tl-toolbar,
        .tl-style-panel,
        .tl-page-menu,
        .tl-navigation-panel,
        .tl-minimap,
        .tl-debug-panel,
        .tl-menu-panel,
        .tl-top-panel,
        .tl-help-menu,
        .tl-main-menu,
        .tl-quick-actions,
        .tl-helper-buttons,
        .tl-zoom-menu {
          display: none !important;
        }

        /* 彻底隐藏选中边框和所有选中效果 */
        .tl-selection__bg,
        .tl-selection__fg,
        .tl-selection-border,
        .tl-bounds,
        .tl-bounds__center,
        .tl-bounds__corner,
        .tl-bounds__edge,
        .tl-bounds__rotate,
        .tl-selection-border__corner,
        .tl-selection-border__edge,
        .tl-selection-border__rotate,
        .tl-selection-border__mobile,
        .tl-selection-border__mobile-rotate,
        .tl-selection-border__mobile-resize,
        .tl-selection-border__mobile-crop,
        .tl-selection-border__mobile-crop-handle,
        .tl-selection-border__mobile-crop-edge,
        .tl-selection-border__mobile-crop-corner,
        .tl-selection-border__mobile-crop-rotate,
        .tl-selection-border__mobile-crop-rotate-handle,
        .tl-selection-border__mobile-crop-rotate-edge,
        .tl-selection-border__mobile-crop-rotate-corner {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }

        /* 隐藏选中时的所有视觉效果 */
        [data-is-selected="true"],
        .tl-shape[data-is-selected="true"],
        .tl-shape.tl-shape--selected {
          outline: none !important;
          box-shadow: none !important;
        }

        /* 隐藏 SVG 选中框 */
        svg.tl-overlays__item {
          display: none !important;
        }

        .tl-overlays > * {
          display: none !important;
        }

        /* 确保画布占满整个屏幕 */
        .tl-container {
          background-color: #000000 !important;
        }

        /* 自定义鼠标样式 - 手型光标 */
        .tl-canvas {
          cursor: grab !important;
        }

        .tl-canvas:active {
          cursor: grabbing !important;
        }

        /* 拖动卡片时也用手型光标 */
        .tl-shape {
          cursor: grab !important;
        }

        .tl-shape:active {
          cursor: grabbing !important;
        }

        /* 选中状态下的卡片 */
        .tl-shape[data-is-selected="true"] {
          cursor: move !important;
        }

        /* 自定义卡片样式 */
        .tl-shape[data-shape-type="geo"] {
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        }

        /* 箭头连接线样式 - 浅灰色 */
        .tl-arrow {
          stroke: #a0a0a0 !important;
        }

        .tl-arrow-hint {
          stroke: #a0a0a0 !important;
        }

        [data-shape-type="arrow"] {
          stroke: #a0a0a0 !important;
        }

        [data-shape-type="arrow"] path {
          stroke: #a0a0a0 !important;
          fill: none !important;
        }

        [data-shape-type="arrow"] line {
          stroke: #a0a0a0 !important;
        }

        [data-shape-type="arrow"] polygon {
          fill: #a0a0a0 !important;
          stroke: #a0a0a0 !important;
        }

        /* 箭头线条粗细 */
        .tl-arrow__line {
          stroke-width: 2 !important;
        }

        /* 滑块样式 */
        .zoom-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          background: #e5e5e5;
        }

        .zoom-slider::-moz-range-thumb:hover {
          background: #e5e5e5;
        }


        /* 介绍动画 */
        @keyframes intro {
          0% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            pointer-events: none;
          }
        }

        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(30px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-intro {
          animation: intro 3s ease-in-out forwards;
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .animate-fade-in-up-delay {
          animation: fadeInUp 0.8s ease-out 0.3s forwards;
          opacity: 0;
        }

        .delay-100 {
          animation-delay: 0.1s;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }
      `}</style>

      {/* 保存为模板弹窗 */}
      {showSaveTemplateModal && editorInstance && (
        <SaveTemplateModal editor={editorInstance} onClose={() => setShowSaveTemplateModal(false)} />
      )}

      {/* 账户中心弹窗 */}
      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          onPay={handlePay}
          balance={balance}
          isMember={isMember}
          memberExpiresAt={memberExpiresAt}
        />
      )}

      {/* 注册欢迎弹窗 */}
      {showWelcomeModal && (
        <WelcomeModal onClose={() => setShowWelcomeModal(false)} onRefresh={refreshMembership} />
      )}
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    }>
      <CanvasPageContent />
    </Suspense>
  );
}
