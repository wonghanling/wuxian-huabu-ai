import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, pickKeyById, releaseKey, userKeyToKeyInfo, releaseUserAwareKey, categorizeError, type KeyInfo } from '@/lib/api-key-pool';
import { lookupUserKey, userKeyInvalidMessage } from '@/lib/user-api-keys';

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_QUERY_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/';
const KIE_QUERY_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 从 Authorization Bearer token 解出 userId（BYOK 取 key 用）
async function getAuthedUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// 转存到自己的 Storage 拿永久 URL。
// 两个目的：上游临时 URL 会过期；同时避免把上游域名暴露给前端。
// 失败重试一次，仍失败才退回原始 URL（宁可暴露域名也不能让用户丢视频）。
async function uploadVideoToStorage(sourceUrl: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(sourceUrl);
      if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `videos/seedance/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      const { error } = await supabaseAdmin.storage
        .from('assets')
        .upload(filename, buffer, { contentType: 'video/mp4', cacheControl: '31536000', upsert: false });
      if (error) throw new Error(`上传视频失败: ${error.message}`);
      const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
      return data.publicUrl;
    } catch (e) {
      if (attempt === 0) {
        console.warn('转存 Seedance 视频失败，重试一次:', e);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      console.warn('转存 Seedance 视频两次失败，使用原始URL:', e);
    }
  }
  return sourceUrl;
}

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId');
    const arkKeyId = request.nextUrl.searchParams.get('arkKeyId');
    const byok = request.nextUrl.searchParams.get('byok') === '1';
    // generate 回传的通道标记（用中性代号，不暴露上游供应商名）。
    // 只有 'c2' 走新分支；其余（含缺失、含旧任务的 'kie'）一律走原方舟逻辑，
    // 保证老任务、BYOK 用户和回退方舟时行为都不变。
    const channelParam = request.nextUrl.searchParams.get('channel');
    const isC2 = channelParam === 'c2' || channelParam === 'kie';  // 'kie' 兼容已在途的旧任务
    if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

    // ========================================================================
    // Kie AI 通道（generate 回传 channel=kie 时）
    // ========================================================================
    // 返回格式与方舟分支完全一致：{ status, videoUrl, progress }，前端无需区分。
    // Kie 的 state: waiting / success / fail；结果在 resultJson（JSON 字符串，需二次解析）
    if (isC2) {
      const kieKeyInfo = await pickKey('kie');
      let kieSuccess = false;
      let kieErr: any = null;
      let kieBody: any;
      try {
        const kRes = await fetch(`${KIE_QUERY_URL}?taskId=${encodeURIComponent(taskId)}`, {
          headers: { 'Authorization': `Bearer ${kieKeyInfo.keyValue}` },
        });
        kieBody = await kRes.json();
        kieSuccess = kRes.ok && kieBody?.code === 200;
        if (!kieSuccess) {
          kieErr = new Error(kieBody?.msg || `Kie 查询失败: HTTP ${kRes.status}`);
          (kieErr as any).status = kieBody?.code || kRes.status;
        }
      } catch (err) {
        kieErr = err;
        throw err;
      } finally {
        // 传完整 KeyInfo：releaseKey 需要 provider + startedAt 才会写 api_call_logs
        await releaseKey(kieKeyInfo, kieSuccess, kieSuccess ? undefined : categorizeError(kieErr), kieErr ? String(kieErr?.message || kieErr) : undefined);
      }

      console.log('Kie 查询结果:', JSON.stringify(kieBody).slice(0, 300));

      if (!kieSuccess) {
        return NextResponse.json({ status: 'failed', error: kieBody?.msg || '查询失败', progress: 0 });
      }

      const d = kieBody?.data || {};
      const state = d.state;

      if (state === 'success') {
        // resultJson 是 JSON 字符串：{"resultUrls":["https://..."]}
        let rawUrl = '';
        try {
          rawUrl = JSON.parse(d.resultJson || '{}')?.resultUrls?.[0] || '';
        } catch {
          rawUrl = '';
        }
        if (!rawUrl) return NextResponse.json({ status: 'failed', error: '未返回视频URL', progress: 0 });
        // 照原逻辑转存到自己的 Storage 拿永久 URL（Kie 的 tempfile 域名会过期）
        const videoUrl = await uploadVideoToStorage(rawUrl);
        return NextResponse.json({ status: 'completed', videoUrl, progress: 100 });
      }

      if (state === 'fail') {
        return NextResponse.json({
          status: 'failed',
          error: d.failMsg || `生成失败${d.failCode ? ` (${d.failCode})` : ''}`,
          progress: 0,
        });
      }

      if (state === 'waiting') {
        return NextResponse.json({ status: 'queued', progress: 10 });
      }

      // 其他中间态（如 generating/queuing）统一按进行中处理
      return NextResponse.json({ status: 'processing', progress: 50 });
    }

    // BYOK：任务是用用户自己的 key 提交的，必须用同一把 key 查，否则查不到。
    // 轮询中途 key 被标记失效时也不能换平台池 key（换了也查不到这个任务，
    // 更不能让用户以为还在用自己的账号），直接结束这次生成。
    const authedUserId = byok ? await getAuthedUserId(request) : null;
    const arkLookup = byok
      ? await lookupUserKey(authedUserId, 'ark')
      : ({ kind: 'none' } as const);

    if (arkLookup.kind === 'invalid') {
      return NextResponse.json({
        status: 'failed',
        error: userKeyInvalidMessage('ark', arkLookup.lastError),
        progress: 0,
      });
    }

    const userArkKey = arkLookup.kind === 'active' ? arkLookup.key : null;

    // byok 任务却拿不到用户 key（key 被删了）：不能用平台池 key 查，否则查不到
    if (byok && !userArkKey) {
      return NextResponse.json({
        status: 'failed',
        error: '这个任务是用你自己的 API Key 提交的，但该 Key 已被删除，无法继续查询结果。',
        progress: 0,
      });
    }

    // 平台池路径才要求 env 有 ARK_API_KEY 兜底
    if (!userArkKey && !ARK_API_KEY) {
      return NextResponse.json({ error: '未配置 ARK_API_KEY' }, { status: 500 });
    }

    // 取 key：BYOK 用用户自己的；否则用指定池 key（避免多 key 时任务 ID 找不到）
    const arkQKeyInfo: KeyInfo = userArkKey
      ? userKeyToKeyInfo(userArkKey, 'ark')
      : (arkKeyId ? await pickKeyById(arkKeyId, 'ark') : await pickKey('ark'));
    let arkQSuccess = false;
    let arkQErr: any = null;
    let res: Response;
    try {
      res = await fetch(ARK_QUERY_URL + taskId, {
        headers: { 'Authorization': `Bearer ${arkQKeyInfo.keyValue}` },
      });
      arkQSuccess = res.ok;
      // 非 2xx 时构造带 status 的错误，让 categorizeError 能识别 401/403，
      // BYOK 路径才会把用户 key 标记为 invalid
      if (!res.ok) {
        arkQErr = new Error(`方舟查询失败: HTTP ${res.status}`);
        (arkQErr as any).status = res.status;
      }
    } catch (err) {
      arkQErr = err;
      throw err;
    } finally {
      await releaseUserAwareKey(arkQKeyInfo, arkQSuccess, arkQSuccess ? undefined : categorizeError(arkQErr), arkQErr ? String(arkQErr?.message || arkQErr) : undefined);
    }

    const data = await res.json();
    console.log('Seedance 查询结果:', JSON.stringify(data).slice(0, 300));

    if (!res.ok) {
      return NextResponse.json({ status: 'failed', error: data?.error?.message || '查询失败' });
    }

    const arkStatus = data.status;

    if (arkStatus === 'succeeded') {
      const rawUrl = data?.content?.video_url;
      if (!rawUrl) return NextResponse.json({ status: 'failed', error: '未返回视频URL' });
      const videoUrl = await uploadVideoToStorage(rawUrl);
      return NextResponse.json({ status: 'completed', videoUrl, progress: 100 });
    } else if (arkStatus === 'failed' || arkStatus === 'expired') {
      return NextResponse.json({ status: 'failed', error: data?.error?.message || arkStatus, progress: 0 });
    } else if (arkStatus === 'queued') {
      return NextResponse.json({ status: 'queued', progress: 10 });
    } else {
      // running
      return NextResponse.json({ status: 'processing', progress: 50 });
    }

  } catch (error: any) {
    console.error('Seedance 查询错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
