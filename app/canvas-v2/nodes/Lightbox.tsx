'use client';

// ============================================================
// Lightbox — 画布内按比例放大查看图片/视频(照原网 lightbox)
// 右上角 × 返回,点遮罩也关闭,不跳转新页面。
// ============================================================
export function Lightbox({ url, kind, onClose }: { url: string; kind: 'image' | 'video'; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        {kind === 'video' ? (
          <video src={url} controls autoPlay style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12, display: 'block' }} />
        ) : (
          <img src={url} alt="" style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 12, display: 'block' }} />
        )}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -14, right: -14, width: 34, height: 34, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(28,28,32,0.95)', color: '#fff',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}
          title="关闭"
        >×</button>
      </div>
    </div>
  );
}

// 下载文件(不跳转新页面,通过 a 标签触发下载)
export async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    // 跨域失败兜底:直接开 a 下载
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }
}
