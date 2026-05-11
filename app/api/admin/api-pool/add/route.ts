import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = '1825221780@qq.com';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_PROVIDERS = ['n1n', 'fal', 'dashscope', 'ark', 'volc'];

// POST /api/admin/api-pool/add
// Body: { provider, key_name?, key_value, secondary_value?, priority?, max_concurrency?, notes? }
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: '未授权' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '无效认证' }, { status: 401 });
    if (user.email !== ADMIN_EMAIL) return NextResponse.json({ error: '无权限' }, { status: 403 });

    const body = await req.json();
    const {
      provider,
      key_name,
      key_value,
      secondary_value,
      priority,
      max_concurrency,
      notes,
    } = body;

    if (!provider || !ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `无效 provider，应为 ${ALLOWED_PROVIDERS.join(' / ')} 之一` }, { status: 400 });
    }
    if (!key_value || typeof key_value !== 'string' || key_value.length < 4) {
      return NextResponse.json({ error: 'key_value 不能为空' }, { status: 400 });
    }
    if (provider === 'volc' && (!secondary_value || secondary_value.length < 4)) {
      return NextResponse.json({ error: 'volc 必须同时提供 secondary_value（secret key）' }, { status: 400 });
    }

    const insertData: any = {
      provider,
      key_name: key_name || null,
      key_value: key_value.trim(),
      secondary_value: secondary_value ? secondary_value.trim() : null,
      priority: typeof priority === 'number' ? priority : 1,
      max_concurrency: typeof max_concurrency === 'number' && max_concurrency > 0 ? max_concurrency : 2,
      notes: notes || null,
      status: 'active',
    };

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert(insertData)
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('[admin/api-pool/add]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
