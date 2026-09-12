import { NextRequest, NextResponse } from 'next/server';
import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
import { refundBalance } from '@/lib/billing';
import { mirrorToOwn } from '@/lib/asset-upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================
// 交互编辑的结果查询（配合 seedream-edit 的两段式）
//
// 为什么要拆成两段：
// Azure App Service 的负载均衡器有 230 秒硬性请求超时，这个值改不了 ——
// 原先 seedream-edit 在服务端一路轮询到出图，一次请求撑 275 秒，超过 230 就
// 被掐断。用户看到失败，而 Kie 那边其实已经出图，钱扣了图拿不到。
// (实测有耗时 6 分钟才出图的情况，靠加长单次请求根本不可能覆盖。)
//
// 改法与视频那几个路由一致：提交只拿 taskId 立刻返回，前端反复调本接口。
// 每次请求几秒钟就结束，总时长不再受 230 秒限制。
// ============================================================

const KIE_QUERY_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');
  // 失败退款需要这两个；缺了也不报错，只是退不了款（前端始终会带上）
  const userId = searchParams.get('userId') || undefined;
  const price = Number(searchParams.get('price') || 0);

  if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

  const keyInfo = await pickKey('kie');
  let ok = false;
  let caught: any = null;

  try {
    const res = await fetch(`${KIE_QUERY_URL}?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${keyInfo.keyValue}` },
    });
    const body = await res.json();

    // Kie 用 body.code 表达错误，HTTP 状态可能仍是 200。
    // 单次查询失败不当作生成失败 —— 返回 pending 让前端继续轮询。
    if (!res.ok || body?.code !== 200) {
      ok = true;
      return NextResponse.json({ pending: true });
    }

    const d = body?.data || {};

    if (d.state === 'success') {
      let outUrls: string[] = [];
      try {
        const arr = JSON.parse(d.resultJson || '{}')?.resultUrls;
        outUrls = Array.isArray(arr) ? arr.filter((u: unknown) => typeof u === 'string' && u) : [];
      } catch { outUrls = []; }

      if (outUrls.length === 0) {
        ok = true;
        if (userId && price > 0) {
          await refundBalance(userId, price, 'Seedream 编辑无产出退款', { taskId });
        }
        return NextResponse.json({ failed: true, reason: '未返回图片，请重试' }, { status: 200 });
      }

      // 图层分离会返回多张（1 张底图 + N 张图层），逐张转存；
      // 单张失败降级用原地址，不影响其余。
      const finalUrls = await Promise.all(
        outUrls.map(async (u) => {
          try { return await mirrorToOwn(u, userId); } catch { return u; }
        })
      );

      ok = true;
      return NextResponse.json({
        success: true,
        imageUrl: finalUrls[0],
        imageUrls: finalUrls,
      });
    }

    if (d.state === 'fail') {
      ok = true;
      const reason = String(d.failMsg || '');
      if (userId && price > 0) {
        await refundBalance(userId, price, 'Seedream 编辑失败退款', { taskId, reason });
      }
      const isModeration = /sensitive|safety|policy|审核|违规|unsafe|risk|blocked|nsfw/i.test(reason);
      return NextResponse.json({
        failed: true,
        reason: isModeration
          ? '审核未通过：本次编辑被平台判定为不合规，请调整描述后重试'
          : (reason || '生成失败，请重试'),
      }, { status: 200 });
    }

    ok = true;
    return NextResponse.json({ pending: true, status: d.state || 'waiting' });
  } catch (e: any) {
    caught = e;
    // 网络抖动之类不该判定为生成失败 —— 返回 pending 让前端再试
    return NextResponse.json({ pending: true });
  } finally {
    await releaseKey(keyInfo, ok, ok ? undefined : categorizeError(caught));
  }
}
