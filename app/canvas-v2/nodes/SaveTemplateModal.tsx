'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCanvasStore } from '../store';

// canvas-v2 版「保存为工作流模板」弹窗
// 照原网 app/canvas/SaveTemplateModal.tsx 1:1 复刻 UI，
// 区别:原网 snapshot 取自 tldraw editor,这里改用 React Flow 的 {nodes, edges}
// 后端接口共用 /api/templates/save(snapshot 以 snapshot_json 存,JSON 无关结构)

const CATEGORIES = ['通用', '视频', '图像', '音频', '创作'];

async function compressImage(file: File, maxSize = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function SaveTemplateModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('通用');
  const [tagsInput, setTagsInput] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [coverBase64, setCoverBase64] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'generating' | 'done'>('form');

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    try {
      const compressed = await compressImage(file);
      setCoverBase64(compressed);
    } catch {
      alert('封面处理失败');
    }
    e.target.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert('视频文件建议小于 50MB');
      return;
    }
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!title.trim()) { alert('请输入标题'); return; }
    if (!coverBase64) { alert('请上传封面图'); return; }
    if (!videoFile) { alert('请上传预览视频（mp4）'); return; }

    setLoading(true);
    setStep('generating');

    try {
      // canvas-v2 模板内容:当前画布的 React Flow 节点与连线
      const { nodes, edges } = useCanvasStore.getState();
      const snapshot = { engine: 'react-flow', nodes, edges };

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('请先登录'); setLoading(false); setStep('form'); return; }

      // 1. 前端直接上传视频到 Supabase Storage（绕过 Vercel 4.5MB 限制）
      const videoPath = `templates/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
      const { error: videoErr } = await supabase.storage
        .from('assets')
        .upload(videoPath, videoFile, { contentType: 'video/mp4' });
      if (videoErr) throw new Error('视频上传失败: ' + videoErr.message);
      const { data: { publicUrl: videoUrl } } = supabase.storage.from('assets').getPublicUrl(videoPath);

      // 2. 前端直接上传封面图到 Supabase Storage
      const coverBlob = await (await fetch(coverBase64)).blob();
      const coverPath = `templates/covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: coverErr } = await supabase.storage
        .from('assets')
        .upload(coverPath, coverBlob, { contentType: 'image/jpeg' });
      if (coverErr) throw new Error('封面上传失败: ' + coverErr.message);
      const { data: { publicUrl: coverUrl } } = supabase.storage.from('assets').getPublicUrl(coverPath);

      // 3. 调 API 写数据库（只传 URL 和 JSON，不走文件）
      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          tags: tagsInput,
          coverUrl,
          videoUrl,
          snapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');

      setStep('done');
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
      setLoading(false);
      setStep('form');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[99999] p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-white text-lg font-semibold">保存为工作流模板</h2>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">✕</button>
        </div>

        {step === 'done' ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white text-base font-medium">模板保存成功</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            {/* 标题 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">标题 <span className="text-red-400">*</span></label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                placeholder="例如：AI 分镜工作流"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">描述</label>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500/50"
                rows={3}
                placeholder="简短描述模板用途..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 分类 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">分类</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    disabled={loading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      category === c
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 标签 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">标签（逗号分隔）</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500/50"
                placeholder="分镜, AI, Kling"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* 封面图上传 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">
                封面图 <span className="text-red-400">*</span>
                <span className="text-gray-500 ml-2">（jpg / png，推荐 16:9）</span>
              </label>
              {coverBase64 ? (
                <div className="relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img src={coverBase64} alt="封面预览" className="w-full max-h-48 object-contain" />
                  <button
                    onClick={() => setCoverBase64('')}
                    disabled={loading}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-500 rounded-full text-white text-xs"
                  >✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 bg-black/40 border border-dashed border-white/15 rounded-lg cursor-pointer hover:border-white/30 transition-colors">
                  <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-400">点击上传封面图</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={loading} />
                </label>
              )}
            </div>

            {/* 预览视频上传 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">
                预览视频 <span className="text-red-400">*</span>
                <span className="text-gray-500 ml-2">（mp4，建议 3-8 秒，&lt;50MB）</span>
              </label>
              {videoPreviewUrl ? (
                <div className="relative rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <video src={videoPreviewUrl} className="w-full max-h-48 object-contain" controls muted loop autoPlay />
                  <button
                    onClick={() => { setVideoFile(null); setVideoPreviewUrl(''); }}
                    disabled={loading}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-500 rounded-full text-white text-xs"
                  >✕</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 bg-black/40 border border-dashed border-white/15 rounded-lg cursor-pointer hover:border-white/30 transition-colors">
                  <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-400">点击上传 mp4 视频</span>
                  <input type="file" accept="video/mp4" className="hidden" onChange={handleVideoChange} disabled={loading} />
                </label>
              )}
            </div>

            {/* 按钮 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all"
              >取消</button>
              <button
                onClick={handleSave}
                disabled={loading || !title.trim() || !videoFile || !coverBase64}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
              >
                {loading ? '保存中...' : '保存模板'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
