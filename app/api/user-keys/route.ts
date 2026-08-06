import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  BYOK_PROVIDERS,
  saveUserKey,
  deleteUserKey,
  listUserKeysMasked,
  testUserKey,
  type ByokProvider,
  type DashscopeRegion,
} from '@/lib/user-api-keys';

// ============================================================================
// 用户自带 API Key（BYOK）管理接口
// ============================================================================
// GET    → 返回当前用户已配置的 key 掩码列表（不含明文）
// POST   → 保存一把 key（先做连通性测试，通过才落库）
// DELETE → 删除一把 key（删掉后该 provider 自动回退平台池 + 正常扣费）
//
// 安全约定：userId 一律从 Authorization Bearer token 解出，
// 绝不接受请求体里的 userId —— 否则可以伪造成别人蹭 key。
// ============================================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 从 Authorization header 解出 userId；未登录返回 null */
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

function isValidProvider(p: unknown): p is ByokProvider {
  return typeof p === 'string' && BYOK_PROVIDERS.includes(p as ByokProvider);
}

// ============================================================================
// GET：列出掩码
// ============================================================================
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const keys = await listUserKeysMasked(userId);
  return NextResponse.json({ success: true, keys });
}

// ============================================================================
// POST：保存（可选纯测试）
// body: { provider, keyValue, secondaryValue?, region?, testOnly? }
// ============================================================================
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const { provider, keyValue, secondaryValue, region, testOnly } = body;

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: '不支持的 provider' }, { status: 400 });
  }
  if (typeof keyValue !== 'string' || !keyValue.trim()) {
    return NextResponse.json({ error: 'Key 不能为空' }, { status: 400 });
  }
  if (provider === 'volc' && (typeof secondaryValue !== 'string' || !secondaryValue.trim())) {
    return NextResponse.json({ error: '即梦需要同时填写 Access Key 和 Secret Key' }, { status: 400 });
  }
  if (provider === 'dashscope' && region !== 'cn' && region !== 'intl') {
    return NextResponse.json({ error: '阿里云需要选择站点（国内 / 国际）' }, { status: 400 });
  }

  // 先测连通，避免用户填错后到生成时才发现
  const test = await testUserKey({
    provider,
    keyValue: keyValue.trim(),
    secondaryValue: typeof secondaryValue === 'string' ? secondaryValue.trim() : undefined,
    region: region as DashscopeRegion | undefined,
  });
  if (!test.ok) {
    return NextResponse.json({ error: test.error || 'Key 验证失败' }, { status: 400 });
  }

  // testOnly：只验证不保存（前端"测试连通"按钮用）
  if (testOnly) {
    return NextResponse.json({ success: true, tested: true });
  }

  const saved = await saveUserKey({
    userId,
    provider,
    keyValue: keyValue.trim(),
    secondaryValue: typeof secondaryValue === 'string' ? secondaryValue.trim() : undefined,
    region: region as DashscopeRegion | undefined,
  });
  if (!saved.success) {
    return NextResponse.json({ error: saved.error || '保存失败' }, { status: 500 });
  }

  const keys = await listUserKeysMasked(userId);
  return NextResponse.json({ success: true, keys });
}

// ============================================================================
// DELETE：删除
// ?provider=ark
// ============================================================================
export async function DELETE(req: NextRequest) {
  const userId = await getAuthedUserId(req);
  if (!userId) return NextResponse.json({ error: '请先登录' }, { status: 401 });

  const provider = req.nextUrl.searchParams.get('provider');
  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: '不支持的 provider' }, { status: 400 });
  }

  const deleted = await deleteUserKey(userId, provider);
  if (!deleted.success) {
    return NextResponse.json({ error: deleted.error || '删除失败' }, { status: 500 });
  }

  const keys = await listUserKeysMasked(userId);
  return NextResponse.json({ success: true, keys });
}
