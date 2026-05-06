'use client';
import { useState } from 'react';
import type { Editor } from 'tldraw';
import { getSnapshot } from 'tldraw';
import { createClient } from '@/lib/supabase/client';

const CATEGORIES = ['通用', '视频', '图像', '音频', '创作'];

export function SaveTemplateModal({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('通用');
  const [tagsInput, setTagsInput] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'generating' | 'done'>('form');

  // 卡片挂载时自动生成封面预览
  const generateCover = async () => {
    try {
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        alert('画布为空，请先添加节点');
        return null;
      }
      const result = await editor.toImage([...shapeIds], {
        format: 'jpeg',
        scale: 0.5,
        background: true,
        padding: 32,
        darkMode: true,
      });
      const coverBase64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(result.blob);
      });
      setCoverPreview(coverBase64);
      return coverBase64;
    } catch (e: any) {
      alert('生成封面失败: ' + e.message);
      return null;
    }
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
  };

  const handleSave = async () => {
    if (!title.trim()) { alert('请输入标题'); return; }
    if (!videoFile) { alert('请上传预览视频（mp4）'); return; }

    setLoading(true);
    setStep('generating');

    try {
      // 1. 生成封面图
      let coverBase64 = coverPreview;
      if (!coverBase64) {
        const c = await generateCover();
        if (!c) { setLoading(false); setStep('form'); return; }
        coverBase64 = c;
      }

      // 2. 拿 snapshot
      const snapshot = getSnapshot(editor.store);

      // 3. 拿登录 token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('请先登录'); setLoading(false); setStep('form'); return; }

      // 4. 提交 FormData
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('category', category);
      fd.append('tags', tagsInput);
      fd.append('coverBase64', coverBase64);
      fd.append('previewVideo', videoFile);
      fd.append('snapshot', JSON.stringify(snapshot));

      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: fd,
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

            {/* 封面预览 */}
            <div>
              <label className="text-gray-300 text-xs mb-1 block">
                封面图（自动从画布生成）
              </label>
              {coverPreview ? (
                <div className="rounded-lg overflow-hidden bg-black/40 border border-white/10">
                  <img src={coverPreview} alt="封面预览" className="w-full max-h-40 object-contain" />
                </div>
              ) : (
                <button
                  onClick={generateCover}
                  disabled={loading}
                  className="w-full h-16 bg-black/40 border border-dashed border-white/15 rounded-lg text-xs text-gray-400 hover:border-white/30"
                >
                  预览封面
                </button>
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
                disabled={loading || !title.trim() || !videoFile}
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
