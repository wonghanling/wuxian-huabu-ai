/**
 * 用户自带 API Key（BYOK）- 加解密与读写
 *
 * 和平台账号池（lib/api-key-pool.ts）的分工：
 *   api-key-pool  = 平台自己的 key 池，有并发调度
 *   本模块        = 用户自己在官方申请的 key，不进池、不占并发、不扣平台余额
 *
 * 明文 key 只在两个瞬间存在：用户提交时、调上游前解密时。
 * 落库一律 AES-256-GCM 密文，主密钥在 env USER_KEY_ENCRYPTION_SECRET。
 *
 * 前端永远只拿到 key_masked（如 "sk-abc••••••wxyz"），拿不到明文。
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 类型
// ============================================================================

/** 开放给用户自带 key 的 provider（n1n / fal 不开放，平台自用） */
export type ByokProvider = 'ark' | 'dashscope' | 'volc';

export const BYOK_PROVIDERS: ByokProvider[] = ['ark', 'dashscope', 'volc'];

/** dashscope 站点归属；ark / volc 不用 */
export type DashscopeRegion = 'cn' | 'intl';

/** 解密后的用户 key，供 API route 直接调上游 */
export interface UserKey {
  id: string;
  provider: ByokProvider;
  keyValue: string;                  // 明文主 key
  secondaryValue?: string;           // 明文 secret（仅 volc）
  region?: DashscopeRegion;          // 仅 dashscope
}

/** 回传前端的安全视图，不含明文 */
export interface UserKeyMasked {
  provider: ByokProvider;
  keyMasked: string;
  region?: DashscopeRegion;
  status: 'active' | 'invalid';
  lastUsedAt: string | null;
  lastError: string | null;
}

// ============================================================================
// 加解密（AES-256-GCM）
// ============================================================================

/**
 * 主密钥取自 env USER_KEY_ENCRYPTION_SECRET。
 * 任意长度字符串经 SHA-256 派生出 32 字节，方便部署时直接填一串随机字符。
 * 生成建议：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
function getMasterKey(): Buffer {
  const secret = process.env.USER_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      '[user-api-keys] 未配置 USER_KEY_ENCRYPTION_SECRET（或长度不足 16），无法加解密用户 key'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/** 加密 → "iv:authTag:ciphertext"（三段均 base64） */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12); // GCM 推荐 12 字节
  const cipher = crypto.createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** 解密；密文被篡改或主密钥变更时会抛错（GCM 自带完整性校验） */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('[user-api-keys] 密文格式错误');
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getMasterKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * 生成掩码：保留头 6 尾 4，中间打点。
 * 太短的 key（<12）整串打点，避免掩码本身泄露过多。
 */
export function maskKey(plain: string): string {
  const s = plain.trim();
  if (s.length < 12) return '•'.repeat(Math.max(4, s.length));
  return `${s.slice(0, 6)}••••••${s.slice(-4)}`;
}

// ============================================================================
// Supabase admin client（service role，绕过 RLS）
// ============================================================================
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// 读：取用户某 provider 的 key（解密）
// ============================================================================

/**
 * 查询结果三态。关键设计：必须区分"没配置"和"配了但失效"——
 *   none    → 用户没填，回退平台账号池 + 正常扣费（改造前行为）
 *   active  → 用他的 key
 *   invalid → 用户填过 key 但已失效，直接报错，**绝不回退平台池**
 *
 * 为什么 invalid 不能回退：用户以为在用自己的账号，静默切回平台池会
 * 悄悄扣他的画布余额。一个 provider 一旦绑定就锁定，避免账单归属混乱。
 */
export type UserKeyLookup =
  | { kind: 'none' }
  | { kind: 'active'; key: UserKey }
  | { kind: 'invalid'; lastError: string | null };

/** 三态查询。库异常/解密失败当作 none（回退平台池），避免完全不可用 */
export async function lookupUserKey(
  userId: string | undefined | null,
  provider: ByokProvider
): Promise<UserKeyLookup> {
  if (!userId) return { kind: 'none' };

  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('user_api_keys')
      .select('id, provider, key_value_enc, secondary_value_enc, region, status, last_error')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (error || !data) return { kind: 'none' };

    // 填过但已被标记失效 → 锁定报错，不回退
    if (data.status !== 'active') {
      return { kind: 'invalid', lastError: data.last_error ?? null };
    }

    return {
      kind: 'active',
      key: {
        id: data.id,
        provider: data.provider as ByokProvider,
        keyValue: decryptSecret(data.key_value_enc),
        secondaryValue: data.secondary_value_enc
          ? decryptSecret(data.secondary_value_enc)
          : undefined,
        region: (data.region as DashscopeRegion) ?? undefined,
      },
    };
  } catch (err) {
    // 解密失败（主密钥换过）或库异常：当作没配置，回退平台池，不阻塞用户
    console.warn(`[user-api-keys] lookupUserKey(${provider}) 失败，回退平台池:`, err);
    return { kind: 'none' };
  }
}

/**
 * 便捷读法：只要可用的 key，失效和未配置都返回 null。
 * 只适合不需要区分二者的场景；生成/查询路由请用 lookupUserKey。
 */
export async function getUserKey(
  userId: string | undefined | null,
  provider: ByokProvider
): Promise<UserKey | null> {
  const r = await lookupUserKey(userId, provider);
  return r.kind === 'active' ? r.key : null;
}

/** 统一的失效报错文案（各路由共用，措辞一致） */
export function userKeyInvalidMessage(
  provider: ByokProvider,
  lastError?: string | null
): string {
  const where =
    provider === 'dashscope' ? '阿里云百炼控制台'
    : provider === 'ark' ? '火山引擎方舟控制台'
    : '火山引擎控制台';
  const base =
    `你的${provider === 'dashscope' ? '阿里云' : '火山引擎'} API Key 已失效，` +
    `已停止调用以免误扣平台余额。请到${where}检查余额和模型权限，` +
    `然后在画布「我的 API Key」里重新填写；也可以删除该 Key 改用平台账号。`;
  return lastError ? `${base}（上次报错：${lastError}）` : base;
}

// ============================================================================
// 写：保存 / 删除 / 列表
// ============================================================================

/** 保存（同 user + provider 已存在则覆盖） */
export async function saveUserKey(params: {
  userId: string;
  provider: ByokProvider;
  keyValue: string;
  secondaryValue?: string;
  region?: DashscopeRegion;
}): Promise<{ success: boolean; error?: string }> {
  const { userId, provider, keyValue, secondaryValue, region } = params;

  const plain = keyValue.trim();
  if (!plain) return { success: false, error: 'Key 不能为空' };
  if (provider === 'volc' && !secondaryValue?.trim()) {
    return { success: false, error: '即梦需要同时填写 Access Key 和 Secret Key' };
  }
  if (provider === 'dashscope' && !region) {
    return { success: false, error: '阿里云需要选择站点（国内 / 国际）' };
  }

  try {
    const admin = getAdminClient();
    const { error } = await admin.from('user_api_keys').upsert(
      {
        user_id: userId,
        provider,
        key_value_enc: encryptSecret(plain),
        secondary_value_enc: secondaryValue?.trim()
          ? encryptSecret(secondaryValue.trim())
          : null,
        key_masked: maskKey(plain),
        region: provider === 'dashscope' ? region : null,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    console.error('[user-api-keys] saveUserKey 失败:', err);
    return { success: false, error: err?.message || '保存失败' };
  }
}

/** 删除（删除后该 provider 自动回退平台账号池 + 正常扣费） */
export async function deleteUserKey(
  userId: string,
  provider: ByokProvider
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = getAdminClient();
    const { error } = await admin
      .from('user_api_keys')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || '删除失败' };
  }
}

/** 列出该用户所有 key 的掩码视图（前端设置页用） */
export async function listUserKeysMasked(userId: string): Promise<UserKeyMasked[]> {
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('user_api_keys')
      .select('provider, key_masked, region, status, last_used_at, last_error')
      .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((r) => ({
      provider: r.provider as ByokProvider,
      keyMasked: r.key_masked,
      region: (r.region as DashscopeRegion) ?? undefined,
      status: (r.status as 'active' | 'invalid') ?? 'active',
      lastUsedAt: r.last_used_at ?? null,
      lastError: r.last_error ?? null,
    }));
  } catch (err) {
    console.error('[user-api-keys] listUserKeysMasked 失败:', err);
    return [];
  }
}

// ============================================================================
// 使用回执：成功打时间戳，鉴权失败标记 invalid
// ============================================================================

/**
 * 上游调用后回执。失败不抛（旁路，不掩盖业务错误）。
 *
 * 只有 auth 类错误（401/403，即欠费/过期/填错）才标 invalid——
 * 内容审核不过、超时这些不是 key 的问题，不能因此禁掉用户的 key。
 */
export async function markUserKeyResult(
  keyId: string,
  success: boolean,
  errorType?: 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other',
  errorMsg?: string
): Promise<void> {
  try {
    const admin = getAdminClient();
    if (success) {
      await admin
        .from('user_api_keys')
        .update({ last_used_at: new Date().toISOString(), last_error: null })
        .eq('id', keyId);
      return;
    }

    const patch: Record<string, unknown> = {
      last_error: errorMsg ? errorMsg.slice(0, 300) : (errorType ?? 'unknown'),
      updated_at: new Date().toISOString(),
    };
    if (errorType === 'auth') patch.status = 'invalid';

    await admin.from('user_api_keys').update(patch).eq('id', keyId);
  } catch (err) {
    console.error('[user-api-keys] markUserKeyResult 失败（不影响主流程）:', err);
  }
}

// ============================================================================
// DashScope 站点 → baseURL
// ============================================================================

/**
 * 平台池默认国际站（保持改造前行为不变）。
 * 用户自带 key 时按其填写的 region 切换。
 */
export function dashscopeHost(region?: DashscopeRegion): string {
  return region === 'cn'
    ? 'https://dashscope.aliyuncs.com'
    : 'https://dashscope-intl.aliyuncs.com';
}

// ============================================================================
// 连通性测试（保存前验证，避免用户填错后到生成时才发现）
// ============================================================================

/** 返回 ok=false 时附带上游原始报错，方便用户自查 */
export async function testUserKey(params: {
  provider: ByokProvider;
  keyValue: string;
  secondaryValue?: string;
  region?: DashscopeRegion;
}): Promise<{ ok: boolean; error?: string }> {
  const { provider, keyValue, secondaryValue, region } = params;

  try {
    if (provider === 'ark') {
      // 方舟：查一个不存在的任务 ID。key 有效 → 404/task not found；无效 → 401/403
      const res = await fetch(
        'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/byok-probe-000',
        { headers: { Authorization: `Bearer ${keyValue}` } }
      );
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'Key 无效或无方舟权限（401/403）' };
      }
      return { ok: true };
    }

    if (provider === 'dashscope') {
      // 百炼：同理查不存在的任务，401/403 判定无效
      const res = await fetch(`${dashscopeHost(region)}/api/v1/tasks/byok-probe-000`, {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error:
            region === 'cn'
              ? 'Key 无效（401/403）。请确认这是国内百炼的 Key'
              : 'Key 无效（401/403）。请确认这是国际站的 Key',
        };
      }
      return { ok: true };
    }

    if (provider === 'volc') {
      // 即梦：AK/SK 签名接口，用一个必然失败的 task_id 探活。
      // 签名错误会返回鉴权类错误码，业务错误说明签名是通的。
      const { Service } = await import('@volcengine/openapi');
      const svc = new Service({
        host: 'visual.volcengineapi.com',
        region: 'cn-north-1',
        serviceName: 'cv',
        accessKeyId: keyValue,
        secretKey: secondaryValue || '',
      });
      const query = svc.createJSONAPI('CVSync2AsyncGetResult', { Version: '2022-08-31' });
      try {
        await query({ req_key: 'jimeng_vgfm_t2v_l20', task_id: 'byok-probe-000' });
        return { ok: true };
      } catch (e: any) {
        const msg = String(e?.message || e);
        if (/signature|access.?key|denied|unauthoriz|forbidden|invalid.*credential/i.test(msg)) {
          return { ok: false, error: `AK/SK 校验失败：${msg.slice(0, 200)}` };
        }
        // 其它错误说明签名通过，只是任务不存在
        return { ok: true };
      }
    }

    return { ok: false, error: '不支持的 provider' };
  } catch (err: any) {
    return { ok: false, error: `连通测试失败：${err?.message || err}` };
  }
}
