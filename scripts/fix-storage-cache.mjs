// ============================================================
// 批量给 Supabase Storage 里已有的文件补缓存头
//
// 为什么需要:
// Supabase 上传时不指定 cacheControl 就默认 no-cache。全站资源实测都是
// no-cache，导致 CDN 每次请求都要回源验证(CF-Cache-Status: REVALIDATED)——
// Supabase 自带的 Cloudflare 全球节点形同虚设，海外用户每次都从新加坡拉。
//
// 代码里的 upload 已全部补上 cacheControl(新文件没问题)，但已有文件的
// 元数据改不了 —— Supabase 的 metadata 表改了不生效(实测过)，只能重传。
// 本脚本下载再原样传回，仅为了带上新的 cacheControl。
//
// 用法:
//   node scripts/fix-storage-cache.mjs --dry     只看会处理哪些，不动数据
//   node scripts/fix-storage-cache.mjs           实际执行
//   node scripts/fix-storage-cache.mjs --prefix videos/   只处理某个目录
//
// 需要环境变量:NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'assets';
const CACHE_CONTROL = '31536000';   // 一年。路径含时间戳，内容不会变

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const prefixArg = args.indexOf('--prefix');
const ONLY_PREFIX = prefixArg >= 0 ? args[prefixArg + 1] : '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

/** 递归列出桶内所有文件（Supabase 的 list 不递归，要自己走目录） */
async function listAll(prefix = '', out = []) {
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) {
    console.error(`列目录失败 ${prefix}: ${error.message}`);
    return out;
  }
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    // id 为 null 表示这是目录，不是文件
    if (item.id === null) {
      await listAll(full, out);
    } else {
      out.push({ path: full, size: item.metadata?.size ?? 0, cache: item.metadata?.cacheControl });
    }
  }
  return out;
}

async function main() {
  console.log(`扫描 ${BUCKET} 桶${ONLY_PREFIX ? `（仅 ${ONLY_PREFIX}）` : ''}…`);
  const all = await listAll(ONLY_PREFIX.replace(/\/+$/, ''));

  // 已经是长缓存的跳过 —— 重传要花流量，没必要动
  const need = all.filter((f) => {
    const c = String(f.cache ?? '');
    return !c.includes('31536000') && !c.includes('max-age=31536000');
  });

  const totalMB = need.reduce((s, f) => s + f.size, 0) / 1024 / 1024;
  console.log(`共 ${all.length} 个文件，其中 ${need.length} 个需要补缓存头（约 ${totalMB.toFixed(1)} MB）`);

  if (DRY) {
    console.log('\n--dry 模式，只列前 20 个：');
    need.slice(0, 20).forEach((f) => {
      console.log(`  ${f.path}  (${(f.size / 1024).toFixed(0)} KB, 现为 ${f.cache ?? 'no-cache'})`);
    });
    if (need.length > 20) console.log(`  …还有 ${need.length - 20} 个`);
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const [i, f] of need.entries()) {
    try {
      // 下载再传回。upsert 覆盖同一路径，URL 不变 —— 数据库里存的地址仍然有效。
      const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(f.path);
      if (dlErr || !blob) throw new Error(dlErr?.message || '下载失败');

      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await sb.storage.from(BUCKET).upload(f.path, buf, {
        contentType: blob.type || 'application/octet-stream',
        cacheControl: CACHE_CONTROL,
        upsert: true,
      });
      if (upErr) throw new Error(upErr.message);

      ok++;
      if ((i + 1) % 20 === 0 || i === need.length - 1) {
        console.log(`  进度 ${i + 1}/${need.length}（成功 ${ok}，失败 ${fail}）`);
      }
    } catch (e) {
      fail++;
      console.error(`  失败 ${f.path}: ${e.message}`);
    }
  }

  console.log(`\n完成：成功 ${ok}，失败 ${fail}`);
  console.log('验证：curl -sI "<任一资源URL>" | grep -i cache-control');
}

main().catch((e) => {
  console.error('脚本异常:', e);
  process.exit(1);
});
