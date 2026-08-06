import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { pickKey, pickKeyById, userKeyToKeyInfo, releaseUserAwareKey, categorizeError, type KeyInfo } from '@/lib/api-key-pool';
import { lookupUserKey, userKeyInvalidMessage } from '@/lib/user-api-keys';

const ARK_API_KEY = process.env.ARK_API_KEY!;
const ARK_QUERY_URL = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/';

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

async function uploadVideoToStorage(sourceUrl: string): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `videos/seedance/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const { error } = await supabaseAdmin.storage
      .from('assets')
      .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });
    if (error) throw new Error(`上传视频失败: ${error.message}`);
    const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(filename);
    return data.publicUrl;
  } catch (e) {
    console.warn('转存 Seedance 视频失败，使用原始URL:', e);
    return sourceUrl;
  }
}

export async function GET(request: NextRequest) {
  try {
    const taskId = request.nextUrl.searchParams.get('taskId');
    const arkKeyId = request.nextUrl.searchParams.get('arkKeyId');
    const byok = request.nextUrl.searchParams.get('byok') === '1';
    if (!taskId) return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });

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
