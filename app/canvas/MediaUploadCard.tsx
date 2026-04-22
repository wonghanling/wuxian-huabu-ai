'use client';
import { BaseBoxShapeUtil, TLBaseShape, HTMLContainer, RecordProps, T, useEditor, Rectangle2d } from 'tldraw';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { mirrorUrlToStorage } from '@/lib/canvas-storage';
import { FloatingMenu, FloatingMenuOption } from './FloatingMenu';

export type MediaUploadCardShape = TLBaseShape<
  'media-upload-card',
  {
    w: number;
    h: number;
    mediaType: 'image' | 'video' | 'none';
    imageData: string;   // base64 or url
    videoUrl: string;    // supabase url
    videoName: string;
    isUploading: boolean;
    isMinimized: boolean;
  }
>;

// @ts-expect-error
export class MediaUploadCardUtil extends BaseBoxShapeUtil<MediaUploadCardShape> {
  static override type = 'media-upload-card' as const;

  static override props: RecordProps<MediaUploadCardShape> = {
    w: T.number,
    h: T.number,
    mediaType: T.literalEnum('image', 'video', 'none'),
    imageData: T.string,
    videoUrl: T.string,
    videoName: T.string,
    isUploading: T.boolean,
    isMinimized: T.boolean,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;

  getDefaultProps(): MediaUploadCardShape['props'] {
    return {
      w: 320,
      h: 220,
      mediaType: 'none',
      imageData: '',
      videoUrl: '',
      videoName: '',
      isUploading: false,
      isMinimized: false,
    };
  }

  override getGeometry(shape: MediaUploadCardShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: MediaUploadCardShape) {
    const { w, h, mediaType, imageData, videoUrl, videoName, isUploading, isMinimized } = shape.props;
    const editor = useEditor();
    const imgInputRef = useRef<HTMLInputElement>(null);
    const vidInputRef = useRef<HTMLInputElement>(null);
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

    const up = (props: Partial<MediaUploadCardShape['props']>) =>
      editor.updateShape({ id: shape.id, type: 'media-upload-card' as any, props: { ...shape.props, ...props } });

    const handleImageUpload = (file: File) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = ev.target?.result as string;
        // 检测比例调整卡片尺寸
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          const newW = 320;
          const newH = Math.round(newW / ratio);
          editor.updateShape({
            id: shape.id, type: 'media-upload-card' as any,
            props: { ...shape.props, mediaType: 'image', imageData: data, w: newW, h: newH + 48 },
          });
        };
        img.src = data;
      };
      reader.readAsDataURL(file);
    };

    const handleVideoUpload = async (file: File) => {
      up({ isUploading: true, videoName: file.name });
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { alert('请先登录'); up({ isUploading: false }); return; }
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.endsWith('.mov') ? '.mov' : '.mp4';
        const contentType = ext === '.mov' ? 'video/quicktime' : 'video/mp4';
        const filename = `videos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const { error } = await supabase.storage.from('assets').upload(filename, file, { contentType, upsert: false });
        if (error) throw new Error(`上传失败: ${error.message}`);
        const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filename);
        // 检测视频比例
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          const ratio = video.videoWidth / video.videoHeight;
          const newW = 320;
          const newH = Math.round(newW / ratio);
          editor.updateShape({
            id: shape.id, type: 'media-upload-card' as any,
            props: { ...shape.props, mediaType: 'video', videoUrl: urlData.publicUrl, videoName: file.name, isUploading: false, w: newW, h: newH + 48 },
          });
        };
        video.onerror = () => up({ mediaType: 'video', videoUrl: urlData.publicUrl, videoName: file.name, isUploading: false });
        video.src = URL.createObjectURL(file);
      } catch (err: any) {
        alert('上传失败: ' + err.message);
        up({ isUploading: false, videoName: '' });
      }
    };

    const scale = Math.min(1, w / 320, h / 220);

    const createLinkedCard = (type: 'camera-control-card' | 'character') => {
      const bounds = editor.getShapePageBounds(shape.id);
      if (!bounds) return;
      const x = bounds.maxX + 40;
      const y = bounds.midY - 260;
      if (type === 'camera-control-card') {
        editor.createShape({ type: 'camera-control-card' as any, x, y, props: {} });
      } else {
        editor.createShape({ type: 'custom-card' as any, x, y, props: { cardType: 'character', w: 380, h: 520 } });
      }
      setShowSideMenu(false);
    };

    const sideMenuOptions: FloatingMenuOption[] = [
      { label: '镜头控制', onClick: () => createLinkedCard('camera-control-card') },
      { label: '角色设计', onClick: () => createLinkedCard('character') },
    ];

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: 'all' }}>
        {/* 左端口 */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 flex items-center justify-center cursor-crosshair z-10 group"
          onMouseDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            editor.setCurrentTool('port', { shapeId: shape.id, portId: 'input', terminal: 'end' });
          }}
        >
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)' }} />
        </div>

        {/* 右端口 */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 flex items-center justify-center cursor-crosshair z-10 group"
          onMouseDown={(e) => {
            e.stopPropagation(); e.preventDefault();
            editor.setCurrentTool('port', { shapeId: shape.id, portId: 'output', terminal: 'start' });
          }}
        >
          <div className="w-3 h-3 rounded-full transition-all group-hover:scale-150"
            style={{ backgroundColor: '#27272a', border: '2px solid rgba(192,192,192,0.8)', boxShadow: '0 0 8px rgba(192,192,192,0.4)' }} />
        </div>

        {/* 右侧按钮 */}
        {mediaType !== 'none' && (
          <button
            className="absolute right-0 top-1/2 translate-x-full ml-2 w-8 h-8 bg-zinc-800/90 hover:bg-zinc-700 border border-white/10 rounded-lg flex items-center justify-center transition-all shadow-lg"
            style={{ transform: 'translateX(calc(100% + 8px)) translateY(-50%)', zIndex: 10 }}
            onClick={(e) => {
              e.stopPropagation();
              const bounds = editor.getShapePageBounds(shape.id);
              if (bounds) {
                setMenuPos({ x: bounds.maxX + 50, y: bounds.midY });
                setShowSideMenu(true);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {/* 浮动菜单 */}
        {showSideMenu && (
          <FloatingMenu
            x={menuPos.x}
            y={menuPos.y}
            options={sideMenuOptions}
            onClose={() => setShowSideMenu(false)}
          />
        )}

        {/* 卡片主体 */}
        <div
          className="w-full h-full rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          style={{
            background: 'rgba(24,24,27,0.97)',
            border: '1px solid rgba(255,255,255,0.10)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          }}
        >
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40"></div>
              <span className="text-white text-xs font-semibold">
                {mediaType === 'image' ? '图片素材' : mediaType === 'video' ? '视频素材' : '素材上传'}
              </span>
            </div>
            <div className="flex gap-1">
              {mediaType !== 'none' && (
                <button
                  className="text-[10px] text-gray-400 hover:text-red-400 transition-colors px-1"
                  onClick={(e) => { e.stopPropagation(); up({ mediaType: 'none', imageData: '', videoUrl: '', videoName: '', w: 320, h: 220 }); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >清除</button>
              )}
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 p-2" style={{ height: 'calc(100% - 40px)' }}>
            {isUploading ? (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-xs">上传中...</span>
              </div>
            ) : mediaType === 'image' && imageData ? (
              <div
                className="relative w-full h-full rounded-xl overflow-hidden group cursor-pointer"
                onClick={(e) => { e.stopPropagation(); imgInputRef.current?.click(); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <img src={imageData} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs">点击更换</span>
                </div>
              </div>
            ) : mediaType === 'video' && videoUrl ? (
              <div className="relative w-full h-full rounded-xl overflow-hidden group">
                <video src={videoUrl} className="w-full h-full object-cover" muted loop
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                  onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <span className="text-gray-300 text-[10px] truncate block">{videoName}</span>
                </div>
              </div>
            ) : (
              /* 空状态：选择上传类型 */
              <div className="w-full h-full flex items-center justify-center gap-3">
                <button
                  className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); imgInputRef.current?.click(); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <svg className="w-7 h-7 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/50 text-xs">上传图片</span>
                </button>
                <button
                  className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); vidInputRef.current?.click(); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <svg className="w-7 h-7 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white/50 text-xs">上传视频</span>
                </button>
              </div>
            )}
          </div>

          {/* 隐藏 input */}
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }}
          />
          <input ref={vidInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ''; }}
          />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: MediaUploadCardShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={16} />;
  }
}
