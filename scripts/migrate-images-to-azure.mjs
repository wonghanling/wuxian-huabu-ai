// ============================================================
// 站点图片迁移到 Azure Blob
//
// 为什么迁:
// 图片现在走 Supabase 的 render/image?quality=80 —— 那条路虽有缓存
// (max-age=3600)，但依赖 Supabase 的图片转换服务:每次回源都要重编码，
// 首次请求实测 2.6s(object 直读 0.6s)，而且按次计费有配额风险。
//
// 迁到 Azure 后是原样直读:不重编码、无转换延迟、无配额，缓存头可控
// (max-age=31536000)。代价是压缩要预先做好 —— 这正是本脚本干的事。
//
// 用法:
//   node scripts/migrate-images-to-azure.mjs --dry
//   node scripts/migrate-images-to-azure.mjs
// ============================================================

import { BlobServiceClient } from '@azure/storage-blob';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join, extname, basename } from 'path';

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const SB_BASE = 'https://qvcantdhbsulcucufwtp.supabase.co/storage/v1/object/public/assets';
const CACHE = 'public, max-age=31536000, immutable';
const TMP = './.img-tmp';
const DRY = process.argv.includes('--dry');

if (!CONN) { console.error('缺少 AZURE_STORAGE_CONNECTION_STRING'); process.exit(1); }

/** 从源码扫出站点引用的图片。画布的运行时 URL 不在源码里，天然被排除 */
function collect() {
  const set = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.next', '.git'].includes(name)) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(tsx|ts)$/.test(name)) continue;
      const src = readFileSync(full, 'utf8');
      const re = /(?:render\/image|object)\/public\/assets\/([^"'`)\s?]+\.(?:jpg|jpeg|png|webp))/g;
      let m;
      while ((m = re.exec(src))) set.add(decodeURIComponent(m[1]));
    }
  };
  walk('./app');
  return [...set].sort();
}

async function main() {
  const paths = collect();
  console.log(`源码引用的站点图片: ${paths.length} 个`);
  if (DRY) { paths.forEach((p) => console.log('  ' + p)); return; }

  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
  const container = BlobServiceClient.fromConnectionString(CONN).getContainerClient('assets');

  let ok = 0, fail = 0, before = 0, after = 0;
  const failed = [];

  for (const [i, path] of paths.entries()) {
    const tag = `[${i + 1}/${paths.length}] ${basename(path)}`;
    const ext = extname(path).toLowerCase();
    const tmpIn = join(TMP, 'in' + ext);
    const tmpOut = join(TMP, 'out' + (ext === '.png' ? '.png' : '.jpg'));

    try {
      const res = await fetch(`${SB_BASE}/${path}`);
      if (!res.ok) throw new Error(`下载 HTTP ${res.status}`);
      const orig = Buffer.from(await res.arrayBuffer());
      writeFileSync(tmpIn, orig);
      before += orig.length;

      let upload = orig;
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      // 预压缩:原来靠 Supabase 的 ?quality=80 动态压，迁走后必须提前压好。
      // 长边限 1920(站点展示够用)，JPEG 用 q:v 4 —— 视觉上看不出差别。
      try {
        const vf = `scale='min(1920,iw)':-1`;
        const cmd = ext === '.png'
          // PNG 多为带透明的图标插图，保持 PNG 免得出现黑底
          ? `ffmpeg -y -loglevel error -i "${tmpIn}" -vf "${vf}" "${tmpOut}"`
          : `ffmpeg -y -loglevel error -i "${tmpIn}" -vf "${vf}" -q:v 4 "${tmpOut}"`;
        execSync(cmd, { stdio: 'pipe' });
        const out = readFileSync(tmpOut);
        if (out.length < orig.length) upload = out;
        unlinkSync(tmpOut);
      } catch {
        // ffmpeg 失败就传原图，不阻塞迁移
      }

      after += upload.length;
      await container.getBlockBlobClient(path).uploadData(upload, {
        blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: CACHE },
      });

      unlinkSync(tmpIn);
      ok++;
      const note = upload.length < orig.length
        ? `${(orig.length / 1024).toFixed(0)}→${(upload.length / 1024).toFixed(0)} KB`
        : `${(orig.length / 1024).toFixed(0)} KB`;
      console.log(`  ${tag}  ${note}`);
    } catch (e) {
      fail++;
      failed.push({ path, error: e.message });
      console.error(`  ${tag}  失败: ${e.message}`);
    }
  }

  console.log(`\n完成: 成功 ${ok}，失败 ${fail}`);
  console.log(`体积 ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
  if (failed.length) writeFileSync('./.img-failed.json', JSON.stringify(failed, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
