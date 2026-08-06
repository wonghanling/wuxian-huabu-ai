-- ============================================================================
-- 用户自带 API Key（BYOK）- 数据库表
-- ============================================================================
-- 在 Supabase SQL Editor 里完整执行一次
--
-- 和平台账号池（api_keys 表）的关系：
--   api_keys      = 平台自己的 key 池，有并发调度（pick_api_key）
--   user_api_keys = 用户自己申请的 key，不进池、不占并发、不扣平台余额
--
-- 本文件只新增表，不修改 api_keys / pick_api_key / api_call_logs 任何结构。
--
-- 验证：select * from user_api_keys;  应返回空表不报错
-- ============================================================================

create table if not exists user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- provider 取值（与 lib/api-key-pool.ts 的 ApiProvider 一致，但只开放这三个）：
  --   'ark'       = 火山引擎方舟（Seedance 2.0）→ 单 key，Bearer
  --   'dashscope' = 阿里云百炼（Wan / 快乐马）  → 单 key，Bearer，需配合 region
  --   'volc'      = 火山引擎即梦                → 双 key（AK + SK），暂未开放
  provider text not null check (provider in ('ark', 'dashscope', 'volc')),

  -- 密文（AES-256-GCM，格式 iv:authTag:ciphertext，全部 base64）
  -- 明文永不落库，解密主密钥在 env USER_KEY_ENCRYPTION_SECRET
  key_value_enc text not null,          -- 主 key / access key id
  secondary_value_enc text,             -- volc 的 secret access key；ark/dashscope 留空

  -- 掩码，仅用于前端回显（如 "sk-abc••••••wxyz"），不含完整明文
  key_masked text not null,

  -- 站点归属，仅 dashscope 使用：
  --   'cn'   = 国内百炼   dashscope.aliyuncs.com
  --   'intl' = 国际站     dashscope-intl.aliyuncs.com
  -- ark / volc 恒为 null
  region text check (region in ('cn', 'intl')),

  -- 'active' = 启用（填了就用）；'invalid' = 上游返回鉴权失败，已标记失效
  status text not null default 'active' check (status in ('active', 'invalid')),

  last_used_at timestamptz,
  last_error text,                      -- 最近一次失败原因，方便用户自查
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 一个用户每个 provider 只能有一把 key（重复保存 = 覆盖）
create unique index if not exists idx_user_api_keys_user_provider
  on user_api_keys(user_id, provider);

-- ============================================================================
-- RLS：全程只经 service_role 访问（和 api_keys 表同一策略）
-- 不加任何 policy = 默认拒绝所有前端直连，前端只能走 /api/user-keys
-- ============================================================================
alter table user_api_keys enable row level security;

-- 完成。执行 select * from user_api_keys; 验证（应返回空表不报错）
