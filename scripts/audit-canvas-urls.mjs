// ============================================================
// 只读审计：画布快照里的资源 URL 现状
//
// 目的有两个:
//   1. 找出仍指向上游临时地址(火山引擎/fal 等)的作品 —— 那些地址 7 天后
//      失效，是"作品静默消失"的直接原因。最近一周失败的现在还能抢救。
//   2. 摸清历史上出现过哪些 URL 形态，作为迁移 Azure 时的兼容清单。
//
// 绝不修改任何数据。
//
// 用法:
//   node scripts/audit-canvas-urls.mjs                  扫全部用户
//   node scripts/audit-canvas-urls.mjs <email>          只扫一个账号
//   node scripts/audit-canvas-urls.mjs <email> --probe  额外逐个测可访问性
// ============================================================

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const email = args.find((a) => a.includes('@'));
const PROBE = args.includes('--probe');

/** 自有存储 = 不会过期;其余都是上游临时地址，有失效风险 */
function classify(host) {
  if (host.includes('supabase.co')) return 'own-supabase';
  if (host.includes('blob.core.windows.net')) return 'own-azure';
  return 'upstream-temp';
}

async function main() {
  let userIds = null;
  if (email) {
    const { data } = await sb.from('users').select('id,email').eq('email', email);
    if (!data?.length) { console.log('未找到账号', email); return; }
    userIds = data.map((u) => u.id);
    console.log('账号:', email, '\n');
  }

  let q = sb.from('canvases').select('id,title,user_id,updated_at').order('updated_at', { ascending: false });
  if (userIds) q = q.in('user_id', userIds);
  const { data: canvases, error } = await q;
  if (error) { console.log('查询失败:', error.message); return; }

  console.log('画布数:', canvases.length);

  const byHost = {};
  const upstream = new Map();   // url -> [画布标题]

  for (const c of canvases) {
    // 快照不在 canvases 表里 —— 那张表只存元数据。真正的快照在
    // canvas_snapshots，每次保存 insert 一条，取最新那条。
    const { data } = await sb.from('canvas_snapshots')
      .select('snapshot').eq('canvas_id', c.id)
      .order('created_at', { ascending: false }).limit(1);
    const json = JSON.stringify(data?.[0]?.snapshot ?? {});
    const urls = json.match(/https?:\/\/[^"'\s\\]+/g) ?? [];

    for (const raw of urls) {
      const url = raw.replace(/[",;)\]}]+$/, '');
      let host;
      try { host = new URL(url).host; } catch { continue; }

      const kind = classify(host);
      byHost[host] = byHost[host] ?? { count: 0, kind };
      byHost[host].count++;

      if (kind === 'upstream-temp') {
        if (!upstream.has(url)) upstream.set(url, []);
        upstream.get(url).push(c.title || c.id.slice(0, 8));
      }
    }
  }

  console.log('\n=== URL 按来源分布 ===');
  const rows = Object.entries(byHost).sort((a, b) => b[1].count - a[1].count);
  for (const [host, info] of rows) {
    const tag = info.kind === 'upstream-temp' ? '会过期!' : '自有';
    console.log(`  ${String(info.count).padStart(5)}  [${tag}]  ${host}`);
  }

  console.log(`\n=== 风险汇总 ===`);
  const tempCount = rows.filter(([, i]) => i.kind === 'upstream-temp').reduce((s, [, i]) => s + i.count, 0);
  console.log(`会过期的临时地址: ${upstream.size} 个唯一 URL（引用 ${tempCount} 次）`);

  if (upstream.size === 0) {
    console.log('没有发现会过期的地址 —— 转存链路工作正常');
    return;
  }

  if (!PROBE) {
    console.log('\n加 --probe 可逐个测试哪些还能抢救');
    let i = 0;
    for (const [url, titles] of upstream) {
      if (i++ >= 10) { console.log(`  …还有 ${upstream.size - 10} 个`); break; }
      console.log(`  ${url.slice(0, 100)}  ← ${titles[0]}`);
    }
    return;
  }

  console.log('\n=== 逐个探测（判断能否抢救）===');
  let alive = 0, dead = 0;
  for (const [url, titles] of upstream) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) { alive++; console.log(`  可救  ${url.slice(0, 90)}`); }
      else { dead++; console.log(`  已失效 HTTP ${res.status}  ${titles[0]}`); }
    } catch {
      dead++;
      console.log(`  已失效（无法连接）  ${titles[0]}`);
    }
  }
  console.log(`\n还能抢救 ${alive} 个，已彻底失效 ${dead} 个`);
}

main().catch((e) => { console.error(e); process.exit(1); });
