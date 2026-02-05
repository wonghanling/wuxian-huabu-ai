import {
  BaseBoxShapeUtil,
  DefaultColorStyle,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  useEditor,
  createShapeId,
} from 'tldraw';
import { useState, useRef } from 'react';

// 3D球形摄像头控制器组件
function CameraController({
  vertical,
  horizontal,
  onAngleChange,
}: {
  vertical: number;
  horizontal: number;
  onAngleChange: (vertical: number, horizontal: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [rotationX, setRotationX] = useState(vertical);
  const [rotationY, setRotationY] = useState(horizontal);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastPosRef.current.x;
    const deltaY = e.clientY - lastPosRef.current.y;

    // 计算新的旋转角度
    let newRotationY = rotationY + deltaX * 0.5;
    let newRotationX = rotationX + deltaY * 0.5;

    // 允许360度旋转，但规范化到-180到180范围
    newRotationY = ((newRotationY + 180) % 360) - 180;
    newRotationX = Math.max(-90, Math.min(90, newRotationX)); // 垂直限制在-90到90

    setRotationX(newRotationX);
    setRotationY(newRotationY);
    onAngleChange(Math.round(newRotationX), Math.round(newRotationY));

    lastPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative w-full h-48 bg-gradient-to-br from-black/50 to-gray-900/50 rounded-lg border border-white/10 overflow-hidden">
      {/* 3D场景容器 */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: '800px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* 3D球体 */}
        <div
          className="relative transition-transform duration-100"
          style={{
            width: '120px',
            height: '120px',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${-rotationX}deg) rotateY(${rotationY}deg)`,
          }}
        >
          {/* 球体外壳 - 使用多个圆环模拟球体 */}
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {/* 赤道圆环 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-blue-400/30"
              style={{ transform: 'rotateX(0deg)' }}
            />
            {/* 经线圆环 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-blue-400/30"
              style={{ transform: 'rotateY(90deg)' }}
            />
            {/* 纬线圆环 - 30度 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] h-[86%] rounded-full border border-blue-400/20"
              style={{ transform: 'rotateX(30deg)' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] h-[86%] rounded-full border border-blue-400/20"
              style={{ transform: 'rotateX(-30deg)' }}
            />
            {/* 纬线圆环 - 60度 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full border border-blue-400/15"
              style={{ transform: 'rotateX(60deg)' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full border border-blue-400/15"
              style={{ transform: 'rotateX(-60deg)' }}
            />

            {/* 摄像头图标 - 固定在球体前方 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                transform: 'translateZ(60px)',
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="relative">
                {/* 摄像头主体 */}
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-2xl flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                {/* 发光效果 */}
                <div className="absolute inset-0 bg-blue-500/40 rounded-xl blur-lg -z-10" />
              </div>
            </div>

            {/* 中心点 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* 角度显示 */}
      <div className="absolute top-3 left-3 space-y-1">
        <div className="text-xs text-white/70 font-mono bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
          <span className="text-gray-400">俯仰: </span>
          <span className="text-blue-400 font-bold">{Math.round(rotationX)}°</span>
        </div>
        <div className="text-xs text-white/70 font-mono bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
          <span className="text-gray-400">偏航: </span>
          <span className="text-blue-400 font-bold">{Math.round(rotationY)}°</span>
        </div>
      </div>

      {/* 重置按钮 */}
      <button
        className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-lg flex items-center justify-center transition-all backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          setRotationX(0);
          setRotationY(0);
          onAngleChange(0, 0);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title="重置视角"
      >
        <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 拖动提示 */}
      {!isDragging && rotationX === 0 && rotationY === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/40 animate-pulse pointer-events-none">
          🖱️ 拖动旋转球体，360°自由控制
        </div>
      )}

      {/* 坐标轴指示 */}
      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] font-mono">
        <span className="text-red-400">X</span>
        <span className="text-green-400">Y</span>
        <span className="text-blue-400">Z</span>
      </div>
    </div>
  );
}

// 定义卡片类型
export type CustomCardShape = TLBaseShape<
  'custom-card',
  {
    w: number;
    h: number;
    cardType: 'text' | 'image' | 'video';
    title: string;
    prompt: string;
    model: string;
    uploadedImage?: string;
    cameraVertical?: number;
    cameraHorizontal?: number;
    showCameraControl?: boolean;
    generatedImage?: string;
    videoMode?: 'text' | 'first-frame' | 'first-last-frame';
    firstFrameImage?: string;
    lastFrameImage?: string;
    generatedVideo?: string;
    showVideoModePanel?: boolean;
    showImageOutput?: boolean;
    showVideoOutput?: boolean;
  }
>;

// 定义形状工具
export class CustomCardShapeUtil extends BaseBoxShapeUtil<CustomCardShape> {
  static override type = 'custom-card' as const;

  static override props: RecordProps<CustomCardShape> = {
    w: T.number,
    h: T.number,
    cardType: T.string,
    title: T.string,
    prompt: T.string,
    model: T.string,
    uploadedImage: T.string,
    cameraVertical: T.number,
    cameraHorizontal: T.number,
    showCameraControl: T.boolean,
    generatedImage: T.string,
    videoMode: T.string,
    firstFrameImage: T.string,
    lastFrameImage: T.string,
    generatedVideo: T.string,
    showVideoModePanel: T.boolean,
    showImageOutput: T.boolean,
    showVideoOutput: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  // 定义箭头绑定点
  override getHandleSnapGeometry(shape: CustomCardShape) {
    const { w, h } = shape.props;
    return {
      points: [
        { x: 0, y: h / 2 },      // 左侧中点
        { x: w, y: h / 2 },      // 右侧中点
        { x: w / 2, y: 0 },      // 顶部中点
        { x: w / 2, y: h },      // 底部中点
      ],
      outline: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
    };
  }

  getDefaultProps(): CustomCardShape['props'] {
    return {
      w: 380,
      h: 380,
      cardType: 'text',
      title: 'Text Generation',
      prompt: '',
      model: 'GPT-4',
      uploadedImage: '',
      cameraVertical: 0,
      cameraHorizontal: 0,
      showCameraControl: false,
      generatedImage: '',
      videoMode: 'text',
      firstFrameImage: '',
      lastFrameImage: '',
      generatedVideo: '',
      showVideoModePanel: false,
      showImageOutput: false,
      showVideoOutput: false,
    };
  }

  component(shape: CustomCardShape) {
    const { cardType, title, prompt, model, w, h, uploadedImage, cameraVertical, cameraHorizontal, showCameraControl, generatedImage, videoMode, firstFrameImage, lastFrameImage, generatedVideo, showVideoModePanel, showImageOutput, showVideoOutput } = shape.props;
    const editor = useEditor();

    // 根据卡片类型设置颜色和渐变
    const colors = {
      text: {
        gradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.12) 50%, rgba(128, 128, 128, 0.08) 100%)',
        border: 'rgba(192, 192, 192, 0.3)',
        glow: '0 0 40px rgba(192, 192, 192, 0.15)',
        icon: 'text-gray-300',
        iconBg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/20',
        buttonBg: 'bg-gradient-to-r from-gray-500/80 to-gray-600/80 hover:from-gray-500 hover:to-gray-600',
        handleColor: 'rgba(192, 192, 192, 0.8)',
      },
      image: {
        gradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.12) 50%, rgba(128, 128, 128, 0.08) 100%)',
        border: 'rgba(192, 192, 192, 0.3)',
        glow: '0 0 40px rgba(192, 192, 192, 0.15)',
        icon: 'text-gray-300',
        iconBg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/20',
        buttonBg: 'bg-gradient-to-r from-gray-500/80 to-gray-600/80 hover:from-gray-500 hover:to-gray-600',
        handleColor: 'rgba(192, 192, 192, 0.8)',
      },
      video: {
        gradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.12) 50%, rgba(128, 128, 128, 0.08) 100%)',
        border: 'rgba(192, 192, 192, 0.3)',
        glow: '0 0 40px rgba(192, 192, 192, 0.15)',
        icon: 'text-gray-300',
        iconBg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/20',
        buttonBg: 'bg-gradient-to-r from-gray-500/80 to-gray-600/80 hover:from-gray-500 hover:to-gray-600',
        handleColor: 'rgba(192, 192, 192, 0.8)',
      },
    };

    const color = colors[cardType];

    // 计算缩放比例
    const scale = Math.min(w / 380, h / 380);

    // 处理输出端口点击 - 开始连接
    const handleOutputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('🔵 输出端口被点击，卡片ID:', shape.id);

      // 使用自定义的 PortTool 开始连接
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'output',
        terminal: 'start',
      });
    };

    // 处理输入端口点击 - 开始连接
    const handleInputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('🟢 输入端口被点击，卡片ID:', shape.id);

      // 使用自定义的 PortTool 开始连接
      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'input',
        terminal: 'end',
      });
    };

    return (
      <HTMLContainer
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
          overflow: 'visible',
        }}
      >
        {/* 输出端口 - Right */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{
            right: '-6px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="output"
          data-node-id={shape.id}
          onMouseDown={handleOutputPortDown}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Output Port"
        >
          <div
            className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{
              backgroundColor: '#27272a',
              border: `2px solid ${color.handleColor}`,
              boxShadow: `0 0 8px ${color.handleColor}`,
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* 输入端口 - Left */}
        <div
          className="absolute top-1/2 -translate-y-1/2 cursor-crosshair group"
          style={{
            left: '-6px',
            zIndex: 101,
            pointerEvents: 'all',
          }}
          data-port-type="input"
          data-node-id={shape.id}
          onMouseDown={handleInputPortDown}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Input Port"
        >
          <div
            className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{
              backgroundColor: '#27272a',
              border: `2px solid ${color.handleColor}`,
              boxShadow: `0 0 8px ${color.handleColor}`,
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          className="w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl"
          style={{
            background: color.gradient,
            border: `1px solid ${color.border}`,
            backgroundColor: 'rgba(192, 192, 192, 0.08)',
            boxShadow: color.glow,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          }}
        >
          <div className="p-4 h-full flex flex-col">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${color.iconBg} flex items-center justify-center flex-shrink-0 backdrop-blur-sm`}>
                {cardType === 'text' && (
                  <span className={`${color.icon} text-base font-bold`}>T</span>
                )}
                {cardType === 'image' && (
                  <svg className={`w-4 h-4 ${color.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {cardType === 'video' && (
                  <svg className={`w-4 h-4 ${color.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
                <p className="text-gray-400 text-xs truncate">
                  {cardType === 'text' && '文本生成'}
                  {cardType === 'image' && '图片生成'}
                  {cardType === 'video' && '视频生成'}
                </p>
              </div>
            </div>

            {/* 输入区域 */}
            <div className="mb-2 flex-1">
              <label className="text-gray-400 text-xs mb-1 block">Prompt</label>
              <textarea
                className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500"
                placeholder={
                  cardType === 'text'
                    ? 'Enter your text prompt...'
                    : cardType === 'image'
                    ? 'Describe the image...'
                    : 'Describe the video...'
                }
                value={cardType === 'image' && (cameraVertical !== 0 || cameraHorizontal !== 0)
                  ? `${prompt} [Camera: vertical ${cameraVertical >= 0 ? '+' : ''}${cameraVertical}°, horizontal ${cameraHorizontal >= 0 ? '+' : ''}${cameraHorizontal}°]`
                  : prompt}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  // 移除镜头参数，只保存用户输入的文本
                  const userInput = e.target.value.replace(/\[Camera: vertical [+-]?\d+°, horizontal [+-]?\d+°\]/g, '').trim();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      prompt: userInput,
                    },
                  });
                }}
              />
              {/* 镜头参数提示 */}
              {cardType === 'image' && (cameraVertical !== 0 || cameraHorizontal !== 0) && (
                <div className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>镜头参数已自动添加</span>
                </div>
              )}
            </div>

            {/* 模型选择 */}
            <div className="mb-2">
              <label className="text-gray-400 text-xs mb-1 block">Model</label>
              <select
                className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                defaultValue={model}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {cardType === 'text' && (
                  <>
                    <option value="GPT-4">GPT-4</option>
                    <option value="GPT-3.5">GPT-3.5</option>
                    <option value="Claude">Claude</option>
                  </>
                )}
                {cardType === 'image' && (
                  <>
                    <option value="DALL-E 3">DALL-E 3</option>
                    <option value="Midjourney">Midjourney</option>
                    <option value="Stable Diffusion">Stable Diffusion</option>
                  </>
                )}
                {cardType === 'video' && (
                  <>
                    <option value="Sora">Sora</option>
                    <option value="Runway">Runway</option>
                    <option value="Pika">Pika</option>
                  </>
                )}
              </select>
            </div>

            {/* 视频模式控制按钮 - 仅视频卡片显示 */}
            {cardType === 'video' && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-purple-500/80 to-purple-600/80 hover:from-purple-500 hover:to-purple-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      showVideoModePanel: !showVideoModePanel,
                    },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showVideoModePanel ? '隐藏模式设置' : '🎬 视频模式设置'}
              </button>
            )}

            {/* 视频模式面板 */}
            {cardType === 'video' && showVideoModePanel && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                {/* 视频生成模式选择 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">生成模式</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                        (videoMode || 'text') === 'text'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card',
                          props: { ...shape.props, videoMode: 'text' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      文本
                    </button>
                    <button
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                        videoMode === 'first-frame'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card',
                          props: { ...shape.props, videoMode: 'first-frame' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      首帧
                    </button>
                    <button
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                        videoMode === 'first-last-frame'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card',
                          props: { ...shape.props, videoMode: 'first-last-frame' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      首尾
                    </button>
                  </div>
                </div>

                {/* 视频首帧上传 - 首帧模式 */}
                {videoMode === 'first-frame' && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">上传首帧图片</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const imageData = event.target?.result as string;
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card',
                              props: { ...shape.props, firstFrameImage: imageData },
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {firstFrameImage && (
                      <div className="mt-1 relative w-full h-16 bg-black/30 rounded-lg overflow-hidden">
                        <img src={firstFrameImage} alt="First Frame" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {/* 视频首尾帧上传 - 首尾帧模式 */}
                {videoMode === 'first-last-frame' && (
                  <div className="space-y-2">
                    {/* 首帧 */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">首帧</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full text-xs text-gray-400 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imageData = event.target?.result as string;
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card',
                                props: { ...shape.props, firstFrameImage: imageData },
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {firstFrameImage && (
                        <div className="mt-1 relative w-full h-12 bg-black/30 rounded overflow-hidden">
                          <img src={firstFrameImage} alt="First" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    {/* 尾帧 */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">尾帧</label>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full text-xs text-gray-400 file:mr-1 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const imageData = event.target?.result as string;
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card',
                                props: { ...shape.props, lastFrameImage: imageData },
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {lastFrameImage && (
                        <div className="mt-1 relative w-full h-12 bg-black/30 rounded overflow-hidden">
                          <img src={lastFrameImage} alt="Last" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 镜头控制器按钮 - 仅图片卡片显示 */}
            {cardType === 'image' && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      showCameraControl: !showCameraControl,
                    },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showCameraControl ? '隐藏镜头控制' : '📷 镜头控制器'}
              </button>
            )}

            {/* 镜头控制面板 */}
            {cardType === 'image' && showCameraControl && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                {/* 图片上传区域 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">上传参考图片</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const imageData = event.target?.result as string;
                          editor.updateShape({
                            id: shape.id,
                            type: 'custom-card',
                            props: {
                              ...shape.props,
                              uploadedImage: imageData,
                            },
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </div>

                {/* 图片预览 */}
                {uploadedImage && (
                  <div className="relative w-full h-24 bg-black/30 rounded-lg overflow-hidden">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* 交互式摄像头控制器 */}
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">拖动摄像头调整角度</label>
                  <CameraController
                    vertical={cameraVertical || 0}
                    horizontal={cameraHorizontal || 0}
                    onAngleChange={(vertical, horizontal) => {
                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card',
                        props: {
                          ...shape.props,
                          cameraVertical: vertical,
                          cameraHorizontal: horizontal,
                        },
                      });
                    }}
                  />
                </div>

                {/* 角度显示 */}
                <div className="flex justify-between text-xs">
                  <div className="bg-black/30 px-3 py-1.5 rounded">
                    <span className="text-gray-400">垂直: </span>
                    <span className="text-white font-mono">{cameraVertical || 0}°</span>
                  </div>
                  <div className="bg-black/30 px-3 py-1.5 rounded">
                    <span className="text-gray-400">水平: </span>
                    <span className="text-white font-mono">{cameraHorizontal || 0}°</span>
                  </div>
                </div>

                {/* 镜头信息提示 */}
                <div className="text-[10px] text-gray-500 bg-black/30 p-2 rounded">
                  💡 拖动摄像头图标旋转，参数自动添加到生成词
                </div>
              </div>
            )}

            {/* 生成按钮 */}
            <button
              className={`w-full py-2 ${showCameraControl && cardType === 'image' ? 'mt-2' : 'mt-0'} rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm ${color.buttonBg}`}
              onClick={(e) => {
                e.stopPropagation();

                if (cardType === 'image') {
                  // 图片生成逻辑
                  const fullPrompt = (cameraVertical !== 0 || cameraHorizontal !== 0)
                    ? `${prompt} [Camera: vertical ${cameraVertical >= 0 ? '+' : ''}${cameraVertical}°, horizontal ${cameraHorizontal >= 0 ? '+' : ''}${cameraHorizontal}°]`
                    : prompt;
                  console.log('生成图片，完整Prompt:', fullPrompt);
                  console.log('上传的图片:', uploadedImage ? '已上传' : '未上传');

                  // 模拟生成图片
                  const mockGeneratedImage = 'https://picsum.photos/800/600';
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      generatedImage: mockGeneratedImage,
                      showImageOutput: true, // 自动展开查看
                    },
                  });
                } else if (cardType === 'video') {
                  // 视频生成逻辑
                  console.log('生成视频，模式:', videoMode || 'text');
                  console.log('Prompt:', prompt);
                  if (videoMode === 'first-frame') {
                    console.log('首帧图片:', firstFrameImage ? '已上传' : '未上传');
                  } else if (videoMode === 'first-last-frame') {
                    console.log('首帧图片:', firstFrameImage ? '已上传' : '未上传');
                    console.log('尾帧图片:', lastFrameImage ? '已上传' : '未上传');
                  }

                  // 模拟生成视频（使用示例视频）
                  const mockGeneratedVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      generatedVideo: mockGeneratedVideo,
                      showVideoOutput: true, // 自动展开查看
                    },
                  });
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Generate
            </button>

            {/* 图片输出按钮 - 仅图片卡片显示 */}
            {cardType === 'image' && generatedImage && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      showImageOutput: !showImageOutput,
                    },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showImageOutput ? '隐藏图片' : '查看生成图片'}
              </button>
            )}

            {/* 图片输出面板 */}
            {cardType === 'image' && showImageOutput && generatedImage && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                <div className="relative group">
                  {/* 生成的图片 */}
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-auto max-h-[250px] object-contain bg-black/20"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* 悬停时显示的操作按钮 */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {/* 查看大图按钮 */}
                    <button
                      className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(generatedImage, '_blank');
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="查看大图"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      查看
                    </button>

                    {/* 下载按钮 */}
                    <button
                      className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = generatedImage;
                        link.download = `generated-${Date.now()}.png`;
                        link.click();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="下载图片"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      下载
                    </button>

                    {/* 删除按钮 */}
                    <button
                      className="px-3 py-2 bg-red-500/90 hover:bg-red-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card',
                          props: {
                            ...shape.props,
                            generatedImage: '',
                            showImageOutput: false,
                          },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="删除图片"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      删除
                    </button>
                  </div>

                  {/* 图片信息 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">✨ 生成成功</p>
                  </div>
                </div>
              </div>
            )}

            {/* 视频输出按钮 - 仅视频卡片显示 */}
            {cardType === 'video' && generatedVideo && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-yellow-500/80 to-yellow-600/80 hover:from-yellow-500 hover:to-yellow-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card',
                    props: {
                      ...shape.props,
                      showVideoOutput: !showVideoOutput,
                    },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showVideoOutput ? '隐藏视频' : '查看生成视频'}
              </button>
            )}

            {/* 视频输出面板 */}
            {cardType === 'video' && showVideoOutput && generatedVideo && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                <div className="relative group">
                  {/* 生成的视频播放器 */}
                  <video
                    src={generatedVideo}
                    controls
                    className="w-full h-auto max-h-[250px] bg-black"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    您的浏览器不支持视频播放
                  </video>

                  {/* 悬停时显示的操作按钮 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 全屏播放按钮 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(generatedVideo, '_blank');
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="全屏播放"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>

                    {/* 下载按钮 */}
                    <button
                      className="p-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement('a');
                        link.href = generatedVideo;
                        link.download = `generated-video-${Date.now()}.mp4`;
                        link.click();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="下载视频"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>

                    {/* 删除按钮 */}
                    <button
                      className="p-2 bg-red-500/90 hover:bg-red-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card',
                          props: {
                            ...shape.props,
                            generatedVideo: '',
                            showVideoOutput: false,
                          },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="删除视频"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* 视频信息 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">
                      🎬 生成成功 · {videoMode === 'text' ? '文本生成' : videoMode === 'first-frame' ? '首帧生成' : '首尾帧生成'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 文本输出区域 */}
            {cardType === 'text' && (
              <div className="mt-2 p-2 bg-black/30 border border-white/8 rounded-lg min-h-[80px]">
                <p className="text-gray-500 text-xs text-center">Text output will appear here...</p>
              </div>
            )}
          </div>
        </div>

        {/* 镜头控制滑块样式 */}
        <style jsx>{`
          .camera-slider::-webkit-slider-thumb {
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.5);
          }

          .camera-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.5);
          }

          .camera-slider::-webkit-slider-thumb:hover {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            transform: scale(1.1);
          }

          .camera-slider::-moz-range-thumb:hover {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            transform: scale(1.1);
          }
        `}</style>
      </HTMLContainer>
    );
  }

  indicator(shape: CustomCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}
