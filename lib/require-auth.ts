import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// 生成类接口的统一身份校验
// ============================================================================
// 背景：这些接口原来用 `if (userId) { 扣费 }` 控制计费，而 userId 来自请求体。
// 未登录时前端传 undefined，于是跳过扣费但照样调用上游模型 —— 任何人不注册
// 就能白用平台额度。
//
// 这里做两件事：
//   1. userId 一律从 Authorization Bearer token 解出，不再信请求体（防伪造他人身份）
//   2. 解不出身份就直接拒绝，而不是"免费放行"
// ============================================================================

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthOk { userId: string; email: string | null }

/**
 * 校验请求身份。
 * 通过返回 { userId, email }；失败返回可直接 return 给前端的响应。
 *
 * 用法：
 *   const auth = await requireAuth(req);
 *   if (auth instanceof NextResponse) return auth;
 *   const userId = auth.userId;   // 之后一律用这个，不要用 body.userId
 */
export async function requireAuth(req: NextRequest): Promise<AuthOk | NextResponse> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json(
      { error: '请先登录后再使用该功能', needLogin: true },
      { status: 401 }
    );
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json(
        { error: '登录已失效，请重新登录', needLogin: true },
        { status: 401 }
      );
    }
    return { userId: user.id, email: user.email ?? null };
  } catch {
    return NextResponse.json(
      { error: '身份校验失败，请重新登录', needLogin: true },
      { status: 401 }
    );
  }
}
