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
export type ApiProvider = 'n1n' | 'fal' | 'dashscope' | 'ark' | 'volc';

export interface KeyInfo {
  keyId: string | null; // null 表示用的是 env fallback，release 时会跳过
  keyValue: string; // 主 key / access_key
  secondaryValue?: string; // volc 的 secret_access_key
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
// pickKey: 取一个 key（优先从池，空池回退 env）
// ============================================================================
export async function pickKey(provider: ApiProvider): Promise<KeyInfo> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.rpc('pick_api_key', { p_provider: provider });

    if (!error && data && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        keyId: row.id,
        keyValue: row.key_value,
        secondaryValue: row.secondary_value ?? undefined,
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
  return envKey;
}

// ============================================================================
// releaseKey: 释放 key（必须在 try-finally 里调用）
// ============================================================================
export async function releaseKey(
  keyId: string | null,
  success: boolean,
  errorType?: 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other'
): Promise<void> {
  // env 回退时 keyId 是 null，跳过
  if (!keyId) return;

  try {
    const admin = getAdminClient();
    if (success) {
      await admin.rpc('release_api_key_success', { p_key_id: keyId });
    } else {
      await admin.rpc('release_api_key_failure', {
        p_key_id: keyId,
        p_error_type: errorType ?? null,
      });
    }
  } catch (err) {
    // 释放失败不抛，避免掩盖原本的业务错误
    console.error('[api-key-pool] releaseKey failed (not fatal):', err);
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
