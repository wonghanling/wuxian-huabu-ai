-- ============================================================================
-- 账号池系统 - 数据库表和调度函数
-- ============================================================================
-- 在 Supabase SQL Editor 里完整执行一次
-- 验证：select pick_api_key('test'); 应返回空表不报错

-- ============================================================================
-- 1. api_keys 表：账号池
-- ============================================================================
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- 见下方 provider 说明
  -- provider 取值（和现有 env 变量对应）：
  --   'n1n'       = n1n.ai 代理（MJ / 豆包 / Flux / 文本模型 / Kling 对口型 / MiniMax 音频）→ YUNWU_API_KEY
  --   'fal'       = fal.ai 直连（Veo 视频 / nano-banana / gpt-image-2 / flux-kontext） → FAL_KEY
  --   'dashscope' = 阿里云 DashScope（Wan 视频） → DASHSCOPE_API_KEY
  --   'ark'       = 火山引擎企业版（Seedance 2.0 视频） → ARK_API_KEY
  --   'volc'      = 火山引擎即梦（需要 access_key + secret）→ VOLC_ACCESS_KEY_ID + VOLC_SECRET_ACCESS_KEY
  key_name text,                          -- 管理员别名方便识别（如 "fal-01"）
  key_value text not null,                -- 主 key / access key（volc 时存 VOLC_ACCESS_KEY_ID）
  secondary_value text,                   -- volc 时存 VOLC_SECRET_ACCESS_KEY，其他 provider 留空
  priority int default 1,                 -- 优先级（越大越先用）
  max_concurrency int default 2,          -- 这个 key 允许的最大并发
  current_concurrency int default 0,      -- 当前正在用的并发数
  total_calls bigint default 0,
  success_count bigint default 0,
  failure_count int default 0,            -- 最近失败次数（成功会清零）
  last_success_at timestamptz,
  last_failure_at timestamptz,
  status text default 'active',           -- 'active' / 'cooldown' / 'disabled'
  quota_reset_at timestamptz,             -- 配额重置时间
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_api_keys_provider_status
  on api_keys(provider, status) where status = 'active';

create index if not exists idx_api_keys_concurrency
  on api_keys(provider, current_concurrency) where status = 'active';

-- ============================================================================
-- 2. api_call_logs 表：调用日志（Phase 6 监控用，现在就建好）
-- ============================================================================
create table if not exists api_call_logs (
  id uuid primary key default gen_random_uuid(),
  key_id uuid references api_keys(id) on delete set null,
  provider text not null,
  user_id uuid,
  duration_ms int,
  success boolean,
  error_type text,                        -- 'rate_limit' / 'auth' / 'content' / 'timeout' / 'other'
  error_msg text,
  created_at timestamptz default now()
);

create index if not exists idx_api_call_logs_provider_created
  on api_call_logs(provider, created_at desc);

create index if not exists idx_api_call_logs_key
  on api_call_logs(key_id);

-- ============================================================================
-- 3. RLS 配置
-- ============================================================================
alter table api_keys enable row level security;
alter table api_call_logs enable row level security;

-- api_keys 和 api_call_logs 全程用 service_role 访问（绕过 RLS）
-- 不加 policy 等于默认拒绝所有前端访问

-- ============================================================================
-- 4. 调度函数 - pick_api_key
-- 原子选一个最闲的可用 key 并占用并发槽
-- ============================================================================
create or replace function pick_api_key(p_provider text)
returns table (
  id uuid,
  key_value text,
  secondary_value text
) as $$
declare
  selected_id uuid;
begin
  -- 挑选规则：
  -- 1. provider 匹配
  -- 2. status = 'active'
  -- 3. current_concurrency < max_concurrency（未满）
  -- 4. 60 秒内失败过的排后面
  -- 5. 并发数少的排前面
  -- 6. 优先级高的排前面
  -- 7. 同条件下随机
  -- 8. FOR UPDATE SKIP LOCKED 避免竞态
  select k.id into selected_id
  from api_keys k
  where k.provider = p_provider
    and k.status = 'active'
    and k.current_concurrency < k.max_concurrency
  order by
    case when k.last_failure_at > now() - interval '60 seconds' then 1 else 0 end asc,
    k.current_concurrency asc,
    k.priority desc,
    random()
  limit 1
  for update skip locked;

  if selected_id is null then
    return;
  end if;

  -- 原子占用一个并发槽
  update api_keys
  set current_concurrency = current_concurrency + 1,
      total_calls = total_calls + 1,
      updated_at = now()
  where api_keys.id = selected_id;

  return query
  select k.id, k.key_value, k.secondary_value
  from api_keys k
  where k.id = selected_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 5. 释放函数 - release_api_key_success
-- 调用成功后释放并发槽，清零失败计数
-- ============================================================================
create or replace function release_api_key_success(p_key_id uuid)
returns void as $$
begin
  update api_keys
  set current_concurrency = greatest(0, current_concurrency - 1),
      success_count = success_count + 1,
      last_success_at = now(),
      failure_count = 0,
      updated_at = now()
  where id = p_key_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 6. 释放函数 - release_api_key_failure
-- 调用失败后释放并发槽，累加失败计数
-- 连续 5 次失败自动 disable
-- ============================================================================
create or replace function release_api_key_failure(p_key_id uuid, p_error_type text default null)
returns void as $$
declare
  new_failure_count int;
begin
  update api_keys
  set current_concurrency = greatest(0, current_concurrency - 1),
      failure_count = failure_count + 1,
      last_failure_at = now(),
      updated_at = now()
  where id = p_key_id
  returning failure_count into new_failure_count;

  -- 连续失败自动禁用
  if new_failure_count >= 5 then
    update api_keys
    set status = 'disabled',
        updated_at = now()
    where id = p_key_id;
  end if;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- 7. 权限给 authenticated 和 anon（因为前端不直接调用，这里其实无所谓）
-- 我们只通过 service_role 的 RPC 调用，无需额外 grant
-- ============================================================================

-- 完成。执行 select pick_api_key('test'); 验证（应返回空表不报错）
