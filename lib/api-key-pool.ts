/**
 * 账号池调度模块
 *
 * 用法（在 API route 里）：
 *
 *   import { pickKey, releaseKey, categorizeError } from '@/lib/api-key-pool';
 *
 *   export async function POST(req) {
 *     const keyInfo = await pickKey('fal');
 *     let success = false;
 *     let err: any = null;
 *     try {
 *       // 用 keyInfo.keyValue 调 AI
 *       const result = await callFal(keyInfo.keyValue, input);
 *       success = true;
 *       return NextResponse.json(result);
 *     } catch (e) {
 *       err = e;
 *       throw e;
 *     } finally {
 *       await releaseKey(keyInfo.keyId, success, categorizeError(err));
 *     }
 *   }
 *
 * 关键保证：
 * - 数据库池空时，pickKey 自动回退到环境变量
 * - releaseKey 失败不抛（避免掩盖业务错误）
 * - 连续 5 次失败的 key 由 Postgres 函数自动 disable
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Provider 类型
// ============================================================================
export type ApiProvider = 'n1n' | 'fal' | 'dashscope' | 'ark' | 'volc' | 'kie';

export interface KeyInfo {
  keyId: string | null; // null 表示用的是 env fallback 或用户自带 key，release 时会跳过并发释放
  keyValue: string; // 主 key / access_key
  secondaryValue?: string; // volc 的 secret_access_key
  provider?: ApiProvider; // 记录 provider，release 时写日志用
  startedAt?: number; // 毫秒时间戳，release 时计算 duration_ms

  // ── 以下仅用户自带 key（BYOK）时出现，平台池路径恒为 undefined ──
  isUserKey?: boolean; // true = 用户自己的 key：不占池并发、不扣平台余额
  userKeyId?: string; // user_api_keys.id，用于回执 markUserKeyResult
  region?: 'cn' | 'intl'; // dashscope 站点归属，决定 baseURL
}

// ============================================================================
// 环境变量回退映射
// ============================================================================
const ENV_FALLBACKS: Record<ApiProvider, () => KeyInfo | null> = {
  n1n: () => {
    const k = process.env.YUNWU_API_KEY;
    return k ? { keyId: null, keyValue: k } : null;
  },
  fal: () => {
    const k = process.env.FAL_KEY;
    return k ? { keyId: null, keyValue: k } : null;
  },
  dashscope: () => {
    const k = process.env.DASHSCOPE_API_KEY;
    return k ? { keyId: null, keyValue: k } : null;
  },
  ark: () => {
    const k = process.env.ARK_API_KEY;
    return k ? { keyId: null, keyValue: k } : null;
  },
  volc: () => {
    const id = process.env.VOLC_ACCESS_KEY_ID;
    const secret = process.env.VOLC_SECRET_ACCESS_KEY;
    return id && secret ? { keyId: null, keyValue: id, secondaryValue: secret } : null;
  },
  kie: () => {
    const k = process.env.KIE_API_KEY;
    return k ? { keyId: null, keyValue: k } : null;
  },
};

// ============================================================================
// Supabase admin client（service role）
// ============================================================================
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// pickKeyById: 用指定 keyId 取 key（用于查询时保证与生成用同一个 key）
// ============================================================================
export async function pickKeyById(keyId: string, provider: ApiProvider): Promise<KeyInfo> {
  const startedAt = Date.now();
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('api_keys')
      .select('id, key_value, secondary_value')
      .eq('id', keyId)
      .single();
    if (!error && data) {
      return { keyId: data.id, keyValue: data.key_value, secondaryValue: data.secondary_value ?? undefined, provider, startedAt };
    }
  } catch (err) {
    console.warn('[api-key-pool] pickKeyById error, fallback to pickKey:', err);
  }
  // 找不到指定 key 时回退到随机取一个
  return pickKey(provider);
}

// ============================================================================
// pickKey: 取一个 key（优先从池，空池回退 env）
// ============================================================================
export async function pickKey(provider: ApiProvider): Promise<KeyInfo> {
  const startedAt = Date.now();
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.rpc('pick_api_key', { p_provider: provider });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        keyId: row.id,
        keyValue: row.key_value,
        secondaryValue: row.secondary_value ?? undefined,
        provider,
        startedAt,
      };
    }
  } catch (err) {
    // 数据库异常不 throw，继续回退到 env
    console.warn('[api-key-pool] pickKey DB error, fallback to env:', err);
  }

  // 回退到环境变量
  const envKey = ENV_FALLBACKS[provider]?.();
  if (!envKey) {
    throw new Error(
      `[api-key-pool] No API key available for provider "${provider}" (database pool empty and no env fallback)`
    );
  }
  return { ...envKey, provider, startedAt };
}

// ============================================================================
// userKeyToKeyInfo: 把已读出的用户 key 包装成 KeyInfo
// ============================================================================
// 给需要"先判断是否 BYOK 决定扣不扣费、再取 key"的路由用（如 seedance/video
// generate）。这样只读一次库，且不会在上传图片等耗时步骤期间占着池并发槽。
//
// 参数 userKey 来自 user-api-keys 的 getUserKey()，此处只做结构转换。
export function userKeyToKeyInfo(
  userKey: { id: string; keyValue: string; secondaryValue?: string; region?: 'cn' | 'intl' },
  provider: ApiProvider
): KeyInfo {
  return {
    keyId: null, // 不在池中，release 时不释放并发槽
    keyValue: userKey.keyValue,
    secondaryValue: userKey.secondaryValue,
    provider,
    startedAt: Date.now(),
    isUserKey: true,
    userKeyId: userKey.id,
    region: userKey.region,
  };
}

// ============================================================================
// pickKeyForUser: 优先用用户自带 key，没有则回退平台账号池
// ============================================================================
// 只对 ark / dashscope / volc 生效（n1n / fal 是平台自用，不开放 BYOK）。
//
// 关键保证：userId 为空、用户没配 key、key 已失效、解密失败 —— 任一情况都
// 直接 return pickKey(provider)，也就是和改造前完全相同的代码路径。
//
// 返回的 KeyInfo 若带 isUserKey=true，调用方需要：
//   1. 跳过 deductBalance / refundBalance（用户在官方自付）
//   2. release 时走 releaseUserAwareKey（不释放池并发槽）
export async function pickKeyForUser(
  provider: ApiProvider,
  userId: string | undefined | null
): Promise<KeyInfo> {
  // n1n / fal 不开放用户自带 key，直接走平台池
  if (provider !== 'ark' && provider !== 'dashscope' && provider !== 'volc') {
    return pickKey(provider);
  }

  // 动态 import 避免平台池路径（n1n/fal 等）多加载一个模块
  const { lookupUserKey, userKeyInvalidMessage } = await import('./user-api-keys');

  let lookup: Awaited<ReturnType<typeof lookupUserKey>>;
  try {
    lookup = await lookupUserKey(userId, provider);
  } catch (err) {
    // 读库本身失败（不是"key 失效"）：回退平台池，不因基础设施抖动阻塞用户
    console.warn(`[api-key-pool] pickKeyForUser(${provider}) 读用户 key 失败，回退平台池:`, err);
    return pickKey(provider);
  }

  // 用户填过 key 但已失效 → 抛错，绝不静默回退平台池。
  // 回退会悄悄扣用户的画布余额，而他以为在用自己的账号。
  if (lookup.kind === 'invalid') {
    const err: any = new Error(userKeyInvalidMessage(provider as any, lookup.lastError));
    err.byokInvalid = true;
    err.status = 402;
    throw err;
  }

  if (lookup.kind === 'active') {
    return userKeyToKeyInfo(lookup.key, provider);
  }

  // kind === 'none'：用户没配 key，走平台池（改造前行为）
  return pickKey(provider);
}

// ============================================================================
// releaseUserAwareKey: 兼容用户 key 和平台池 key 的统一释放入口
// ============================================================================
// 平台池 key → 原样调 releaseKey（释放并发槽 + 写日志）
// 用户自带 key → 跳过并发释放（本来就没占槽），改为写 user_api_keys 回执，
//                同时照常写 api_call_logs 便于排查
export async function releaseUserAwareKey(
  keyInfo: KeyInfo,
  success: boolean,
  errorType?: 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other',
  errorMsg?: string
): Promise<void> {
  if (keyInfo.isUserKey && keyInfo.userKeyId) {
    try {
      const { markUserKeyResult } = await import('./user-api-keys');
      await markUserKeyResult(keyInfo.userKeyId, success, errorType, errorMsg);
    } catch (err) {
      console.error('[api-key-pool] markUserKeyResult 失败（不影响主流程）:', err);
    }
  }
  // keyId 为 null 时 releaseKey 已会跳过并发释放，只写日志
  await releaseKey(keyInfo, success, errorType, errorMsg);
}

// ============================================================================
// releaseKey: 释放 key（必须在 try-finally 里调用）
// 支持两种调用方式：
//   1. releaseKey(keyId, success, errorType)  ← 兼容旧调用
//   2. releaseKey(keyInfo, success, errorType, errorMsg)  ← 推荐，自动写日志
// ============================================================================
export async function releaseKey(
  keyOrInfo: string | null | KeyInfo,
  success: boolean,
  errorType?: 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other',
  errorMsg?: string
): Promise<void> {
  const keyInfo: KeyInfo | null = typeof keyOrInfo === 'object' && keyOrInfo !== null
    ? keyOrInfo
    : (typeof keyOrInfo === 'string' ? { keyId: keyOrInfo, keyValue: '' } : null);

  const keyId = keyInfo?.keyId ?? null;

  // 同时进行：释放并发槽 + 写日志（即使 env 回退也写日志）
  const tasks: PromiseLike<any>[] = [];
  const admin = getAdminClient();

  // 任务 1：释放并发计数（仅池中 key）
  if (keyId) {
    if (success) {
      tasks.push(admin.rpc('release_api_key_success', { p_key_id: keyId }));
    } else {
      tasks.push(admin.rpc('release_api_key_failure', { p_key_id: keyId, p_error_type: errorType ?? null }));
    }
  }

  // 任务 2：写调用日志（如果有 provider 和 startedAt）
  if (keyInfo?.provider && keyInfo?.startedAt) {
    const durationMs = Date.now() - keyInfo.startedAt;
    tasks.push(
      admin.from('api_call_logs').insert({
        key_id: keyId,
        provider: keyInfo.provider,
        duration_ms: durationMs,
        success,
        error_type: success ? null : (errorType ?? null),
        error_msg: errorMsg ? errorMsg.slice(0, 500) : null,
      })
    );
  }

  // 失败不抛，避免掩盖业务错误
  try {
    await Promise.all(tasks);
  } catch (err) {
    console.error('[api-key-pool] releaseKey/log failed (not fatal):', err);
  }
}

// ============================================================================
// logApiCall: 记录调用日志（可选，Phase 6 监控用）
// ============================================================================
export async function logApiCall(data: {
  keyId: string | null;
  provider: ApiProvider;
  userId?: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  errorMsg?: string;
}): Promise<void> {
  try {
    const admin = getAdminClient();
    await admin.from('api_call_logs').insert({
      key_id: data.keyId,
      provider: data.provider,
      user_id: data.userId ?? null,
      duration_ms: data.durationMs,
      success: data.success,
      error_type: data.errorType ?? null,
      error_msg: data.errorMsg ? data.errorMsg.slice(0, 500) : null,
    });
  } catch (err) {
    console.error('[api-key-pool] logApiCall failed (not fatal):', err);
  }
}

// ============================================================================
// categorizeError: 根据异常对象分类错误
// ============================================================================
export function categorizeError(
  err: any
): 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other' {
  if (!err) return 'other';
  const status = err?.status ?? err?.response?.status;
  const msg = String(err?.message || err?.body?.message || err).toLowerCase();

  if (status === 429 || /rate.*limit|too many|quota/i.test(msg)) return 'rate_limit';
  if (status === 401 || status === 403 || /unauthorized|forbidden|invalid.*(token|key)/i.test(msg)) return 'auth';
  if (status === 422 || /content|safety|moderation|no_media_generate/i.test(msg)) return 'content';
  if (/timeout|timed? ?out|etimedout/i.test(msg)) return 'timeout';
  return 'other';
}

// ============================================================================
// withKey: 便捷包装（可选用）
// 自动处理 pick / release / categorize
// ============================================================================
export async function withKey<T>(
  provider: ApiProvider,
  fn: (keyInfo: KeyInfo) => Promise<T>
): Promise<T> {
  const keyInfo = await pickKey(provider);
  let success = false;
  let caught: any = null;

  try {
    const result = await fn(keyInfo);
    success = true;
    return result;
  } catch (err) {
    caught = err;
    throw err;
  } finally {
    await releaseKey(keyInfo.keyId, success, success ? undefined : categorizeError(caught));
  }
}
