// ============================================================
// 站点视频迁移到 Azure Blob
//
// 为什么必须迁:
// Supabase 的 object/public 路径强制返回 Cache-Control: no-cache，无视上传时
// 设的 cacheControl —— 实测同一文件 object 读到 no-cache、render/image 读到
// max-age=31536000。而 render/image 只处理图片，视频走它返回 400。
// 于是站点视频在 Supabase 上无论怎么配都无法被 CDN 缓存，每次访问都回源。
//
// Azure Blob 的缓存头完全可控(试点已验证 public, max-age=31536000, immutable)。
//
// 只迁站点素材，画布的用户创作不动 —— 那部分涉及前端直传与模型回传，
// 风险高，单独处理。
//
// 用法:
//   node scripts/migrate-videos-to-azure.mjs --dry        只列清单
//   node scripts/migrate-videos-to-azure.mjs              执行迁移
//   node scripts/migrate-videos-to-azure.mjs --compress   顺便用 ffmpeg 压缩
//
// 需要 AZURE_STORAGE_CONNECTION_STRING
// ============================================================

import { BlobServiceClient } from '@azure/storage-blob';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = 'assets';
const SUPABASE_BASE = 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets';
const CACHE = 'public, max-age=31536000, immutable';
const TMP = './.migrate-tmp';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const COMPRESS = args.includes('--compress');

if (!CONN) {
  console.error('缺少 AZURE_STORAGE_CONNECTION_STRING');
  process.exit(1);
}

/** 从源码里扫出所有引用到的站点视频路径（画布的运行时 URL 不在源码里，天然被排除） */
function collectVideoPaths() {
  const paths = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name === '.git') continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.(tsx|ts)$/.test(name)) continue;
      const src = readFileSync(full, 'utf8');
      const re = /object\/public\/assets\/([^"'`)\s]+\.(?:mp4|mov|webm))/g;
      let m;
      while ((m = re.exec(src))) paths.add(decodeURIComponent(m[1]));
    }
  };
  walk('./app');
  return [...paths].sort();
}

async function main() {
  const paths = collectVideoPaths();
  console.log(`源码中引用的站点视频: ${paths.length} 个`);

  if (DRY) {
    paths.forEach((p) => console.log('  ' + p));
    return;
  }

  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

  const svc = BlobServiceClient.fromConnectionString(CONN);
  const container = svc.getContainerClient(CONTAINER);

  let ok = 0, fail = 0, savedBytes = 0;
  const results = [];

  for (const [i, path] of paths.entries()) {
    const label = `[${i + 1}/${paths.length}] ${basename(path)}`;
    const tmpIn = join(TMP, 'in' + extname(path));
    const tmpOut = join(TMP, 'out.mp4');

    try {
      // 下载
      const res = await fetch(`${SUPABASE_BASE}/${path}`);
      if (!res.ok) throw new Error(`下载 HTTP ${res.status}`);
      const orig = Buffer.from(await res.arrayBuffer());
      writeFileSync(tmpIn, orig);

      let upload = orig;

      if (COMPRESS) {
        // faststart 把 moov 移到文件头 —— 否则浏览器要下完整个文件才能出首帧
        // (这正是之前 hero 视频黑屏的原因)。同时压到 1080p 上限。
        try {
          execSync(
            `ffmpeg -y -loglevel error -i "${tmpIn}" ` +
            `-vf "scale='min(1920,iw)':-2" -c:v libx264 -crf 26 -preset medium ` +
            `-pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${tmpOut}"`,
            { stdio: 'pipe' }
          );
          const compressed = readFileSync(tmpOut);
          // 只在真的更小时才用压缩版 —— 有些源已经压得很好，重编码会变大
          if (compressed.length < orig.length) {
            savedBytes += orig.length - compressed.length;
            upload = compressed;
          }
          unlinkSync(tmpOut);
        } catch {
          // ffmpeg 失败就传原文件，不阻塞迁移
        }
      }

      const blob = container.getBlockBlobClient(path);
      await blob.uploadData(upload, {
        blobHTTPHeaders: {
          blobContentType: 'video/mp4',
          blobCacheControl: CACHE,
        },
      });

      unlinkSync(tmpIn);
      ok++;
      const note = upload.length < orig.length
        ? `${(orig.length / 1048576).toFixed(1)}→${(upload.length / 1048576).toFixed(1)}MB`
        : `${(orig.length / 1048576).toFixed(1)}MB`;
      console.log(`  ${label}  ${note}`);
      results.push({ path, ok: true });
    } catch (e) {
      fail++;
      console.error(`  ${label}  失败: ${e.message}`);
      results.push({ path, ok: false, error: e.message });
    }
  }

  console.log(`\n完成: 成功 ${ok}，失败 ${fail}`);
  if (savedBytes > 0) console.log(`压缩节省 ${(savedBytes / 1048576).toFixed(1)} MB`);
  writeFileSync('./.migrate-result.json', JSON.stringify(results, null, 2));
  console.log('结果已写入 .migrate-result.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
