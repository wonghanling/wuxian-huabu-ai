import {
  BaseBoxShapeUtil,
  DefaultColorStyle,
  HTMLContainer,
  RecordProps,
  T,
  TLBaseShape,
  useEditor,
  createShapeId,
  Editor,
} from 'tldraw';
import { useState, useRef, useCallback } from 'react';
import { fal } from '@fal-ai/client';
import { createClient } from '@/lib/supabase/client';
import { mirrorUrlToStorage } from '@/lib/canvas-storage';
import { useMembership } from '@/lib/useMembership';
import MembershipModal from './MembershipModal';

fal.config({ proxyUrl: '/api/fal/proxy' });

// Helper function to update custom card shape (bypasses TypeScript type checking)
const updateCustomCardShape = (editor: Editor, id: string, props: any) => {
  (editor.updateShape as any)({
    id,
    type: 'custom-card' as any,
    props,
  });
};

// 轻度压缩：最长边限 2048px，quality 0.92
function softCompressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 2048;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// 上传压缩：最长边限 2048px，quality 0.85，视觉影响极小
function compressForUpload(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 2048;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      c.toBlob((blob) => resolve(blob || new Blob()), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(new Blob([file])); };
    img.src = url;
  });
}

// 下载文件（fetch blob，不打开新标签页）
const downloadFile = async (url: string, filename: string) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }
};

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
    cardType: 'text' | 'image' | 'video' | 'character' | 'kling';
    title: string;
    prompt: string;
    model: string;
    uploadedImage?: string;
    uploadedImages?: string; // JSON 数组字符串，nano-banana/pro 多图用（最多2张）
    uploadedImageUrls?: string; // JSON 数组字符串，多图融合模型用（fal storage URL）
    generatedImage?: string;
    aspectRatio?: string; // 图片/视频比例
    gridLayout?: string; // 宫格布局（可选）：'2x2' | '3x3' | '3x4' | '4x4'
    videoMode?: 'text' | 'first-frame' | 'first-last-frame';
    firstFrameImage?: string;
    lastFrameImage?: string;
    generatedVideo?: string;
    showVideoModePanel?: boolean;
    showImageOutput?: boolean;
    showVideoOutput?: boolean;
    capturedFrame?: string;
    videoDuration?: number;
    videoResolution?: string;
    videoGenerateAudio?: boolean;
    // 角色卡片专属字段
    characterName?: string;
    characterAppearance?: string;
    characterClothing?: string;
    characterPersonality?: string;
    characterBackground?: string;
    characterKeywords?: string;
    characterForbiddenWords?: string;
    characterReferenceImage?: string;
    characterStep?: 'analyze' | 'three-view-json' | 'generate';
    characterAnalyzeImage?: string;
    characterAnchorJson?: string;
    characterThreeViewJson?: string;
    characterThreeViewImage?: string;
    characterGeneratedImage?: string;
    characterImageModel?: string;
    imageQuality?: string;
    cameraTemplate?: string;
    cameraStrength?: string;
    showCharacterOutput?: boolean;
    showAnalyzePanel?: boolean;
    showThreeViewJsonPanel?: boolean;
    showGeneratePanel?: boolean;
    isMinimized?: boolean; // 是否缩小状态
    textOutput?: string; // 文本卡片输出
    isGenerating?: boolean; // 是否正在生成
    generationProgress?: number; // 生成进度 0-100
    generationStatus?: string; // 生成状态文本
    // Kling 卡片专属字段
    klingDuration?: string;
    klingAspectRatio?: string;
    klingImage?: string;
    klingGeneratedVideo?: string;
    klingShowSettingsPanel?: boolean;
    klingMode?: string;        // 'motion-control' | 'lip-sync'
    klingVideoUrl?: string;    // 动作控制：动作视频URL
    klingVideoName?: string;   // 动作控制：视频文件名
    klingCharacterOrientation?: string; // 'image' | 'video'
    klingKeepSound?: string;   // 'yes' | 'no'
    klingVideoMode?: string;   // 'std' | 'pro'
    klingLipSyncSessionId?: string;
    klingLipSyncFaceId?: string;
    klingLipSyncAudio?: string;  // base64 or url
    klingLipSyncAudioName?: string;
    klingLipSyncPhase?: string;  // 'idle' | 'identifying' | 'ready' | 'generating'
    klingLipSyncSoundStart?: number;
    klingLipSyncSoundEnd?: number;
    klingLipSyncSoundInsert?: number;
    klingLipSyncSoundVolume?: number;
    klingLipSyncOriginalVolume?: number;
  }
>;

// 定义形状工具
// @ts-expect-error - Custom shape types are not recognized by BaseBoxShapeUtil constraint
export class CustomCardShapeUtil extends BaseBoxShapeUtil<CustomCardShape> {
  static override type = 'custom-card' as const;

  static override props: RecordProps<CustomCardShape> = {
    w: T.number,
    h: T.number,
    cardType: T.literalEnum('image', 'text', 'video', 'character', 'kling'),
    title: T.string,
    prompt: T.string,
    model: T.string,
    uploadedImage: T.string.optional(),
    uploadedImages: T.string.optional(),
    uploadedImageUrls: T.string.optional(),
    generatedImage: T.string.optional(),
    aspectRatio: T.string.optional(),
    gridLayout: T.string.optional(),
    videoMode: T.literalEnum('text', 'first-frame', 'first-last-frame').optional(),
    firstFrameImage: T.string.optional(),
    lastFrameImage: T.string.optional(),
    generatedVideo: T.string.optional(),
    showVideoModePanel: T.boolean.optional(),
    showImageOutput: T.boolean.optional(),
    showVideoOutput: T.boolean.optional(),
    capturedFrame: T.string.optional(),
    videoDuration: T.number.optional(),
    videoResolution: T.string.optional(),
    videoGenerateAudio: T.boolean.optional(),
    characterName: T.string.optional(),
    characterAppearance: T.string.optional(),
    characterClothing: T.string.optional(),
    characterPersonality: T.string.optional(),
    characterBackground: T.string.optional(),
    characterKeywords: T.string.optional(),
    characterForbiddenWords: T.string.optional(),
    characterReferenceImage: T.string.optional(),
    characterStep: T.literalEnum('analyze', 'three-view-json', 'generate').optional(),
    characterAnalyzeImage: T.string.optional(),
    characterAnchorJson: T.string.optional(),
    characterThreeViewJson: T.string.optional(),
    characterThreeViewImage: T.string.optional(),
    characterGeneratedImage: T.string.optional(),
    characterImageModel: T.string.optional(),
    imageQuality: T.string.optional(),
    cameraTemplate: T.string.optional(),
    cameraStrength: T.string.optional(),
    showCharacterOutput: T.boolean.optional(),
    showAnalyzePanel: T.boolean.optional(),
    showThreeViewJsonPanel: T.boolean.optional(),
    showGeneratePanel: T.boolean.optional(),
    isMinimized: T.boolean.optional(),
    textOutput: T.string.optional(),
    isGenerating: T.boolean.optional(),
    generationProgress: T.number.optional(),
    generationStatus: T.string.optional(),
    klingDuration: T.string.optional(),
    klingAspectRatio: T.string.optional(),
    klingImage: T.string.optional(),
    klingGeneratedVideo: T.string.optional(),
    klingShowSettingsPanel: T.boolean.optional(),
    klingMode: T.string.optional(),
    klingVideoUrl: T.string.optional(),
    klingVideoName: T.string.optional(),
    klingCharacterOrientation: T.string.optional(),
    klingKeepSound: T.string.optional(),
    klingVideoMode: T.string.optional(),
    klingLipSyncSessionId: T.string.optional(),
    klingLipSyncFaceId: T.string.optional(),
    klingLipSyncAudio: T.string.optional(),
    klingLipSyncAudioName: T.string.optional(),
    klingLipSyncPhase: T.string.optional(),
    klingLipSyncSoundStart: T.number.optional(),
    klingLipSyncSoundEnd: T.number.optional(),
    klingLipSyncSoundInsert: T.number.optional(),
    klingLipSyncSoundVolume: T.number.optional(),
    klingLipSyncOriginalVolume: T.number.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  // 定义箭头绑定点
  /* @ts-expect-error - HandleSnapGeometry type has changed in newer tldraw version
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
  */

  getDefaultProps(): CustomCardShape['props'] {
    return {
      w: 380,
      h: 380,
      cardType: 'text',
      title: 'Text Generation',
      prompt: '',
      model: 'gpt-5.2',
      uploadedImage: '',
      generatedImage: '',
      aspectRatio: '1:1',
      videoMode: 'text',
      firstFrameImage: '',
      lastFrameImage: '',
      generatedVideo: '',
      showVideoModePanel: false,
      showImageOutput: false,
      showVideoOutput: false,
      capturedFrame: '',
      videoDuration: 5,
      videoResolution: '720p',
      videoGenerateAudio: false,
      characterName: '',
      characterAppearance: '',
      characterClothing: '',
      characterPersonality: '',
      characterBackground: '',
      characterKeywords: '',
      characterForbiddenWords: '',
      characterReferenceImage: '',
      characterStep: 'generate',
      characterAnalyzeImage: '',
      characterAnchorJson: '',
      characterThreeViewJson: '',
      characterThreeViewImage: '',
      characterGeneratedImage: '',
      characterImageModel: 'nano-banana-pro',
      showCharacterOutput: false,
      showAnalyzePanel: false,
      showThreeViewJsonPanel: false,
      showGeneratePanel: false,
      isMinimized: false,
      textOutput: '',
      isGenerating: false,
      generationProgress: 0,
      generationStatus: '',
    };
  }

  component(shape: CustomCardShape) {
    const { cardType, title, prompt, model, w, h, uploadedImage, uploadedImages, uploadedImageUrls, generatedImage, aspectRatio, gridLayout, videoMode, firstFrameImage, lastFrameImage, generatedVideo, showVideoModePanel, showImageOutput, showVideoOutput, capturedFrame, videoDuration, videoResolution, videoGenerateAudio, characterName, characterAppearance, characterClothing, characterPersonality, characterBackground, characterKeywords, characterForbiddenWords, characterReferenceImage, characterStep, characterAnalyzeImage, characterAnchorJson, characterThreeViewJson, characterThreeViewImage, characterGeneratedImage, characterImageModel, imageQuality, cameraTemplate, cameraStrength, showCharacterOutput, showAnalyzePanel, showThreeViewJsonPanel, showGeneratePanel, isMinimized, textOutput, isGenerating, generationProgress, generationStatus, klingDuration, klingAspectRatio, klingImage, klingGeneratedVideo, klingShowSettingsPanel, klingMode, klingVideoUrl, klingVideoName, klingCharacterOrientation, klingKeepSound, klingVideoMode, klingLipSyncSessionId, klingLipSyncFaceId, klingLipSyncAudio, klingLipSyncAudioName, klingLipSyncPhase, klingLipSyncSoundStart, klingLipSyncSoundEnd, klingLipSyncSoundInsert, klingLipSyncSoundVolume, klingLipSyncOriginalVolume } = shape.props;
    const editor = useEditor();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isMember, userId, refresh: refreshBalance } = useMembership();
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [isUploadingMulti, setIsUploadingMulti] = useState(false);
    const [uploadedImageRatio, setUploadedImageRatio] = useState<'16/9' | '9/16'>('16/9');
    const [uploadedImgRatios, setUploadedImgRatios] = useState<Record<number, '16/9' | '9/16'>>({});
    const [isUploadingKlingVideo, setIsUploadingKlingVideo] = useState(false);
    const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);

    // 本地 state 做显示层，防抖写 tldraw store，避免输入法冲突
    const [localPrompt, setLocalPrompt] = useState(shape.props.prompt ?? '');
    const [localCharacterAnchorJson, setLocalCharacterAnchorJson] = useState(shape.props.characterAnchorJson ?? '');
    const [localCharacterThreeViewJson, setLocalCharacterThreeViewJson] = useState(shape.props.characterThreeViewJson ?? '');
    const [localKlingVideoUrl, setLocalKlingVideoUrl] = useState(shape.props.klingVideoUrl ?? '');
    const [localKlingLipSyncFaceId, setLocalKlingLipSyncFaceId] = useState(shape.props.klingLipSyncFaceId ?? '');
    const isComposing = useRef(false);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const updateShapeDebounced = useCallback((props: Partial<CustomCardShape['props']>) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, ...props } });
      }, 300);
    }, [editor, shape.id, shape.props]);

    const handleKlingVideoUpload = async (file: File) => {
      const lowerName = file.name.toLowerCase();
      if (!(lowerName.endsWith('.mp4') || lowerName.endsWith('.mov'))) {
        alert('仅支持 mp4 或 mov 视频');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        alert('视频文件不能超过 500MB');
        return;
      }
      setIsUploadingKlingVideo(true);
      try {
        // 直接从浏览器上传到 Supabase Storage，绕过 Vercel 4.5MB 限制
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('请先登录');
        const ext = lowerName.endsWith('.mov') ? '.mov' : '.mp4';
        const contentType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
        const filename = `videos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const { error } = await supabase.storage.from('assets').upload(filename, file, { contentType, upsert: false });
        if (error) throw new Error(`上传失败: ${error.message}`);
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
        const latestShape = editor.getShape(shape.id);
        const latestProps = latestShape ? (latestShape as any).props : shape.props;
        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...latestProps, klingVideoUrl: urlData.publicUrl, klingVideoName: file.name } });
      } catch (error: any) {
        alert(error?.message || '视频上传失败');
      } finally {
        setIsUploadingKlingVideo(false);
      }
    };

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

    // 视频模型参数配置
    const VIDEO_MODEL_CONFIG: Record<string, {
      mode: 't2v' | 'i2v' | 'firstLastFrame';
      durations: number[];
      resolutions: string[];
      aspectRatios: string[];
      supportsAudio: boolean;
      audioBuiltIn: boolean;
      supportsEndFrame: boolean;
      i2vNoAspectRatio?: boolean;
      defaultResolution: string;
    }> = {
      'veo3.1-t2v':        { mode: 't2v',          durations: [4,6,8], resolutions: ['720p','1080p','4k'],    aspectRatios: ['16:9','9:16'],        supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p' },
      'veo3.1-i2v':        { mode: 'i2v',          durations: [4,6,8], resolutions: ['720p','1080p','4k'],    aspectRatios: ['16:9','9:16'],        supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p' },
      'veo3.1-fast-t2v':   { mode: 't2v',          durations: [4,6,8], resolutions: ['720p','1080p','4k'],    aspectRatios: ['16:9','9:16'],        supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p' },
      'veo3.1-fast-i2v':   { mode: 'i2v',          durations: [4,6,8], resolutions: ['720p','1080p','4k'],    aspectRatios: ['16:9','9:16'],        supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p' },
      'veo3.1-first-last': { mode: 'firstLastFrame',durations: [4,6,8], resolutions: ['720p','1080p','4k'],    aspectRatios: ['16:9','9:16'],        supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: true,  defaultResolution: '720p' },
      'wan2.6-t2v':        { mode: 't2v',          durations: [5,10],    resolutions: ['720P','1080P'],         aspectRatios: ['16:9','9:16','1:1'],  supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720P' },
      'wan2.5-t2v-preview':{ mode: 't2v',          durations: [5,10],    resolutions: ['480P','720P','1080P'],  aspectRatios: ['16:9','9:16','1:1'],  supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720P' },
      'wan2.6-i2v':        { mode: 'i2v',          durations: [5,10,15], resolutions: ['720P','1080P'],         aspectRatios: [],                     supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720P', i2vNoAspectRatio: true },
      'wan2.6-i2v-flash':  { mode: 'i2v',          durations: [5,10,15], resolutions: ['720P','1080P'],         aspectRatios: [],                     supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720P', i2vNoAspectRatio: true },
      'wan2.5-i2v-preview':{ mode: 'i2v',          durations: [5,10],    resolutions: ['480P','720P','1080P'],  aspectRatios: [],                     supportsAudio: true,  audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720P', i2vNoAspectRatio: true },
      'wan2.2-kf2v-flash': { mode: 'firstLastFrame',durations: [5],       resolutions: ['480P','720P','1080P'],  aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: true,  defaultResolution: '720P', i2vNoAspectRatio: true },
      'jimeng-pro-t2v':    { mode: 't2v',          durations: [5,10],    resolutions: ['1080p'],               aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '1080p' },
      'jimeng-pro-i2v':    { mode: 'i2v',          durations: [5,10],    resolutions: ['1080p'],               aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '1080p', i2vNoAspectRatio: true },
      'jimeng-t2v':        { mode: 't2v',          durations: [5,10],    resolutions: ['720p'],                aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p' },
      'jimeng-i2v':        { mode: 'i2v',          durations: [5,10],    resolutions: ['720p'],                aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p',  i2vNoAspectRatio: true },
      'jimeng-first-last': { mode: 'firstLastFrame',durations: [5,10],    resolutions: ['720p'],                aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: true,  defaultResolution: '720p',  i2vNoAspectRatio: true },
      'jimeng-camera':     { mode: 'i2v',          durations: [5,10],    resolutions: ['720p'],                aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '720p',  i2vNoAspectRatio: true },
      'jimeng-1080-t2v':   { mode: 't2v',          durations: [5,10],    resolutions: ['1080p'],               aspectRatios: ['16:9','4:3','1:1','3:4','9:16','21:9'], supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '1080p' },
      'jimeng-1080-i2v':   { mode: 'i2v',          durations: [5,10],    resolutions: ['1080p'],               aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: false, defaultResolution: '1080p', i2vNoAspectRatio: true },
      'jimeng-1080-first-last': { mode: 'firstLastFrame', durations: [5,10], resolutions: ['1080p'],           aspectRatios: [],                     supportsAudio: false, audioBuiltIn: false, supportsEndFrame: true,  defaultResolution: '1080p', i2vNoAspectRatio: true },
      'ovi-i2v':           { mode: 'i2v',          durations: [],      resolutions: [],                       aspectRatios: [],                     supportsAudio: false, audioBuiltIn: true,  supportsEndFrame: false, defaultResolution: '' },
    };
    const currentVideoModel = VIDEO_MODEL_CONFIG[model || ''] ?? null;

    // 获取连接到当前卡片的 ShotCard 指令
    const getShotCardPrompt = (): string => {
      // 找到所有绑定到当前卡片的连接线
      const allBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of allBindings) {
        // 只看 end 端（ShotCard 连到当前卡片）
        if (binding.props.terminal !== 'end') continue;
        const connection = editor.getShape(binding.fromId);
        if (!connection) continue;
        // 找连接线的另一端（start 端）
        const otherBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const ob of otherBindings) {
          if ((ob as any).props?.terminal !== 'start') continue;
          const sourceShape = editor.getShape((ob as any).toId);
          if (!sourceShape || (sourceShape as any).type !== 'shot-card') continue;
          // 找到了连接的 ShotCard，拼指令
          const sp = (sourceShape as any).props;
          const parts: string[] = [];
          if (sp.shotType) parts.push(`景别：${sp.shotType}`);
          if (sp.cameraMovement && sp.cameraMovement !== 'Follow/Tracking') parts.push(`运镜：${sp.cameraMovement}`);
          if (sp.composition) parts.push(`构图：${sp.composition}`);
          if (sp.subjectScale) parts.push(`主体比例：${sp.subjectScale}`);
          if (sp.spaceType) parts.push(`空间类型：${sp.spaceType}`);
          if (sp.timeFeeling) parts.push(`时间感：${sp.timeFeeling}`);
          if (sp.lighting) parts.push(`光影/天气：${sp.lighting}`);
          if (sp.motionSource) parts.push(`动态来源：${sp.motionSource}`);
          if (sp.semantic) parts.push(`语义：${sp.semantic}`);
          if (parts.length > 0) return `[电影镜头指令] ${parts.join('，')}。`;
        }
      }
      return '';
    };

    // 实时读取上游 Step2/Step3/Step4 的 result 作为 prompt
    const getConnectedPrompt = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (!src) continue;
          if (
            (src.type === 'gem-step2-card' || src.type === 'gem-step3-card' || src.type === 'gem-step4-card') &&
            src.props?.result
          ) return src.props.result;
        }
      }
      return '';
    };

    const connectedPrompt = getConnectedPrompt();
    const shotPromptDisplay = getShotCardPrompt();
    // 输入框显示的前缀：shot-card 指令 + Step 卡片结果
    const displayPrefix = [shotPromptDisplay, connectedPrompt].filter(Boolean).join('\n');

    // 实时读取连接的上游图片卡片的 generatedImage 或上传卡片的图片
    const getConnectedGeneratedImage = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const srcShape = editor.getShape((cb as any).toId) as any;
          if (!srcShape) continue;
          if (srcShape.type === 'custom-card' && srcShape.props?.generatedImage) return srcShape.props.generatedImage;
          if (srcShape.type === 'media-upload-card' && srcShape.props?.mediaType === 'image' && srcShape.props?.imageData) return srcShape.props.imageData;
        }
      }
      return '';
    };

    const connectedGeneratedImage = getConnectedGeneratedImage();

    // 读取连接的上游卡片生成的视频或上传卡片的视频
    const getConnectedGeneratedVideo = (): string => {
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (!src) continue;
          if (src.type === 'custom-card' && src.props?.generatedVideo) return src.props.generatedVideo;
          if (src.type === 'seedance-card' && src.props?.generatedVideo) return src.props.generatedVideo;
          if (src.type === 'media-upload-card' && src.props?.mediaType === 'video' && src.props?.videoUrl) return src.props.videoUrl;
        }
      }
      return '';
    };

    const connectedGeneratedVideo = getConnectedGeneratedVideo();

    // 读取连接的上游图片卡片（最多 maxCount 张）
    const getConnectedImages = (maxCount: number): string[] => {
      const imgs: string[] = [];
      const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of inputBindings) {
        if ((binding as any).props?.terminal !== 'end') continue;
        const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const cb of connBindings) {
          if ((cb as any).props?.terminal !== 'start') continue;
          const src = editor.getShape((cb as any).toId) as any;
          if (!src) continue;
          if (src.type === 'custom-card' && src.props?.generatedImage) imgs.push(src.props.generatedImage);
          else if (src.type === 'media-upload-card' && src.props?.mediaType === 'image' && src.props?.imageData) imgs.push(src.props.imageData);
          if (imgs.length >= maxCount) return imgs;
        }
      }
      return imgs;
    };

    // 视频卡片连接图片
    const connectedVideoImages = cardType === 'video' ? getConnectedImages(2) : [];
    const connFirstFrame = connectedVideoImages[0] || '';
    const connLastFrame = connectedVideoImages[1] || '';

    const toggleMinimize = (e: React.MouseEvent) => {
      e.stopPropagation();

      const newMinimized = !isMinimized;
      const newW = newMinimized ? 150 : 380;
      const newH = newMinimized ? 80 : 380;

      editor.updateShape({
        id: shape.id,
        type: 'custom-card' as any,
        props: {
          ...shape.props,
          w: newW,
          h: newH,
          isMinimized: newMinimized,
        },
      });
    };

    // 捕获视频当前帧
    const captureCurrentFrame = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      // 创建canvas元素
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 将视频当前帧绘制到canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 转换为base64图片
      const frameImage = canvas.toDataURL('image/png');

      // 更新shape状态
      editor.updateShape({
        id: shape.id,
        type: 'custom-card' as any,
        props: {
          ...shape.props,
          capturedFrame: frameImage,
        },
      });
    }, [editor, shape.id, shape.props]);

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
      character: {
        gradient: 'linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.12) 50%, rgba(128, 128, 128, 0.08) 100%)',
        border: 'rgba(192, 192, 192, 0.3)',
        glow: '0 0 40px rgba(192, 192, 192, 0.15)',
        icon: 'text-gray-300',
        iconBg: 'bg-gradient-to-br from-gray-400/20 to-gray-500/20',
        buttonBg: 'bg-gradient-to-r from-gray-500/80 to-gray-600/80 hover:from-gray-500 hover:to-gray-600',
        handleColor: 'rgba(192, 192, 192, 0.8)',
      },
      kling: {
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

    // 计算缩放比例（缩小时固定为1，避免内容被压缩）
    const scale = isMinimized ? 1 : Math.min(w / 380, h / 380);

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
        {showMemberModal && <MembershipModal onClose={() => setShowMemberModal(false)} onPay={() => handlePay('membership', 115)} />}

        {/* 视频/图片放大弹窗 */}
        {lightboxVideo && (
          <div
            className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center"
            onClick={() => setLightboxVideo(null)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="relative" style={{ maxWidth: '70vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
              {lightboxVideo.includes('.mp4') || lightboxVideo.includes('video') ? (
                <video src={lightboxVideo} controls autoPlay className="rounded-xl" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              ) : (
                <img src={lightboxVideo} alt="大图" className="rounded-xl object-contain" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              )}
              <button
                className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightboxVideo(null)}
                onPointerDown={(e) => e.stopPropagation()}
              >✕</button>
            </div>
          </div>
        )}
        {/* 图片卡片菜单按钮 - 右侧端口上方 */}
        {cardType === 'image' && !isMinimized && (
          <div
            className="absolute cursor-pointer group"
            style={{ right: '-32px', top: '50%', transform: 'translateY(-50%)', zIndex: 102, pointerEvents: 'all' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              window.dispatchEvent(new CustomEvent('card-menu-open', {
                detail: { x: rect.right + 6, y: rect.top - 40, shapeId: shape.id, type: 'image-card' },
              }));
            }}
            title="卡片菜单"
          >
            <div className="w-6 h-6 rounded-full bg-zinc-800/90 border border-white/15 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:border-white/30 transition-all shadow-lg">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </div>
          </div>
        )}

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
          className="w-full h-full backdrop-blur-xl rounded-2xl shadow-2xl transition-all duration-300"
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
          {/* 缩放按钮 */}
          <button
            onClick={toggleMinimize}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg transition-all z-10"
            style={{
              transform: `scale(${1 / scale})`,
              transformOrigin: 'center',
            }}
            title={isMinimized ? "展开" : "缩小"}
          >
            {isMinimized ? '+' : '−'}
          </button>

          {/* 缩小状态 - 只显示标题 */}
          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">{title}</div>
                <div className="text-gray-400 text-xs mt-1">
                  {cardType === 'text' && '文本生成'}
                  {cardType === 'image' && '图片生成'}
                  {cardType === 'video' && '视频生成'}
                  {cardType === 'character' && '角色设计'}
                  {cardType === 'kling' && 'Kling 视频'}
                </div>
                <div className="text-gray-500 text-[10px] mt-2">点击+展开</div>
              </div>
            </div>
          ) : (
            /* 正常状态 - 显示所有内容 */
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
                {cardType === 'character' && (
                  <svg className={`w-4 h-4 ${color.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                {cardType === 'kling' && (
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
                  {cardType === 'character' && '角色设计'}
                  {cardType === 'kling' && 'Kling 视频'}
                </p>
              </div>
            </div>

            {/* 输入区域 */}
            <div className="mb-2 flex-1">
              {cardType !== 'character' && cardType !== 'kling' && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs">Prompt</label>
                    <button
                      className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                      onClick={async (e) => { e.stopPropagation(); try { const text = await navigator.clipboard.readText(); if (text) { const newPrompt = (localPrompt ? localPrompt + '\n' : '') + text; setLocalPrompt(newPrompt); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, prompt: newPrompt } }); } } catch {} }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >粘贴</button>
                  </div>
                  <textarea
                    className="w-full h-20 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500"
                    placeholder={
                      cardType === 'text'
                        ? 'Enter your text prompt...'
                        : cardType === 'image'
                        ? 'Describe the image...'
                        : 'Describe the video...'
                    }
                    value={displayPrefix ? `${displayPrefix}${localPrompt ? '\n' + localPrompt : ''}` : localPrompt}
                    readOnly={false}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onCompositionStart={() => { isComposing.current = true; }}
                    onCompositionEnd={(e) => {
                      isComposing.current = false;
                      const full = (e.target as HTMLTextAreaElement).value;
                      const prefix = displayPrefix ? displayPrefix + '\n' : '';
                      const userInput = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : (displayPrefix && full.startsWith(displayPrefix) ? full.slice(displayPrefix.length) : full);
                      setLocalPrompt(userInput);
                      updateShapeDebounced({ prompt: userInput });
                    }}
                    onChange={(e) => {
                      const full = e.target.value;
                      const prefix = displayPrefix ? displayPrefix + '\n' : '';
                      const userInput = prefix && full.startsWith(prefix) ? full.slice(prefix.length) : (displayPrefix && full.startsWith(displayPrefix) ? full.slice(displayPrefix.length) : full);
                      setLocalPrompt(userInput);
                      if (!isComposing.current) updateShapeDebounced({ prompt: userInput });
                    }}
                  />
                  {displayPrefix && (
                    <div className="text-[10px] text-purple-400 mt-0.5">
                      {shotPromptDisplay && connectedPrompt ? '· 景别 + 连接卡片' : shotPromptDisplay ? '· 来自电影控制器' : '· 来自连接卡片'}
                    </div>
                  )}
                  {/* 连接提示标签 */}
                  {cardType === 'video' && (() => {
                    const tags: string[] = [];
                    const inputBindings = editor.getBindingsToShape(shape.id, 'connection');
                    for (const binding of inputBindings) {
                      if ((binding as any).props?.terminal !== 'end') continue;
                      const connBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
                      for (const cb of connBindings) {
                        if ((cb as any).props?.terminal !== 'start') continue;
                        const src = editor.getShape((cb as any).toId) as any;
                        if (!src) continue;
                        if (src.type === 'shot-card') tags.push('景别参数已连接');
                        if (src.type === 'gem-step3-card') tags.push('Step3 prompt 已连接');
                        if (src.type === 'gem-step4-card') tags.push('Step4 prompt 已连接');
                      }
                    }
                    if (tags.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tags.map((tag, i) => (
                          <span key={i} className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-2 py-0.5">{tag}</span>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* 角色卡片专属输入区域 */}
              {cardType === 'character' && (
                <div className="space-y-2">

                  {/* 步骤1: 分析图片 */}
                  {(characterStep || 'analyze') === 'analyze' && (
                    <div className="relative">
                      <div className="space-y-2">{/* 上传图片 */}
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">
                            上传图片{connectedGeneratedImage && <span className="text-purple-400 ml-1">(已从连接获取)</span>}
                          </label>
                          {!connectedGeneratedImage && (
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
                                      type: 'custom-card' as any,
                                      props: { ...shape.props, characterAnalyzeImage: imageData },
                                    });
                                  };
                                  reader.readAsDataURL(file);
                                }
                                e.target.value = '';
                              }}
                            />
                          )}
                        {(connectedGeneratedImage || characterAnalyzeImage) && (
                          <div className="mt-2 relative w-full h-32 bg-black/30 rounded-lg overflow-hidden">
                            <img src={connectedGeneratedImage || characterAnalyzeImage} alt="Analyze" className="w-full h-full object-cover" />
                            {connectedGeneratedImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-white text-[10px] text-center py-1">来自连接的图片卡片</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 固定指令说明 */}
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-[10px] text-blue-400 leading-relaxed">
                          固定指令：根据这张图片，只做单人分析，反推出一个【单人成功范式 JSON】。不要加三视角、不要加转面、不要做设定稿，只保证这是一个稳定可复现的人物 JSON
                        </p>
                      </div>

                      {/* 选择模型 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">选择模型</label>
                        <select
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                          value={model || 'gpt-5.2'}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, model: e.target.value },
                            });
                          }}
                        >
                          <option value="gpt-5.2">GPT-5.2</option>
                          <option value="gpt-5.1-thinking-all">GPT-5.1 Thinking</option>
                          <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                          <option value="grok-4">Grok 4</option>
                        </select>
                      </div>

                      {/* 分析按钮 */}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600'}`}
                        disabled={isGenerating || (!connectedGeneratedImage && !characterAnalyzeImage)}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!isMember) { setShowMemberModal(true); return; }

                          // 如果已经有输出结果，则切换显示/隐藏
                          if (characterAnchorJson) {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: {
                                ...shape.props,
                                showAnalyzePanel: !showAnalyzePanel,
                              },
                            });
                          } else {
                            // 第一次点击，调用 API 分析图片生成 Anchor JSON
                            console.log('分析图片生成Anchor JSON');

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '分析图片中...' },
                            });

                            try {
                              const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: model || 'gpt-5.2',
                                  prompt: '请分析这张图片中的角色，生成一个【单人成功范式 JSON】。只做单人分析，反推出稳定可复现的人物 JSON。不要加三视角、不要加转面、不要做设定稿。请直接输出 JSON，不要解释。',
                                  imageUrl: connectedGeneratedImage || characterAnalyzeImage,
                                  stream: false,
                                }),
                              });
                              const data = await res.json();
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: {
                                  ...shape.props,
                                  characterAnchorJson: data.content || '',
                                  showAnalyzePanel: true,
                                  isGenerating: false,
                                },
                              });
                            } catch (err) {
                              console.error('分析失败:', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('分析失败，请重试');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>分析中...</span>
                          </div>
                        ) : (characterAnchorJson && showAnalyzePanel ? '收起 Anchor JSON' : '分析生成 Anchor JSON')}
                      </button>

                      {/* 模型输出结果 - Anchor JSON */}
                      {characterAnchorJson && showAnalyzePanel && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-gray-400 text-xs">模型输出 - Anchor JSON</label>
                            <button
                              className="px-2 py-1 bg-green-500/80 hover:bg-green-600 rounded text-white text-[10px] font-semibold transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(characterAnchorJson);
                                alert('JSON已复制到剪贴板');
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              复制
                            </button>
                          </div>
                          <textarea
                            className="w-full h-32 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-[10px] font-mono resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all overflow-y-auto"
                            value={characterAnchorJson}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                    {/* 滚动提示 - 步骤1 */}
                    {characterAnchorJson && (
                      <div className="mt-2 text-center">
                        <p className="text-[10px] text-yellow-400 animate-bounce">👇 向下滚动查看更多内容</p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* 步骤2: 生成三视角JSON */}
                  {characterStep === 'three-view-json' && (
                    <div className="relative">
                      <div className="space-y-2">
                      {/* 粘贴Anchor JSON */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-gray-400 text-xs">粘贴 Anchor JSON</label>
                          <button className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                            onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) { setLocalCharacterAnchorJson(t); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, characterAnchorJson: t } }); } } catch {} }}
                            onPointerDown={(e) => e.stopPropagation()}>粘贴</button>
                        </div>
                        <textarea
                          className="w-full h-24 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-[10px] font-mono resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500"
                          placeholder="粘贴步骤1生成的Anchor JSON..."
                          value={localCharacterAnchorJson}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onCompositionStart={() => { isComposing.current = true; }}
                          onCompositionEnd={(e) => {
                            isComposing.current = false;
                            const v = (e.target as HTMLTextAreaElement).value;
                            setLocalCharacterAnchorJson(v);
                            updateShapeDebounced({ characterAnchorJson: v });
                          }}
                          onChange={(e) => {
                            setLocalCharacterAnchorJson(e.target.value);
                            if (!isComposing.current) updateShapeDebounced({ characterAnchorJson: e.target.value });
                          }}
                        />
                      </div>

                      {/* 固定指令说明 */}
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-[10px] text-blue-400 leading-relaxed">
                          固定指令：基于上面的 Anchor JSON，生成一份【稳定的三视角（正/侧/背）完整 JSON】。要求：同一人物、同一服装、同一发型、同一身材比例；使用 character turnaround 工程化方式，不要摄影模式；必须避免重复正面或换人，按上次成功的方式来。
                        </p>
                      </div>

                      {/* 选择模型 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">选择模型</label>
                        <select
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                          value={model || 'gpt-5.2'}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, model: e.target.value },
                            });
                          }}
                        >
                          <option value="gpt-5.2">GPT-5.2</option>
                          <option value="gpt-5.1-thinking-all">GPT-5.1 Thinking</option>
                          <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                          <option value="grok-4">Grok 4</option>
                        </select>
                      </div>

                      {/* 生成三视角JSON按钮 */}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600'}`}
                        disabled={isGenerating || !characterAnchorJson}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!isMember) { setShowMemberModal(true); return; }

                          // 如果已经有输出结果，则切换显示/隐藏
                          if (characterThreeViewJson) {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: {
                                ...shape.props,
                                showThreeViewJsonPanel: !showThreeViewJsonPanel,
                              },
                            });
                          } else {
                            // 第一次点击，调用 API 生成三视角 JSON
                            console.log('生成三视角JSON');

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '分析图片中...' },
                            });

                            try {
                              const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: model || 'gpt-5.2',
                                  prompt: `基于下面的 Anchor JSON，生成一份【稳定的三视角（正/侧/背）完整 JSON】。要求：同一人物、同一服装、同一发型、同一身材比例；使用 character turnaround 工程化方式，不要摄影模式；必须避免重复正面或换人，按上次成功的方式来。\n\nAnchor JSON：\n${characterAnchorJson}\n\n请直接输出 JSON，不要解释。`,
                                  stream: false,
                                }),
                              });
                              const data = await res.json();
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: {
                                  ...shape.props,
                                  characterThreeViewJson: data.content || '',
                                  showThreeViewJsonPanel: true,
                                  isGenerating: false,
                                },
                              });
                            } catch (err) {
                              console.error('三视角JSON生成失败:', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('生成失败，请重试');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>生成中...</span>
                          </div>
                        ) : (characterThreeViewJson && showThreeViewJsonPanel ? '收起三视角JSON' : '生成三视角 JSON')}
                      </button>

                      {/* 模型输出结果 - 三视角完整JSON */}
                      {characterThreeViewJson && showThreeViewJsonPanel && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-gray-400 text-xs">模型输出 - 三视角完整 JSON</label>
                            <button
                              className="px-2 py-1 bg-green-500/80 hover:bg-green-600 rounded text-white text-[10px] font-semibold transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(characterThreeViewJson);
                                alert('JSON已复制到剪贴板');
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              复制
                            </button>
                          </div>
                          <textarea
                            className="w-full h-40 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-[10px] font-mono resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                            value={characterThreeViewJson}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                    {/* 滚动提示 - 步骤2 */}
                    {characterThreeViewJson && (
                      <div className="mt-2 text-center">
                        <p className="text-[10px] text-yellow-400 animate-bounce">👇 向下滚动查看更多内容</p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* 步骤3: 生成三视角图片 */}
                  {characterStep === 'generate' && (
                    <div className="relative">
                      <div className="space-y-2">
                      {/* 上传图片 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">
                          上传角色参考图片（必填）{connectedGeneratedImage && <span className="text-purple-400 ml-1">·来自连接</span>}
                        </label>
                        {!connectedGeneratedImage && (
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await fal.storage.upload(file);
                                if (url) {
                                  editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, characterThreeViewImage: url } });
                                }
                              } catch {}
                            }
                            e.target.value = '';
                          }}
                        />
                        )}
                        {(connectedGeneratedImage || characterThreeViewImage) && (
                          <div className="mt-2 relative w-full h-24 bg-black/30 rounded-lg overflow-hidden group">
                            <img src={connectedGeneratedImage || characterThreeViewImage} alt="Reference" className="w-full h-full object-cover" />
                            {connectedGeneratedImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-white text-[10px] text-center py-0.5">来自连接</div>
                            )}
                            {!connectedGeneratedImage && (
                            <button
                              className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, characterThreeViewImage: '' } }); }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >✕</button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 清晰度 + 比例 */}
                      {['nano-banana-pro'].includes(characterImageModel || 'nano-banana-pro') && (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-gray-400 text-xs mb-1 block">清晰度</label>
                            <div className="flex gap-1">
                              {[{ value: '2k', label: '2K ¥1.2' }, { value: '4k', label: '4K ¥1.5' }].map(({ value, label }) => (
                                <button
                                  key={value}
                                  onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, imageQuality: value } }); }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-all ${(imageQuality ?? '2k') === value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                >{label}</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-gray-400 text-xs mb-1 block">比例</label>
                            <select
                              className="w-full bg-black/30 border border-white/8 rounded p-1 text-white text-[10px] focus:outline-none"
                              value={aspectRatio || '16:9'}
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onChange={(e) => { editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, aspectRatio: e.target.value } }); }}
                            >
                              {['1:1','16:9','9:16','4:3','3:4','3:2','2:3'].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* 选择图片生成模型 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">选择图片生成模型</label>
                        <select
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                          value={characterImageModel || 'nano-banana-pro'}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, characterImageModel: e.target.value },
                            });
                          }}
                        >
                          <option value="nano-banana-pro">Nano Banana 2（2K ¥1.2 / 4K ¥1.5）</option>
                          <option value="nano-banana">Nano Banana — ¥0.5/次</option>
                          <option value="gpt-image-2">GPT Image 2 — ¥0.5~0.8/次</option>
                          <option value="flux-kontext">Flux Kontext — ¥0.6/次</option>
                          <option value="flux-kontext-max">Flux Kontext Max — ¥1.0/次</option>
                          <option value="doubao-seedream-4-5-251128">豆包 Seedream — ¥0.3/次</option>
                        </select>
                      </div>

                      {/* 生成三视角图片按钮 */}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600'}`}
                        disabled={isGenerating || (!characterThreeViewImage && !connectedGeneratedImage)}
                        onClick={async (e) => {
                          e.stopPropagation();

                          // 如果已经有输出结果，则切换显示/隐藏
                          if (characterGeneratedImage) {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: {
                                ...shape.props,
                                showGeneratePanel: !showGeneratePanel,
                              },
                            });
                          } else {
                            // 第一次点击，调用图片 API 生成三视角图片
                            console.log('生成三视角图片');
                            console.log('使用模型:', characterImageModel);
                            console.log('JSON:', characterThreeViewJson);

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '分析图片中...' },
                            });

                            try {
                              const effectiveImage = connectedGeneratedImage || characterThreeViewImage || '';
                              const isBase64 = effectiveImage.startsWith('data:');
                              const charModel = characterImageModel || 'nano-banana-pro';
                              const charPrompt = `use the uploaded image as the ONLY character reference, character turnaround sheet, TOP SECTION: full body views front view, side view, back view, full body, head to toe visible, BOTTOM SECTION: head detail views reuse the SAME head from the original image, do not generate a new face, close-up crops of the same character head, front face, side profile, 3/4 view, same character, identical face, preserve facial features exactly, preserve hairstyle exactly, same hair shape, same hair volume, no variation, reuse the same identity across all views, no redesign, no reinterpretation, keep original outfit exactly, do not redesign, match the original image style exactly, same rendering, same lighting, same material, no duplicate character generation, no alternate versions, neutral pose, clean studio background, arranged in one frame, structured grid layout, clear separation`;

                              // GPT Image 2 走 /api/image/generate
                              if (charModel === 'gpt-image-2') {
                                let imgToSend: string | undefined;
                                if (effectiveImage) {
                                  const raw = isBase64 ? effectiveImage : await fetch(effectiveImage).then(r => r.blob()).then(b => new Promise<string>(res => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b); }));
                                  imgToSend = await softCompressImage(raw);
                                }
                                const res = await fetch('/api/image/generate', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    model: 'gpt-image-2',
                                    prompt: charPrompt,
                                    aspectRatio: '2048x1152',
                                    imageQuality: 'medium',
                                    imageBase64Array: imgToSend ? [imgToSend] : undefined,
                                    userId: userId || undefined,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || '生成失败');
                                editor.updateShape({
                                  id: shape.id, type: 'custom-card' as any,
                                  props: { ...shape.props, characterGeneratedImage: data.imageUrl, isGenerating: false, showCharacterOutput: true },
                                });
                                await refreshBalance();
                                return;
                              }

                              let charImageBase64: string | undefined;
                              let charImageBase64Array: string[] | undefined;
                              let charImageUrlArray: string[] | undefined;

                              if (effectiveImage) {
                                if (['nano-banana-pro'].includes(charModel)) {
                                  if (isBase64) {
                                    const blob = await fetch(effectiveImage).then(r => r.blob());
                                    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
                                    const url = await fal.storage.upload(file);
                                    charImageUrlArray = [url];
                                  } else {
                                    charImageUrlArray = [effectiveImage];
                                  }
                                } else if (charModel === 'nano-banana') {
                                  if (isBase64) {
                                    charImageBase64Array = [await softCompressImage(effectiveImage)];
                                  } else {
                                    const blob = await fetch(effectiveImage).then(r => r.blob());
                                    const base64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
                                    charImageBase64Array = [await softCompressImage(base64)];
                                  }
                                } else {
                                  if (isBase64) {
                                    charImageBase64 = await softCompressImage(effectiveImage);
                                  } else {
                                    const blob = await fetch(effectiveImage).then(r => r.blob());
                                    const base64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
                                    charImageBase64 = await softCompressImage(base64);
                                  }
                                }
                              }

                              const res = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: charModel,
                                  prompt: charPrompt,
                                  aspectRatio: aspectRatio || '16:9',
                                  imageBase64: charImageBase64,
                                  imageBase64Array: charImageBase64Array,
                                  imageUrlArray: charImageUrlArray,
                                  imageQuality: imageQuality || '2k',
                                  userId: userId || undefined,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || '生成失败');

                              // fal 异步轮询
                              let imageUrl = data.imageUrl;
                              if (data.pending && data.requestId) {
                                const hasImg = charImageUrlArray && charImageUrlArray.length > 0;
                                const endpoint = hasImg ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2';
                                let pollAttempts = 0;
                                const poll = async (): Promise<string> => {
                                  pollAttempts++;
                                  await new Promise(r => setTimeout(r, 3000));
                                  try {
                                    const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(endpoint)}`);
                                    const qData = await qRes.json();
                                    if (qData.success && qData.imageUrl) return qData.imageUrl;
                                    if (qData.error) throw new Error(qData.error);
                                    if (pollAttempts > 60) throw new Error('生成超时');
                                    return poll();
                                  } catch (e: any) {
                                    if (e.message && (e.message.includes('超时') || e.message.includes('error'))) throw e;
                                    if (pollAttempts > 60) throw new Error('生成超时');
                                    await new Promise(r => setTimeout(r, 5000));
                                    return poll();
                                  }
                                };
                                imageUrl = await poll();
                              }

                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: {
                                  ...shape.props,
                                  characterGeneratedImage: imageUrl,
                                  showGeneratePanel: true,
                                  isGenerating: false,
                                },
                              });
                            } catch (err) {
                              console.error('三视角图片生成失败:', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('图片生成失败，请重试');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>生成中...</span>
                          </div>
                        ) : (characterGeneratedImage && showGeneratePanel ? '收起三视角图片' : '生成三视角图片')}
                      </button>

                      {/* 显示生成的图片 */}
                      {showGeneratePanel && characterGeneratedImage && (
                        <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                          <div className="relative group">
                            <img src={characterGeneratedImage} alt="Generated Three Views" className="w-full h-auto max-h-[250px] object-contain bg-black/20" />

                            {/* 悬停时显示的操作按钮 */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {/* 查看大图按钮 */}
                              <button
                                className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxVideo(characterGeneratedImage);
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
                                  downloadFile(characterGeneratedImage, `character-three-view-${Date.now()}.png`);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="下载图片"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                下载
                              </button>
                            </div>

                            {/* 图片信息 */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                              <p className="text-white text-[10px] truncate">三视角生成成功</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 滚动提示 - 步骤3 */}
                    {characterGeneratedImage && showCharacterOutput && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-2 pointer-events-none">
                        <div className="text-center">
                          <p className="text-[10px] text-yellow-400 animate-bounce">👇 向下滚动查看生成图片</p>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>
            {/* 模型选择 */}
            {cardType !== 'character' && cardType !== 'kling' && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">Model</label>
                <select
                  className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                  value={model || (cardType === 'text' ? 'gpt-5.2' : cardType === 'image' ? 'nano-banana-pro' : 'veo3.1-fast-t2v')}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: { ...shape.props, model: e.target.value },
                    });
                  }}
                >
                  {cardType === 'text' && (
                    <>
                      <optgroup label="高级模型">
                        <option value="gpt-5.2">GPT-5.2</option>
                        <option value="gpt-5.1-2025-11-13">GPT-5.1</option>
                        <option value="gpt-5.1-thinking-all">GPT-5.1 Thinking</option>
                        <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                        <option value="gemini-2.5-pro-all">Gemini 2.5 Pro</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                        <option value="grok-4.1">Grok 4.1</option>
                        <option value="grok-4">Grok 4</option>
                        <option value="gpt-5.1-chat">GPT-5.1 Chat</option>
                      </optgroup>
                      <optgroup label="普通模型">
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                    </>
                  )}
                  {cardType === 'image' && (
                    <>
                      <optgroup label="Gemini">
                        <option value="nano-banana-pro">Nano Banana 2（2K ¥1.2 / 4K ¥1.5）</option>
                        <option value="nano-banana">Nano Banana — ¥0.5/次</option>
                        <option value="nano-banana-pro-multi">多图融合 Nano Banana Pro（2K ¥1.5 / 4K ¥2.5）</option>
                      </optgroup>
                      <optgroup label="GPT Image">
                        <option value="gpt-image-2">GPT Image 2 — ¥0.5~0.8/次</option>
                        <option value="gpt-image-2-all">GPT Image 2 多图融合 — ¥0.5~0.8/次</option>
                      </optgroup>
                      <optgroup label="Flux">
                        <option value="flux-kontext">Flux Kontext — ¥0.6/次</option>
                        <option value="flux-kontext-max">Flux Kontext Max — ¥1.0/次</option>
                      </optgroup>
                      <optgroup label="其他">
                        <option value="mj_imagine">Midjourney — ¥0.6/次</option>
                        <option value="doubao-seedream-4-5-251128">豆包 Seedream — ¥0.3/次</option>
                      </optgroup>
                    </>
                  )}
                  {cardType === 'video' && (
                    <>
                      <optgroup label="Google Veo 3.1">
                        <option value="veo3.1-t2v">Veo 3.1 文生视频 — 会员¥1.78/秒 普通¥1.98/秒</option>
                        <option value="veo3.1-i2v">Veo 3.1 图生视频 — 会员¥1.78/秒 普通¥1.98/秒</option>
                        <option value="veo3.1-fast-t2v">Veo 3.1 Fast 文生视频 — 会员¥1.09/秒 普通¥1.29/秒</option>
                        <option value="veo3.1-fast-i2v">Veo 3.1 Fast 图生视频 — 会员¥1.09/秒 普通¥1.29/秒</option>
                        <option value="veo3.1-first-last">Veo 3.1 首尾帧 — 会员¥1.09/秒 普通¥1.29/秒</option>
                      </optgroup>
                      <optgroup label="Wan 2.6">
                        <option value="wan2.6-t2v">Wan 2.6 文生视频 — 会员¥1.0/秒 普通¥1.2/秒</option>
                        <option value="wan2.6-i2v">Wan 2.6 图生视频 — 会员¥1.0/秒 普通¥1.2/秒</option>
                        <option value="wan2.6-i2v-flash">Wan 2.6 图生视频 Flash — 会员¥0.55/秒 普通¥0.75/秒</option>
                      </optgroup>
                      <optgroup label="Wan 2.5">
                        <option value="wan2.5-t2v-preview">Wan 2.5 文生视频 — 会员¥1.0/秒 普通¥1.2/秒</option>
                        <option value="wan2.5-i2v-preview">Wan 2.5 图生视频 — 会员¥1.0/秒 普通¥1.2/秒</option>
                      </optgroup>
                      <optgroup label="Wan 2.2">
                        <option value="wan2.2-kf2v-flash">Wan 2.2 首尾帧视频 — 会员¥3.0/次 普通¥4.0/次（固定5秒）</option>
                      </optgroup>
                      <optgroup label="即梦 3.0 Pro（1080P）">
                        <option value="jimeng-pro-t2v">即梦 Pro 文生视频 — 会员¥1.4/秒 普通¥1.6/秒</option>
                        <option value="jimeng-pro-i2v">即梦 Pro 图生视频（首帧）— 会员¥1.4/秒 普通¥1.6/秒</option>
                      </optgroup>
                      <optgroup label="即梦 3.0（720P）">
                        <option value="jimeng-t2v">即梦 文生视频 — 会员¥0.68/秒 普通¥0.88/秒</option>
                        <option value="jimeng-i2v">即梦 图生视频（首帧）— 会员¥0.68/秒 普通¥0.88/秒</option>
                        <option value="jimeng-first-last">即梦 首尾帧 — 会员¥0.68/秒 普通¥0.88/秒</option>
                        <option value="jimeng-camera">即梦 运镜 — 会员¥0.68/秒 普通¥0.88/秒</option>
                      </optgroup>
                      <optgroup label="即梦 3.0（1080P）">
                        <option value="jimeng-1080-t2v">即梦 文生视频 1080P — 会员¥1.03/秒 普通¥1.23/秒</option>
                        <option value="jimeng-1080-i2v">即梦 图生视频首帧 1080P — 会员¥1.03/秒 普通¥1.23/秒</option>
                        <option value="jimeng-1080-first-last">即梦 首尾帧 1080P — 会员¥1.03/秒 普通¥1.23/秒</option>
                      </optgroup>
                      <optgroup label="其他">
                        <option value="ovi-i2v">Ovi 图生视频 — ¥1.78/次（固定）</option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* 比例选择 - 图片卡片 */}
            {cardType === 'image' && !['gpt-image-2', 'gpt-image-2-all'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">比例</label>
                <select
                  className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                  value={aspectRatio || '1:1'}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: { ...shape.props, aspectRatio: e.target.value },
                    });
                  }}
                >
                  <option value="1:1">1:1 正方形</option>
                  <option value="4:3">4:3 横图</option>
                  <option value="3:4">3:4 竖图</option>
                  <option value="16:9">16:9 宽屏</option>
                  <option value="9:16">9:16 竖屏</option>
                  <option value="3:2">3:2 横图</option>
                  <option value="2:3">2:3 竖图</option>
                  <option value="21:9">21:9 超宽</option>
                </select>
              </div>
            )}

            {/* GPT Image 2 尺寸选择 */}
            {cardType === 'image' && ['gpt-image-2', 'gpt-image-2-all'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">尺寸</label>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { value: '2048x1152', label: '16:9 2K', priceMedium: '¥0.7', priceHigh: '¥0.7' },
                    { value: '3840x2160', label: '16:9 4K', priceMedium: '¥1.5', priceHigh: '¥2.0' },
                    { value: '2160x3840', label: '9:16 4K', priceMedium: '¥1.5', priceHigh: '¥2.0' },
                    { value: '2048x2048', label: '1:1 2K',  priceMedium: '¥0.7', priceHigh: '¥1.0' },
                  ].map(({ value, label, priceMedium, priceHigh }) => (
                    <button key={value}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, aspectRatio: value } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(aspectRatio ?? '2048x1152') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                    >
                      <div>{label}</div>
                      <div className="text-[10px] opacity-70">{(imageQuality ?? 'medium') === 'high' ? priceHigh : priceMedium}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* GPT Image 2 画质选择 */}
            {cardType === 'image' && ['gpt-image-2', 'gpt-image-2-all'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">画质</label>
                <div className="flex gap-1">
                  {[
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ].map(({ value, label }) => (
                    <button key={value}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, imageQuality: value } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(imageQuality ?? 'medium') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 宫格布局 - 图片卡片（可选） */}
            {cardType === 'image' && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">分镜宫格</label>
                <div className="flex gap-1 flex-wrap">
                  {[
                    { value: '2x2', label: '2×2', panels: 4 },
                    { value: '3x3', label: '3×3', panels: 9 },
                    { value: '3x4', label: '3×4', panels: 12 },
                    { value: '4x4', label: '4×4', panels: 16 },
                    { value: '5x5', label: '5×5', panels: 25 },
                  ].map((opt) => (
                    <button key={opt.value}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, gridLayout: (gridLayout || '') === opt.value ? '' : opt.value } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${(gridLayout || '') === opt.value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 清晰度选择 - nano-banana-pro 和多图融合 */}
            {cardType === 'image' && ['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">清晰度</label>
                <div className="flex gap-1">
                  {[
                    { value: '2k', label: model === 'nano-banana-pro-multi' ? '2K — ¥1.5/次' : '2K — ¥1.2/次' },
                    { value: '4k', label: model === 'nano-banana-pro-multi' ? '4K — ¥2.5/次' : '4K — ¥1.5/次' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(imageQuality ?? '2k') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, imageQuality: value } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >{label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 图片上传 - 支持图生图的模型才显示 */}
            {cardType === 'image' && ['nano-banana', 'nano-banana-pro', 'nano-banana-pro-multi', 'gpt-image-2', 'gpt-image-2-all', 'doubao-seedream-4-5-251128', 'flux-kontext', 'mj_imagine'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">
                  {model === 'nano-banana-pro-multi'
                    ? '参考图片（必填，最多10张）'
                    : ['nano-banana', 'nano-banana-pro'].includes(model || '')
                    ? '参考图片（可选，最多2张）'
                    : model === 'flux-kontext' ? '参考图片（必填）' : '参考图片（可选）'}
                </label>

                {/* 多图融合模型：上传到 fal storage，存 URL */}
                {model === 'nano-banana-pro-multi' ? (
                  <>
                    {(() => {
                      const urls: string[] = uploadedImageUrls ? JSON.parse(uploadedImageUrls) : [];
                      return (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={urls.length >= 10 || isUploadingMulti}
                            className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer disabled:opacity-50"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              const remaining = 10 - urls.length;
                              const toUpload = files.slice(0, remaining);
                              if (toUpload.length === 0) return;
                              setIsUploadingMulti(true);
                              const newUrls = [...urls];
                              for (const file of toUpload) {
                                const url = await fal.storage.upload(file);
                                if (url) newUrls.push(url);
                              }
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: JSON.stringify(newUrls) } });
                              setIsUploadingMulti(false);
                              e.target.value = '';
                            }}
                          />
                          {isUploadingMulti && <p className="text-xs text-gray-400 mt-1">上传中...</p>}
                          {urls.length > 0 && (
                            <div className="mt-1 flex flex-col gap-2">
                              {urls.map((url, idx) => (
                                <div key={idx} className="relative w-full bg-black/30 rounded-xl overflow-hidden group"
                                  style={{ aspectRatio: uploadedImgRatios[idx] ?? '16/9' }}>
                                  <img src={url} className="w-full h-full object-cover"
                                    onLoad={(e) => {
                                      const el = e.currentTarget;
                                      setUploadedImgRatios(prev => ({ ...prev, [idx]: el.naturalHeight > el.naturalWidth ? '9/16' : '16/9' }));
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      className="px-3 py-1.5 bg-red-500/40 hover:bg-red-500/60 rounded-lg text-white text-xs transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const next = urls.filter((_, i) => i !== idx);
                                        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: next.length ? JSON.stringify(next) : '' } });
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >删除</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : ['nano-banana', 'nano-banana-pro'].includes(model || '') ? (
                  /* nano-banana-pro 走 fal storage URL，nano-banana 走 base64 */
                  <>
                    {(() => {
                      const imgs: string[] = uploadedImages ? JSON.parse(uploadedImages) : [];
                      const urls: string[] = uploadedImageUrls ? JSON.parse(uploadedImageUrls) : [];
                      return (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={model === 'nano-banana-pro' ? urls.length >= 2 || isUploadingMulti : imgs.length >= 2}
                            className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer disabled:opacity-50"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              if (model === 'nano-banana-pro') {
                                const existing = uploadedImageUrls ? JSON.parse(uploadedImageUrls) : [];
                                const remaining = 2 - existing.length;
                                const toUpload = files.slice(0, remaining);
                                if (toUpload.length === 0) return;
                                setIsUploadingMulti(true);
                                const newUrls = [...existing];
                                for (const file of toUpload) {
                                  try {
                                    const url = await fal.storage.upload(file);
                                    if (url) newUrls.push(url);
                                  } catch (err) {
                                    console.error('上传异常:', err);
                                  }
                                }
                                editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: JSON.stringify(newUrls) } });
                                setIsUploadingMulti(false);
                              } else {
                                // nano-banana：base64
                                const remaining = 2 - imgs.length;
                                const toLoad = files.slice(0, remaining);
                                let loaded = 0;
                                const newImgs = [...imgs];
                                toLoad.forEach(file => {
                                  const reader = new FileReader();
                                  reader.onload = async (ev) => {
                                    const compressed = await softCompressImage(ev.target?.result as string);
                                    newImgs.push(compressed);
                                    loaded++;
                                    if (loaded === toLoad.length) {
                                      editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImages: JSON.stringify(newImgs) } });
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                });
                              }
                              e.target.value = '';
                            }}
                          />
                          {model === 'nano-banana-pro' && isUploadingMulti && <p className="text-xs text-gray-400 mt-1">上传中...</p>}
                          {model === 'nano-banana-pro' && urls.length > 0 && (
                            <div className="mt-1 flex flex-col gap-2">
                              {urls.map((url, idx) => (
                                <div key={idx} className="relative w-full bg-black/30 rounded-xl overflow-hidden group"
                                  style={{ aspectRatio: uploadedImgRatios[idx] ?? '16/9' }}>
                                  <img src={url} className="w-full h-full object-cover"
                                    onLoad={(e) => {
                                      const el = e.currentTarget;
                                      setUploadedImgRatios(prev => ({ ...prev, [idx]: el.naturalHeight > el.naturalWidth ? '9/16' : '16/9' }));
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      className="px-3 py-1.5 bg-red-500/40 hover:bg-red-500/60 rounded-lg text-white text-xs transition-colors"
                                      onClick={(e) => { e.stopPropagation(); const next = urls.filter((_, i) => i !== idx); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: next.length ? JSON.stringify(next) : '' } }); }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >删除</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {model === 'nano-banana' && imgs.length > 0 && (
                            <div className="mt-1 flex flex-col gap-2">
                              {imgs.map((img, idx) => (
                                <div key={idx} className="relative w-full bg-black/30 rounded-xl overflow-hidden group"
                                  style={{ aspectRatio: uploadedImgRatios[idx] ?? '16/9' }}>
                                  <img src={img} className="w-full h-full object-cover"
                                    onLoad={(e) => {
                                      const el = e.currentTarget;
                                      setUploadedImgRatios(prev => ({ ...prev, [idx]: el.naturalHeight > el.naturalWidth ? '9/16' : '16/9' }));
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                      className="px-3 py-1.5 bg-red-500/40 hover:bg-red-500/60 rounded-lg text-white text-xs transition-colors"
                                      onClick={(e) => { e.stopPropagation(); const next = imgs.filter((_, i) => i !== idx); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImages: next.length ? JSON.stringify(next) : '' } }); }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >删除</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  /* 其他模型：单图上传 */
                  (() => {
                    const singleImgInputRef = { current: null as HTMLInputElement | null };
                    const effectiveImage = connectedGeneratedImage || uploadedImage;
                    const handleSingleFile = async (file: File) => {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        let imageData = event.target?.result as string;
                        if (model === 'mj_imagine') {
                          imageData = await softCompressImage(imageData);
                        }
                        // 检测宽高比
                        const img = new Image();
                        img.onload = () => {
                          setUploadedImageRatio(img.height > img.width ? '9/16' : '16/9');
                        };
                        img.src = imageData;
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: { ...shape.props, uploadedImage: imageData },
                        });
                      };
                      reader.readAsDataURL(file);
                    };
                    return (
                      <>
                        <input
                          ref={(el) => { singleImgInputRef.current = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) await handleSingleFile(file);
                            e.target.value = '';
                          }}
                        />
                        {effectiveImage ? (
                          <div
                            className="relative w-full bg-black/30 rounded-xl overflow-hidden group cursor-pointer"
                            style={{ aspectRatio: uploadedImageRatio }}
                            onClick={(e) => { e.stopPropagation(); if (!connectedGeneratedImage) singleImgInputRef.current?.click(); }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <img src={effectiveImage} alt="参考图" className="w-full h-full object-cover" />
                            {connectedGeneratedImage && (
                              <div className="absolute bottom-0 left-0 right-0 bg-blue-600/70 text-white text-[10px] text-center py-0.5">来自连接</div>
                            )}
                            {!connectedGeneratedImage && (
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                <button
                                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white text-xs transition-colors"
                                  onClick={(e) => { e.stopPropagation(); singleImgInputRef.current?.click(); }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >更换</button>
                                <button
                                  className="px-3 py-1.5 bg-red-500/40 hover:bg-red-500/60 rounded-lg text-white text-xs transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImage: '' } });
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >删除</button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className="w-full flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/15 rounded-xl cursor-pointer hover:border-white/30 hover:bg-white/3 transition-all"
                            style={{ aspectRatio: '16/9' }}
                            onClick={(e) => { e.stopPropagation(); singleImgInputRef.current?.click(); }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-500 text-xs">点击上传或连接图片卡片</span>
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            )}

            {/* 比例选择 - 视频卡片，根据模型动态显示 */}
            {cardType === 'video' && currentVideoModel && currentVideoModel.aspectRatios.length > 0 && !currentVideoModel.i2vNoAspectRatio && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">比例</label>
                <div className="flex gap-1 flex-wrap">
                  {currentVideoModel.aspectRatios.map((r) => (
                    <button
                      key={r}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${(aspectRatio ?? '16:9') === r ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, aspectRatio: r } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >{r}</button>
                  ))}
                </div>
              </div>
            )}

            {/* 图片上传 - 视频卡片，i2v 模型直接显示在外面 */}
            {cardType === 'video' && currentVideoModel?.mode === 'i2v' && (
              <div className="mb-2 space-y-2">
                {/* 首帧 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">
                    首帧图片（必填）{connFirstFrame && <span className="text-blue-400 ml-1">·来自连接</span>}
                  </label>
                  {!connFirstFrame && (
                    <input type="file" accept="image/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                        e.target.value = '';
                      }}
                    />
                  )}
                  {(connFirstFrame || firstFrameImage) && (
                    <div className="mt-1 relative w-full bg-black/30 rounded-lg overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                      <img src={connFirstFrame || firstFrameImage} className="w-full h-full object-cover" />
                      {!connFirstFrame && (
                        <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: '' } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >✕</button>
                      )}
                    </div>
                  )}
                </div>
                {/* 尾帧 - 仅 supportsEndFrame 模型显示 */}
                {currentVideoModel.supportsEndFrame && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      尾帧图片（可选）{connLastFrame && <span className="text-blue-400 ml-1">·来自连接</span>}
                    </label>
                    {!connLastFrame && (
                      <input type="file" accept="image/*"
                        className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                          e.target.value = '';
                        }}
                      />
                    )}
                    {(connLastFrame || lastFrameImage) && (
                      <div className="mt-1 relative w-full bg-black/30 rounded-lg overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                        <img src={connLastFrame || lastFrameImage} className="w-full h-full object-cover" />
                        {!connLastFrame && (
                          <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: '' } }); }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >✕</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 即梦运镜参数 */}
            {cardType === 'video' && model === 'jimeng-camera' && (
              <div className="mb-2 space-y-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">运镜模板</label>
                  <select
                    className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                    value={cameraTemplate ?? 'dynamic_orbit'}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, cameraTemplate: e.target.value } }); }}
                  >
                    <option value="hitchcock_dolly_in">希区柯克推进</option>
                    <option value="hitchcock_dolly_out">希区柯克拉远</option>
                    <option value="robo_arm">机械臂</option>
                    <option value="dynamic_orbit">动感环绕</option>
                    <option value="central_orbit">中心环绕</option>
                    <option value="crane_push">起重机</option>
                    <option value="quick_pull_back">超级拉远</option>
                    <option value="counterclockwise_swivel">逆时针回旋</option>
                    <option value="clockwise_swivel">顺时针回旋</option>
                    <option value="handheld">手持运镜</option>
                    <option value="rapid_push_pull">快速推拉</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">运镜强度</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'weak', label: '弱' },
                      { value: 'medium', label: '中' },
                      { value: 'strong', label: '强' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(cameraStrength ?? 'medium') === value ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                        onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, cameraStrength: value } }); }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* firstLastFrame 专属模型的首尾帧上传 */}
            {cardType === 'video' && currentVideoModel?.mode === 'firstLastFrame' && (
              <div className="mb-2 space-y-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">
                    首帧图片（必填）{connFirstFrame && <span className="text-blue-400 ml-1">·来自连接</span>}
                  </label>
                  {!connFirstFrame && (
                    <input type="file" accept="image/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                        e.target.value = '';
                      }}
                    />
                  )}
                  {(connFirstFrame || firstFrameImage) && (
                    <div className="mt-1 relative w-full bg-black/30 rounded-lg overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                      <img src={connFirstFrame || firstFrameImage} className="w-full h-full object-cover" />
                      {!connFirstFrame && (
                        <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: '' } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >✕</button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">
                    尾帧图片（必填）{connLastFrame && <span className="text-blue-400 ml-1">·来自连接</span>}
                  </label>
                  {!connLastFrame && (
                    <input type="file" accept="image/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                        e.target.value = '';
                      }}
                    />
                  )}
                  {(connLastFrame || lastFrameImage) && (
                    <div className="mt-1 relative w-full bg-black/30 rounded-lg overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                      <img src={connLastFrame || lastFrameImage} className="w-full h-full object-cover" />
                      {!connLastFrame && (
                        <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: '' } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >✕</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 视频模式控制按钮 - 仅视频卡片显示 */}
            {cardType === 'video' && (
              <button
                className="w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, showVideoModePanel: !showVideoModePanel } });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showVideoModePanel ? '收起参数设置 ▲' : '展开参数设置 ▼'}
              </button>
            )}


            {/* 视频模式面板 - 只含时长/清晰度/音频参数 */}
            {cardType === 'video' && showVideoModePanel && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                {currentVideoModel && currentVideoModel.durations.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">时长</label>
                    <div className="flex gap-1 flex-wrap">
                      {currentVideoModel.durations.map((dur) => (
                        <button key={dur}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${(videoDuration ?? currentVideoModel.durations[0]) === dur ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, videoDuration: dur } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >{dur}s</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 清晰度 */}
                {currentVideoModel && currentVideoModel.resolutions.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">清晰度</label>
                    <div className="flex gap-1 flex-wrap">
                      {currentVideoModel.resolutions.map((res) => (
                        <button key={res}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${(videoResolution ?? currentVideoModel.defaultResolution) === res ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, videoResolution: res } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >{res.toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 音频开关 */}
                {currentVideoModel?.supportsAudio && !currentVideoModel.audioBuiltIn && (
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">生成音频（更贵）</label>
                    <button
                      className={`relative w-10 h-5 rounded-full transition-colors ${videoGenerateAudio ? 'bg-blue-500' : 'bg-white/10'}`}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, videoGenerateAudio: !videoGenerateAudio } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${videoGenerateAudio ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
                {currentVideoModel?.audioBuiltIn && (
                  <p className="text-[10px] text-gray-500">该模型自带音频</p>
                )}
              </div>
            )}

            {/* 生成按钮 - 仅非角色/kling卡片显示 */}
            {cardType !== 'character' && cardType !== 'kling' && (
            <button
              className={`w-full py-2 mt-0 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${
                isGenerating
                  ? 'bg-gray-500 cursor-not-allowed'
                  : `hover:scale-[1.02] active:scale-[0.98] ${color.buttonBg}`
              }`}
              disabled={isGenerating}
              onClick={async (e) => {
                e.stopPropagation();

                if (cardType === 'text') {
                  // 文本生成逻辑 — 需要会员
                  if (!isMember) { setShowMemberModal(true); return; }
                  console.log('生成文本，模型:', model);
                  console.log('Prompt:', prompt);

                  // 设置生成中状态
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      textOutput: '',
                    },
                  });

                  try {
                    const response = await fetch('/api/chat', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: model || 'gpt-5.2',
                        prompt: prompt,
                        stream: false,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('API 调用失败');
                    }

                    const data = await response.json();

                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        textOutput: data.content,
                        isGenerating: false,
                      },
                    });
                  } catch (error) {
                    console.error('文本生成错误:', error);
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        textOutput: '生成失败，请重试',
                        isGenerating: false,
                      },
                    });
                  }
                } else if (cardType === 'image') {
                  // 图片生成逻辑
                  // 顺序：宫格（隐藏）→ 景别 → connectedPrompt → 用户输入
                  const shotPrompt = getShotCardPrompt();
                  const GRID_PROMPTS: Record<string, string> = {
                    '2x2': 'storyboard sheet, 2x2 grid layout, 4 panels in one image, all panels visible, clean panel borders, equal sized panels, storyboard contact sheet, multi-panel composition, not a single image, not full-frame illustration, each panel contains a different shot, grid enforced layout, overall image aspect ratio 16:9, each panel framed in widescreen 16:9 composition, cinematic framing inside each panel',
                    '3x3': 'storyboard sheet, 3x3 grid layout, 9 panels in one image, all panels visible, clean panel borders, equal sized panels, storyboard contact sheet, multi-panel composition, not a single image, not full-frame illustration, each panel contains a different shot, grid enforced layout, overall image aspect ratio 16:9, each panel framed in widescreen 16:9 composition, cinematic framing inside each panel',
                    '3x4': 'storyboard sheet, 3x4 grid layout, 12 panels in one image, all panels visible, clean panel borders, equal sized panels, storyboard contact sheet, multi-panel composition, not a single image, not full-frame illustration, each panel contains a different shot, grid enforced layout, overall image aspect ratio 16:9, each panel framed in widescreen 16:9 composition, cinematic framing inside each panel',
                    '4x4': 'storyboard sheet, 4x4 grid layout, 16 panels in one image, all panels visible, clean panel borders, equal sized panels, storyboard contact sheet, multi-panel composition, not a single image, not full-frame illustration, each panel contains a different shot, grid enforced layout, overall image aspect ratio 16:9, each panel framed in widescreen 16:9 composition, cinematic framing inside each panel',
                  };
                  const gridPrompt = gridLayout ? GRID_PROMPTS[gridLayout] : '';
                  const fullPrompt = [gridPrompt, shotPrompt, connectedPrompt, prompt].filter(Boolean).join('\n');
                  console.log('生成图片，完整Prompt:', fullPrompt);
                  console.log('模型:', model);
                  console.log('上传的图片:', uploadedImage ? '已上传' : '未上传');

                  // 设置生成中状态
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      generationProgress: 10,
                      generationStatus: '生成图片中...',
                    },
                  });

                  try {
                    // GPT Image 2 单独处理
                    if (['gpt-image-2', 'gpt-image-2-all'].includes(model || '')) {
                      const imgs: string[] = uploadedImages ? JSON.parse(uploadedImages) : [];

                      let imagesToSend: string[] = [];
                      if (connectedGeneratedImage) {
                        const isBase64 = connectedGeneratedImage.startsWith('data:');
                        const raw = isBase64 ? connectedGeneratedImage : await fetch(connectedGeneratedImage).then(r => r.blob()).then(b => new Promise<string>(res => { const rd = new FileReader(); rd.onload = () => res(rd.result as string); rd.readAsDataURL(b); }));
                        imagesToSend.push(await softCompressImage(raw));
                      }
                      if (imgs.length > 0) {
                        for (const img of imgs) {
                          imagesToSend.push(await softCompressImage(img));
                        }
                      }

                      const res = await fetch('/api/image/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          model: model,
                          prompt: fullPrompt,
                          aspectRatio: aspectRatio || '2048x1152',
                          imageQuality: imageQuality || 'medium',
                          imageBase64Array: imagesToSend.length > 0 ? imagesToSend : undefined,
                          userId: userId || undefined,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || '生成失败');

                      if (data.pending && data.requestId) {
                        // fal 异步，走轮询
                        editor.updateShape({
                          id: shape.id, type: 'custom-card' as any,
                          props: { ...shape.props, generationProgress: 20, generationStatus: '排队中...' },
                        });
                        let pollAttempts = 0;
                        const falEndpoint = data.endpoint || 'openai/gpt-image-2/edit';
                        const poll = async (): Promise<string> => {
                          pollAttempts++;
                          await new Promise(r => setTimeout(r, 3000));
                          const progress = Math.min(20 + pollAttempts * 5, 90);
                          const currentShape = editor.getShape(shape.id) as any;
                          if (currentShape) {
                            editor.updateShape({
                              id: shape.id, type: 'custom-card' as any,
                              props: { ...currentShape.props, generationProgress: progress, generationStatus: '生成中...' },
                            });
                          }
                          try {
                            const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(falEndpoint)}`);
                            const qData = await qRes.json();
                            if (qData.success && qData.imageUrl) return qData.imageUrl;
                            if (qData.error) throw new Error(qData.error);
                            if (pollAttempts > 60) throw new Error('生成超时');
                            return poll();
                          } catch (e: any) {
                            if (e.message && (e.message.includes('超时') || e.message.includes('error'))) throw e;
                            if (pollAttempts > 60) throw new Error('生成超时');
                            await new Promise(r => setTimeout(r, 5000));
                            return poll();
                          }
                        };
                        const pollResult = await poll();
                        editor.updateShape({
                          id: shape.id, type: 'custom-card' as any,
                          props: { ...shape.props, generatedImage: pollResult, isGenerating: false, generationProgress: 100, generationStatus: '生成完成' },
                        });
                      } else {
                        editor.updateShape({
                          id: shape.id, type: 'custom-card' as any,
                          props: { ...shape.props, generatedImage: data.imageUrl, isGenerating: false, generationProgress: 100, generationStatus: '生成完成' },
                        });
                      }
                      await refreshBalance();
                      return;
                    }

                    // 连接图片用 prepareImageForModel 处理，手动上传的图片保持原有逻辑
                    // 连接图片按模型处理
                    let connImageBase64: string | undefined;
                    let connImageBase64Array: string[] | undefined;
                    let connImageUrlArray: string[] | undefined;

                    if (connectedGeneratedImage) {
                      const connImg = connectedGeneratedImage;
                      const isBase64 = connImg.startsWith('data:');
                      if (['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '')) {
                        // 需要 fal URL
                        if (isBase64) {
                          const blob = await fetch(connImg).then(r => r.blob());
                          const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
                          const url = await fal.storage.upload(file);
                          connImageUrlArray = [url];
                        } else {
                          connImageUrlArray = [connImg];
                        }
                      } else if (model === 'nano-banana') {
                        // 需要 base64 数组
                        if (isBase64) {
                          const compressed = await softCompressImage(connImg);
                          connImageBase64Array = [compressed];
                        } else {
                          const blob = await fetch(connImg).then(r => r.blob());
                          const base64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
                          connImageBase64Array = [await softCompressImage(base64)];
                        }
                      } else {
                        // flux-kontext, doubao, mj 等：base64
                        if (isBase64) {
                          connImageBase64 = await softCompressImage(connImg);
                        } else {
                          const blob = await fetch(connImg).then(r => r.blob());
                          const base64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
                          connImageBase64 = await softCompressImage(base64);
                        }
                      }
                    }

                    const response = await fetch('/api/image/generate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: model || 'nano-banana-pro',
                        prompt: fullPrompt,
                        aspectRatio: aspectRatio || '1:1',
                        imageBase64: connectedGeneratedImage ? connImageBase64 : (uploadedImage || undefined),
                        imageBase64Array: connectedGeneratedImage ? connImageBase64Array : (model === 'nano-banana' && uploadedImages ? JSON.parse(uploadedImages) : undefined),
                        imageUrlArray: connectedGeneratedImage ? connImageUrlArray : (['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '') && uploadedImageUrls ? JSON.parse(uploadedImageUrls) : undefined),
                        imageQuality: ['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '') ? (imageQuality ?? '2k') : undefined,
                        userId: userId || undefined,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('API 调用失败');
                    }

                    const data = await response.json();

                    // MJ 异步模式：轮询查询结果
                    if (data.pending && data.taskId) {
                      const mjPoll = async (): Promise<string> => {
                        await new Promise(r => setTimeout(r, 3000));
                        const qRes = await fetch(`/api/image/mj-query?taskId=${encodeURIComponent(data.taskId)}`);
                        const qData = await qRes.json();
                        if (qData.status === 'completed' && qData.imageUrl) return qData.imageUrl;
                        if (qData.status === 'failed') throw new Error(qData.error || 'MJ 生成失败');
                        return mjPoll();
                      };
                      data.imageUrl = await mjPoll();
                    }

                    // fal 异步模式：轮询查询结果
                    if (data.pending && data.requestId) {
                      const hasImages = uploadedImageUrls && JSON.parse(uploadedImageUrls).length > 0;
                      const falEndpointMap: Record<string, string> = {
                        'flux-kontext': 'fal-ai/flux-pro/kontext/max',
                        'flux-kontext-max': 'fal-ai/flux-pro/kontext/max/text-to-image',
                        'nano-banana-pro': hasImages ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2',
                        'nano-banana-pro-multi': 'fal-ai/nano-banana-pro/edit',
                      };
                      const falEndpoint = falEndpointMap[data.model] || 'fal-ai/nano-banana-2';
                      let falPollAttempts = 0;
                      const falPoll = async (): Promise<string> => {
                        falPollAttempts++;
                        await new Promise(r => setTimeout(r, 3000));
                        try {
                          const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(falEndpoint)}`);
                          const qData = await qRes.json();
                          if (qData.success && qData.imageUrl) return qData.imageUrl;
                          if (qData.error) throw new Error(qData.error);
                          if (falPollAttempts > 60) throw new Error('生成超时');
                          return falPoll();
                        } catch (e: any) {
                          if (e.message && (e.message.includes('超时') || e.message.includes('error'))) throw e;
                          if (falPollAttempts > 60) throw new Error('生成超时');
                          await new Promise(r => setTimeout(r, 5000));
                          return falPoll();
                        }
                      };
                      data.imageUrl = await falPoll();
                    }

                    // 先立即显示图片，不等上传
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        generatedImage: data.imageUrl,
                        showImageOutput: true,
                        isGenerating: false,
                      },
                    });
                    refreshBalance();

                    // 后台异步上传到 Supabase Storage，完成后替换为永久 URL
                    try {
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user && data.imageUrl) {
                        const permanentUrl = await mirrorUrlToStorage(user.id, data.imageUrl, 'image');
                        const latest = editor.getShape(shape.id);
                        if (latest) {
                          editor.updateShape({
                            id: shape.id,
                            type: 'custom-card' as any,
                            props: { ...(latest.props as any), generatedImage: permanentUrl },
                          });
                        }
                      }
                    } catch (uploadErr) {
                      console.warn('上传到 Storage 失败，保留原始 URL:', uploadErr);
                    }
                  } catch (error) {
                    console.error('图片生成错误:', error);
                    // fal 异步失败时退款
                    if (userId && ['nano-banana-pro', 'nano-banana-pro-multi', 'flux-kontext', 'flux-kontext-max'].includes(model || '')) {
                      fetch('/api/image/refund', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, model, imageQuality }),
                      }).catch(() => {});
                    }
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: { ...shape.props, isGenerating: false },
                    });
                    alert('图片生成失败，请重试');
                  }
                } else if (cardType === 'video') {
                  // 视频生成逻辑
                  const shotPrompt = getShotCardPrompt();
                  const videoPrompt = [shotPrompt, connectedPrompt, prompt].filter(Boolean).join('\n');
                  console.log('生成视频，模式:', videoMode || 'text');
                  console.log('Prompt:', videoPrompt);
                  console.log('模型:', model);

                  // 设置生成中状态
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      generationProgress: 5,
                      generationStatus: '提交任务中...',
                    },
                  });

                  try {
                    // 压缩图片到 1.5MB 以内
                    const compressImage = (base64: string | null | undefined, maxBytes = 1.5 * 1024 * 1024): Promise<string | null | undefined> => {
                      if (!base64 || !base64.startsWith('data:')) return Promise.resolve(base64);
                      return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                          let w = img.naturalWidth;
                          let h = img.naturalHeight;
                          let quality = 0.85;
                          const canvas = document.createElement('canvas');
                          const tryCompress = () => {
                            canvas.width = w;
                            canvas.height = h;
                            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
                            const result = canvas.toDataURL('image/jpeg', quality);
                            const bytes = (result.length - result.indexOf(',') - 1) * 0.75;
                            if (bytes <= maxBytes || quality <= 0.3) {
                              resolve(result);
                            } else {
                              quality -= 0.1;
                              tryCompress();
                            }
                          };
                          tryCompress();
                        };
                        img.src = base64;
                      });
                    };

                    const needsStart = currentVideoModel?.mode === 'i2v' || currentVideoModel?.mode === 'firstLastFrame';
                    const needsEnd = currentVideoModel?.mode === 'firstLastFrame' || currentVideoModel?.supportsEndFrame;
                    const effectiveFirstFrame = connFirstFrame || firstFrameImage;
                    const effectiveLastFrame = connLastFrame || lastFrameImage;
                    const [compressedStart, compressedEnd] = await Promise.all([
                      needsStart ? compressImage(effectiveFirstFrame) : Promise.resolve(undefined),
                      needsEnd ? compressImage(effectiveLastFrame) : Promise.resolve(undefined),
                    ]);

                    // 调用视频生成 API
                    const response = await fetch('/api/video/generate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        prompt: videoPrompt,
                        model: model || 'veo3.1-fast-t2v',
                        aspectRatio: aspectRatio || '16:9',
                        duration: videoDuration ?? 5,
                        resolution: videoResolution ?? '720p',
                        generateAudio: videoGenerateAudio ?? false,
                        startFrameImage: needsStart ? compressedStart : undefined,
                        endFrameImage: needsEnd ? compressedEnd : undefined,
                        cameraTemplate: model === 'jimeng-camera' ? (cameraTemplate ?? 'dynamic_orbit') : undefined,
                        cameraStrength: model === 'jimeng-camera' ? (cameraStrength ?? 'medium') : undefined,
                        userId: userId || undefined,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('视频生成请求失败');
                    }

                    const data = await response.json();
                    const taskId = data.taskId;
                    const videoEndpoint = data.endpoint;

                    // 获取 token 用于轮询鉴权
                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const authToken = session?.access_token || '';

                    // 轮询查询视频状态
                    const maxAttempts = 60;
                    let attempts = 0;

                    const poll = async (): Promise<void> => {
                      if (attempts >= maxAttempts) {
                        throw new Error('视频生成超时，请稍后重试');
                      }

                      attempts++;
                      await new Promise(resolve => setTimeout(resolve, 5000));

                      const queryResponse = await fetch(`/api/video/query?taskId=${encodeURIComponent(taskId)}&endpoint=${encodeURIComponent(videoEndpoint)}`, {
                        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                      });
                      if (!queryResponse.ok) return poll();

                      const queryData = await queryResponse.json();

                      // 用 getShape 获取最新 props，避免闭包旧值覆盖 isGenerating
                      const latestShape = editor.getShape(shape.id);
                      if (!latestShape) return;
                      const latestProps = (latestShape as any).props;

                      // 更新进度
                      const progress = queryData.progress || 30;
                      const statusText = queryData.status === 'pending' ? '排队中...' : queryData.status === 'processing' ? '生成中...' : '处理中...';
                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: {
                          ...latestProps,
                          generationProgress: progress,
                          generationStatus: statusText,
                        },
                      });

                      if (queryData.status === 'completed' && queryData.videoUrl) {
                        const finalVideoUrl = queryData.videoUrl;
                        const latestShape2 = editor.getShape(shape.id);
                        const latestProps2 = latestShape2 ? (latestShape2 as any).props : latestProps;

                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: {
                            ...latestProps2,
                            generatedVideo: finalVideoUrl,
                            showVideoOutput: true,
                            isGenerating: false,
                            generationProgress: 100,
                            generationStatus: '生成完成',
                          },
                        });
                        refreshBalance();
                      } else if (queryData.status === 'failed') {
                        throw new Error('视频生成失败');
                      } else {
                        return poll();
                      }
                    };

                    await poll();

                  } catch (error) {
                    console.error('视频生成错误:', error);
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        isGenerating: false,
                      },
                    });
                    alert('视频生成失败，请重试');
                  }
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </div>
              ) : (
                'Generate'
              )}
            </button>
            )}

            {/* 生成进度条 */}
            {isGenerating && generationProgress !== undefined && generationProgress > 0 && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">生成进度</span>
                  <span className="text-xs text-gray-300 font-semibold">{generationProgress}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-gray-400 to-white transition-all duration-500"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                {generationStatus && (
                  <p className="text-xs text-gray-500 mt-2">{generationStatus}</p>
                )}
              </div>
            )}

            {/* 图片输出按钮 - 仅图片卡片显示 */}
            {cardType === 'image' && generatedImage && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
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
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
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
                        setLightboxVideo(generatedImage);
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
                        downloadFile(generatedImage, `generated-${Date.now()}.png`);
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
                      className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
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
                    <p className="text-white text-[10px] truncate">生成成功</p>
                  </div>
                </div>
              </div>
            )}

            {/* 视频输出按钮 - 仅视频卡片显示 */}
            {cardType === 'video' && generatedVideo && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-yellow-400/80 to-yellow-500/80 hover:from-yellow-400 hover:to-yellow-500"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
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
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                <div className="relative group" style={{ minHeight: '200px' }}>
                  {/* 生成的视频播放器 */}
                  <video
                    ref={videoRef}
                    src={generatedVideo}
                    controls
                    crossOrigin="anonymous"
                    className="w-full bg-black"
                    style={{ minHeight: '200px', maxHeight: '250px' }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    您的浏览器不支持视频播放
                  </video>

                  {/* 悬停时显示的操作按钮 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 保存当前帧按钮 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        captureCurrentFrame();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="保存当前帧"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    {/* 全屏播放按钮 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxVideo(generatedVideo);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="放大播放"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>

                    {/* 下载视频按钮 */}
                    <button
                      className="p-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(generatedVideo, `generated-video-${Date.now()}.mp4`);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="下载视频"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>

                    {/* 删除视频按钮 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
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
                      生成成功 · {videoMode === 'text' ? '文本生成' : videoMode === 'first-frame' ? '首帧生成' : '首尾帧生成'}
                    </p>
                  </div>
                </div>

                {/* 捕获的帧图片显示 */}
                {capturedFrame && (
                  <div className="mt-2 bg-black/40 border border-purple-500/30 rounded-lg overflow-hidden">
                    <div className="p-2 bg-purple-500/10 border-b border-purple-500/20">
                      <p className="text-purple-400 text-[10px] font-semibold">捕获的视频帧</p>
                    </div>
                    <div className="relative group">
                      <img
                        src={capturedFrame}
                        alt="Captured Frame"
                        className="w-full h-auto max-h-[200px] object-contain bg-black/20"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* 悬停时显示的操作按钮 */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* 查看大图按钮 */}
                        <button
                          className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxVideo(capturedFrame);
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
                            downloadFile(capturedFrame, `video-frame-${Date.now()}.png`);
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
                          className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: {
                                ...shape.props,
                                capturedFrame: '',
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
                        <p className="text-white text-[10px] truncate">已保存视频帧</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Kling 卡片内容 */}
            {cardType === 'kling' && (
              <div className="flex flex-col gap-2 flex-1">
                {/* 模式切换 */}
                <div className="flex gap-1 bg-black/20 rounded-lg p-1">
                  {(['motion-control', 'lip-sync'] as const).map((m) => (
                    <button key={m}
                      className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${(klingMode || 'motion-control') === m ? 'bg-gray-600/80 text-white' : 'text-gray-400 hover:text-gray-300'}`}
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingMode: m, klingVideoUrl: '', klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '' } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >{m === 'motion-control' ? '运动控制' : '对口型'}</button>
                  ))}
                </div>

                {/* 运动控制模式 */}
                {(klingMode || 'motion-control') === 'motion-control' && (<>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">提示词（可选）</label>
                    <textarea className="w-full h-14 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                      placeholder="让图片的人像视频一样..."
                      value={localPrompt}
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onCompositionStart={() => { isComposing.current = true; }}
                      onCompositionEnd={(e) => {
                        isComposing.current = false;
                        const v = (e.target as HTMLTextAreaElement).value;
                        setLocalPrompt(v);
                        updateShapeDebounced({ prompt: v });
                      }}
                      onChange={(e) => {
                        setLocalPrompt(e.target.value);
                        if (!isComposing.current) updateShapeDebounced({ prompt: e.target.value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      参考图（必填）{connectedGeneratedImage && <span className="text-blue-400 ml-1">·来自连接</span>}
                    </label>
                    {!connectedGeneratedImage && (
                      <input type="file" accept="image/*"
                        className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600/70 file:text-white hover:file:bg-blue-600 file:cursor-pointer"
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const r = new FileReader();
                          r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingImage: ev.target?.result as string } });
                          r.readAsDataURL(file); e.target.value = '';
                        }}
                      />
                    )}
                    {(connectedGeneratedImage || klingImage) && (
                      <div className="mt-1 relative w-full bg-black/30 rounded-lg overflow-hidden group" style={{ aspectRatio: '16/9' }}>
                        <img src={connectedGeneratedImage || klingImage} className="w-full h-full object-cover" />
                        {!connectedGeneratedImage && (
                          <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingImage: '' } }); }}
                            onPointerDown={(e) => e.stopPropagation()}>✕</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      动作视频（必填）{connectedGeneratedVideo && <span className="text-blue-400 ml-1">·来自连接</span>}
                    </label>
                    {connectedGeneratedVideo ? (
                      <div className="bg-black/20 border border-blue-500/30 rounded-lg p-2">
                        <span className="text-blue-300 text-xs break-all line-clamp-2">{connectedGeneratedVideo}</span>
                      </div>
                    ) : (
                      <>
                        <input type="file" accept="video/mp4,video/quicktime"
                          className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600/70 file:text-white hover:file:bg-blue-600 file:cursor-pointer"
                          onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            await handleKlingVideoUpload(file); e.target.value = '';
                          }}
                        />
                        {klingVideoName && (
                          <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                            <span className="text-gray-300 text-xs truncate flex-1">{klingVideoName}</span>
                            <button className="text-gray-500 hover:text-red-400 text-xs"
                              onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoUrl: '', klingVideoName: '' } }); }}
                              onPointerDown={(e) => e.stopPropagation()}>✕</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    className="w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                    onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingShowSettingsPanel: !klingShowSettingsPanel } }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{klingShowSettingsPanel ? '收起参数设置 ▲' : '展开参数设置 ▼'}</button>
                  <button
                    className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98]'}`}
                    disabled={isGenerating}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!(connectedGeneratedImage || klingImage)) { alert('请上传或连接参考图'); return; }
                      if (!(connectedGeneratedVideo || klingVideoUrl)) { alert('请上传或连接动作视频'); return; }
                      editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, isGenerating: true, generationStatus: '提交中...', generationProgress: 0 } });
                      try {
                        const res = await fetch('/api/kling/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                          mode: 'motion-control', prompt: prompt || '',
                          image_url: connectedGeneratedImage || klingImage, video_url: connectedGeneratedVideo || klingVideoUrl,
                          keep_original_sound: klingKeepSound || 'no',
                          character_orientation: klingCharacterOrientation || 'image',
                          videoMode: klingVideoMode || 'std',
                          model_name: model || 'kling-v2-master',
                        }) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || '生成失败');
                        const taskId = data.taskId;
                        let attempts = 0;
                        const poll = async () => {
                          attempts++;
                          try {
                            const qRes = await fetch(`/api/kling/query?taskId=${taskId}&mode=motion-control`);
                            const qData = await qRes.json();
                            const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                            if (qData.status === 'completed' && qData.videoUrl) {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, klingGeneratedVideo: qData.videoUrl, generationProgress: 100, generationStatus: '完成' } });
                            } else if (qData.status === 'failed') {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: '生成失败' } });
                            } else if (attempts < 60) {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, generationStatus: '生成中...', generationProgress: Math.min(90, attempts * 2) } });
                              setTimeout(poll, 5000);
                            } else {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: '超时' } });
                            }
                          } catch (e) {
                            if (attempts < 60) {
                              const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, generationStatus: '网络重试中...' } });
                              setTimeout(poll, 8000);
                            }
                          }
                        };
                        setTimeout(poll, 5000);
                      } catch (err: any) {
                        const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: err?.message || '失败' } });
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{isGenerating ? (generationStatus || '生成中...') : 'Generate'}</button>
                </>)}

                {/* 对口型模式 */}
                {klingMode === 'lip-sync' && (<>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">
                      源视频 URL{connectedGeneratedVideo && <span className="text-blue-400 ml-1">·来自连接</span>}
                    </label>
                    {connectedGeneratedVideo ? (
                      <div className="bg-black/20 border border-blue-500/30 rounded-lg p-2">
                        <span className="text-blue-300 text-xs break-all">{connectedGeneratedVideo}</span>
                      </div>
                    ) : (
                      <input className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-500"
                        placeholder="https://..."
                        value={localKlingVideoUrl && !klingVideoName ? localKlingVideoUrl : ''}
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setLocalKlingVideoUrl(e.target.value);
                          if (!isComposing.current) updateShapeDebounced({ klingVideoUrl: e.target.value, klingVideoName: '' });
                        }}
                      />
                    )}
                  </div>
                  {!connectedGeneratedVideo && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">或上传视频（mp4/mov ≤100MB）</label>
                      <input type="file" accept="video/mp4,video/quicktime"
                        className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600/70 file:text-white hover:file:bg-blue-600 file:cursor-pointer"
                        onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          await handleKlingVideoUpload(file); e.target.value = '';
                        }}
                      />
                      {klingVideoName && (
                        <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                          <span className="text-gray-300 text-xs truncate flex-1">{klingVideoName}</span>
                          <button className="text-gray-500 hover:text-red-400 text-xs"
                            onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoUrl: '', klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '' } }); }}
                            onPointerDown={(e) => e.stopPropagation()}>✕</button>
                        </div>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">音频（mp3/wav/m4a 2-60秒）</label>
                    <input type="file" accept="audio/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600/70 file:text-white hover:file:bg-blue-600 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncAudio: ev.target?.result as string, klingLipSyncAudioName: file.name } });
                        reader.readAsDataURL(file); e.target.value = '';
                      }}
                    />
                    {klingLipSyncAudio && (
                      <div className="mt-1 flex items-center gap-2 bg-black/20 border border-white/10 rounded p-1">
                        <span className="text-gray-300 text-xs truncate flex-1">{klingLipSyncAudioName || '已上传'}</span>
                        <button className="text-gray-500 hover:text-red-400 text-xs"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncAudio: '', klingLipSyncAudioName: '' } }); }}
                          onPointerDown={(e) => e.stopPropagation()}>x</button>
                      </div>
                    )}
                  </div>
                  <button
                    className="w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                    onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingShowSettingsPanel: !klingShowSettingsPanel } }); }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{klingShowSettingsPanel ? '收起参数设置 ▲' : '展开参数设置 ▼'}</button>
                  <button
                    className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98]'}`}
                    disabled={isGenerating}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!(connectedGeneratedVideo || klingVideoUrl)) { alert('请上传或连接视频'); return; }
                      if (!klingLipSyncAudio) { alert('请上传音频'); return; }
                      const effectiveVideoUrl = connectedGeneratedVideo || klingVideoUrl;
                      editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, isGenerating: true, generationStatus: '识别人脸中...', generationProgress: 5 } });
                      try {
                        // 第一步：人脸识别
                        const faceRes = await fetch('/api/kling/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'identify-face', video_url: effectiveVideoUrl }) });
                        const faceData = await faceRes.json();
                        if (!faceRes.ok) throw new Error(faceData?.error || '人脸识别失败');
                        const sessionId = faceData.sessionId;
                        const faceId = faceData.faceId || '-1';
                        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, isGenerating: true, klingLipSyncSessionId: sessionId, klingLipSyncFaceId: faceId, generationStatus: '提交生成中...', generationProgress: 20 } });
                        // 第二步：生成对口型
                        const res = await fetch('/api/kling/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                          mode: 'advanced-lip-sync',
                          session_id: sessionId,
                          face_id: faceId,
                          sound_file: klingLipSyncAudio,
                          sound_start_time: klingLipSyncSoundStart ?? 0,
                          sound_end_time: klingLipSyncSoundEnd ?? 5000,
                          sound_insert_time: klingLipSyncSoundInsert ?? 0,
                          sound_volume: klingLipSyncSoundVolume ?? 1,
                          original_audio_volume: klingLipSyncOriginalVolume ?? 1,
                        }) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data?.error || '生成失败');
                        const taskId = data.taskId;
                        let attempts = 0;
                        const poll = async () => {
                          attempts++;
                          try {
                            const qRes = await fetch(`/api/kling/query?taskId=${taskId}&mode=lip-sync`);
                            const qData = await qRes.json();
                            const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                            if (qData.status === 'completed' && qData.videoUrl) {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, klingGeneratedVideo: qData.videoUrl, generationProgress: 100, generationStatus: '完成' } });
                            } else if (qData.status === 'failed') {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: '生成失败' } });
                            } else if (attempts < 60) {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, generationStatus: '生成中...', generationProgress: Math.min(90, 20 + attempts * 2) } });
                              setTimeout(poll, 5000);
                            } else {
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: '超时' } });
                            }
                          } catch (e) {
                            if (attempts < 60) {
                              const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, generationStatus: '网络重试中...' } });
                              setTimeout(poll, 8000);
                            }
                          }
                        };
                        setTimeout(poll, 5000);
                      } catch (err: any) {
                        const ls = editor.getShape(shape.id); const lp = ls ? (ls as any).props : shape.props;
                        editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...lp, isGenerating: false, generationStatus: err?.message || '失败' } });
                      }
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >{isGenerating ? (generationStatus || '生成中...') : 'Generate'}</button>
                </>)}

                {/* 进度条 */}
                {isGenerating && (
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div className="bg-blue-400 h-1 rounded-full transition-all" style={{ width: `${generationProgress || 0}%` }} />
                  </div>
                )}

                {/* 视频输出面板 - 卡片内部，overflow-visible 溢出显示 */}
                {klingGeneratedVideo && (
                  <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                    <div className="relative group" style={{ minHeight: '180px' }}>
                      <video
                        ref={videoRef}
                        src={klingGeneratedVideo}
                        controls
                        crossOrigin="anonymous"
                        className="w-full bg-black"
                        style={{ minHeight: '180px', maxHeight: '250px' }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="保存当前帧"
                          onClick={(e) => { e.stopPropagation(); captureCurrentFrame(); }} onPointerDown={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="放大播放"
                          onClick={(e) => { e.stopPropagation(); setLightboxVideo(klingGeneratedVideo); }} onPointerDown={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                        <button className="p-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white transition-all" title="下载视频"
                          onClick={(e) => { e.stopPropagation(); downloadFile(klingGeneratedVideo, 'kling-video.mp4'); }} onPointerDown={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all" title="删除视频"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingGeneratedVideo: '' } }); }} onPointerDown={(e) => e.stopPropagation()}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                        <p className="text-white text-[10px] truncate">生成成功 · Kling 视频</p>
                      </div>
                    </div>
                    {capturedFrame && (
                      <div className="mt-2 bg-black/40 border border-purple-500/30 rounded-lg overflow-hidden">
                        <div className="p-2 bg-purple-500/10 border-b border-purple-500/20">
                          <p className="text-purple-400 text-[10px] font-semibold">捕获的视频帧</p>
                        </div>
                        <div className="relative group">
                          <img src={capturedFrame} alt="Captured Frame" className="w-full h-auto max-h-[200px] object-contain bg-black/20" onClick={(e) => e.stopPropagation()} />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition-all"
                              onClick={(e) => { e.stopPropagation(); setLightboxVideo(capturedFrame); }} onPointerDown={(e) => e.stopPropagation()}>查看</button>
                            <button className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold transition-all"
                              onClick={(e) => { e.stopPropagation(); downloadFile(capturedFrame, `kling-frame-${Date.now()}.png`); }} onPointerDown={(e) => e.stopPropagation()}>下载</button>
                            <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold transition-all"
                              onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, capturedFrame: '' } }); }} onPointerDown={(e) => e.stopPropagation()}>删除</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Kling 展开参数面板 */}
            {cardType === 'kling' && klingShowSettingsPanel && (
          <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
            {(klingMode || 'motion-control') === 'motion-control' && (<>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">版本</label>
                  <select className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={model || 'kling-v2-master'}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, model: e.target.value } })}>
                    <option value="kling-v2-master">V2.6 (720p std 0.9/秒，1080p pro 1.5/秒)</option>
                    <option value="kling-v3-master">V3.0 (720p std 1.6/秒，1080p pro 2.1/秒)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">质量</label>
                  <select className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={klingVideoMode || 'std'}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoMode: e.target.value } })}>
                    <option value="std">Std (720p)</option>
                    <option value="pro">Pro (1080p)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">人物朝向</label>
                  <select className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={klingCharacterOrientation || 'image'}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingCharacterOrientation: e.target.value } })}>
                    <option value="image">与图片一致</option>
                    <option value="video">与视频一致</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="kling-keep-sound" className="w-3 h-3"
                    checked={(klingKeepSound || 'no') === 'yes'}
                    onChange={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingKeepSound: e.target.checked ? 'yes' : 'no' } }); }}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} />
                  <label htmlFor="kling-keep-sound" className="text-gray-400 text-xs cursor-pointer" onClick={(e) => e.stopPropagation()}>保留原声</label>
                </div>
              </div>
            </>)}
            {klingMode === 'lip-sync' && (<>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Face ID（自动填充，可手动改）</label>
                <input className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                  value={localKlingLipSyncFaceId}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setLocalKlingLipSyncFaceId(e.target.value);
                    if (!isComposing.current) updateShapeDebounced({ klingLipSyncFaceId: e.target.value });
                  }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">开始(ms)</label>
                  <input type="number" className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={klingLipSyncSoundStart ?? 0}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundStart: parseInt(e.target.value) || 0 } })} />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">结束(ms)</label>
                  <input type="number" className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={klingLipSyncSoundEnd ?? 5000}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundEnd: parseInt(e.target.value) || 5000 } })} />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">插入(ms)</label>
                  <input type="number" className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none transition-all"
                    value={klingLipSyncSoundInsert ?? 0}
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundInsert: parseInt(e.target.value) || 0 } })} />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">音频音量 ({klingLipSyncSoundVolume ?? 1})</label>
                <input type="range" min="0" max="2" step="0.1" className="w-full"
                  value={klingLipSyncSoundVolume ?? 1}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundVolume: parseFloat(e.target.value) } })} />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">原声音量 ({klingLipSyncOriginalVolume ?? 1})</label>
                <input type="range" min="0" max="2" step="0.1" className="w-full"
                  value={klingLipSyncOriginalVolume ?? 1}
                  onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncOriginalVolume: parseFloat(e.target.value) } })} />
              </div>
            </>)}
          </div>
        )}
            {/* 文本输出区域 */}
            {cardType === 'text' && (
              <div className="mt-2 bg-black/30 border border-white/8 rounded-lg min-h-[80px] max-h-[300px] overflow-y-auto">
                {textOutput && !isGenerating && (
                  <div className="flex justify-end px-2 pt-1.5">
                    <button
                      className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(textOutput); alert('已复制到剪贴板'); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >复制</button>
                  </div>
                )}
                <div className="px-3 pb-3 pt-1">
                {isGenerating ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                ) : textOutput ? (
                  <p className="text-white text-xs whitespace-pre-wrap leading-relaxed">{textOutput}</p>
                ) : (
                  <p className="text-gray-500 text-xs text-center">Text output will appear here...</p>
                )}
                </div>
              </div>
            )}
          </div>
          )}
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
