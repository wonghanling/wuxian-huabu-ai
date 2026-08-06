import { NextRequest, NextResponse } from 'next/server';
import { Service } from '@volcengine/openapi';
import { createClient } from '@supabase/supabase-js';
import { pickKey, pickKeyById, userKeyToKeyInfo, releaseKey, releaseUserAwareKey, categorizeError, type KeyInfo } from '@/lib/api-key-pool';
import { lookupUserKey, userKeyInvalidMessage, dashscopeHost } from '@/lib/user-api-keys';

const FAL_KEY = process.env.FAL_KEY!;
const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 下载视频并上传到 Supabase Storage，返回公开 URL
async function uploadVideoToStorage(sourceUrl: string, userId: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`下载视频失败: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `videos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const { error } = await supabase.storage
    .from('assets')
    .upload(filename, buffer, { contentType: 'video/mp4', upsert: false });
  if (error) throw new Error(`上传视频失败: ${error.message}`);
  const { data } = supabase.storage.from('assets').getPublicUrl(filename);
  return data.publicUrl;
}

const volcService = new Service({
  host: 'visual.volcengineapi.com',
  region: 'cn-north-1',
  serviceName: 'cv',
  accessKeyId: process.env.VOLC_ACCESS_KEY_ID!,
  secretKey: process.env.VOLC_SECRET_ACCESS_KEY!,
});
const jimengQuery = volcService.createJSONAPI('CVSync2AsyncGetResult', { Version: '2022-08-31' });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId   = searchParams.get('taskId');
    const endpoint = searchParams.get('endpoint');
    const keyId    = searchParams.get('keyId');  // dashscope 创建任务的同一把 key
    const byok     = searchParams.get('byok') === '1';  // 任务由用户自带 key 提交

    if (!taskId || !endpoint) {
      return NextResponse.json({ error: '缺少 taskId 或 endpoint' }, { status: 400 });
    }

    // 验证用户身份
    // userId 用于视频转存路径（未登录兜成 'anonymous'）
    // authedUserId 用于查 BYOK key（未登录必须是 null，不能用 'anonymous' 查库）
    const authHeader = request.headers.get('authorization');
    let userId = 'anonymous';
    let authedUserId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        authedUserId = user.id;
      }
    }

    let status = 'processing';
    let progress = 30;
    let videoUrl: string | null = null;
    let errorDetail: any = null;

    if (endpoint.startsWith('jimeng:')) {
      // 即梦 火山引擎查询（账号池：每次请求取一组双 key 动态创建）
      const reqKey = endpoint.replace('jimeng:', '');
      const jmKeyInfo = await pickKey('volc');
      const jmVolcService = new Service({
        host: 'visual.volcengineapi.com',
        region: 'cn-north-1',
        serviceName: 'cv',
        accessKeyId: jmKeyInfo.keyValue,
        secretKey: jmKeyInfo.secondaryValue || '',
      });
      const jmQuery = jmVolcService.createJSONAPI('CVSync2AsyncGetResult', { Version: '2022-08-31' });

      let jmSuccess = false;
      let jmErr: any = null;
      let jmRes: any;
      try {
        jmRes = await jmQuery({ req_key: reqKey, task_id: taskId }) as any;
        jmSuccess = true;
      } catch (err) {
        jmErr = err;
        throw err;
      } finally {
        await releaseKey(jmKeyInfo.keyId, jmSuccess, jmSuccess ? undefined : categorizeError(jmErr));
      }

      console.log('即梦查询结果:', JSON.stringify(jmRes).slice(0, 500));

      if (jmRes?.code !== 10000) {
        status = 'failed';
        progress = 0;
        errorDetail = jmRes?.message;
      } else {
        const jmStatus = jmRes?.data?.status;
        if (jmStatus === 'done') {
          const rawUrl = jmRes?.data?.video_url || null;
          if (rawUrl) {
            try {
              videoUrl = await uploadVideoToStorage(rawUrl, userId);
            } catch (e) {
              console.warn('转存即梦视频失败，使用原始URL:', e);
              videoUrl = rawUrl;
            }
          }
          status = videoUrl ? 'completed' : 'failed';
          progress = videoUrl ? 100 : 0;
        } else if (jmStatus === 'in_queue') {
          status = 'pending';
          progress = 10;
        } else if (jmStatus === 'generating') {
          status = 'processing';
          progress = 50;
        } else {
          status = 'failed';
          progress = 0;
          errorDetail = jmStatus;
        }
      }
    } else if (endpoint.startsWith('dashscope:')) {
      // DashScope 官方 API 查询
      // 关键:task_id 只能用创建它的同一把 key 查询,否则查不到
      //   BYOK  → 用该用户自己的 key（提交时用的就是它）
      //   平台池 → 用 keyId 锁定创建任务的那把
      // 轮询中途 key 被标记失效 / 被删除时，都不能换平台池 key 继续查：
      // 换了也查不到这个任务，更不能让用户以为还在用自己的账号
      const dsLookup = byok
        ? await lookupUserKey(authedUserId, 'dashscope')
        : ({ kind: 'none' } as const);

      if (dsLookup.kind === 'invalid') {
        return NextResponse.json({
          success: true,
          taskId,
          status: 'failed',
          progress: 0,
          videoUrl: null,
          errorDetail: userKeyInvalidMessage('dashscope', dsLookup.lastError),
        });
      }

      const userDsKey = dsLookup.kind === 'active' ? dsLookup.key : null;

      if (byok && !userDsKey) {
        return NextResponse.json({
          success: true,
          taskId,
          status: 'failed',
          progress: 0,
          videoUrl: null,
          errorDetail: '这个任务是用你自己的 API Key 提交的，但该 Key 已被删除，无法继续查询结果。',
        });
      }

      const dsQKeyInfo: KeyInfo = userDsKey
        ? userKeyToKeyInfo(userDsKey, 'dashscope')
        : (keyId ? await pickKeyById(keyId, 'dashscope') : await pickKey('dashscope'));
      let dsQSuccess = false;
      let dsQErr: any = null;
      let res: Response;
      try {
        // BYOK 时按用户填的站点切 baseURL；平台池恒为国际站（改造前行为）
        res = await fetch(
          `${dashscopeHost(dsQKeyInfo.region)}/api/v1/tasks/${taskId}`,
          { headers: { 'Authorization': `Bearer ${dsQKeyInfo.keyValue}` } }
        );
        dsQSuccess = res.ok;
        // 非 2xx 时构造带 status 的错误，让 categorizeError 能识别 401/403，
        // BYOK 路径才会把用户 key 标记为 invalid
        if (!res.ok) {
          dsQErr = new Error(`DashScope 查询失败: HTTP ${res.status}`);
          (dsQErr as any).status = res.status;
        }
      } catch (err) {
        dsQErr = err;
        throw err;
      } finally {
        await releaseUserAwareKey(dsQKeyInfo, dsQSuccess, dsQSuccess ? undefined : categorizeError(dsQErr), dsQErr ? String(dsQErr?.message || dsQErr) : undefined);
      }

      if (!res.ok) {
        const err = await res.text();
        return NextResponse.json({ error: '查询状态失败', details: err }, { status: 500 });
      }

      const data = await res.json();
      const taskStatus = data?.output?.task_status;
      console.log('DashScope 状态:', taskStatus, '完整响应:', JSON.stringify(data).slice(0, 800));

      if (taskStatus === 'SUCCEEDED') {
        const rawUrl = data?.output?.video_url || null;
        if (rawUrl) {
          try {
            videoUrl = await uploadVideoToStorage(rawUrl, userId);
          } catch (e) {
            console.warn('转存 DashScope 视频失败，使用原始URL:', e);
            videoUrl = rawUrl;
          }
        }
        status = videoUrl ? 'completed' : 'failed';
        progress = videoUrl ? 100 : 0;
      } else if (taskStatus === 'PENDING') {
        status = 'pending';
        progress = 10;
      } else if (taskStatus === 'RUNNING') {
        status = 'processing';
        progress = 50;
      } else {
        status = 'failed';
        progress = 0;
        errorDetail = data?.output;
      }
    } else {
      // fal 查询（账号池）
      const appId = endpoint.split('/').slice(0, 2).join('/');
      const falKeyInfo = await pickKey('fal');
      let falQSuccess = false;
      let falQErr: any = null;

      try {
      const statusRes = await fetch(
        `https://queue.fal.run/${appId}/requests/${taskId}/status`,
        { headers: { 'Authorization': `Key ${falKeyInfo.keyValue}` } }
      );

      if (!statusRes.ok) {
        const err = await statusRes.text();
        falQErr = new Error(`查询状态失败: ${err}`);
        (falQErr as any).status = statusRes.status;
        return NextResponse.json({ error: '查询状态失败', details: err }, { status: 500 });
      }

      const statusData = await statusRes.json();
      console.log('fal 状态:', statusData.status);

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(
          `https://queue.fal.run/${appId}/requests/${taskId}`,
          { headers: { 'Authorization': `Key ${falKeyInfo.keyValue}` } }
        );
        if (resultRes.ok) {
          const data = await resultRes.json();
          console.log('fal result full:', JSON.stringify(data).slice(0, 1000));
          const rawUrl = data?.video?.url || data?.video_url || data?.url || data?.videos?.[0]?.url || null;
          console.log('视频URL:', rawUrl);
          if (rawUrl) {
            try {
              videoUrl = await uploadVideoToStorage(rawUrl, userId);
            } catch (e) {
              console.warn('转存 fal 视频失败，使用原始URL:', e);
              videoUrl = rawUrl;
            }
          }
        } else {
          const errText = await resultRes.text();
          console.log('fal result fetch failed:', resultRes.status, errText);
          errorDetail = errText;
        }
        status = videoUrl ? 'completed' : 'failed';
        progress = videoUrl ? 100 : 0;
      } else if (statusData.status === 'IN_QUEUE') {
        status = 'pending';
        progress = 10;
      } else if (statusData.status === 'IN_PROGRESS') {
        status = 'processing';
        progress = 50;
      } else {
        status = 'failed';
        progress = 0;
        errorDetail = statusData;
      }
      falQSuccess = true;
      } catch (err) {
        if (!falQErr) falQErr = err;
        throw err;
      } finally {
        await releaseKey(falKeyInfo.keyId, falQSuccess, falQSuccess ? undefined : categorizeError(falQErr));
      }
    }

    return NextResponse.json({ success: true, taskId, status, progress, videoUrl, errorDetail });

  } catch (error: any) {
    console.error('查询视频错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}
