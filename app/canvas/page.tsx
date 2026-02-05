'use client';

import { Tldraw, TLComponents, Editor, useEditor, createShapeId } from 'tldraw';
import 'tldraw/tldraw.css';
import { useState, useEffect } from 'react';
import { CustomCardShapeUtil } from './CustomCard';
import { ConnectionShapeUtil } from './ConnectionShapeUtil';
import { ConnectionBindingUtil } from './ConnectionBindingUtil';
import { PortTool } from './PortTool';

// 自定义缩放控制器组件 - 外部版本
function ZoomControlsExternal({ editor }: { editor: Editor }) {
  const [zoom, setZoom] = useState(100);

  // 同步编辑器的缩放级别到状态
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

// 底部工具栏 - 外部版本（重新设计）
function BottomToolbarExternal({ editor }: { editor: Editor }) {
  const createTextCard = () => {
    console.log('点击文本生成按钮');
    try {
      const viewportPageBounds = editor.getViewportPageBounds();
      const centerX = viewportPageBounds.center.x;
      const centerY = viewportPageBounds.center.y;
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'custom-card',
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'text',
          title: 'Text Generation',
          prompt: '',
          model: 'GPT-4',
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
        type: 'custom-card',
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'image',
          title: 'Image Generation',
          prompt: '',
          model: 'DALL-E 3',
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
        type: 'custom-card',
        x: centerX - 190,
        y: centerY - 190,
        props: {
          w: 380,
          h: 380,
          cardType: 'video',
          title: 'Video Generation',
          prompt: '',
          model: 'Sora',
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
      className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1a1a1a] rounded-2xl p-3 border border-white/10"
      style={{ zIndex: 99999 }}
    >
      {/* 文本生成按钮 */}
      <button
        onClick={createTextCard}
        className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center mb-1 group-hover:bg-gray-500/30 transition-all">
          <span className="text-gray-300 text-xl font-bold">T</span>
        </div>
        <span className="text-xs text-gray-400">Text</span>
      </button>

      {/* 图片生成按钮 */}
      <button
        onClick={createImageCard}
        className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center mb-1 group-hover:bg-gray-600/30 transition-all">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-xs text-gray-400">Image</span>
      </button>

      {/* 视频生成按钮 */}
      <button
        onClick={createVideoCard}
        className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/5 transition-all group"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-700/20 flex items-center justify-center mb-1 group-hover:bg-gray-700/30 transition-all">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-xs text-gray-400">Video</span>
      </button>

      {/* 分隔线 */}
      <div className="w-px h-12 bg-white/10 mx-2"></div>

      {/* 更多按钮 */}
      <button className="flex flex-col items-center justify-center w-20 h-20 rounded-xl hover:bg-white/5 transition-all group">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-1 group-hover:bg-white/10 transition-all">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <span className="text-xs text-gray-400">More</span>
      </button>
    </div>
  );
}

// 自定义缩放控制器组件 - 滑块样式
function ZoomControls() {
  const editor = useEditor();
  const [zoom, setZoom] = useState(100);

  // 同步编辑器的缩放级别到状态
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
    editor.setZoomLevel(newZoom / 100);
  };

  const handleZoomIn = () => {
    console.log('点击放大按钮，当前缩放:', zoom);
    const newZoom = Math.min(zoom + 10, 200);
    setZoom(newZoom);
    editor.setZoomLevel(newZoom / 100);
    console.log('新缩放:', newZoom);
  };

  const handleZoomOut = () => {
    console.log('点击缩小按钮，当前缩放:', zoom);
    const newZoom = Math.max(zoom - 10, 25);
    setZoom(newZoom);
    editor.setZoomLevel(newZoom / 100);
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
      const viewportCenter = editor.getViewportPageCenter();
      console.log('视口中心:', viewportCenter);
      const id = createShapeId();
      console.log('生成的ID:', id);

      editor.createShape({
        id,
        type: 'geo',
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 300,
          h: 200,
          geo: 'rectangle',
          color: 'blue',
          fill: 'solid',
          text: '文本生成卡片\n\n点击编辑...',
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
      const viewportCenter = editor.getViewportPageCenter();
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'geo',
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 300,
          h: 200,
          geo: 'rectangle',
          color: 'violet',
          fill: 'solid',
          text: '图片生成卡片\n\n点击编辑...',
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
      const viewportCenter = editor.getViewportPageCenter();
      const id = createShapeId();

      editor.createShape({
        id,
        type: 'geo',
        x: viewportCenter.x - 150,
        y: viewportCenter.y - 100,
        props: {
          w: 300,
          h: 200,
          geo: 'rectangle',
          color: 'red',
          fill: 'solid',
          text: '视频生成卡片\n\n点击编辑...',
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

export default function CanvasPage() {
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraPos, setCameraPos] = useState({ x: 0, y: 0 });
  const [showIntro, setShowIntro] = useState(true);

  // 自定义形状工具和绑定工具
  const customShapeUtils = [CustomCardShapeUtil, ConnectionShapeUtil];
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
    setEditorInstance(editor);

    // 立即设置初始缩放为 60%
    setTimeout(() => {
      editor.setCamera({
        x: 0,
        y: 0,
        z: 0.6,
      });
      console.log('初始缩放已设置为60%');
    }, 0);

    // 3秒后隐藏介绍动画
    setTimeout(() => {
      setShowIntro(false);
    }, 3000);

    // 监听相机变化，更新缩放级别和位置
    const updateCamera = () => {
      const camera = editor.getCamera();
      setCameraZoom(camera.z);
      setCameraPos({ x: camera.x, y: camera.y });
    };

    // 初始更新
    updateCamera();

    // 监听相机变化
    editor.store.listen(() => {
      updateCamera();
    });

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
    container.addEventListener('pointerleave', () => { isDraggingCanvas = false; });
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
      />

      {/* 将控件放在 Tldraw 外面 */}
      {editorInstance && (
        <>
          <ZoomControlsExternal editor={editorInstance} />
          <BottomToolbarExternal editor={editorInstance} />
        </>
      )}

      {/* 自定义样式 - 纯黑色主题 */}
      <style jsx global>{`
        /* tldraw 画布背景 - 细线网格，随缩放和位置变化 */
        .tl-background {
          background-color: #000000 !important;
          background-image:
            linear-gradient(rgba(68, 68, 68, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(68, 68, 68, 0.3) 1px, transparent 1px);
          background-size: ${30 * cameraZoom}px ${30 * cameraZoom}px;
          background-position: ${-cameraPos.x * cameraZoom}px ${-cameraPos.y * cameraZoom}px;
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
    </div>
  );
}
