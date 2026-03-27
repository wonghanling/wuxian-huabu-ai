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
import { createClient } from '@/lib/supabase/client';
import { mirrorUrlToStorage } from '@/lib/canvas-storage';
import { useMembership } from '@/lib/useMembership';
import MembershipModal from './MembershipModal';

// Helper function to update custom card shape (bypasses TypeScript type checking)
const updateCustomCardShape = (editor: Editor, id: string, props: any) => {
  (editor.updateShape as any)({
    id,
    type: 'custom-card' as any,
    props,
  });
};

// 杞诲害鍘嬬缉锛氭渶闀胯竟闄?2048px锛宷uality 0.92
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

// 涓嬭浇鏂囦欢锛坒etch blob锛屼笉鎵撳紑鏂版爣绛鹃〉锛?
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

// 3D鐞冨舰鎽勫儚澶存帶鍒跺櫒缁勪欢
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

    // 璁＄畻鏂扮殑鏃嬭浆瑙掑害

    let newRotationY = rotationY + deltaX * 0.5;
    let newRotationX = rotationX + deltaY * 0.5;

    // 鍏佽360搴︽棆杞紝浣嗚鑼冨寲鍒?180鍒?80鑼冨洿
    newRotationY = ((newRotationY + 180) % 360) - 180;
    newRotationX = Math.max(-90, Math.min(90, newRotationX)); // 鍨傜洿闄愬埗鍦?90鍒?0

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
      {/* 3D鍦烘櫙瀹瑰櫒 */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: '800px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* 3D鐞冧綋 */}
        <div
          className="relative transition-transform duration-100"
          style={{
            width: '120px',
            height: '120px',
            transformStyle: 'preserve-3d',
            transform: `rotateX(${-rotationX}deg) rotateY(${rotationY}deg)`,
          }}
        >
          {/* 鐞冧綋澶栧３ - 浣跨敤澶氫釜鍦嗙幆妯℃嫙鐞冧綋 */}
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {/* 璧ら亾鍦嗙幆 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-blue-400/30"
              style={{ transform: 'rotateX(0deg)' }}
            />
            {/* 缁忕嚎鍦嗙幆 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full border-2 border-blue-400/30"
              style={{ transform: 'rotateY(90deg)' }}
            />
            {/* 绾嚎鍦嗙幆 - 30搴?*/}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] h-[86%] rounded-full border border-blue-400/20"
              style={{ transform: 'rotateX(30deg)' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] h-[86%] rounded-full border border-blue-400/20"
              style={{ transform: 'rotateX(-30deg)' }}
            />
            {/* 绾嚎鍦嗙幆 - 60搴?*/}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full border border-blue-400/15"
              style={{ transform: 'rotateX(60deg)' }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full border border-blue-400/15"
              style={{ transform: 'rotateX(-60deg)' }}
            />

            {/* 鎽勫儚澶村浘鏍?- 鍥哄畾鍦ㄧ悆浣撳墠鏂?*/}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                transform: 'translateZ(60px)',
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="relative">
                {/* 鎽勫儚澶翠富浣?*/}
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
                {/* 鍙戝厜鏁堟灉 */}
                <div className="absolute inset-0 bg-blue-500/40 rounded-xl blur-lg -z-10" />
              </div>
            </div>

            {/* 涓績鐐?*/}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* 瑙掑害鏄剧ず */}
      <div className="absolute top-3 left-3 space-y-1">
        <div className="text-xs text-white/70 font-mono bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
          <span className="text-gray-400">淇话: </span>
          <span className="text-blue-400 font-bold">{Math.round(rotationX)}掳</span>
        </div>
        <div className="text-xs text-white/70 font-mono bg-black/40 px-2 py-1 rounded backdrop-blur-sm">
          <span className="text-gray-400">鍋忚埅: </span>
          <span className="text-blue-400 font-bold">{Math.round(rotationY)}掳</span>
        </div>
      </div>

      {/* 閲嶇疆鎸夐挳 */}
      <button
        className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-lg flex items-center justify-center transition-all backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          setRotationX(0);
          setRotationY(0);
          onAngleChange(0, 0);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title="閲嶇疆瑙嗚"
      >
        <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 鎷栧姩鎻愮ず */}
      {!isDragging && rotationX === 0 && rotationY === 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/40 animate-pulse pointer-events-none">
          馃柋锔?鎷栧姩鏃嬭浆鐞冧綋锛?60掳鑷敱鎺у埗
        </div>
      )}

      {/* 鍧愭爣杞存寚绀?*/}
      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] font-mono">
        <span className="text-red-400">X</span>
        <span className="text-green-400">Y</span>
        <span className="text-blue-400">Z</span>
      </div>
    </div>
  );
}

// 瀹氫箟鍗＄墖绫诲瀷
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
    uploadedImages?: string; // JSON 鏁扮粍瀛楃涓诧紝nano-banana/pro 澶氬浘鐢紙鏈€澶?寮狅級
    uploadedImageUrls?: string; // JSON 鏁扮粍瀛楃涓诧紝澶氬浘铻嶅悎妯″瀷鐢紙fal storage URL锛?    cameraVertical?: number;
    cameraHorizontal?: number;
    showCameraControl?: boolean;
    generatedImage?: string;
    aspectRatio?: string; // 鍥剧墖/瑙嗛姣斾緥
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
    // 瑙掕壊鍗＄墖涓撳睘瀛楁
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
    isMinimized?: boolean; // 鏄惁缂╁皬鐘舵€?    textOutput?: string; // 鏂囨湰鍗＄墖杈撳嚭
    isGenerating?: boolean; // 鏄惁姝ｅ湪鐢熸垚
    generationProgress?: number; // 鐢熸垚杩涘害 0-100
    generationStatus?: string; // 鐢熸垚鐘舵€佹枃鏈?    // Kling 涓撳睘瀛楁
    klingMode?: 'text2video' | 'image2video' | 'motion-control' | 'lip-sync';
    klingModel?: string;
    klingMotionVersion?: 'v2.6' | 'v3.0';
    klingVideoMode?: 'std' | 'pro';
    klingAspectRatio?: string;
    klingDuration?: string;
    klingSound?: 'on' | 'off';
    klingImage?: string; // base64 鎴?URL锛屽浘鐢熻棰戦甯?    klingImageTail?: string; // 灏惧抚
    klingVideoUrl?: string; // 鍔ㄤ綔鎺у埗鍙傝€冭棰?URL
    klingVideoInputUrl?: string;
    klingVideoName?: string;
    klingCharacterOrientation?: 'image' | 'video';
    klingKeepSound?: 'yes' | 'no';
    klingLipSyncSessionId?: string;
    klingLipSyncFaceId?: string;
    klingLipSyncFaces?: string; // JSON 瀛楃涓诧紝瀛樺偍璇嗗埆鍒扮殑浜鸿劯鍒楄〃
    klingLipSyncAudio?: string; // base64 鎴?URL
    klingLipSyncAudioName?: string;
    klingLipSyncPhase?: 'idle' | 'identifying' | 'identified' | 'syncing' | 'completed';
    klingLipSyncSoundStart?: number;
    klingLipSyncSoundEnd?: number;
    klingLipSyncSoundInsert?: number;
    klingLipSyncSoundVolume?: number;
    klingLipSyncOriginalVolume?: number;
    klingGeneratedVideo?: string;
    klingShowOutput?: boolean;
    showKlingSettingsPanel?: boolean;
  }
>;

// 瀹氫箟褰㈢姸宸ュ叿
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
    cameraVertical: T.number.optional(),
    cameraHorizontal: T.number.optional(),
    showCameraControl: T.boolean.optional(),
    generatedImage: T.string.optional(),
    aspectRatio: T.string.optional(),
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
    klingMode: T.literalEnum('text2video', 'image2video', 'motion-control', 'lip-sync').optional(),
    klingModel: T.string.optional(),
    klingMotionVersion: T.literalEnum('v2.6', 'v3.0').optional(),
    klingVideoMode: T.literalEnum('std', 'pro').optional(),
    klingAspectRatio: T.string.optional(),
    klingDuration: T.string.optional(),
    klingSound: T.literalEnum('on', 'off').optional(),
    klingImage: T.string.optional(),
    klingImageTail: T.string.optional(),
    klingVideoUrl: T.string.optional(),
    klingVideoInputUrl: T.string.optional(),
    klingVideoName: T.string.optional(),
    klingCharacterOrientation: T.literalEnum('image', 'video').optional(),
    klingKeepSound: T.literalEnum('yes', 'no').optional(),
    klingLipSyncSessionId: T.string.optional(),
    klingLipSyncFaceId: T.string.optional(),
    klingLipSyncFaces: T.string.optional(),
    klingLipSyncAudio: T.string.optional(),
    klingLipSyncAudioName: T.string.optional(),
    klingLipSyncPhase: T.literalEnum('idle', 'identifying', 'identified', 'syncing', 'completed').optional(),
    klingLipSyncSoundStart: T.number.optional(),
    klingLipSyncSoundEnd: T.number.optional(),
    klingLipSyncSoundInsert: T.number.optional(),
    klingLipSyncSoundVolume: T.number.optional(),
    klingLipSyncOriginalVolume: T.number.optional(),
    klingGeneratedVideo: T.string.optional(),
    klingShowOutput: T.boolean.optional(),
    showKlingSettingsPanel: T.boolean.optional(),
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  // 定义箭头绑定点
  // @ts-expect-error - HandleSnapGeometry type has changed in newer tldraw version
  override getHandleSnapGeometry(shape: CustomCardShape) {
    const { w, h } = shape.props;
    return {
      points: [
        { x: 0, y: h / 2 },      // 宸︿晶涓偣
        { x: w, y: h / 2 },      // 鍙充晶涓偣
        { x: w / 2, y: 0 },      // 椤堕儴涓偣
        { x: w / 2, y: h },      // 搴曢儴涓偣
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
      model: 'gpt-5.2',
      uploadedImage: '',
      cameraVertical: 0,
      cameraHorizontal: 0,
      showCameraControl: false,
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
      characterStep: 'analyze',
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
      klingMode: 'motion-control',
      klingModel: 'v2.6',
      klingMotionVersion: 'v2.6',
      klingVideoMode: 'std',
      klingAspectRatio: '16:9',
      klingDuration: '5',
      klingSound: 'off',
      klingImage: '',
      klingImageTail: '',
      klingVideoUrl: '',
      klingVideoInputUrl: '',
      klingVideoName: '',
      klingCharacterOrientation: 'image',
      klingKeepSound: 'no',
      klingLipSyncSessionId: '',
      klingLipSyncFaceId: '',
      klingLipSyncFaces: '',
      klingLipSyncAudio: '',
      klingLipSyncAudioName: '',
      klingLipSyncPhase: 'idle',
      klingLipSyncSoundStart: 0,
      klingLipSyncSoundEnd: 5000,
      klingLipSyncSoundInsert: 0,
      klingLipSyncSoundVolume: 1,
      klingLipSyncOriginalVolume: 1,
      klingGeneratedVideo: '',
      klingShowOutput: false,
      showKlingSettingsPanel: true,
    };
  }

  component(shape: CustomCardShape) {
    const { cardType, title, prompt, model, w, h, uploadedImage, uploadedImages, uploadedImageUrls, cameraVertical, cameraHorizontal, showCameraControl, generatedImage, aspectRatio, videoMode, firstFrameImage, lastFrameImage, generatedVideo, showVideoModePanel, showImageOutput, showVideoOutput, capturedFrame, videoDuration, videoResolution, videoGenerateAudio, characterName, characterAppearance, characterClothing, characterPersonality, characterBackground, characterKeywords, characterForbiddenWords, characterReferenceImage, characterStep, characterAnalyzeImage, characterAnchorJson, characterThreeViewJson, characterThreeViewImage, characterGeneratedImage, characterImageModel, imageQuality, cameraTemplate, cameraStrength, showCharacterOutput, showAnalyzePanel, showThreeViewJsonPanel, showGeneratePanel, isMinimized, textOutput, isGenerating, generationProgress, generationStatus, klingMode, klingModel, klingMotionVersion, klingVideoMode, klingAspectRatio, klingDuration, klingSound, klingImage, klingImageTail, klingVideoUrl, klingVideoInputUrl, klingVideoName, klingCharacterOrientation, klingKeepSound, klingLipSyncSessionId, klingLipSyncFaceId, klingLipSyncFaces, klingLipSyncAudio, klingLipSyncAudioName, klingLipSyncPhase, klingLipSyncSoundStart, klingLipSyncSoundEnd, klingLipSyncSoundInsert, klingLipSyncSoundVolume, klingLipSyncOriginalVolume, klingGeneratedVideo, klingShowOutput, showKlingSettingsPanel } = shape.props;
    const editor = useEditor();
    const videoRef = useRef<HTMLVideoElement>(null);
    const { isMember, userId, refresh: refreshBalance } = useMembership();
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [isUploadingMulti, setIsUploadingMulti] = useState(false);
    const [isUploadingKlingVideo, setIsUploadingKlingVideo] = useState(false);
    const [lightboxVideo, setLightboxVideo] = useState<string | null>(null);
    const currentKlingMode = klingMode === 'lip-sync' ? 'lip-sync' : 'motion-control';
    const klingModeForUi = currentKlingMode;
    const klingSettingsPanelOpen = showKlingSettingsPanel ?? true;
    const normalizedKlingMotionVersion =
      klingMotionVersion === 'v2.6' || klingMotionVersion === 'v3.0'
        ? klingMotionVersion
        : klingModel === 'v3.0'
          ? 'v3.0'
          : 'v2.6';
    const klingDetectedFaces = (() => {
      if (!klingLipSyncFaces) return [] as Array<{ face_id?: string; faceId?: string; name?: string }>;
      try {
        const parsed = JSON.parse(klingLipSyncFaces);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [] as Array<{ face_id?: string; faceId?: string; name?: string }>;
      }
    })();

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

    const handleKlingVideoUpload = async (file: File) => {
      const lowerName = file.name.toLowerCase();
      if (!(lowerName.endsWith('.mp4') || lowerName.endsWith('.mov'))) {
        alert('浠呮敮鎸?mp4 鎴?mov 瑙嗛');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        alert('瑙嗛鏂囦欢涓嶈兘瓒呰繃 100MB');
        return;
      }

      setIsUploadingKlingVideo(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/kling/upload-video', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!res.ok || !data?.url) {
          throw new Error(data?.error || '瑙嗛涓婁紶澶辫触');
        }

        const latestShape = editor.getShape(shape.id);
        const latestProps = latestShape ? (latestShape as any).props : shape.props;
        editor.updateShape({
          id: shape.id,
          type: 'custom-card' as any,
          props: {
            ...latestProps,
            klingVideoUrl: data.url,
            klingVideoInputUrl: '',
            klingVideoName: file.name,
            klingLipSyncSessionId: '',
            klingLipSyncFaceId: '',
            klingLipSyncFaces: '',
            klingLipSyncPhase: 'idle',
          },
        });
      } catch (error: any) {
        console.error('Kling 瑙嗛涓婁紶澶辫触:', error);
        alert(error?.message || '瑙嗛涓婁紶澶辫触');
      } finally {
        setIsUploadingKlingVideo(false);
      }
    };

    // 瑙嗛妯″瀷鍙傛暟閰嶇疆

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

    // 鑾峰彇杩炴帴鍒板綋鍓嶅崱鐗囩殑 ShotCard 鎸囦护

    const getShotCardPrompt = (): string => {
      // 鎵惧埌鎵€鏈夌粦瀹氬埌褰撳墠鍗＄墖鐨勮繛鎺ョ嚎
      const allBindings = editor.getBindingsToShape(shape.id, 'connection');
      for (const binding of allBindings) {
        // 鍙湅 end 绔紙ShotCard 杩炲埌褰撳墠鍗＄墖锛?
        if (binding.props.terminal !== 'end') continue;
        const connection = editor.getShape(binding.fromId);
        if (!connection) continue;
        // 鎵捐繛鎺ョ嚎鐨勫彟涓€绔紙start 绔級
        const otherBindings = editor.getBindingsFromShape(binding.fromId, 'connection');
        for (const ob of otherBindings) {
          if ((ob as any).props?.terminal !== 'start') continue;
          const sourceShape = editor.getShape((ob as any).toId);
          if (!sourceShape || (sourceShape as any).type !== 'shot-card') continue;
          // 鎵惧埌浜嗚繛鎺ョ殑 ShotCard锛屾嫾鎸囦护
          const sp = (sourceShape as any).props;
          const parts: string[] = [];
          if (sp.shotType) parts.push(`鏅埆锛?{sp.shotType}`);
          if (sp.cameraMovement && sp.cameraMovement !== 'Follow/Tracking') parts.push(`杩愰暅锛?{sp.cameraMovement}`);
          if (sp.composition) parts.push(`鏋勫浘锛?{sp.composition}`);
          if (sp.subjectScale) parts.push(`主体比例：${sp.subjectScale}`);
          if (sp.spaceType) parts.push(`空间类型：${sp.spaceType}`);
          if (sp.timeFeeling) parts.push(`时间感：${sp.timeFeeling}`);
          if (sp.lighting) parts.push(`光影/天气：${sp.lighting}`);
          if (sp.motionSource) parts.push(`动态来源：${sp.motionSource}`);
          if (sp.semantic) parts.push(`语义：${sp.semantic}`);
          if (parts.length > 0) return `[电影镜头指令] ${parts.join('；')}。`;
        }
      }
      return '';
    };

    // 鍒囨崲缂╂斁

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

    // 鎹曡幏瑙嗛褰撳墠甯?

    const captureCurrentFrame = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;

      // 鍒涘缓canvas鍏冪礌

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 灏嗚棰戝綋鍓嶅抚缁樺埗鍒癱anvas

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 杞崲涓篵ase64鍥剧墖

      const frameImage = canvas.toDataURL('image/png');

      // 鏇存柊shape鐘舵€?

      editor.updateShape({
        id: shape.id,
        type: 'custom-card' as any,
        props: {
          ...shape.props,
          capturedFrame: frameImage,
        },
      });
    }, [editor, shape.id, shape.props]);

    // 鏍规嵁鍗＄墖绫诲瀷璁剧疆棰滆壊鍜屾笎鍙?

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
        buttonBg: 'bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600',
        handleColor: 'rgba(192, 192, 192, 0.8)',
      },
    };

    const color = colors[cardType];

    // 璁＄畻缂╂斁姣斾緥

    const scale = Math.min(w / 380, h / 380);

    // 澶勭悊杈撳嚭绔彛鐐瑰嚮 - 寮€濮嬭繛鎺?

    const handleOutputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      console.log('馃數 杈撳嚭绔彛琚偣鍑伙紝鍗＄墖ID:', shape.id);

      // 浣跨敤鑷畾涔夌殑 PortTool 寮€濮嬭繛鎺?

      editor.setCurrentTool('port', {
        shapeId: shape.id,
        portId: 'output',
        terminal: 'start',
      });
    };

    // 澶勭悊杈撳叆绔彛鐐瑰嚮 - 寮€濮嬭繛鎺?

    const handleInputPortDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('馃煝 杈撳叆绔彛琚偣鍑伙紝鍗＄墖ID:', shape.id);

      // 浣跨敤鑷畾涔夌殑 PortTool 寮€濮嬭繛鎺?

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

        {/* 瑙嗛/鍥剧墖鏀惧ぇ寮圭獥 */}
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
                <img src={lightboxVideo} alt="澶у浘" className="rounded-xl object-contain" style={{ maxWidth: '70vw', maxHeight: '70vh' }} />
              )}
              <button
                className="absolute -top-3 -right-3 w-7 h-7 bg-zinc-800 hover:bg-zinc-700 border border-white/20 rounded-full text-white text-sm flex items-center justify-center"
                onClick={() => setLightboxVideo(null)}
                onPointerDown={(e) => e.stopPropagation()}
              >鉁?/button>
            </div>
          </div>
        )}
        {/* 杈撳嚭绔彛 - Right */}
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

        {/* 杈撳叆绔彛 - Left */}
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
          {/* 缂╂斁鎸夐挳 */}
          <button
            onClick={toggleMinimize}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-7 h-7 bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/20 rounded flex items-center justify-center text-white text-lg transition-all z-10"
            style={{
              transform: `scale(${1 / scale})`,
              transformOrigin: 'center',
            }}
            title={isMinimized ? "灞曞紑" : "缂╁皬"}
          >
            {isMinimized ? '+' : '鈭?}
          </button>

          {/* 缂╁皬鐘舵€?- 鍙樉绀烘爣棰?*/}
          {isMinimized ? (
            <div className="p-4 h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-sm font-semibold">{title}</div>
                <div className="text-gray-400 text-xs mt-1">
                  {cardType === 'text' && '鏂囨湰鐢熸垚'}
                  {cardType === 'image' && '鍥剧墖鐢熸垚'}
                  {cardType === 'video' && '瑙嗛鐢熸垚'}
                  {cardType === 'character' && '瑙掕壊璁捐'}
                  {cardType === 'kling' && '鍙伒瑙嗛'}
                </div>
                <div className="text-gray-500 text-[10px] mt-2">鐐瑰嚮+灞曞紑</div>
              </div>
            </div>
          ) : (
            /* 姝ｅ父鐘舵€?- 鏄剧ず鎵€鏈夊唴瀹?*/
            <div className="p-4 h-full flex flex-col">
            {/* 鏍囬鏍?*/}
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
                <p className="text-gray-400 text-xs truncate">
                  {cardType === 'text' && '鏂囨湰鐢熸垚'}
                  {cardType === 'image' && '鍥剧墖鐢熸垚'}
                  {cardType === 'video' && '瑙嗛鐢熸垚'}
                  {cardType === 'character' && '瑙掕壊璁捐'}
                  {cardType === 'kling' && '鍙伒瑙嗛'}
                </p>
              </div>
            </div>

            {/* 杈撳叆鍖哄煙 */}
            <div className={`mb-2 ${cardType === 'kling' ? '' : 'flex-1'}`}>
              {cardType !== 'character' && cardType !== 'kling' && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-gray-400 text-xs">Prompt</label>
                    <button
                      className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, prompt: (prompt ? prompt + '\n' : '') + text } });
                        } catch {}
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >绮樿创</button>
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
                    value={cardType === 'image' && ((cameraVertical ?? 0) !== 0 || (cameraHorizontal ?? 0) !== 0)
                      ? `${prompt} [Camera: vertical ${(cameraVertical ?? 0) >= 0 ? '+' : ''}${cameraVertical ?? 0}掳, horizontal ${(cameraHorizontal ?? 0) >= 0 ? '+' : ''}${cameraHorizontal ?? 0}掳]`
                      : prompt}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      // 绉婚櫎闀滃ご鍙傛暟锛屽彧淇濆瓨鐢ㄦ埛杈撳叆鐨勬枃鏈?
                      const userInput = e.target.value.replace(/\[Camera: vertical [+-]?\d+掳, horizontal [+-]?\d+掳\]/g, '').trim();
                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: {
                          ...shape.props,
                          prompt: userInput,
                        },
                      });
                    }}
                  />
                  {/* 闀滃ご鍙傛暟鎻愮ず */}
                  {cardType === 'image' && (cameraVertical !== 0 || cameraHorizontal !== 0) && (
                    <div className="text-[10px] text-blue-400 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>闀滃ご鍙傛暟宸茶嚜鍔ㄦ坊鍔?/span>
                    </div>
                  )}
                </>
              )}

              {/* 瑙掕壊鍗＄墖涓撳睘杈撳叆鍖哄煙 */}
              {cardType === 'character' && (
                <div className="space-y-2">
                  {/* 姝ラ鍒囨崲鎸夐挳 */}
                  <div className="flex gap-1 mb-3">
                    <button
                      className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                        (characterStep || 'analyze') === 'analyze'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: { ...shape.props, characterStep: 'analyze' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      1.鍒嗘瀽鍥剧墖
                    </button>
                    <button
                      className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                        characterStep === 'three-view-json'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: { ...shape.props, characterStep: 'three-view-json' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      2.涓夎瑙扟SON
                    </button>
                    <button
                      className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-semibold transition-all ${
                        characterStep === 'generate'
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-black/30 text-gray-400 hover:bg-black/40'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: { ...shape.props, characterStep: 'generate' },
                        });
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      3.鐢熸垚鍥剧墖
                    </button>
                  </div>

                  {/* 姝ラ1: 鍒嗘瀽鍥剧墖 */}
                  {(characterStep || 'analyze') === 'analyze' && (
                    <div className="relative">
                      <div className="space-y-2">{/* 涓婁紶鍥剧墖 */}
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">涓婁紶鍥剧墖</label>
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
                        {characterAnalyzeImage && (
                          <div className="mt-2 relative w-full h-32 bg-black/30 rounded-lg overflow-hidden">
                            <img src={characterAnalyzeImage} alt="Analyze" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      {/* 鍥哄畾鎸囦护璇存槑 */}
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-[10px] text-blue-400 leading-relaxed">
                          鍥哄畾鎸囦护锛氭牴鎹繖寮犲浘鐗囷紝鍙仛鍗曚汉鍒嗘瀽锛屽弽鎺ㄥ嚭涓€涓€愬崟浜烘垚鍔熻寖寮?JSON銆戙€備笉瑕佸姞涓夎瑙掋€佷笉瑕佸姞杞潰銆佷笉瑕佸仛璁惧畾绋匡紝鍙繚璇佽繖鏄竴涓ǔ瀹氬彲澶嶇幇鐨勪汉鐗?JSON
                        </p>
                      </div>

                      {/* 閫夋嫨妯″瀷 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">閫夋嫨妯″瀷</label>
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

                      {/* 鍒嗘瀽鎸夐挳 */}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600'}`}
                        disabled={isGenerating || !characterAnalyzeImage}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!isMember) { setShowMemberModal(true); return; }

                          // 濡傛灉宸茬粡鏈夎緭鍑虹粨鏋滐紝鍒欏垏鎹㈡樉绀?闅愯棌

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
                            // 绗竴娆＄偣鍑伙紝璋冪敤 API 鍒嗘瀽鍥剧墖鐢熸垚 Anchor JSON
                            console.log('鍒嗘瀽鍥剧墖鐢熸垚Anchor JSON');

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '鍒嗘瀽鍥剧墖涓?..' },
                            });

                            try {
                              const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: model || 'gpt-5.2',
                                  prompt: '璇峰垎鏋愯繖寮犲浘鐗囦腑鐨勮鑹诧紝鐢熸垚涓€涓€愬崟浜烘垚鍔熻寖寮?JSON銆戙€傚彧鍋氬崟浜哄垎鏋愶紝鍙嶆帹鍑虹ǔ瀹氬彲澶嶇幇鐨勪汉鐗?JSON銆備笉瑕佸姞涓夎瑙掋€佷笉瑕佸姞杞潰銆佷笉瑕佸仛璁惧畾绋裤€傝鐩存帴杈撳嚭 JSON锛屼笉瑕佽В閲娿€?,
                                  imageUrl: characterAnalyzeImage,
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
                              console.error('鍒嗘瀽澶辫触:', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('鍒嗘瀽澶辫触锛岃閲嶈瘯');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>鍒嗘瀽涓?..</span>
                          </div>
                        ) : (characterAnchorJson && showAnalyzePanel ? '鏀惰捣 Anchor JSON' : '鍒嗘瀽鐢熸垚 Anchor JSON')}
                      </button>

                      {/* 妯″瀷杈撳嚭缁撴灉 - Anchor JSON */}
                      {characterAnchorJson && showAnalyzePanel && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-gray-400 text-xs">妯″瀷杈撳嚭 - Anchor JSON</label>
                            <button
                              className="px-2 py-1 bg-green-500/80 hover:bg-green-600 rounded text-white text-[10px] font-semibold transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(characterAnchorJson);
                                alert('JSON宸插鍒跺埌鍓创鏉?);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              澶嶅埗
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
                    {/* 婊氬姩鎻愮ず - 姝ラ1 */}
                    {characterAnchorJson && (
                      <div className="mt-2 text-center">
                        <p className="text-[10px] text-yellow-400 animate-bounce">馃憞 鍚戜笅婊氬姩鏌ョ湅鏇村鍐呭</p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* 姝ラ2: 鐢熸垚涓夎瑙扟SON */}
                  {characterStep === 'three-view-json' && (
                    <div className="relative">
                      <div className="space-y-2">
                      {/* 绮樿创Anchor JSON */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-gray-400 text-xs">绮樿创 Anchor JSON</label>
                          <button className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                            onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, characterAnchorJson: t } }); } catch {} }}
                            onPointerDown={(e) => e.stopPropagation()}>绮樿创</button>
                        </div>
                        <textarea
                          className="w-full h-24 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-[10px] font-mono resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500"
                          placeholder="绮樿创姝ラ1鐢熸垚鐨凙nchor JSON..."
                          value={characterAnchorJson || ''}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, characterAnchorJson: e.target.value },
                            });
                          }}
                        />
                      </div>

                      {/* 鍥哄畾鎸囦护璇存槑 */}
                      <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-[10px] text-blue-400 leading-relaxed">
                          鍥哄畾鎸囦护锛氬熀浜庝笂闈㈢殑 Anchor JSON锛岀敓鎴愪竴浠姐€愮ǔ瀹氱殑涓夎瑙掞紙姝?渚?鑳岋級瀹屾暣 JSON銆戙€傝姹傦細鍚屼竴浜虹墿銆佸悓涓€鏈嶈銆佸悓涓€鍙戝瀷銆佸悓涓€韬潗姣斾緥锛涗娇鐢?character turnaround 宸ョ▼鍖栨柟寮忥紝涓嶈鎽勫奖妯″紡锛涘繀椤婚伩鍏嶉噸澶嶆闈㈡垨鎹汉锛屾寜涓婃鎴愬姛鐨勬柟寮忔潵銆?                        </p>
                      </div>

                      {/* 閫夋嫨妯″瀷 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">閫夋嫨妯″瀷</label>
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

                      {/* 鐢熸垚涓夎瑙扟SON鎸夐挳 */}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600'}`}
                        disabled={isGenerating || !characterAnchorJson}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!isMember) { setShowMemberModal(true); return; }

                          // 濡傛灉宸茬粡鏈夎緭鍑虹粨鏋滐紝鍒欏垏鎹㈡樉绀?闅愯棌

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
                            // 绗竴娆＄偣鍑伙紝璋冪敤 API 鐢熸垚涓夎瑙?JSON
                            console.log('鐢熸垚涓夎瑙扟SON');

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '鍒嗘瀽鍥剧墖涓?..' },
                            });

                            try {
                              const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: model || 'gpt-5.2',
                                  prompt: `鍩轰簬涓嬮潰鐨?Anchor JSON锛岀敓鎴愪竴浠姐€愮ǔ瀹氱殑涓夎瑙掞紙姝?渚?鑳岋級瀹屾暣 JSON銆戙€傝姹傦細鍚屼竴浜虹墿銆佸悓涓€鏈嶈銆佸悓涓€鍙戝瀷銆佸悓涓€韬潗姣斾緥锛涗娇鐢?character turnaround 宸ョ▼鍖栨柟寮忥紝涓嶈鎽勫奖妯″紡锛涘繀椤婚伩鍏嶉噸澶嶆闈㈡垨鎹汉锛屾寜涓婃鎴愬姛鐨勬柟寮忔潵銆俓n\nAnchor JSON锛歕n${characterAnchorJson}\n\n璇风洿鎺ヨ緭鍑?JSON锛屼笉瑕佽В閲娿€俙,
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
                              console.error('涓夎瑙扟SON鐢熸垚澶辫触:', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('鐢熸垚澶辫触锛岃閲嶈瘯');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>鐢熸垚涓?..</span>
                          </div>
                        ) : (characterThreeViewJson && showThreeViewJsonPanel ? '鏀惰捣涓夎瑙扟SON' : '鐢熸垚涓夎瑙?JSON')}
                      </button>

                      {/* 妯″瀷杈撳嚭缁撴灉 - 涓夎瑙掑畬鏁碕SON */}
                      {characterThreeViewJson && showThreeViewJsonPanel && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-gray-400 text-xs">妯″瀷杈撳嚭 - 涓夎瑙掑畬鏁?JSON</label>
                            <button
                              className="px-2 py-1 bg-green-500/80 hover:bg-green-600 rounded text-white text-[10px] font-semibold transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(characterThreeViewJson);
                                alert('JSON宸插鍒跺埌鍓创鏉?);
                              }}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              澶嶅埗
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
                    {/* 婊氬姩鎻愮ず - 姝ラ2 */}
                    {characterThreeViewJson && (
                      <div className="mt-2 text-center">
                        <p className="text-[10px] text-yellow-400 animate-bounce">馃憞 鍚戜笅婊氬姩鏌ョ湅鏇村鍐呭</p>
                      </div>
                    )}
                  </div>
                  )}

                  {/* 姝ラ3: 鐢熸垚涓夎瑙掑浘鐗?*/}
                  {characterStep === 'generate' && (
                    <div className="relative">
                      <div className="space-y-2">
                      {/* 涓婁紶鍥剧墖 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">涓婁紶鍙傝€冨浘鐗?/label>
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
                                  props: { ...shape.props, characterThreeViewImage: imageData },
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                        {characterThreeViewImage && (
                          <div className="mt-2 relative w-full h-24 bg-black/30 rounded-lg overflow-hidden">
                            <img src={characterThreeViewImage} alt="Reference" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      {/* 绮樿创瀹屾暣JSON */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-gray-400 text-xs">绮樿创瀹屾暣 JSON</label>
                          <button className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                            onClick={async (e) => { e.stopPropagation(); try { const t = await navigator.clipboard.readText(); if (t) editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, characterThreeViewJson: t } }); } catch {} }}
                            onPointerDown={(e) => e.stopPropagation()}>绮樿创</button>
                        </div>
                        <textarea
                          className="w-full h-24 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-[10px] font-mono resize-none focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all placeholder-gray-500 overflow-y-auto"
                          placeholder="绮樿创姝ラ2鐢熸垚鐨勪笁瑙嗚JSON..."
                          value={characterThreeViewJson || ''}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, characterThreeViewJson: e.target.value },
                            });
                          }}
                        />
                      </div>

                      {/* 閫夋嫨鍥剧墖鐢熸垚妯″瀷 */}
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">閫夋嫨鍥剧墖鐢熸垚妯″瀷</label>
                        <select
                          className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                          value={characterImageModel || 'Nano Banana Pro'}
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
                          <option value="nano-banana-pro">Nano Banana Pro锛?K/4K鍙€夛級</option>
                          <option value="nano-banana">Nano Banana 鈥?楼0.5/娆?/option>
                          <option value="flux-kontext">Flux Kontext 鈥?楼0.6/娆?/option>
                          <option value="flux-kontext-max">Flux Kontext Max 鈥?楼1.0/娆?/option>
                          <option value="doubao-seedream-4-5-251128">璞嗗寘 Seedream 鈥?楼0.3/娆?/option>
                        </select>
                      </div>

                      {/* 鐢熸垚涓夎瑙掑浘鐗囨寜閽?*/}
                      <button
                        className={`w-full py-2 rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${isGenerating ? 'bg-gray-500 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500 hover:to-green-600'}`}
                        disabled={isGenerating || !characterThreeViewImage || !characterThreeViewJson}
                        onClick={async (e) => {
                          e.stopPropagation();

                          // 濡傛灉宸茬粡鏈夎緭鍑虹粨鏋滐紝鍒欏垏鎹㈡樉绀?闅愯棌

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
                            // 绗竴娆＄偣鍑伙紝璋冪敤鍥剧墖 API 鐢熸垚涓夎瑙掑浘鐗?                            console.log('鐢熸垚涓夎瑙掑浘鐗?);
                            console.log('浣跨敤妯″瀷:', characterImageModel);
                            console.log('JSON:', characterThreeViewJson);

                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, isGenerating: true, generationProgress: 10, generationStatus: '鍒嗘瀽鍥剧墖涓?..' },
                            });

                            try {
                              const res = await fetch('/api/image/generate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  model: characterImageModel || 'nano-banana-pro',
                                  prompt: `Character three-view sheet (front, side, back), same character, same outfit, same hairstyle. Based on: ${characterThreeViewJson}`,
                                  aspectRatio: '16:9',
                                  imageBase64: characterThreeViewImage || undefined,
                                  userId: userId || undefined,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || '鐢熸垚澶辫触');
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: {
                                  ...shape.props,
                                  characterGeneratedImage: data.imageUrl,
                                  showGeneratePanel: true,
                                  isGenerating: false,
                                },
                              });
                            } catch (err) {
                              console.error('涓夎瑙掑浘鐗囩敓鎴愬け璐?', err);
                              editor.updateShape({
                                id: shape.id,
                                type: 'custom-card' as any,
                                props: { ...shape.props, isGenerating: false },
                              });
                              alert('鍥剧墖鐢熸垚澶辫触锛岃閲嶈瘯');
                            }
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {isGenerating ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            <span>鐢熸垚涓?..</span>
                          </div>
                        ) : (characterGeneratedImage && showGeneratePanel ? '鏀惰捣涓夎瑙掑浘鐗? : '鐢熸垚涓夎瑙掑浘鐗?)}
                      </button>

                      {/* 鏄剧ず鐢熸垚鐨勫浘鐗?*/}
                      {showGeneratePanel && characterGeneratedImage && (
                        <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                          <div className="relative group">
                            <img src={characterGeneratedImage} alt="Generated Three Views" className="w-full h-auto max-h-[250px] object-contain bg-black/20" />

                            {/* 鎮仠鏃舵樉绀虹殑鎿嶄綔鎸夐挳 */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {/* 鏌ョ湅澶у浘鎸夐挳 */}
                              <button
                                className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(characterGeneratedImage, '_blank');
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="鏌ョ湅澶у浘"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                                鏌ョ湅
                              </button>

                              {/* 涓嬭浇鎸夐挳 */}
                              <button
                                className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadFile(characterGeneratedImage, `character-three-view-${Date.now()}.png`);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                title="涓嬭浇鍥剧墖"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                涓嬭浇
                              </button>
                            </div>

                            {/* 鍥剧墖淇℃伅 */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                              <p className="text-white text-[10px] truncate">涓夎瑙掔敓鎴愭垚鍔?/p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 婊氬姩鎻愮ず - 姝ラ3 */}
                    {characterGeneratedImage && showCharacterOutput && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-8 pb-2 pointer-events-none">
                        <div className="text-center">
                          <p className="text-[10px] text-yellow-400 animate-bounce">馃憞 鍚戜笅婊氬姩鏌ョ湅鐢熸垚鍥剧墖</p>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </div>
            {/* 妯″瀷閫夋嫨 */}
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
                      <optgroup label="楂樼骇妯″瀷">
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
                      <optgroup label="鏅€氭ā鍨?>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                    </>
                  )}
                  {cardType === 'image' && (
                    <>
                      <optgroup label="Gemini">
                        <option value="nano-banana-pro">Nano Banana Pro锛?K/4K鍙€夛級</option>
                        <option value="nano-banana">Nano Banana 鈥?楼0.5/娆?/option>
                        <option value="nano-banana-pro-multi">澶氬浘铻嶅悎 Nano Banana Pro锛?K 楼1.5 / 4K 楼2.5锛?/option>
                      </optgroup>
                      <optgroup label="Flux">
                        <option value="flux-kontext">Flux Kontext 鈥?楼0.6/娆?/option>
                        <option value="flux-kontext-max">Flux Kontext Max 鈥?楼1.0/娆?/option>
                      </optgroup>
                      <optgroup label="鍏朵粬">
                        <option value="mj_imagine">Midjourney 鈥?楼0.6/娆?/option>
                        <option value="doubao-seedream-4-5-251128">璞嗗寘 Seedream 鈥?楼0.3/娆?/option>
                      </optgroup>
                    </>
                  )}
                  {cardType === 'video' && (
                    <>
                      <optgroup label="Google Veo 3.1">
                        <option value="veo3.1-t2v">Veo 3.1 鏂囩敓瑙嗛 鈥?浼氬憳楼1.78/绉?鏅€毬?.98/绉?/option>
                        <option value="veo3.1-i2v">Veo 3.1 鍥剧敓瑙嗛 鈥?浼氬憳楼1.78/绉?鏅€毬?.98/绉?/option>
                        <option value="veo3.1-fast-t2v">Veo 3.1 Fast 鏂囩敓瑙嗛 鈥?浼氬憳楼1.09/绉?鏅€毬?.29/绉?/option>
                        <option value="veo3.1-fast-i2v">Veo 3.1 Fast 鍥剧敓瑙嗛 鈥?浼氬憳楼1.09/绉?鏅€毬?.29/绉?/option>
                        <option value="veo3.1-first-last">Veo 3.1 棣栧熬甯?鈥?浼氬憳楼1.09/绉?鏅€毬?.29/绉?/option>
                      </optgroup>
                      <optgroup label="Wan 2.6">
                        <option value="wan2.6-t2v">Wan 2.6 鏂囩敓瑙嗛 鈥?浼氬憳楼1.0/绉?鏅€毬?.2/绉?/option>
                        <option value="wan2.6-i2v">Wan 2.6 鍥剧敓瑙嗛 鈥?浼氬憳楼1.0/绉?鏅€毬?.2/绉?/option>
                        <option value="wan2.6-i2v-flash">Wan 2.6 鍥剧敓瑙嗛 Flash 鈥?浼氬憳楼0.55/绉?鏅€毬?.75/绉?/option>
                      </optgroup>
                      <optgroup label="Wan 2.5">
                        <option value="wan2.5-t2v-preview">Wan 2.5 鏂囩敓瑙嗛 鈥?浼氬憳楼1.0/绉?鏅€毬?.2/绉?/option>
                        <option value="wan2.5-i2v-preview">Wan 2.5 鍥剧敓瑙嗛 鈥?浼氬憳楼1.0/绉?鏅€毬?.2/绉?/option>
                      </optgroup>
                      <optgroup label="Wan 2.2">
                        <option value="wan2.2-kf2v-flash">Wan 2.2 棣栧熬甯ц棰?鈥?浼氬憳楼3.0/娆?鏅€毬?.0/娆★紙鍥哄畾5绉掞級</option>
                      </optgroup>
                      <optgroup label="鍗虫ⅵ 3.0 Pro锛?080P锛?>
                        <option value="jimeng-pro-t2v">鍗虫ⅵ Pro 鏂囩敓瑙嗛 鈥?浼氬憳楼1.4/绉?鏅€毬?.6/绉?/option>
                        <option value="jimeng-pro-i2v">鍗虫ⅵ Pro 鍥剧敓瑙嗛锛堥甯э級鈥?浼氬憳楼1.4/绉?鏅€毬?.6/绉?/option>
                      </optgroup>
                      <optgroup label="鍗虫ⅵ 3.0锛?20P锛?>
                        <option value="jimeng-t2v">鍗虫ⅵ 鏂囩敓瑙嗛 鈥?浼氬憳楼0.68/绉?鏅€毬?.88/绉?/option>
                        <option value="jimeng-i2v">鍗虫ⅵ 鍥剧敓瑙嗛锛堥甯э級鈥?浼氬憳楼0.68/绉?鏅€毬?.88/绉?/option>
                        <option value="jimeng-first-last">鍗虫ⅵ 棣栧熬甯?鈥?浼氬憳楼0.68/绉?鏅€毬?.88/绉?/option>
                        <option value="jimeng-camera">鍗虫ⅵ 杩愰暅 鈥?浼氬憳楼0.68/绉?鏅€毬?.88/绉?/option>
                      </optgroup>
                      <optgroup label="鍗虫ⅵ 3.0锛?080P锛?>
                        <option value="jimeng-1080-t2v">鍗虫ⅵ 鏂囩敓瑙嗛 1080P 鈥?浼氬憳楼1.03/绉?鏅€毬?.23/绉?/option>
                        <option value="jimeng-1080-i2v">鍗虫ⅵ 鍥剧敓瑙嗛棣栧抚 1080P 鈥?浼氬憳楼1.03/绉?鏅€毬?.23/绉?/option>
                        <option value="jimeng-1080-first-last">鍗虫ⅵ 棣栧熬甯?1080P 鈥?浼氬憳楼1.03/绉?鏅€毬?.23/绉?/option>
                      </optgroup>
                      <optgroup label="鍏朵粬">
                        <option value="ovi-i2v">Ovi 鍥剧敓瑙嗛 鈥?楼1.78/娆★紙鍥哄畾锛?/option>
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            )}

            {/* 姣斾緥閫夋嫨 - 鍥剧墖鍗＄墖 */}
            {cardType === 'image' && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">姣斾緥</label>
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
                  <option value="1:1">1:1 姝ｆ柟褰?/option>
                  <option value="4:3">4:3 妯浘</option>
                  <option value="3:4">3:4 绔栧浘</option>
                  <option value="16:9">16:9 瀹藉睆</option>
                  <option value="9:16">9:16 绔栧睆</option>
                  <option value="3:2">3:2 妯浘</option>
                  <option value="2:3">2:3 绔栧浘</option>
                  <option value="21:9">21:9 瓒呭</option>
                </select>
              </div>
            )}

            {/* 娓呮櫚搴﹂€夋嫨 - nano-banana-pro 鍜屽鍥捐瀺鍚?*/}
            {cardType === 'image' && ['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">娓呮櫚搴?/label>
                <div className="flex gap-1">
                  {[
                    { value: '2k', label: model === 'nano-banana-pro-multi' ? '2K 鈥?楼1.5/娆? : '2K 鈥?楼0.7/娆? },
                    { value: '4k', label: model === 'nano-banana-pro-multi' ? '4K 鈥?楼2.5/娆? : '4K 鈥?楼1.5/娆? },
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

            {/* 鍥剧墖涓婁紶 - 鏀寔鍥剧敓鍥剧殑妯″瀷鎵嶆樉绀?*/}
            {cardType === 'image' && ['nano-banana', 'nano-banana-pro', 'nano-banana-pro-multi', 'doubao-seedream-4-5-251128', 'flux-kontext'].includes(model || '') && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">
                  {model === 'nano-banana-pro-multi'
                    ? '鍙傝€冨浘鐗囷紙蹇呭～锛屾渶澶?0寮狅級'
                    : ['nano-banana', 'nano-banana-pro'].includes(model || '')
                    ? '鍙傝€冨浘鐗囷紙鍙€夛紝鏈€澶?寮狅級'
                    : model === 'flux-kontext' ? '鍙傝€冨浘鐗囷紙蹇呭～锛? : '鍙傝€冨浘鐗囷紙鍙€夛級'}
                </label>

                {/* 澶氬浘铻嶅悎妯″瀷锛氫笂浼犲埌 fal storage锛屽瓨 URL */}
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
                                const base64 = await new Promise<string>((resolve) => {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => resolve(ev.target?.result as string);
                                  reader.readAsDataURL(file);
                                });
                                const res = await fetch('/api/image/upload', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ imageBase64: base64 }),
                                });
                                const data = await res.json();
                                if (data.url) newUrls.push(data.url);
                              }
                              editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: JSON.stringify(newUrls) } });
                              setIsUploadingMulti(false);
                              e.target.value = '';
                            }}
                          />
                          {isUploadingMulti && <p className="text-xs text-gray-400 mt-1">涓婁紶涓?..</p>}
                          {urls.length > 0 && (
                            <div className="mt-1 flex gap-1 flex-wrap">
                              {urls.map((url, idx) => (
                                <div key={idx} className="relative w-16 h-16 bg-black/30 rounded-lg overflow-hidden group">
                                  <img src={url} className="w-full h-full object-cover" />
                                  <button
                                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-red-500/80 rounded text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = urls.filter((_, i) => i !== idx);
                                      editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImageUrls: next.length ? JSON.stringify(next) : '' } });
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >鉁?/button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : ['nano-banana', 'nano-banana-pro'].includes(model || '') ? (
                  /* n1n 妯″瀷锛氭渶澶?寮狅紝base64 */
                  <>
                    {(() => {
                      const imgs: string[] = uploadedImages ? JSON.parse(uploadedImages) : [];
                      return (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={imgs.length >= 2}
                            className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer disabled:opacity-50"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
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
                              e.target.value = '';
                            }}
                          />
                          {imgs.length > 0 && (
                            <div className="mt-1 flex gap-1 flex-wrap">
                              {imgs.map((img, idx) => (
                                <div key={idx} className="relative w-16 h-16 bg-black/30 rounded-lg overflow-hidden group">
                                  <img src={img} className="w-full h-full object-cover" />
                                  <button
                                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 hover:bg-red-500/80 rounded text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = imgs.filter((_, i) => i !== idx);
                                      editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, uploadedImages: next.length ? JSON.stringify(next) : '' } });
                                    }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >鉁?/button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  /* 鍏朵粬妯″瀷锛氬崟鍥句笂浼?*/
                  <>
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
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, uploadedImage: event.target?.result as string },
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                    />
                    {uploadedImage && (
                      <div className="mt-1 relative w-full h-20 bg-black/30 rounded-lg overflow-hidden group">
                        <img src={uploadedImage} alt="鍙傝€冨浘" className="w-full h-full object-cover" />
                        <button
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            editor.updateShape({
                              id: shape.id,
                              type: 'custom-card' as any,
                              props: { ...shape.props, uploadedImage: '' },
                            });
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >鉁?/button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 姣斾緥閫夋嫨 - 瑙嗛鍗＄墖锛屾牴鎹ā鍨嬪姩鎬佹樉绀?*/}
            {cardType === 'video' && currentVideoModel && currentVideoModel.aspectRatios.length > 0 && !currentVideoModel.i2vNoAspectRatio && (
              <div className="mb-2">
                <label className="text-gray-400 text-xs mb-1 block">姣斾緥</label>
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

            {/* 鍥剧墖涓婁紶 - 瑙嗛鍗＄墖锛宨2v 妯″瀷鐩存帴鏄剧ず鍦ㄥ闈?*/}
            {cardType === 'video' && currentVideoModel?.mode === 'i2v' && (
              <div className="mb-2 space-y-2">
                {/* 棣栧抚 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">棣栧抚鍥剧墖锛堝繀濉級</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                      e.target.value = '';
                    }}
                  />
                  {firstFrameImage && (
                    <div className="mt-1 relative w-full h-16 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={firstFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: '' } }); }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >鉁?/button>
                    </div>
                  )}
                </div>
                {/* 灏惧抚 - 浠?supportsEndFrame 妯″瀷鏄剧ず */}
                {currentVideoModel.supportsEndFrame && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">灏惧抚鍥剧墖锛堝彲閫夛級</label>
                    <input type="file" accept="image/*"
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                      onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                        e.target.value = '';
                      }}
                    />
                    {lastFrameImage && (
                      <div className="mt-1 relative w-full h-16 bg-black/30 rounded-lg overflow-hidden group">
                        <img src={lastFrameImage} className="w-full h-full object-cover" />
                        <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: '' } }); }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >鉁?/button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 鍗虫ⅵ杩愰暅鍙傛暟 */}
            {cardType === 'video' && model === 'jimeng-camera' && (
              <div className="mb-2 space-y-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">杩愰暅妯℃澘</label>
                  <select
                    className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 focus:bg-black/40 transition-all"
                    value={cameraTemplate ?? 'dynamic_orbit'}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => { editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, cameraTemplate: e.target.value } }); }}
                  >
                    <option value="hitchcock_dolly_in">甯屽尯鏌厠鎺ㄨ繘</option>
                    <option value="hitchcock_dolly_out">甯屽尯鏌厠鎷夎繙</option>
                    <option value="robo_arm">鏈烘鑷?/option>
                    <option value="dynamic_orbit">鍔ㄦ劅鐜粫</option>
                    <option value="central_orbit">涓績鐜粫</option>
                    <option value="crane_push">璧烽噸鏈?/option>
                    <option value="quick_pull_back">瓒呯骇鎷夎繙</option>
                    <option value="counterclockwise_swivel">閫嗘椂閽堝洖鏃?/option>
                    <option value="clockwise_swivel">椤烘椂閽堝洖鏃?/option>
                    <option value="handheld">鎵嬫寔杩愰暅</option>
                    <option value="rapid_push_pull">蹇€熸帹鎷?/option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">杩愰暅寮哄害</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'weak', label: '寮? },
                      { value: 'medium', label: '涓? },
                      { value: 'strong', label: '寮? },
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

            {/* firstLastFrame 涓撳睘妯″瀷鐨勯灏惧抚涓婁紶 */}
            {cardType === 'video' && currentVideoModel?.mode === 'firstLastFrame' && (
              <div className="mb-2 space-y-2">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">棣栧抚鍥剧墖锛堝繀濉級</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                      e.target.value = '';
                    }}
                  />
                  {firstFrameImage && (
                    <div className="mt-1 relative w-full h-16 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={firstFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, firstFrameImage: '' } }); }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >鉁?/button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">灏惧抚鍥剧墖锛堝彲閫夛級</label>
                  <input type="file" accept="image/*"
                    className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-gray-600/50 file:text-white hover:file:bg-gray-600/70 file:cursor-pointer"
                    onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { const r = new FileReader(); r.onload = (ev) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: ev.target?.result as string } }); r.readAsDataURL(file); }
                      e.target.value = '';
                    }}
                  />
                  {lastFrameImage && (
                    <div className="mt-1 relative w-full h-16 bg-black/30 rounded-lg overflow-hidden group">
                      <img src={lastFrameImage} className="w-full h-full object-cover" />
                      <button className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500/80 rounded text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, lastFrameImage: '' } }); }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >鉁?/button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 瑙嗛妯″紡鎺у埗鎸夐挳 - 浠呰棰戝崱鐗囨樉绀?*/}
            {cardType === 'video' && (
              <button
                className="w-full py-2 mt-1 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, showVideoModePanel: !showVideoModePanel } });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showVideoModePanel ? '鏀惰捣鍙傛暟璁剧疆 鈻? : '灞曞紑鍙傛暟璁剧疆 鈻?}
              </button>
            )}


            {/* 瑙嗛妯″紡闈㈡澘 - 鍙惈鏃堕暱/娓呮櫚搴?闊抽鍙傛暟 */}
            {cardType === 'video' && showVideoModePanel && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                {currentVideoModel && currentVideoModel.durations.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">鏃堕暱</label>
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

                {/* 娓呮櫚搴?*/}
                {currentVideoModel && currentVideoModel.resolutions.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">娓呮櫚搴?/label>
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

                {/* 闊抽寮€鍏?*/}
                {currentVideoModel?.supportsAudio && !currentVideoModel.audioBuiltIn && (
                  <div className="flex items-center justify-between">
                    <label className="text-gray-400 text-xs">鐢熸垚闊抽锛堟洿璐碉級</label>
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
                  <p className="text-[10px] text-gray-500">璇ユā鍨嬭嚜甯﹂煶棰?/p>
                )}
              </div>
            )}
            {cardType === 'image' && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      showCameraControl: !showCameraControl,
                    },
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {showCameraControl ? '闅愯棌闀滃ご鎺у埗' : '闀滃ご鎺у埗鍣?}
              </button>
            )}

            {/* 闀滃ご鎺у埗闈㈡澘 */}
            {cardType === 'image' && showCameraControl && (
              <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-3">
                {/* 鍥剧墖涓婁紶鍖哄煙 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">涓婁紶鍙傝€冨浘鐗?/label>
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
                            props: {
                              ...shape.props,
                              uploadedImage: imageData,
                            },
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* 鍥剧墖棰勮 */}
                {uploadedImage && (
                  <div className="relative w-full h-24 bg-black/30 rounded-lg overflow-hidden">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* 浜や簰寮忔憚鍍忓ご鎺у埗鍣?*/}
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">鎷栧姩鎽勫儚澶磋皟鏁磋搴?/label>
                  <CameraController
                    vertical={cameraVertical || 0}
                    horizontal={cameraHorizontal || 0}
                    onAngleChange={(vertical, horizontal) => {
                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: {
                          ...shape.props,
                          cameraVertical: vertical,
                          cameraHorizontal: horizontal,
                        },
                      });
                    }}
                  />
                </div>

                {/* 瑙掑害鏄剧ず */}
                <div className="flex justify-between text-xs">
                  <div className="bg-black/30 px-3 py-1.5 rounded">
                    <span className="text-gray-400">鍨傜洿: </span>
                    <span className="text-white font-mono">{cameraVertical || 0}掳</span>
                  </div>
                  <div className="bg-black/30 px-3 py-1.5 rounded">
                    <span className="text-gray-400">姘村钩: </span>
                    <span className="text-white font-mono">{cameraHorizontal || 0}掳</span>
                  </div>
                </div>

                {/* 闀滃ご淇℃伅鎻愮ず */}
                <div className="text-[10px] text-gray-500 bg-black/30 p-2 rounded">
                  鎷栧姩鎽勫儚澶村浘鏍囨棆杞紝鍙傛暟鑷姩娣诲姞鍒扮敓鎴愯瘝
                </div>
              </div>
            )}

            {/* 鐢熸垚鎸夐挳 - 浠呴潪瑙掕壊鍗＄墖鏄剧ず */}
            {cardType !== 'character' && (
            <button
              className={`w-full py-2 ${cardType === 'kling' ? 'mt-2 order-[1]' : showCameraControl && cardType === 'image' ? 'mt-2' : 'mt-0'} rounded-lg font-semibold text-white text-xs transition-all shadow-lg backdrop-blur-sm ${
                isGenerating
                  ? 'bg-gray-500 cursor-not-allowed'
                  : `hover:scale-[1.02] active:scale-[0.98] ${color.buttonBg}`
              }`}
              disabled={isGenerating}
              onClick={async (e) => {
                e.stopPropagation();

                if (cardType === 'text') {
                  // 鏂囨湰鐢熸垚閫昏緫 鈥?闇€瑕佷細鍛?
                  if (!isMember) { setShowMemberModal(true); return; }
                  console.log('鐢熸垚鏂囨湰锛屾ā鍨?', model);
                  console.log('Prompt:', prompt);

                  // 璁剧疆鐢熸垚涓姸鎬?

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
                      throw new Error('API 璋冪敤澶辫触');
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
                    console.error('鏂囨湰鐢熸垚閿欒:', error);
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        textOutput: '鐢熸垚澶辫触锛岃閲嶈瘯',
                        isGenerating: false,
                      },
                    });
                  }
                } else if (cardType === 'image') {
                  // 鍥剧墖鐢熸垚閫昏緫
                  const shotPrompt = getShotCardPrompt();
                  const basePrompt = ((cameraVertical ?? 0) !== 0 || (cameraHorizontal ?? 0) !== 0)
                    ? `${prompt} [Camera: vertical ${(cameraVertical ?? 0) >= 0 ? '+' : ''}${cameraVertical ?? 0}掳, horizontal ${(cameraHorizontal ?? 0) >= 0 ? '+' : ''}${cameraHorizontal ?? 0}掳]`
                    : prompt;
                  const fullPrompt = shotPrompt ? `${shotPrompt}\n${basePrompt}` : basePrompt;
                  console.log('鐢熸垚鍥剧墖锛屽畬鏁碢rompt:', fullPrompt);
                  console.log('妯″瀷:', model);
                  console.log('涓婁紶鐨勫浘鐗?', uploadedImage ? '宸蹭笂浼? : '鏈笂浼?);

                  // 璁剧疆鐢熸垚涓姸鎬?

                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      generationProgress: 10,
                      generationStatus: '鐢熸垚鍥剧墖涓?..',
                    },
                  });

                  try {
                    const response = await fetch('/api/image/generate', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: model || 'nano-banana-pro',
                        prompt: fullPrompt,
                        aspectRatio: aspectRatio || '1:1',
                        imageBase64: uploadedImage || undefined,
                        imageBase64Array: ['nano-banana', 'nano-banana-pro'].includes(model || '') && uploadedImages
                          ? JSON.parse(uploadedImages)
                          : undefined,
                        imageUrlArray: model === 'nano-banana-pro-multi' && uploadedImageUrls
                          ? JSON.parse(uploadedImageUrls)
                          : undefined,
                        imageQuality: ['nano-banana-pro', 'nano-banana-pro-multi'].includes(model || '') ? (imageQuality ?? '2k') : undefined,
                        userId: userId || undefined,
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('API 璋冪敤澶辫触');
                    }

                    const data = await response.json();

                    // MJ 寮傛妯″紡锛氳疆璇㈡煡璇㈢粨鏋?

                    if (data.pending && data.taskId) {
                      const mjPoll = async (): Promise<string> => {
                        await new Promise(r => setTimeout(r, 3000));
                        const qRes = await fetch(`/api/image/mj-query?taskId=${encodeURIComponent(data.taskId)}`);
                        const qData = await qRes.json();
                        if (qData.status === 'completed' && qData.imageUrl) return qData.imageUrl;
                        if (qData.status === 'failed') throw new Error(qData.error || 'MJ 鐢熸垚澶辫触');
                        return mjPoll();
                      };
                      data.imageUrl = await mjPoll();
                    }

                    // fal 寮傛妯″紡锛氳疆璇㈡煡璇㈢粨鏋?

                    if (data.pending && data.requestId) {
                      const falEndpointMap: Record<string, string> = {
                        'flux-kontext': 'fal-ai/flux-pro/kontext/max',
                        'flux-kontext-max': 'fal-ai/flux-pro/kontext/max/text-to-image',
                        'nano-banana-pro-multi': 'fal-ai/nano-banana-pro/edit',
                      };
                      const falEndpoint = falEndpointMap[data.model] || 'fal-ai/nano-banana-pro/edit';
                      const falPoll = async (): Promise<string> => {
                        await new Promise(r => setTimeout(r, 3000));
                        const qRes = await fetch(`/api/image/fal-query?requestId=${encodeURIComponent(data.requestId)}&endpoint=${encodeURIComponent(falEndpoint)}`);
                        const qData = await qRes.json();
                        if (qData.success && qData.imageUrl) return qData.imageUrl;
                        if (qData.error) throw new Error(qData.error);
                        return falPoll();
                      };
                      data.imageUrl = await falPoll();
                    }

                    // 涓婁紶鍒?Supabase Storage锛岃幏鍙栨案涔?URL

                    let finalImageUrl = data.imageUrl;
                    try {
                      const supabase = createClient();
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user && data.imageUrl) {
                        finalImageUrl = await mirrorUrlToStorage(user.id, data.imageUrl, 'image');
                      }
                    } catch (uploadErr) {
                      console.warn('涓婁紶鍒?Storage 澶辫触锛屼娇鐢ㄥ師濮?URL:', uploadErr);
                    }

                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        generatedImage: finalImageUrl,
                        showImageOutput: true,
                        isGenerating: false,
                      },
                    });
                    refreshBalance();
                  } catch (error) {
                    console.error('鍥剧墖鐢熸垚閿欒:', error);
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        isGenerating: false,
                      },
                    });
                    alert('鍥剧墖鐢熸垚澶辫触锛岃閲嶈瘯');
                  }
                } else if (cardType === 'video') {
                  // 瑙嗛鐢熸垚閫昏緫
                  const shotPrompt = getShotCardPrompt();
                  const videoPrompt = shotPrompt ? `${shotPrompt}\n${prompt}` : prompt;
                  console.log('鐢熸垚瑙嗛锛屾ā寮?', videoMode || 'text');
                  console.log('Prompt:', videoPrompt);
                  console.log('妯″瀷:', model);

                  // 璁剧疆鐢熸垚涓姸鎬?

                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      generationProgress: 5,
                      generationStatus: '鎻愪氦浠诲姟涓?..',
                    },
                  });

                  try {
                    // 鍘嬬缉鍥剧墖鍒?1.5MB 浠ュ唴
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
                    const [compressedStart, compressedEnd] = await Promise.all([
                      needsStart ? compressImage(firstFrameImage) : Promise.resolve(undefined),
                      needsEnd ? compressImage(lastFrameImage) : Promise.resolve(undefined),
                    ]);

                    // 璋冪敤瑙嗛鐢熸垚 API

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
                      throw new Error('瑙嗛鐢熸垚璇锋眰澶辫触');
                    }

                    const data = await response.json();
                    const taskId = data.taskId;
                    const videoEndpoint = data.endpoint;

                    // 鑾峰彇 token 鐢ㄤ簬杞閴存潈

                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();
                    const authToken = session?.access_token || '';

                    // 杞鏌ヨ瑙嗛鐘舵€?

                    const maxAttempts = 60;
                    let attempts = 0;

                    const poll = async (): Promise<void> => {
                      if (attempts >= maxAttempts) {
                        throw new Error('瑙嗛鐢熸垚瓒呮椂锛岃绋嶅悗閲嶈瘯');
                      }

                      attempts++;
                      await new Promise(resolve => setTimeout(resolve, 5000));

                      const queryResponse = await fetch(`/api/video/query?taskId=${encodeURIComponent(taskId)}&endpoint=${encodeURIComponent(videoEndpoint)}`, {
                        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                      });
                      if (!queryResponse.ok) return poll();

                      const queryData = await queryResponse.json();

                      // 鐢?getShape 鑾峰彇鏈€鏂?props锛岄伩鍏嶉棴鍖呮棫鍊艰鐩?isGenerating

                      const latestShape = editor.getShape(shape.id);
                      if (!latestShape) return;
                      const latestProps = (latestShape as any).props;

                      // 鏇存柊杩涘害

                      const progress = queryData.progress || 30;
                      const statusText = queryData.status === 'pending' ? '鎺掗槦涓?..' : queryData.status === 'processing' ? '鐢熸垚涓?..' : '澶勭悊涓?..';
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
                            generationStatus: '鐢熸垚瀹屾垚',
                          },
                        });
                        refreshBalance();
                      } else if (queryData.status === 'failed') {
                        throw new Error('瑙嗛鐢熸垚澶辫触');
                      } else {
                        return poll();
                      }
                    };

                    await poll();

                  } catch (error) {
                    console.error('瑙嗛鐢熸垚閿欒:', error);
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        isGenerating: false,
                      },
                    });
                    alert('瑙嗛鐢熸垚澶辫触锛岃閲嶈瘯');
                  }
                } else if (cardType === 'kling') {
                  // Kling 鐢熸垚閫昏緫
                  const currentMode = currentKlingMode;

                  editor.updateShape({
                    id: shape.id,
                    type: 'custom-card' as any,
                    props: {
                      ...shape.props,
                      isGenerating: true,
                      generationProgress: 5,
                      generationStatus: currentMode === 'lip-sync' ? '鍑嗗瀵瑰彛鍨嬩换鍔?..' : '鎻愪氦浠诲姟涓?..',
                      klingLipSyncPhase: currentMode === 'lip-sync' ? 'identifying' : klingLipSyncPhase,
                      capturedFrame: '',
                      klingGeneratedVideo: '',
                      klingShowOutput: false,
                    },
                  });

                  try {
                    let taskId = '';
                    let queryMode = currentMode;

                    if (currentMode === 'lip-sync') {
                      if (!klingVideoUrl) throw new Error('璇峰～鍐欐垨涓婁紶婧愯棰?);
                      if (!klingLipSyncAudio) throw new Error('璇蜂笂浼犲鍙ｅ瀷闊抽');

                      const soundStart = Math.max(0, Math.floor(klingLipSyncSoundStart ?? 0));
                      const soundEnd = Math.max(0, Math.floor(klingLipSyncSoundEnd ?? 5000));
                      const soundInsert = Math.max(0, Math.floor(klingLipSyncSoundInsert ?? 0));
                      const soundVolume = Math.min(2, Math.max(0, Number(klingLipSyncSoundVolume ?? 1)));
                      const originalAudioVolume = Math.min(2, Math.max(0, Number(klingLipSyncOriginalVolume ?? 1)));

                      if (soundEnd <= soundStart) {
                        throw new Error('闊抽缁撴潫鏃堕棿蹇呴』澶т簬寮€濮嬫椂闂?);
                      }

                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: { ...shape.props, isGenerating: true, generationProgress: 15, generationStatus: '浜鸿劯璇嗗埆涓?..', klingLipSyncPhase: 'identifying' },
                      });

                      const identifyResponse = await fetch('/api/kling/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          mode: 'identify-face',
                          video_url: klingVideoUrl,
                        }),
                      });

                      if (!identifyResponse.ok) {
                        const errData = await identifyResponse.json();
                        throw new Error(errData.error || '浜鸿劯璇嗗埆澶辫触');
                      }

                      const identifyData = await identifyResponse.json();
                      const sessionId = identifyData.sessionId || klingLipSyncSessionId;
                      const faceId = identifyData.faceId || klingLipSyncFaceId || '-1';
                      const faces = Array.isArray(identifyData.faces) ? identifyData.faces : [];

                      if (!sessionId) {
                        throw new Error('浜鸿劯璇嗗埆鏈繑鍥?session_id');
                      }

                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: {
                          ...shape.props,
                          isGenerating: true,
                          generationProgress: 35,
                          generationStatus: '宸茶瘑鍒汉鑴革紝寮€濮嬬敓鎴愬鍙ｅ瀷瑙嗛...',
                          klingLipSyncSessionId: sessionId,
                          klingLipSyncFaceId: faceId,
                          klingLipSyncFaces: JSON.stringify(faces),
                          klingLipSyncPhase: 'syncing',
                        },
                      });

                      const lipSyncResponse = await fetch('/api/kling/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          mode: 'advanced-lip-sync',
                          session_id: sessionId,
                          face_id: faceId,
                          sound_file: klingLipSyncAudio,
                          sound_start_time: soundStart,
                          sound_end_time: soundEnd,
                          sound_insert_time: soundInsert,
                          sound_volume: soundVolume,
                          original_audio_volume: originalAudioVolume,
                        }),
                      });

                      if (!lipSyncResponse.ok) {
                        const errData = await lipSyncResponse.json();
                        throw new Error(errData.error || '瀵瑰彛鍨嬩换鍔℃彁浜ゅけ璐?);
                      }

                      const lipSyncData = await lipSyncResponse.json();
                      taskId = lipSyncData.taskId;
                      queryMode = 'advanced-lip-sync';
                    } else {
                      const reqBody: Record<string, unknown> = {
                        mode: currentMode,
                        model_name: normalizedKlingMotionVersion,
                        motionVersion: normalizedKlingMotionVersion,
                        prompt: prompt || '',
                        videoMode: klingVideoMode || 'std',
                        aspect_ratio: klingAspectRatio || '16:9',
                        duration: klingDuration || '5',
                        sound: klingSound || 'off',
                      };

                      if (!klingImage) throw new Error('璇蜂笂浼犱汉鐗╁弬鑰冨浘');
                      if (!klingVideoUrl) throw new Error('璇峰～鍐欐垨涓婁紶鍔ㄤ綔鍙傝€冭棰?);
                      reqBody.image_url = klingImage;
                      reqBody.video_url = klingVideoUrl;
                      reqBody.character_orientation = klingCharacterOrientation || 'image';
                      reqBody.keep_original_sound = klingKeepSound || 'no';

                      const response = await fetch('/api/kling/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reqBody),
                      });

                      if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.error || 'Kling 璇锋眰澶辫触');
                      }

                      const data = await response.json();
                      taskId = data.taskId;
                    }

                    // 杞鏌ヨ

                    const maxAttempts = 120;
                    let attempts = 0;

                    const poll = async (): Promise<void> => {
                      if (attempts >= maxAttempts) throw new Error('鐢熸垚瓒呮椂锛岃绋嶅悗閲嶈瘯');
                      attempts++;
                      await new Promise(r => setTimeout(r, 5000));

                      const qRes = await fetch(`/api/kling/query?taskId=${encodeURIComponent(taskId)}&mode=${encodeURIComponent(queryMode)}`);
                      if (!qRes.ok) return poll();

                      const qData = await qRes.json();
                      const latestShape = editor.getShape(shape.id);
                      if (!latestShape) return;
                      const latestProps = (latestShape as any).props;

                      const statusText =
                        qData.status === 'pending'
                          ? (currentMode === 'lip-sync' ? '瀵瑰彛鍨嬫帓闃熶腑...' : '鎺掗槦涓?..')
                          : qData.status === 'processing'
                            ? (currentMode === 'lip-sync' ? '瀵瑰彛鍨嬬敓鎴愪腑...' : '鐢熸垚涓?..')
                            : '澶勭悊涓?..';
                      editor.updateShape({
                        id: shape.id,
                        type: 'custom-card' as any,
                        props: { ...latestProps, generationProgress: qData.progress || 30, generationStatus: statusText },
                      });

                      if (qData.status === 'completed' && qData.videoUrl) {
                        const latestShape2 = editor.getShape(shape.id);
                        const latestProps2 = latestShape2 ? (latestShape2 as any).props : latestProps;
                        editor.updateShape({
                          id: shape.id,
                          type: 'custom-card' as any,
                          props: {
                            ...latestProps2,
                            klingGeneratedVideo: qData.videoUrl,
                            klingShowOutput: true,
                            capturedFrame: '',
                            isGenerating: false,
                            generationProgress: 100,
                            generationStatus: currentMode === 'lip-sync' ? '瀵瑰彛鍨嬪畬鎴? : '鐢熸垚瀹屾垚',
                            klingLipSyncPhase: currentMode === 'lip-sync' ? 'completed' : klingLipSyncPhase,
                          },
                        });
                      } else if (qData.status === 'failed') {
                        throw new Error(qData.errorDetail || 'Kling 鐢熸垚澶辫触');
                      } else {
                        return poll();
                      }
                    };

                    await poll();

                  } catch (error: any) {
                    console.error('Kling 鐢熸垚閿欒:', error);
                    const latestShape = editor.getShape(shape.id);
                    const latestProps = latestShape ? (latestShape as any).props : shape.props;
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: { ...latestProps, isGenerating: false, klingLipSyncPhase: currentMode === 'lip-sync' ? 'idle' : latestProps.klingLipSyncPhase },
                    });
                    alert(error.message || 'Kling 鐢熸垚澶辫触锛岃閲嶈瘯');
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

            {/* 鐢熸垚杩涘害鏉?*/}
            {isGenerating && generationProgress !== undefined && generationProgress > 0 && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">鐢熸垚杩涘害</span>
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

            {/* 鍥剧墖杈撳嚭鎸夐挳 - 浠呭浘鐗囧崱鐗囨樉绀?*/}
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
                {showImageOutput ? '闅愯棌鍥剧墖' : '鏌ョ湅鐢熸垚鍥剧墖'}
              </button>
            )}

            {/* 鍥剧墖杈撳嚭闈㈡澘 */}
            {cardType === 'image' && showImageOutput && generatedImage && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                <div className="relative group">
                  {/* 鐢熸垚鐨勫浘鐗?*/}
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full h-auto max-h-[250px] object-contain bg-black/20"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* 鎮仠鏃舵樉绀虹殑鎿嶄綔鎸夐挳 */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {/* 鏌ョ湅澶у浘鎸夐挳 */}
                    <button
                      className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxVideo(generatedImage);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="鏌ョ湅澶у浘"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                      鏌ョ湅
                    </button>

                    {/* 涓嬭浇鎸夐挳 */}
                    <button
                      className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(generatedImage, `generated-${Date.now()}.png`);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="涓嬭浇鍥剧墖"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      涓嬭浇
                    </button>

                    {/* 鍒犻櫎鎸夐挳 */}
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
                      title="鍒犻櫎鍥剧墖"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      鍒犻櫎
                    </button>
                  </div>

                  {/* 鍥剧墖淇℃伅 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">鐢熸垚鎴愬姛</p>
                  </div>
                </div>
              </div>
            )}

            {/* 瑙嗛杈撳嚭鎸夐挳 - 浠呰棰戝崱鐗囨樉绀?*/}
            {cardType === 'video' && generatedVideo && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
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
                {showVideoOutput ? '闅愯棌瑙嗛' : '鏌ョ湅鐢熸垚瑙嗛'}
              </button>
            )}

            {/* 瑙嗛杈撳嚭闈㈡澘 */}
            {cardType === 'video' && showVideoOutput && generatedVideo && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                <div className="relative group" style={{ minHeight: '200px' }}>
                  {/* 鐢熸垚鐨勮棰戞挱鏀惧櫒 */}
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
                    鎮ㄧ殑娴忚鍣ㄤ笉鏀寔瑙嗛鎾斁
                  </video>

                  {/* 鎮仠鏃舵樉绀虹殑鎿嶄綔鎸夐挳 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 淇濆瓨褰撳墠甯ф寜閽?*/}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        captureCurrentFrame();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="淇濆瓨褰撳墠甯?
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>

                    {/* 鍏ㄥ睆鎾斁鎸夐挳 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxVideo(generatedVideo);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="鏀惧ぇ鎾斁"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>

                    {/* 涓嬭浇瑙嗛鎸夐挳 */}
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(generatedVideo, `generated-video-${Date.now()}.mp4`);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="涓嬭浇瑙嗛"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>

                    {/* 鍒犻櫎瑙嗛鎸夐挳 */}
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
                      title="鍒犻櫎瑙嗛"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* 瑙嗛淇℃伅 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">
                      鐢熸垚鎴愬姛 路 {videoMode === 'text' ? '鏂囨湰鐢熸垚' : videoMode === 'first-frame' ? '棣栧抚鐢熸垚' : '棣栧熬甯х敓鎴?}
                    </p>
                  </div>
                </div>

                {/* 鎹曡幏鐨勫抚鍥剧墖鏄剧ず */}
                {capturedFrame && (
                  <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                    <div className="p-2 bg-white/5 border-b border-white/10">
                      <p className="text-gray-200 text-[10px] font-semibold">鎹曡幏鐨勮棰戝抚</p>
                    </div>
                    <div className="relative group">
                      <img
                        src={capturedFrame}
                        alt="Captured Frame"
                        className="w-full h-auto max-h-[200px] object-contain bg-black/20"
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* 鎮仠鏃舵樉绀虹殑鎿嶄綔鎸夐挳 */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* 鏌ョ湅澶у浘鎸夐挳 */}
                        <button
                          className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(capturedFrame, '_blank');
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          title="鏌ョ湅澶у浘"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          鏌ョ湅
                        </button>

                        {/* 涓嬭浇鎸夐挳 */}
                        <button
                          className="px-3 py-2 bg-green-500/90 hover:bg-green-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(capturedFrame, `video-frame-${Date.now()}.png`);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                          title="涓嬭浇鍥剧墖"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          涓嬭浇
                        </button>

                        {/* 鍒犻櫎鎸夐挳 */}
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
                          title="鍒犻櫎鍥剧墖"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          鍒犻櫎
                        </button>
                      </div>

                      {/* 鍥剧墖淇℃伅 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                        <p className="text-white text-[10px] truncate">宸蹭繚瀛樿棰戝抚</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== Kling 鍗＄墖涓撳睘 UI ===== */}
            {cardType === 'kling' && (
              <div className="space-y-2">
                {/* 妯″紡閫夋嫨 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">妯″紡</label>
                  <div className="flex gap-1">
                    {[
                      { value: 'motion-control', label: '杩愬姩鎺у埗' },
                      { value: 'lip-sync', label: '瀵瑰彛鍨? },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${klingModeForUi === value ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingMode: value as any, capturedFrame: '', klingGeneratedVideo: '', klingShowOutput: false, generationStatus: '', klingLipSyncPhase: 'idle' } });
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <button
                  className="w-full py-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    editor.updateShape({
                      id: shape.id,
                      type: 'custom-card' as any,
                      props: {
                        ...shape.props,
                        showKlingSettingsPanel: !klingSettingsPanelOpen,
                      },
                    });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {klingSettingsPanelOpen ? '鏀惰捣鍙傛暟璁剧疆 鈻? : '灞曞紑鍙傛暟璁剧疆 鈻?}
                </button>
                {klingSettingsPanelOpen && currentKlingMode === 'motion-control' && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-gray-400 text-xs">鎻愮ず璇?/label>
                        <button className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors" onClick={async (e) => { e.stopPropagation(); try { const text = await navigator.clipboard.readText(); if (text) editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, prompt: (prompt ? `${prompt}\n` : '') + text } }); } catch {} }} onPointerDown={(e) => e.stopPropagation()}>绮樿创</button>
                      </div>
                      <textarea className="w-full h-16 bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs resize-none focus:outline-none focus:border-white/15 transition-all placeholder-gray-500" placeholder="鍙€夛紝琛ュ厖闀滃ご鎻忚堪銆佺幆澧冦€佽妭濂忕瓑淇℃伅..." value={prompt} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, prompt: e.target.value } })} />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">鐗堟湰</label>
                      <div className="flex gap-1">
                        {['v2.6', 'v3.0'].map((value) => (
                          <button key={value} className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(normalizedKlingMotionVersion === value) ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`} onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingMotionVersion: value as any, klingModel: value } }); }} onPointerDown={(e) => e.stopPropagation()}>{value.toUpperCase()}</button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-gray-500">褰撳墠鏈湴鏂囨。閲屽姩浣滄帶鍒惰姹傚彧鏄庣‘浜?`std / pro`锛岀増鏈瓧娈靛厛鎸?UI 璁板綍淇濈暀銆?/p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">杈撳嚭瑙勬牸</label>
                      <div className="flex gap-1">
                        {[{ value: 'std', label: 'Std 路 720P' }, { value: 'pro', label: 'Pro 路 1080P' }].map(({ value, label }) => (
                          <button key={value} className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(klingVideoMode || 'std') === value ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`} onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoMode: value as any } }); }} onPointerDown={(e) => e.stopPropagation()}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">浜虹墿鍙傝€冨浘</label>
                      <div className="w-full h-20 bg-black/30 border border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-white/30 transition-all relative overflow-hidden" onClick={(e) => { e.stopPropagation(); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = async (ev) => { const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (re) => { editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingImage: re.target?.result as string } }); }; reader.readAsDataURL(file); }; inp.click(); }} onPointerDown={(e) => e.stopPropagation()}>
                        {klingImage ? <>
                          <img src={klingImage} alt="kling-reference" className="w-full h-full object-cover" />
                          <button className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/85 rounded-lg text-white" onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingImage: '' } }); }} onPointerDown={(e) => e.stopPropagation()} title="绉婚櫎鍙傝€冨浘">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </> : <span className="text-gray-500 text-xs">鐐瑰嚮涓婁紶鍙傝€冧汉鐗╁浘鐗?/span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">鍔ㄤ綔鍙傝€冭棰?URL</label>
                        <input className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-600" placeholder="https://..." value={klingVideoInputUrl || ''} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoInputUrl: e.target.value, klingVideoUrl: e.target.value, klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '', klingLipSyncFaces: '', klingLipSyncPhase: 'idle' } })} />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">鎴栦笂浼犲姩浣滆棰戯紙mp4/mov锛?lt;=100MB锛?/label>
                        <div className="w-full min-h-16 bg-black/30 border border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-white/30 transition-all px-3 py-3" onClick={(e) => { e.stopPropagation(); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mp4,.mov,video/mp4,video/quicktime'; inp.onchange = async (ev) => { const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return; await handleKlingVideoUpload(file); }; inp.click(); }} onPointerDown={(e) => e.stopPropagation()}>
                          {klingVideoName ? <div className="flex w-full items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-white truncate">{klingVideoName}</p><p className="text-[10px] text-gray-500">宸蹭笂浼狅紝灏嗚嚜鍔ㄨ浆鎹负鍙闂?URL 鍚庢彁浜?/p></div><button className="px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-[10px] text-white transition-all" onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoUrl: '', klingVideoInputUrl: '', klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '', klingLipSyncFaces: '', klingLipSyncPhase: 'idle' } }); }} onPointerDown={(e) => e.stopPropagation()}>绉婚櫎</button></div> : <span className="text-gray-500 text-xs">{isUploadingKlingVideo ? '瑙嗛涓婁紶涓?..' : '鐐瑰嚮涓婁紶鍔ㄤ綔鍙傝€冭棰?}</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">浜虹墿鏈濆悜</label>
                      <div className="flex gap-1">
                        {[{ value: 'image', label: '涓庡浘鐗囦竴鑷? }, { value: 'video', label: '涓庤棰戜竴鑷? }].map(({ value, label }) => (
                          <button key={value} className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(klingCharacterOrientation || 'image') === value ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`} onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingCharacterOrientation: value as any } }); }} onPointerDown={(e) => e.stopPropagation()}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">淇濈暀鍘熷０</label>
                      <div className="flex gap-1">
                        {[{ value: 'no', label: '涓嶄繚鐣? }, { value: 'yes', label: '淇濈暀' }].map(({ value, label }) => (
                          <button key={value} className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${(klingKeepSound || 'no') === value ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`} onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingKeepSound: value as any } }); }} onPointerDown={(e) => e.stopPropagation()}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-[10px] text-gray-400">鏂囨。绾︽潫</p>
                      <p className="mt-1 text-[10px] text-gray-500">鏈濆悜涓衡€滀笌鍥剧墖涓€鑷粹€濇椂锛屽弬鑰冭棰戝缓璁笉瓒呰繃 10 绉掞紱鏈濆悜涓衡€滀笌瑙嗛涓€鑷粹€濇椂锛屾渶闀垮彲鍒?30 绉掋€?/p>
                    </div>
                  </>
                )}

                {klingSettingsPanelOpen && currentKlingMode === 'lip-sync' && (
                  <>
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-[10px] font-semibold text-gray-300">鑷姩娴佺▼</p>
                      <p className="mt-1 text-[10px] text-gray-500">濉啓婧愯棰?URL 鎴栦笂浼犳簮瑙嗛锛屽啀鍑嗗濂藉鍙ｅ瀷闊抽鍚庯紝鐐瑰嚮 Generate 浼氳嚜鍔ㄥ厛鎵ц浜鸿劯璇嗗埆锛屽啀杩涘叆瀵瑰彛鍨嬨€?/p>
                      <p className="mt-1 text-[10px] text-gray-500">浜鸿劯璇嗗埆鍩轰簬婧愯棰戞墽琛岋紝涓嶉渶瑕佸崟鐙笂浼犲浘鐗囥€?/p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-gray-300">姝ラ鐘舵€?/p>
                        <span className="text-[10px] text-gray-500">鐘舵€佸睍绀猴紝鏃犻渶鐐瑰嚮</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          {
                            title: '1. 浜鸿劯璇嗗埆',
                            active: klingLipSyncPhase === 'identifying',
                            done: klingLipSyncPhase === 'syncing' || klingLipSyncPhase === 'completed',
                            desc: klingLipSyncPhase === 'identifying' ? '姝ｅ湪璇嗗埆涓?..' : (klingLipSyncPhase === 'syncing' || klingLipSyncPhase === 'completed') ? '璇嗗埆瀹屾垚' : '绛夊緟寮€濮?,
                          },
                          {
                            title: '2. 瀵瑰彛鍨嬬敓鎴?,
                            active: klingLipSyncPhase === 'syncing',
                            done: klingLipSyncPhase === 'completed',
                            desc: klingLipSyncPhase === 'completed' ? '鐢熸垚瀹屾垚' : klingLipSyncPhase === 'syncing' ? '鐢熸垚涓?..' : '绛夊緟寮€濮?,
                          },
                        ].map((step) => (
                          <div key={step.title} className={`rounded-lg border px-3 py-2 cursor-default select-none transition-all ${step.active ? 'border-white/20 bg-white/5' : step.done ? 'border-white/15 bg-black/30' : 'border-white/10 bg-black/20'}`}>
                            <p className={`text-[11px] font-semibold ${step.active ? 'text-white' : step.done ? 'text-gray-200' : 'text-gray-300'}`}>{step.title}</p>
                            <p className="mt-1 text-[10px] text-gray-500">{step.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">婧愯棰?URL</label>
                        <input className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-600" placeholder="https://..." value={klingVideoInputUrl || ''} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoInputUrl: e.target.value, klingVideoUrl: e.target.value, klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '', klingLipSyncFaces: '', klingLipSyncPhase: 'idle' } })} />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">鎴栦笂浼犳簮瑙嗛锛坢p4/mov锛?lt;=100MB锛?/label>
                        <div className="w-full min-h-16 bg-black/30 border border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-white/30 transition-all px-3 py-3" onClick={(e) => { e.stopPropagation(); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mp4,.mov,video/mp4,video/quicktime'; inp.onchange = async (ev) => { const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return; await handleKlingVideoUpload(file); }; inp.click(); }} onPointerDown={(e) => e.stopPropagation()}>
                          {klingVideoName ? <div className="flex w-full items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-white truncate">{klingVideoName}</p><p className="text-[10px] text-gray-500">璇嗗埆鏃跺皢鐩存帴浣跨敤杩欐瑙嗛</p></div><button className="px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-[10px] text-white transition-all" onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingVideoUrl: '', klingVideoInputUrl: '', klingVideoName: '', klingLipSyncSessionId: '', klingLipSyncFaceId: '', klingLipSyncFaces: '', klingLipSyncPhase: 'idle' } }); }} onPointerDown={(e) => e.stopPropagation()}>绉婚櫎</button></div> : <span className="text-gray-500 text-xs">{isUploadingKlingVideo ? '瑙嗛涓婁紶涓?..' : '鐐瑰嚮涓婁紶婧愯棰?}</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">涓婁紶闊抽</label>
                      <div className="w-full min-h-16 bg-black/30 border border-dashed border-white/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-white/30 transition-all px-3 py-3" onClick={(e) => { e.stopPropagation(); const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.mp3,.wav,.m4a,audio/*'; inp.onchange = async (ev) => { const file = (ev.target as HTMLInputElement).files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (re) => { editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncAudio: re.target?.result as string, klingLipSyncAudioName: file.name } }); }; reader.readAsDataURL(file); }; inp.click(); }} onPointerDown={(e) => e.stopPropagation()}>
                        {klingLipSyncAudio ? <div className="flex w-full items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs text-white truncate">{klingLipSyncAudioName || '宸蹭笂浼犻煶棰?}</p><p className="text-[10px] text-gray-500">鏀寔 mp3 / wav / m4a锛岀洿鎺ヤ綔涓?sound_file 鎻愪氦</p></div><button className="px-2 py-1 rounded-md bg-black/50 hover:bg-black/70 text-[10px] text-white transition-all" onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncAudio: '', klingLipSyncAudioName: '' } }); }} onPointerDown={(e) => e.stopPropagation()}>绉婚櫎</button></div> : <span className="text-gray-500 text-xs">鐐瑰嚮涓婁紶瀵瑰彛鍨嬮煶棰?/span>}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Face ID</label>
                      <input className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all placeholder-gray-600" placeholder="璇嗗埆浜鸿劯鍚庤嚜鍔ㄥ～鍏咃紝鍙墜鍔ㄤ慨鏀? value={klingLipSyncFaceId || ''} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncFaceId: e.target.value } })} />
                    </div>
                    {klingDetectedFaces.length > 0 && (
                      <div>
                        <label className="text-gray-400 text-xs mb-1 block">璇嗗埆鍒扮殑浜鸿劯</label>
                        <div className="grid grid-cols-2 gap-1">
                          {klingDetectedFaces.map((face, index) => {
                            const faceValue = face.face_id || face.faceId || `${index}`;
                            const faceLabel = face.name || `浜鸿劯 ${index + 1}`;
                            return <button key={`${faceValue}-${index}`} className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${(klingLipSyncFaceId || '') === faceValue ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-black/30 border-white/8 text-gray-400 hover:border-white/20'}`} onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncFaceId: faceValue } }); }} onPointerDown={(e) => e.stopPropagation()}>{faceLabel}</button>;
                          })}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-gray-400 text-xs mb-1 block">寮€濮嬫椂闂?ms)</label><input type="number" min={0} className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all" value={klingLipSyncSoundStart ?? 0} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundStart: Number(e.target.value || 0) } })} /></div>
                      <div><label className="text-gray-400 text-xs mb-1 block">缁撴潫鏃堕棿(ms)</label><input type="number" min={0} className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all" value={klingLipSyncSoundEnd ?? 5000} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundEnd: Number(e.target.value || 0) } })} /></div>
                      <div><label className="text-gray-400 text-xs mb-1 block">鎻掑叆鏃堕棿(ms)</label><input type="number" min={0} className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all" value={klingLipSyncSoundInsert ?? 0} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundInsert: Number(e.target.value || 0) } })} /></div>
                      <div><label className="text-gray-400 text-xs mb-1 block">闊抽闊抽噺(0-2)</label><input type="number" min={0} max={2} step={0.1} className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all" value={klingLipSyncSoundVolume ?? 1} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncSoundVolume: Number(e.target.value || 0) } })} /></div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">鍘熻棰戦煶閲?0-2)</label>
                      <input type="number" min={0} max={2} step={0.1} className="w-full bg-black/30 border border-white/8 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-white/15 transition-all" value={klingLipSyncOriginalVolume ?? 1} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onChange={(e) => editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingLipSyncOriginalVolume: Number(e.target.value || 0) } })} />
                    </div>
                    {(klingLipSyncSessionId || klingLipSyncFaceId) && <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"><p className="text-[10px] text-gray-400">鏈€杩戜竴娆¤瘑鍒粨鏋?/p>{klingLipSyncSessionId && <p className="mt-1 text-[10px] text-gray-500 truncate">Session: {klingLipSyncSessionId}</p>}{klingLipSyncFaceId && <p className="text-[10px] text-gray-500 truncate">Face ID: {klingLipSyncFaceId}</p>}</div>}
                    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <p className="text-[10px] text-gray-400">娴佺▼璇存槑</p>
                      <p className="mt-1 text-[10px] text-gray-500">鐐瑰嚮鐢熸垚鍚庝細鍏堟墽琛屼汉鑴歌瘑鍒紝鍐嶈嚜鍔ㄨ繘鍏ュ鍙ｅ瀷浠诲姟銆?/p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Kling 瑙嗛杈撳嚭鎸夐挳 */}
            {cardType === 'kling' && klingGeneratedVideo && (
              <button
                className="w-full py-2 mt-2 rounded-lg font-semibold text-white text-xs transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg backdrop-blur-sm bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-500 hover:to-blue-600"
                onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingShowOutput: !klingShowOutput } }); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {klingShowOutput ? '闅愯棌瑙嗛' : '鏌ョ湅鐢熸垚瑙嗛'}
              </button>
            )}

            {/* Kling 瑙嗛杈撳嚭闈㈡澘 */}
            {cardType === 'kling' && klingShowOutput && klingGeneratedVideo && (
              <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-visible">
                <div className="relative group" style={{ minHeight: '200px' }}>
                  <video
                    ref={videoRef}
                    src={klingGeneratedVideo}
                    controls
                    crossOrigin="anonymous"
                    className="w-full bg-black"
                    style={{ minHeight: '200px', maxHeight: '250px' }}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    鎮ㄧ殑娴忚鍣ㄤ笉鏀寔瑙嗛鎾斁
                  </video>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => { e.stopPropagation(); captureCurrentFrame(); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="淇濆瓨褰撳墠甯?
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => { e.stopPropagation(); setLightboxVideo(klingGeneratedVideo); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="鏀惧ぇ鎾斁"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => { e.stopPropagation(); downloadFile(klingGeneratedVideo, `kling-video-${Date.now()}.mp4`); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="涓嬭浇瑙嗛"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      className="p-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white transition-all"
                      onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, klingGeneratedVideo: '', klingShowOutput: false, capturedFrame: '' } }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      title="鍒犻櫎瑙嗛"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                    <p className="text-white text-[10px] truncate">鐢熸垚鎴愬姛 路 {currentKlingMode === 'lip-sync' ? '瀵瑰彛鍨? : '杩愬姩鎺у埗'}</p>
                  </div>
                </div>

                {capturedFrame && (
                  <div className="mt-2 bg-black/40 border border-white/10 rounded-lg overflow-hidden">
                    <div className="p-2 bg-white/5 border-b border-white/10">
                      <p className="text-gray-200 text-[10px] font-semibold">鎹曡幏鐨勮棰戝抚</p>
                    </div>
                    <div className="relative group">
                      <img src={capturedFrame} alt="Captured Frame" className="w-full h-auto max-h-[200px] object-contain bg-black/20" onClick={(e) => e.stopPropagation()} />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all" onClick={(e) => { e.stopPropagation(); window.open(capturedFrame, '_blank'); }} onPointerDown={(e) => e.stopPropagation()} title="鏌ョ湅澶у浘">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          鏌ョ湅
                        </button>
                        <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all" onClick={(e) => { e.stopPropagation(); downloadFile(capturedFrame, `kling-frame-${Date.now()}.png`); }} onPointerDown={(e) => e.stopPropagation()} title="涓嬭浇鍥剧墖">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          涓嬭浇
                        </button>
                        <button className="px-3 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition-all" onClick={(e) => { e.stopPropagation(); editor.updateShape({ id: shape.id, type: 'custom-card' as any, props: { ...shape.props, capturedFrame: '' } }); }} onPointerDown={(e) => e.stopPropagation()} title="鍒犻櫎鍥剧墖">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          鍒犻櫎
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                        <p className="text-white text-[10px] truncate">宸蹭繚瀛樿棰戝抚</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 鏂囨湰杈撳嚭鍖哄煙 */}
            {cardType === 'text' && (
              <div className="mt-2 bg-black/30 border border-white/8 rounded-lg min-h-[80px] max-h-[300px] overflow-y-auto">
                {textOutput && !isGenerating && (
                  <div className="flex justify-end px-2 pt-1.5">
                    <button
                      className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(textOutput); alert('宸插鍒跺埌鍓创鏉?); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >澶嶅埗</button>
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

        {/* 闀滃ご鎺у埗婊戝潡鏍峰紡 */}
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



