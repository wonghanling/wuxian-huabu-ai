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
import { GemStep1CardUtil } from './GemStoryboardStep1Card';
import { GemStep2CardUtil } from './GemStoryboardStep2Card';
import { GemStep3CardUtil } from './GemStoryboardStep3Card';
import { GemStep4CardUtil } from './GemStoryboardStep4Card';
import { AudioCardUtil } from './AudioCard';
import TutorialOverlay from './TutorialOverlay';
import { createClient } from '@/lib/supabase/client';
import { getOrCreateCanvas, loadSnapshot as loadCanvasSnapshot, saveSnapshot } from '@/lib/canvas-storage';
import { useMembership } from '@/lib/useMembership';
import { MEMBERSHIP_PRICE } from '@/lib/pricing';

// 鑷畾涔夌缉鏀炬帶鍒跺櫒缁勪欢 - 澶栭儴鐗堟湰
function ZoomControlsExternal({ editor }: { editor: Editor }) {
  const [zoom, setZoom] = useState(100);

  // 鍚屾缂栬緫鍣ㄧ殑缂╂斁绾у埆鍒扮姸鎬?

  useEffect(() => {
    const interval = setInterval(() => {
      const currentZoom = Math.round(editor.getCamera().z * 100);
      if (currentZoom !== zoom) {
        setZoom(currentZoom);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editor, zoom]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('婊戝潡鏀瑰彉');
    const newZoom = parseInt(e.target.value);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
  };

  const handleZoomIn = () => {
    console.log('鐐瑰嚮鏀惧ぇ鎸夐挳锛屽綋鍓嶇缉鏀?', zoom);
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('鏂扮缉鏀?', newZoom);
  };

  const handleZoomOut = () => {
    console.log('鐐瑰嚮缂╁皬鎸夐挳锛屽綋鍓嶇缉鏀?', zoom);
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('鏂扮缉鏀?', newZoom);
  };

  const handleResetZoom = () => {
    console.log('閲嶇疆缂╂斁');
    setZoom(100);
    editor.setCamera({ ...editor.getCamera(), z: 1 });
  };

  const handleFitToScreen = () => {
    console.log('閫傚簲灞忓箷');
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
      {/* 閫傚簲灞忓箷 */}
      <button
        onClick={handleFitToScreen}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white transition-all"
        title="閫傚簲灞忓箷"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* 閲嶇疆缂╂斁 */}
      <button
        onClick={handleResetZoom}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white transition-all"
        title="閲嶇疆缂╂斁"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 缂╁皬鎸夐挳 */}
      <button
        onClick={handleZoomOut}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-bold transition-all"
        title="缂╁皬"
      >
        鈭?      </button>

      {/* 婊戝潡 */}
      <input
        type="range"
        min="25"
        max="200"
        value={zoom}
        onChange={handleZoomChange}
        className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer zoom-slider"
        title={`${zoom}%`}
      />

      {/* 鏀惧ぇ鎸夐挳 */}
      <button
        onClick={handleZoomIn}
        className="w-6 h-6 hover:bg-white/10 rounded-md flex items-center justify-center text-white text-sm font-bold transition-all"
        title="鏀惧ぇ"
      >
        +
      </button>

      {/* 缂╂斁鐧惧垎姣旀樉绀?*/}
      <div className="min-w-[2rem] text-center text-white text-xs font-medium">
        {zoom}%
      </div>

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

// 搴曢儴宸ュ叿鏍?- 澶栭儴鐗堟湰锛堥噸鏂拌璁?- 鍙姌鍙犳娊灞夊紡锛?
function BottomToolbarExternal({ editor, onOpenAssetPanel, onOpenImageSplit }: { editor: Editor; onOpenAssetPanel: () => void; onOpenImageSplit: () => void }) {

const [isExpanded, setIsExpanded] = useState(true);
  const [showShotTypePanel, setShowShotTypePanel] = useState(false);

  const createTextCard = () => {
    console.log('鐐瑰嚮鏂囨湰鐢熸垚鎸夐挳');
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

      console.log('鏂囨湰鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓鍗＄墖澶辫触:', error);
    }
  };

  const createImageCard = () => {
    console.log('鐐瑰嚮鍥剧墖鐢熸垚鎸夐挳');
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

      console.log('鍥剧墖鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓鍥剧墖鍗＄墖澶辫触:', error);
    }
  };

  const createVideoCard = () => {
    console.log('鐐瑰嚮瑙嗛鐢熸垚鎸夐挳');
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

      console.log('瑙嗛鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓瑙嗛鍗＄墖澶辫触:', error);
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
        y: centerY - 220,
        props: {
          w: 380,
          h: 440,
          cardType: 'kling',
          title: 'Kling Video',
          prompt: '',
          model: 'v2.6',
          klingMode: 'motion-control',
          klingMotionVersion: 'v2.6',
          klingVideoMode: 'std',
          klingKeepSound: 'no',
        },
      });

      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('创建 Kling 卡片失败:', error);
    }
  };
  const createCharacterCard = () => {
    console.log('鐐瑰嚮瑙掕壊璁捐鎸夐挳');
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

      console.log('瑙掕壊鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓瑙掕壊鍗＄墖澶辫触:', error);
    }
  };

  const createAssetCard = () => {
    onOpenAssetPanel();
  };

  const createDirectorTimeline = () => {
    console.log('鐐瑰嚮瀵兼紨娴佺▼鎸夐挳');
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
          shotType: '鍏ㄦ櫙',
        },
      });

      console.log('瀵兼紨娴佺▼鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓瀵兼紨娴佺▼澶辫触:', error);
    }
  };

  // 澶勭悊鏅埆绫诲瀷閫夋嫨锛堝垱寤烘櫙鍒崱鐗囷級

  const handleShotTypeSelect = (shotType: '超远景' | '远景' | '全景' | '中远景' | '中景' | '中近景' | '特写') => {
    console.log('閫夋嫨浜嗘櫙鍒被鍨?', shotType);
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      // 鏍规嵁鏅埆绫诲瀷璁剧疆榛樿鍊?      let defaultCameraMovement = 'Static';

      switch (shotType) {
        case '超远景':
          defaultCameraMovement = 'Static';
          break;
        case '杩滄櫙':
        case '鍏ㄦ櫙':
          defaultCameraMovement = 'Follow/Tracking';
          break;
        case '中远景':
          defaultCameraMovement = 'Follow';
          break;
        case '涓櫙':
          defaultCameraMovement = 'Static';
          break;
        case '中近景':
          defaultCameraMovement = 'Static';
          break;
        case '鐗瑰啓':
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

      console.log('鏅埆鍗＄墖鍒涘缓鎴愬姛锛屾櫙鍒?', shotType);
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓鏅埆鍗＄墖澶辫触:', error);
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

      console.log('Prompt浼樺寲鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓Prompt浼樺寲鍗＄墖澶辫触:', error);
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

      const id1 = createShapeId();
      const id2 = createShapeId();
      const id3 = createShapeId();
      const id4 = createShapeId();

      editor.createShape({ id: id1, type: 'gem-step1-card' as any, x: startX, y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id2, type: 'gem-step2-card' as any, x: startX + (cardW + gap), y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id3, type: 'gem-step3-card' as any, x: startX + (cardW + gap) * 2, y: startY, props: { w: cardW, h: 520 } });
      editor.createShape({ id: id4, type: 'gem-step4-card' as any, x: startX + (cardW + gap) * 3, y: startY, props: { w: cardW, h: 520 } });

      editor.select(id1);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓瀵兼紨寮曟搸鍗＄墖澶辫触:', error);
    }
  };

  const createGemStoryboardCards = () => {
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id1 = createShapeId();
      const id2 = createShapeId();

      editor.createShape({
        id: id1,
        type: 'gem-step1-card' as any,
        x: centerX - 420,
        y: centerY - 260,
        props: { w: 400, h: 520 },
      });

      editor.createShape({
        id: id2,
        type: 'gem-step2-card' as any,
        x: centerX + 20,
        y: centerY - 280,
        props: { w: 400, h: 560 },
      });

      editor.select(id1);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓GEM鍒嗛暅鍗＄墖澶辫触:', error);
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
      console.error('鍒涘缓闊抽鍗＄墖澶辫触:', error);
    }
  };

  return (
    <div
      className="fixed bottom-32 left-6 transition-all duration-300"
      style={{ zIndex: 9998 }}
      data-tutorial="toolbar"
    >
      <div
        className="relative flex flex-col gap-2"
        onMouseLeave={() => setShowShotTypePanel(false)}
      >
        {/* 灞曞紑/鏀惰捣鎸夐挳 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-12 h-12 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-zinc-800/90 transition-all shadow-xl"
          title={isExpanded ? '收起工具栏' : '展开工具栏'}
        >
          <svg
            className={`w-5 h-5 text-white transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 宸ュ叿鏍忓唴瀹?- 鍙姌鍙?*/}
        <div
          className={`flex flex-col gap-2 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-2 shadow-xl transition-all duration-300 origin-bottom ${
            isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
        {/* 鏂囨湰鐢熸垚鎸夐挳 */}
        <button
          onClick={createTextCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Text Generation"
          data-tutorial="text-button"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center group-hover:bg-gray-500/30 transition-all flex-shrink-0">
            <span className="text-gray-300 text-base font-bold">T</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Text</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">鏂囨湰鐢熸垚</span>
          </div>
        </button>

        {/* 鍥剧墖鐢熸垚鎸夐挳 */}
        <button
          onClick={createImageCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Image Generation"
          data-tutorial="image-button"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-600/20 flex items-center justify-center group-hover:bg-gray-600/30 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Image</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">鍥剧墖鐢熸垚</span>
          </div>
        </button>

        {/* 瑙嗛鐢熸垚鎸夐挳 */}
        <button
          onClick={createVideoCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Video Generation"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-700/20 flex items-center justify-center group-hover:bg-gray-700/30 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Video</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">瑙嗛鐢熸垚</span>
          </div>
        </button>

        {/* 瑙掕壊璁捐鎸夐挳 */}
        <button
          onClick={createKlingCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Kling Video"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/25 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Kling</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">可灵独立视频卡</span>
          </div>
        </button>
        <button
          onClick={createCharacterCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Character Design"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Character Design</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">瑙掕壊璁捐</span>
          </div>
        </button>

        {/* 璧勪骇搴撴寜閽?*/}
        <button
          onClick={createAssetCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Assets"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Assets</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">资产库</span>
          </div>
        </button>

        {/* 瀵兼紨娴佺▼鎸夐挳 */}
        <button
          onClick={createDirectorTimeline}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Director Timeline"
          data-tutorial="director-button"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Director Timeline</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">瀵兼紨娴佺▼</span>
          </div>
        </button>

        {/* 鐢靛奖鎺у埗鍣ㄦ寜閽?*/}
        <button
          onMouseEnter={() => setShowShotTypePanel(true)}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Film Controller"
          data-tutorial="film-controller-button"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Film Controller</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">电影控制器</span>
          </div>
        </button>

        {/* Prompt鎸夐挳 */}
        <button
          onClick={createPromptOptimizerCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Prompt"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Prompt</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">蹇€熺紪璇戣棰戠敓鎴愯瘝</span>
          </div>
        </button>

        {/* GEM鍒嗛暅璁捐鎸夐挳 */}
        <button
          onClick={createGemStoryboardCards}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="GEM鍒嗛暅璁捐"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">GEM 鍒嗛暅璁捐</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">25格分镜生成</span>
          </div>
        </button>

        {/* 瀵兼紨寮曟搸鎸夐挳 */}
        <button
          onClick={createGemDirectorCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="瀵兼紨寮曟搸"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">瀵兼紨寮曟搸</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">瑙嗛杩囨浮鎸囦护</span>
          </div>
        </button>

        {/* 璇煶鍚堟垚鎸夐挳 */}
        <button
          onClick={createAudioCard}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="璇煶鍚堟垚"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">璇煶鍚堟垚</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">MiniMax TTS</span>
          </div>
        </button>

        {/* 鍥剧墖鍒囧壊鎸夐挳 */}
        <button
          onClick={onOpenImageSplit}
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="Image Split"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4v16M12 4v16M18 4v16" />
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm text-gray-300 whitespace-nowrap">Image Split</span>
            <span className="text-xs text-gray-500 whitespace-nowrap">鍥剧墖鍒囧壊</span>
          </div>
        </button>

        {/* 鍒嗛殧绾?*/}
        <div className="h-px bg-white/10 my-1"></div>

        {/* 鏇村鎸夐挳 */}
        <button
          className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all group"
          title="More Options"
        >
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all flex-shrink-0">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap">More</span>
        </button>
      </div>

      {/* 鏅埆绫诲瀷閫夋嫨闈㈡澘 */}
      {showShotTypePanel && (
        <div className="absolute left-full bottom-0 z-50">
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 w-64">
            {/* 鏍囬鏍?*/}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm">閫夋嫨鏅埆绫诲瀷</h3>
              <button
                onClick={() => setShowShotTypePanel(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 鏅埆閫夐」鍒楄〃 */}
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

// 鑷畾涔夌缉鏀炬帶鍒跺櫒缁勪欢 - 婊戝潡鏍峰紡
function ZoomControls() {
  const editor = useEditor();
  const [zoom, setZoom] = useState(100);

  // 鍚屾缂栬緫鍣ㄧ殑缂╂斁绾у埆鍒扮姸鎬?

  useEffect(() => {
    const interval = setInterval(() => {
      const currentZoom = Math.round(editor.getCamera().z * 100);
      if (currentZoom !== zoom) {
        setZoom(currentZoom);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editor, zoom]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseInt(e.target.value);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
  };

  const handleZoomIn = () => {
    console.log('鐐瑰嚮鏀惧ぇ鎸夐挳锛屽綋鍓嶇缉鏀?', zoom);
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('鏂扮缉鏀?', newZoom);
  };

  const handleZoomOut = () => {
    console.log('鐐瑰嚮缂╁皬鎸夐挳锛屽綋鍓嶇缉鏀?', zoom);
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editor.setCamera({ ...editor.getCamera(), z: newZoom / 100 });
    console.log('鏂扮缉鏀?', newZoom);
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
      {/* 閫傚簲灞忓箷 */}
      <button
        onClick={handleFitToScreen}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
        title="閫傚簲灞忓箷"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      {/* 閲嶇疆缂╂斁 */}
      <button
        onClick={handleResetZoom}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-all"
        title="閲嶇疆缂╂斁"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 缂╁皬鎸夐挳 */}
      <button
        onClick={handleZoomOut}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white text-lg font-bold transition-all"
        title="缂╁皬"
      >
        鈭?      </button>

      {/* 婊戝潡 */}
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

      {/* 鏀惧ぇ鎸夐挳 */}
      <button
        onClick={handleZoomIn}
        className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center text-white text-lg font-bold transition-all"
        title="鏀惧ぇ"
      >
        +
      </button>

      {/* 缂╂斁鐧惧垎姣旀樉绀?*/}
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
    console.log('鐐瑰嚮鏂囨湰鐢熸垚鎸夐挳');
    try {
      const viewportCenter = editor.getViewportScreenCenter();
      console.log('瑙嗗彛涓績:', viewportCenter);
      const id = createShapeId();
      console.log('鐢熸垚鐨処D:', id);

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

      console.log('鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
      console.log('宸查€変腑鍗＄墖骞跺垏鎹㈠埌閫夋嫨宸ュ叿');
    } catch (error) {
      console.error('鍒涘缓鍗＄墖澶辫触:', error);
    }
  };

  const createImageCard = () => {
    console.log('鐐瑰嚮鍥剧墖鐢熸垚鎸夐挳');
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

      console.log('鍥剧墖鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓鍥剧墖鍗＄墖澶辫触:', error);
    }
  };

  const createVideoCard = () => {
    console.log('鐐瑰嚮瑙嗛鐢熸垚鎸夐挳');
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

      console.log('瑙嗛鍗＄墖鍒涘缓鎴愬姛');
      editor.select(id);
      editor.setCurrentTool('select');
    } catch (error) {
      console.error('鍒涘缓瑙嗛鍗＄墖澶辫触:', error);
    }
  };

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-4"
      style={{ zIndex: 9999, pointerEvents: 'auto' }}
    >
      {/* 鏂囨湰鐢熸垚鎸夐挳 */}
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
            <div className="text-sm font-semibold">鏂囨湰鐢熸垚</div>
            <div className="text-xs text-blue-200/70">Text Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/10 group-hover:to-cyan-400/10 transition-all duration-300"></div>
      </button>

      {/* 鍥剧墖鐢熸垚鎸夐挳 */}
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
            <div className="text-sm font-semibold">鍥剧墖鐢熸垚</div>
            <div className="text-xs text-violet-200/70">Image Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/0 to-purple-400/0 group-hover:from-violet-400/10 group-hover:to-purple-400/10 transition-all duration-300"></div>
      </button>

      {/* 瑙嗛鐢熸垚鎸夐挳 */}
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
            <div className="text-sm font-semibold">瑙嗛鐢熸垚</div>
            <div className="text-xs text-rose-200/70">Video Generate</div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-rose-400/0 to-orange-400/0 group-hover:from-rose-400/10 group-hover:to-orange-400/10 transition-all duration-300"></div>
      </button>
    </div>
  );
}

// 鍥剧墖鍒囧壊寮圭獥缁勪欢
function ImageSplitModal({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [isDragging, setIsDragging] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
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

  const handleSplit = async () => {
    if (!image) return;
    setIsSplitting(true);
    try {
      const cellW = Math.floor(image.naturalWidth / cols);
      const cellH = Math.floor(image.naturalHeight / rows);

      // 鍔ㄦ€佸鍏?JSZip

      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const canvas = document.createElement('canvas');
          canvas.width = cellW;
          canvas.height = cellH;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, c * cellW, r * cellH, cellW, cellH, 0, 0, cellW, cellH);
          const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
          zip.file(`${r + 1}-${c + 1}.png`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `split_${rows}x${cols}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsSplitting(false);
    }
  };

  const PRESETS = [
    { label: '2脳2', r: 2, c: 2 },
    { label: '3脳3', r: 3, c: 3 },
    { label: '4脳4', r: 4, c: 4 },
    { label: '5脳5', r: 5, c: 5 },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[9999]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-[480px] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-6">
        {/* 鏍囬 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-base">鍥剧墖鍒囧壊</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 涓婁紶鍖哄煙 */}
        <div
          className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-5 ${
            isDragging ? 'border-white/40 bg-white/5' : 'border-white/15 hover:border-white/30'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f); }} />
          {image ? (
            <div className="flex items-center gap-3">
              <img src={image.src} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
              <div className="text-left">
                <p className="text-white text-sm truncate max-w-[280px]">{imageFile?.name}</p>
                <p className="text-gray-500 text-xs mt-1">{image.naturalWidth} 脳 {image.naturalHeight}px</p>
                <p className="text-gray-500 text-xs">鐐瑰嚮鏇存崲鍥剧墖</p>
              </div>
            </div>
          ) : (
            <div>
              <svg className="w-8 h-8 text-gray-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400 text-sm">Upload Image</p>
              <p className="text-gray-600 text-xs mt-1">点击或拖拽上传图片，支持 PNG / JPG / WebP</p>
            </div>
          )}
        </div>

        {/* 瀹牸閫夋嫨 */}
        <div className="mb-5">
          <p className="text-gray-400 text-xs mb-2">蹇€熼€夋嫨</p>
          <div className="flex gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setRows(p.r); setCols(p.c); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  rows === p.r && cols === p.c
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-gray-500 text-xs mb-1">鍒楁暟</p>
              <input
                type="number" min={1} max={20} value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-xs mb-1">琛屾暟</p>
              <input
                type="number" min={1} max={20} value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
          {image && (
            <p className="text-gray-600 text-xs mt-2">
              姣忓紶 {Math.floor(image.naturalWidth / cols)} 脳 {Math.floor(image.naturalHeight / rows)}px锛屽叡 {rows * cols} 寮?            </p>
          )}
        </div>

        {/* 鍒囧壊鎸夐挳 */}
        <button
          onClick={handleSplit}
          disabled={!image || isSplitting}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSplitting ? '鍒囧壊涓?..' : `鍒囧壊骞朵笅杞?(${rows * cols} 寮?`}
        </button>
      </div>
    </>
  );
}

// 璧勪骇闈㈡澘缁勪欢
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

        // 璇荤敤鎴风洰褰曚笅鐨勫浘鐗?

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

        // 璇?videos/{userId}/ 鐩綍涓嬬殑瑙嗛

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
        console.error('鍔犺浇璧勪骇澶辫触:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-zinc-900 border-l border-white/10 z-[9999] shadow-2xl flex flex-col">
      {/* 澶撮儴 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h2 className="text-lg font-semibold text-white">Asset Library</h2>
          <p className="text-xs text-gray-500 mt-1">资产库</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab 鍒囨崲 */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('images')}
          className={`flex-1 py-3 text-sm font-medium transition-all ${
            activeTab === 'images'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          鍥剧墖 ({images.length})
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-3 text-sm font-medium transition-all ${
            activeTab === 'videos'
              ? 'text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          瑙嗛 ({videos.length})
        </button>
      </div>

      {/* 鍐呭鍖?*/}
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
            <div className="text-center text-gray-400 py-16">鏆傛棤鍥剧墖</div>
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
            <div className="text-center text-gray-400 py-16">鏆傛棤瑙嗛</div>
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

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 });
  const [showIntro, setShowIntro] = useState(true);
  const [showTutorial, setShowTutorial] = useState(isTutorial);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('unsaved');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [canvasList, setCanvasList] = useState<{id: string; title: string}[]>([]);
  const [showCanvasList, setShowCanvasList] = useState(false);
  const [showAssetPanel, setShowAssetPanel] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showImageSplitModal, setShowImageSplitModal] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const { isMember, balance, refresh: refreshMembership } = useMembership();

  const handlePay = async (plan: 'membership' | 'recharge', amount: number) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { alert('璇峰厛鐧诲綍'); return; }
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
      alert(data.error || '鍙戣捣鏀粯澶辫触');
    }
  };

  const canvasIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const hasUnsavedRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  // 閫€鍑洪〉闈㈣嚜鍔ㄤ繚瀛?

  useEffect(() => {
    const doSaveSync = () => {
      if (!canvasIdRef.current || !editorRef.current) return;
      try {
        const snapshot = getSnapshot(editorRef.current.store);
        const payload = JSON.stringify({ canvasId: canvasIdRef.current, snapshot });

        // 浼樺厛浣跨敤 Beacon API锛堟洿鍙潬锛屼笉浼氳娴忚鍣ㄩ樆姝級

        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/canvas/save', blob);
        } else {
          // 闄嶇骇鍒板悓姝?XHR
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/canvas/save', false);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(payload);
        }
      } catch (e) {
        console.error('閫€鍑轰繚瀛樺け璐?', e);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') doSaveSync();
    };

    window.addEventListener('beforeunload', doSaveSync);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', doSaveSync);

    return () => {
      window.removeEventListener('beforeunload', doSaveSync);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', doSaveSync);
    };
  }, []);

  // 鑷畾涔夊舰鐘跺伐鍏峰拰缁戝畾宸ュ叿

  const customShapeUtils = [CustomCardShapeUtil, ConnectionShapeUtil, TimelineShapeUtil, ShotCardShapeUtil, PromptOptimizerCardUtil, GemStep1CardUtil, GemStep2CardUtil, GemStep3CardUtil, GemStep4CardUtil, AudioCardUtil];
  const customBindingUtils = [ConnectionBindingUtil];
  const customTools = [PortTool];

  // 闅愯棌鎵€鏈夐粯璁I缁勪欢

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

  // 褰撶紪杈戝櫒鍔犺浇瀹屾垚鏃剁殑璁剧疆

  const handleMount = (editor: Editor) => {
    console.log('缂栬緫鍣ㄥ凡鍔犺浇');
    setEditorInstance(editor);
    editorRef.current = editor;

    // 绔嬪嵆璁剧疆鍒濆缂╂斁涓?60%
    setTimeout(() => {
      editor.setCamera({ x: 0, y: 0, z: 0.6 });
    }, 0);

    // 3绉掑悗闅愯棌浠嬬粛鍔ㄧ敾
    setTimeout(() => setShowIntro(false), 3000);

    // 鈹€鈹€ 鍔犺浇鐢ㄦ埛鐢诲竷 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          window.location.replace('/auth');
          return;
        }

        setIsLoggedIn(true);
        userIdRef.current = user.id;

        // 鍔犺浇鐢诲竷鍒楄〃

        const { data: canvases } = await supabase
          .from('canvases')
          .select('id, title')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        if (canvases) setCanvasList(canvases);

        // 鐢ㄥ凡鏈夌殑绗竴涓敾甯冿紝娌℃湁鎵嶅垱寤?

        const canvasId = canvases && canvases.length > 0
          ? canvases[0].id
          : await getOrCreateCanvas(user.id);
        canvasIdRef.current = canvasId;

        const snapshot = await loadCanvasSnapshot(canvasId);
        if (snapshot) {
          isRestoringRef.current = true;
          loadSnapshot(editor.store, snapshot);
          isRestoringRef.current = false;
          console.log('画布已恢复');
        }
      } catch (err) {
        console.error('鍔犺浇鐢诲竷澶辫触:', err);
      }
    })();

    // 鈹€鈹€ 鐩戝惉鍙樺寲鏍囪鏈繚瀛?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    editor.store.listen(() => {
      if (isRestoringRef.current) return;
      if (!canvasIdRef.current) return;
      hasUnsavedRef.current = true;
      setSaveStatus('unsaved');
    });

    // 鈹€鈹€ 鑷姩淇濆瓨锛氳繘鍏ュ悗30/60/90鍒嗛挓鍚勪繚瀛樹竴娆?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

    const doAutoSave = async () => {
      if (!canvasIdRef.current || !hasUnsavedRef.current) return;
      try {
        setSaveStatus('saving');
        const snapshot = getSnapshot(editor.store);
        await saveSnapshot(canvasIdRef.current!, snapshot);
        hasUnsavedRef.current = false;
        setSaveStatus('saved');
      } catch (err) {
        console.error('鑷姩淇濆瓨澶辫触:', err);
        setSaveStatus('unsaved');
      }
    };

    const t1 = setTimeout(doAutoSave, 30 * 60 * 1000);
    const t2 = setTimeout(doAutoSave, 60 * 60 * 1000);
    const t3 = setTimeout(doAutoSave, 90 * 60 * 1000);

    // 鐩戝惉鐩告満鍙樺寲锛屾洿鏂扮缉鏀剧骇鍒拰浣嶇疆

    const updateCamera = () => {
      const camera = editor.getCamera();
      setCameraZoom(camera.z);
      setCameraPos({ x: camera.x, y: camera.y });
    };
    updateCamera();
    const unsubscribe = editor.store.listen(updateCamera);

    // 鐩戝惉榧犳爣浜嬩欢锛屽疄鐜板彸閿嫋鍔ㄧ敾甯?    let isDraggingCanvas = false;
    let lastX = 0;
    let lastY = 0;

    const handleContextMenu = (e: MouseEvent) => {
      // 闃绘鍙抽敭鑿滃崟
      e.preventDefault();
    };

    const handlePointerDown = (e: PointerEvent) => {
      // 鍙抽敭鎸変笅锛坆utton === 2锛?
      if (e.button === 2) {
        const target = e.target as HTMLElement;

        // 妫€鏌ユ槸鍚︾偣鍑讳簡鍗＄墖

        const clickedOnShape = target.closest('.tl-shape') !== null;

        if (!clickedOnShape) {
          // 鐐瑰嚮绌虹櫧澶勶紝鎷栧姩鐢诲竷
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

    // 娣诲姞浜嬩欢鐩戝惉锛屼娇鐢?capture 闃舵

    const container = editor.getContainer();
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('pointerdown', handlePointerDown, { capture: true });
    container.addEventListener('pointermove', handlePointerMove, { capture: true });
    container.addEventListener('pointerup', handlePointerUp, { capture: true });
    container.addEventListener('pointerleave', () => { isDraggingCanvas = false; });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      unsubscribe();
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      container.removeEventListener('pointermove', handlePointerMove, { capture: true });
      container.removeEventListener('pointerup', handlePointerUp, { capture: true });
    };
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* 浠嬬粛鍔ㄧ敾 */}
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

      {/* 灏嗘帶浠舵斁鍦?Tldraw 澶栭潰 */}
      {editorInstance && (
        <>
          {/* 鏈櫥褰曟彁绀?*/}
          {isLoggedIn === false && (
            <div className="fixed inset-0 z-[200000] bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-white text-lg font-semibold mb-2">Sign In To Continue</h2>
                <p className="text-gray-400 text-sm mb-6">登录后即可保存画布、生成图片和视频</p>
                <a
                  href="/auth"
                  className="block w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-all"
                >
                  前往登录
                </a>
              </div>
            </div>
          )}

          {/* 淇濆瓨鐘舵€?+ 鐢诲竷鍒囨崲 */}
          {isLoggedIn && (
            <div className="fixed top-4 right-4 flex items-center gap-2" style={{ zIndex: 99999 }}>

              {/* 浣欓 + 浼氬憳鐘舵€?*/}
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300">
                {isMember ? (
                  <span className="text-violet-400 font-semibold">浼氬憳</span>
                ) : (
                  <button
                    className="text-yellow-400 hover:text-yellow-300 transition-colors"
                    onClick={() => handlePay('membership', MEMBERSHIP_PRICE)}
                  >
                    寮€閫氫細鍛?                  </button>
                )}
                <span className="text-white/20">|</span>
                <span className="text-white/60">楼{balance.toFixed(2)}</span>
                <button
                  className="text-blue-400 hover:text-blue-300 transition-colors ml-0.5"
                  onClick={() => setShowRechargeModal(true)}
                >
                  鍏呭€?                </button>
              </div>

              {/* 鐢诲竷鍒楄〃鎸夐挳 */}
              <div className="relative">
                <button
                  onClick={() => setShowCanvasList(!showCanvasList)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  鐢诲竷
                </button>

                {showCanvasList && (
                  <div className="absolute top-8 right-0 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-white/5">
                      <button
                        className="w-full text-left px-3 py-2 text-xs text-blue-400 hover:bg-white/5 rounded-lg transition-all"
                        onClick={async () => {
                          const supabase = createClient();
                          const title = `鐢诲竷 ${new Date().toLocaleDateString('zh-CN')}`;
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
                        + 鏂板缓鐢诲竷
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
                                // 绔嬪嵆鏇存柊 UI锛岄伩鍏嶉樆濉?
                                const targetId = c.id;
                                canvasIdRef.current = targetId;
                                setShowCanvasList(false);

                                // 寮傛鍔犺浇鐢诲竷鏁版嵁

                                if (editorInstance) {
                                  setTimeout(async () => {
                                    try {
                                      const snapshot = await loadCanvasSnapshot(targetId);
                                      isRestoringRef.current = true;
                                      if (snapshot) {
                                        loadSnapshot(editorInstance.store, snapshot);
                                      } else {
                                        editorInstance.selectAll();
                                        editorInstance.deleteShapes(editorInstance.getSelectedShapeIds());
                                      }
                                      isRestoringRef.current = false;
                                    } catch (err) {
                                      console.error('鍔犺浇鐢诲竷澶辫触:', err);
                                      isRestoringRef.current = false;
                                    }
                                  }, 0);
                                }
                              }}
                            >
                              {canvasIdRef.current === c.id ? '鈼?' : '鈼?'}{c.title}
                            </button>
                          )}
                          {/* 閲嶅懡鍚嶆寜閽?*/}
                          <button
                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white rounded transition-all flex-shrink-0"
                            title="Rename / 重命名"
                            onClick={e => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                            onPointerDown={e => e.stopPropagation()}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* 鍒犻櫎鎸夐挳 - 鑷冲皯淇濈暀涓€涓敾甯?*/}
                          {canvasList.length > 1 && (
                            <button
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 rounded transition-all flex-shrink-0"
                              title="鍒犻櫎鐢诲竷"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`纭畾鍒犻櫎鐢诲竷銆?{c.title}銆嶏紵`)) return;
                                const supabase = createClient();
                                await supabase.from('canvas_snapshots').delete().eq('canvas_id', c.id);
                                await supabase.from('canvases').delete().eq('id', c.id);
                                const newList = canvasList.filter(x => x.id !== c.id);
                                setCanvasList(newList);
                                // 濡傛灉鍒犵殑鏄綋鍓嶇敾甯冿紝鍒囨崲鍒扮涓€涓?
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

              {/* 鎵嬪姩淇濆瓨鎸夐挳 */}
              <button
                onClick={async () => {
                  if (!canvasIdRef.current || !editorInstance) return;
                  try {
                    flushSync(() => setSaveStatus('saving'));
                    const snapshot = getSnapshot(editorInstance.store);
                    await saveSnapshot(canvasIdRef.current, snapshot);
                    hasUnsavedRef.current = false;
                    setSaveStatus('saved');
                    // 涓嶅啀鑷姩鍙樺洖 unsaved锛屽彧鏈夋柊鎿嶄綔鏃舵墠浼氬彉
                  } catch (err) {
                    console.error('淇濆瓨澶辫触:', err);
                    setSaveStatus('unsaved');
                  }
                }}
                disabled={saveStatus === 'saving'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving' ? (
                  <><div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" /><span className="text-yellow-400">淇濆瓨涓?..</span></>
                ) : saveStatus === 'saved' ? (
                  <><div className="w-1.5 h-1.5 rounded-full bg-green-400" /><span className="text-green-400">已保存</span></>
                ) : (
                  <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg><span>淇濆瓨</span></>
                )}
              </button>

              {/* 杩斿洖涓婚〉鎸夐挳 */}
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 text-gray-300 hover:border-white/20 transition-all"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>涓婚〉</span>
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

      {/* 璧勪骇闈㈡澘 */}
      {showAssetPanel && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={() => setShowAssetPanel(false)} />
          <AssetPanel onClose={() => setShowAssetPanel(false)} />
        </>
      )}

      {/* 鍥剧墖鍒囧壊寮圭獥 */}
      {showImageSplitModal && (
        <ImageSplitModal onClose={() => setShowImageSplitModal(false)} />
      )}

      {/* 绂诲紑纭寮圭獥 */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-80 shadow-2xl flex flex-col gap-4">
            <div>
              <div className="text-white font-semibold text-base">Leave Canvas</div>
              <div className="text-gray-400 text-sm mt-1">离开前将自动保存当前画布内容。</div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  btn.textContent = '淇濆瓨涓?..';
                  if (canvasIdRef.current && editorInstance) {
                    try {
                      const snapshot = getSnapshot(editorInstance.store);
                      await saveSnapshot(canvasIdRef.current, snapshot);
                    } catch {}
                  }
                  window.location.href = '/';
                }}
              >淇濆瓨骞剁寮€</button>
              <button
                className="w-full py-2 rounded-xl text-gray-500 text-sm hover:text-gray-300 transition-all"
                onClick={() => setShowLeaveConfirm(false)}
              >鍙栨秷</button>
            </div>
          </div>
        </div>
      )}

      {/* 鑷畾涔夋牱寮?- 绾粦鑹蹭富棰?*/}
      <style jsx global>{`
        /* tldraw 鐢诲竷鑳屾櫙 - 缁嗙嚎缃戞牸锛岄殢缂╂斁鍜屼綅缃彉鍖?*/
        .tl-background {
          background-color: #000000 !important;
          background-image:
            linear-gradient(rgba(100, 100, 100, 0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100, 100, 100, 0.4) 1px, transparent 1px);
          background-size: ${30 * cameraZoom}px ${30 * cameraZoom}px;
          background-position: ${-cameraPos.x * cameraZoom}px ${-cameraPos.y * cameraZoom}px;
        }

        /* 缃戞牸棰滆壊 */
        .tl-grid {
          opacity: 0 !important;
        }

        /* 娣″叆鍔ㄧ敾 */
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

        /* 闅愯棌鎵€鏈夐粯璁I */
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

        /* 褰诲簳闅愯棌閫変腑杈规鍜屾墍鏈夐€変腑鏁堟灉 */
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

        /* 闅愯棌閫変腑鏃剁殑鎵€鏈夎瑙夋晥鏋?*/
        [data-is-selected="true"],
        .tl-shape[data-is-selected="true"],
        .tl-shape.tl-shape--selected {
          outline: none !important;
          box-shadow: none !important;
        }

        /* 闅愯棌 SVG 閫変腑妗?*/
        svg.tl-overlays__item {
          display: none !important;
        }

        .tl-overlays > * {
          display: none !important;
        }

        /* 纭繚鐢诲竷鍗犳弧鏁翠釜灞忓箷 */
        .tl-container {
          background-color: #000000 !important;
        }

        /* 鑷畾涔夐紶鏍囨牱寮?- 鎵嬪瀷鍏夋爣 */
        .tl-canvas {
          cursor: grab !important;
        }

        .tl-canvas:active {
          cursor: grabbing !important;
        }

        /* 鎷栧姩鍗＄墖鏃朵篃鐢ㄦ墜鍨嬪厜鏍?*/
        .tl-shape {
          cursor: grab !important;
        }

        .tl-shape:active {
          cursor: grabbing !important;
        }

        /* 閫変腑鐘舵€佷笅鐨勫崱鐗?*/
        .tl-shape[data-is-selected="true"] {
          cursor: move !important;
        }

        /* 鑷畾涔夊崱鐗囨牱寮?*/
        .tl-shape[data-shape-type="geo"] {
          border-radius: 16px !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
        }

        /* 绠ご杩炴帴绾挎牱寮?- 娴呯伆鑹?*/
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

        /* 绠ご绾挎潯绮楃粏 */
        .tl-arrow__line {
          stroke-width: 2 !important;
        }

        /* 婊戝潡鏍峰紡 */
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


        /* 浠嬬粛鍔ㄧ敾 */
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

      {/* 鍏呭€煎脊绐?*/}
      {showRechargeModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowRechargeModal(false)}
        >
          <div
            className="relative w-[360px] rounded-2xl bg-zinc-900 border border-white/10 p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
              onClick={() => setShowRechargeModal(false)}
            >×</button>
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-white">Choose Recharge Amount</h2>
              <p className="text-xs text-gray-500 mt-1">选择充值金额</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { amount: 50, label: '楼50' },
                { amount: 100, label: '楼100' },
                { amount: 1000, label: '楼1000' },
                { amount: 10000, label: '楼10000' },
              ].map(({ amount, label }) => (
                <button
                  key={amount}
                  className="py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-semibold text-lg transition-all"
                  onClick={() => { setShowRechargeModal(false); handlePay('recharge', amount); }}
                >{label}</button>
              ))}
            </div>
            <p className="text-center text-xs text-white/30 mt-4">鍏呭€煎悗浣欓鍙敤浜庡浘鐗囧拰瑙嗛鐢熸垚</p>
          </div>
        </div>
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







