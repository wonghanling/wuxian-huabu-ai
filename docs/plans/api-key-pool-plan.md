# 账号池系统实施计划

## 背景与目标

aura-canvas 当前所有 AI 平台调用都用**单一环境变量 key**，容易：
- 触发限流（并发超 2 直接失败）
- 单点故障（一个 key 被封全站瘫痪）
- 无法水平扩展账号资源

目标：建设账号池，让多个 key 自动轮询、失败降权、实时监控。支撑 100-1000 用户。

**重要约束**：
- 现有行为**保持不变**（没账号时退回原 env key 机制）
- 账号一个个加入池时无缝接入
- 不引入 Redis / Kafka / K8s，只用 Supabase + Next.js

**推进节奏**：50 个账号没到位前可先完成 Phase 0-3（建框架）。账号就绪后激活 Phase 4+。

## 关键约束

- **回退机制**：数据库账号池为空时，走原 `process.env.XXX_KEY` 路径
- **原子操作**：并发计数用 Postgres `UPDATE ... RETURNING`，避免超卖
- **无感切换**：用户不会知道用的是哪个 key
- **失败熔断**：连续失败 5 次或 60 秒内有失败 → 降权
- **现有代码最小改动**：每个 API 路由只改 1-2 行（取 key 的方式）

## Phase 0：调研结论（已完成）

### 现有 AI 调用点统计

| 环境变量 | 文件数 | 平台 |
|---|---|---|
| `FAL_KEY` | 7 | fal.ai |
| `YUNWU_API_KEY` | 15+ | n1n.ai（Gemini/GPT/MJ/Kling/MiniMax） |
| `ARK_API_KEY` | 2 | 火山引擎 Seedance |
| `DASHSCOPE_API_KEY` | 2 | 阿里云 Wan 视频 |
| `VOLC_ACCESS_KEY_ID` + `VOLC_SECRET_ACCESS_KEY` | 3 | 火山引擎即梦 |

### 调用点清单

**fal.ai**：
- `app/api/fal/proxy/route.ts`
- `app/api/image/upload/route.ts`
- `app/api/image/generate/route.ts`
- `app/api/image/fal-query/route.ts`
- `app/api/video/generate/route.ts`
- `app/api/video/query/route.ts`
- `app/api/gem/generate-storyboard-image/route.ts`

**火山引擎 Seedance**：
- `app/api/seedance/generate/route.ts`
- `app/api/seedance/query/route.ts`

**n1n.ai**：所有 `app/api/kling/*`、`app/api/tts/*`、`app/api/prompt-optimizer/*` 等

**阿里云 Wan**：2 个视频相关

### 调研关键发现

1. **fal 用的是 SDK**：`fal.config({ credentials })` + `fal.queue.submit/status/result`。SDK 是全局单例，**同一进程多 key 需要每次重新 config，有并发风险**。需要改为手写 fetch 或每次 new client。
2. **火山引擎 Seedance 用的是 fetch + Bearer token**：`Authorization: Bearer ${ARK_API_KEY}`。最容易切换 key。
3. **n1n.ai 用的是 fetch + Bearer token**：同上。
4. **所有调用都在 Next.js API Route 内**，用 service role Supabase client。

## 管理员约束

- 所有账号池管理必须登录 **1825221780@qq.com**（和模板系统保持一致）
- 后台页面 `/admin/api-pool` 仅该邮箱可见
- 普通用户看不到也调不了管理接口

---

## Phase 1：数据库与调度函数（1-2 小时）

### 1.1 新建 SQL 迁移文件

**路径**：`docs/api_keys_pool.sql`

**内容**：
```sql
-- API key 池
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- 'fal' / 'ark' / 'yunwu' / 'dashscope' / 'volc' / 'volc-secret'
  key_name text,                          -- 管理员起的别名，方便识别
  key_value text not null,                -- 实际 key（加密可选，先明文存）
  secondary_value text,                   -- 火山引擎需要 key+secret，secret 存这里
  priority int default 1,                 -- 1=默认，越大越先用
  max_concurrency int default 2,          -- 这个 key 允许的最大并发
  current_concurrency int default 0,      -- 当前正在用的并发数
  total_calls bigint default 0,           -- 累计调用
  success_count bigint default 0,
  failure_count int default 0,            -- 最近失败次数（可清零）
  last_success_at timestamptz,
  last_failure_at timestamptz,
  status text default 'active',           -- 'active' / 'cooldown' / 'disabled'
  quota_reset_at timestamptz,             -- 配额重置时间（保留）
  notes text,                             -- 管理员备注
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_api_keys_provider_status on api_keys(provider, status) where status = 'active';
create index idx_api_keys_concurrency on api_keys(provider, current_concurrency) where status = 'active';

-- 调用日志（后续监控用）
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

create index idx_api_call_logs_provider_created on api_call_logs(provider, created_at desc);
create index idx_api_call_logs_key on api_call_logs(key_id);

-- RLS
alter table api_keys enable row level security;
alter table api_call_logs enable row level security;

-- api_keys: 只有服务端 service_role 能读写，前端不可访问
-- （不加 policy 即默认拒绝，service_role 本身绕过 RLS）

-- 调度函数：取一个最空闲的可用 key，原子占用并发数
create or replace function pick_api_key(p_provider text)
returns table (
  id uuid,
  key_value text,
  secondary_value text
) as $$
declare
  selected_id uuid;
begin
  -- 先挑一个最闲的可用 key（并发未满、非 cooldown、非 disabled）
  -- 冷却期：最近 60 秒有失败 → 优先级降低
  select k.id into selected_id
  from api_keys k
  where k.provider = p_provider
    and k.status = 'active'
    and k.current_concurrency < k.max_concurrency
  order by
    -- 最近 60 秒有失败的排后面
    case when k.last_failure_at > now() - interval '60 seconds' then 1 else 0 end asc,
    k.current_concurrency asc,
    k.priority desc,
    random()
  limit 1
  for update skip locked;

  if selected_id is null then
    return;
  end if;

  -- 原子占用并发
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

-- 释放 key（成功）
create or replace function release_api_key_success(p_key_id uuid)
returns void as $$
begin
  update api_keys
  set current_concurrency = greatest(0, current_concurrency - 1),
      success_count = success_count + 1,
      last_success_at = now(),
      failure_count = 0,  -- 成功清零失败计数
      updated_at = now()
  where id = p_key_id;
end;
$$ language plpgsql security definer;

-- 释放 key（失败）
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

  -- 连续 5 次失败 → 自动 disable
  if new_failure_count >= 5 then
    update api_keys
    set status = 'disabled',
        updated_at = now()
    where id = p_key_id;
  end if;
end;
$$ language plpgsql security definer;
```

### 1.2 在 Supabase Dashboard 执行

- 管理员手动跑一次 SQL
- 验证：`select count(*) from api_keys;` 返回 0
- 验证：`select pick_api_key('fal');` 返回空（因为还没插入）

### 验证清单

- [ ] 表 `api_keys` / `api_call_logs` 创建成功
- [ ] 3 个 Postgres 函数创建成功
- [ ] `select pick_api_key('test');` 正常返回空（不报错）

### 反模式警告

- ❌ 不要用应用层 JavaScript 做"选 key"，会有竞态。必须用 Postgres 函数 + 行级锁
- ❌ 不要把 `key_value` 用 `select *` 暴露给前端，前端只用管理接口返回"脱敏版"（`****1234`）

---

## Phase 2：Node.js 调度模块（1 小时）

### 2.1 新建 `lib/api-key-pool.ts`

**目标**：提供两个函数给所有 API route 用。

**接口**：
```typescript
// 取 key（从池 or 从 env）
export async function pickKey(provider: string): Promise<{
  keyId: string | null;  // null 表示用的是 env fallback
  keyValue: string;
  secondaryValue?: string;
}>;

// 释放 key（必须在 try-finally 里调用）
export async function releaseKey(
  keyId: string | null,
  success: boolean,
  errorType?: 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other'
): Promise<void>;

// 记录调用日志（可选，Phase 5 用）
export async function logApiCall(data: {
  keyId: string | null;
  provider: string;
  userId?: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  errorMsg?: string;
}): Promise<void>;
```

**实现要点**：
```typescript
import { createClient } from '@supabase/supabase-js';

const ENV_FALLBACKS: Record<string, string | undefined> = {
  fal: process.env.FAL_KEY,
  ark: process.env.ARK_API_KEY,
  yunwu: process.env.YUNWU_API_KEY,
  dashscope: process.env.DASHSCOPE_API_KEY,
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function pickKey(provider: string) {
  // 先尝试从数据库池中取
  const { data, error } = await supabaseAdmin
    .rpc('pick_api_key', { p_provider: provider });

  if (!error && data && data.length > 0) {
    return {
      keyId: data[0].id,
      keyValue: data[0].key_value,
      secondaryValue: data[0].secondary_value,
    };
  }

  // 回退到环境变量
  const envKey = ENV_FALLBACKS[provider];
  if (!envKey) throw new Error(`No API key available for provider: ${provider}`);
  return { keyId: null, keyValue: envKey };
}

export async function releaseKey(keyId: string | null, success: boolean, errorType?: string) {
  if (!keyId) return; // env 回退不需要释放
  if (success) {
    await supabaseAdmin.rpc('release_api_key_success', { p_key_id: keyId });
  } else {
    await supabaseAdmin.rpc('release_api_key_failure', { p_key_id: keyId, p_error_type: errorType ?? null });
  }
}
```

### 验证清单

- [ ] `lib/api-key-pool.ts` 文件创建
- [ ] 数据库空池时调用 `pickKey('fal')` 能返回 env key
- [ ] 数据库插入一条 key 后调用能返回数据库 key
- [ ] `releaseKey(keyId, true)` 能成功将 `current_concurrency` 减 1

### 反模式警告

- ❌ `pickKey` 失败时别 throw，要回退 env——产品不能因为 Supabase 抖一下就挂
- ❌ `releaseKey` 不能 throw，否则会掩盖真正的业务错误——用 try-catch 包起来，失败只 console.error

---

## Phase 3：改造 fal.ai 路由（先试点验证，1 小时）

### 3.1 为什么先改 fal

- fal 用 SDK，需要解决"全局 config 在并发下不安全"的问题
- 改通了证明方案可行，其他路由只是复制模式

### 3.2 修改 `app/api/image/generate/route.ts`

**关键改动**：
- 去掉顶部的 `fal.config({ credentials: process.env.FAL_KEY! })` 全局调用
- 在 POST 处理函数里按请求 `pickKey('fal')` → 用这个 key 创建本地 fal client
- 成功/失败后 `releaseKey`

**SDK 本地化方式**：
```typescript
import { createFalClient } from '@fal-ai/client';

export async function POST(req: NextRequest) {
  const keyInfo = await pickKey('fal');
  const fal = createFalClient({ credentials: keyInfo.keyValue });

  let success = false;
  try {
    // 原有生成逻辑，把 fal.xxx 改为本地 fal
    const submitted = await fal.queue.submit(endpoint, { input });
    success = true;
    return NextResponse.json({ ... });
  } catch (err: any) {
    throw err;
  } finally {
    await releaseKey(keyInfo.keyId, success, categorizeError(err));
  }
}

function categorizeError(err: any): 'rate_limit' | 'auth' | 'content' | 'timeout' | 'other' {
  const msg = String(err?.message || err);
  if (err?.status === 429 || /rate.*limit/i.test(msg)) return 'rate_limit';
  if (err?.status === 401 || err?.status === 403) return 'auth';
  if (err?.status === 422 || /content|safety/i.test(msg)) return 'content';
  if (/timeout/i.test(msg)) return 'timeout';
  return 'other';
}
```

### 3.3 修改 `app/api/image/fal-query/route.ts`

轮询接口比较特殊——**一个任务全程用同一个 key**，不要每次查询换 key。方案：提交时把 `keyId` 作为 hidden 字段返回给前端，前端轮询时带上，后端按 id 取 key。

但这样改动大，**权衡**：轮询本身调用 `fal.queue.status/result` 本身 QPS 比生成低，**可以先用 env fallback**，Phase 3 不改 query，只改 submit。

### 验证清单

- [ ] 数据库空池：生成功能完全正常（回退 env）
- [ ] 插入 1 条 fal key 到数据库：生成用了数据库 key（查 `api_keys.total_calls` 应增加）
- [ ] 调用失败（比如故意 prompt 违规）：`api_keys.failure_count` 增加
- [ ] 连续 5 次失败后：该 key `status='disabled'`
- [ ] 有 2 条 key：并发 2 个请求应该分到不同 key

### 反模式警告

- ❌ 不要让 `finally` 里的 `releaseKey` 阻塞响应——await 但快速
- ❌ fal 轮询暂时不改，下阶段再说，避免一次改动过大

---

## Phase 4：管理员后台页面（1-2 小时）

### 4.1 新建 `/admin/api-pool/page.tsx`

**功能**：
- 仅 `1825221780@qq.com` 可见（进入时 `getUser()` 校验 email）
- 按 provider 分 tab 展示
- 每个 key 显示：别名、掩码后的 key、状态、当前并发 / 最大并发、成功/失败数、最近使用时间
- 操作按钮：启用 / 禁用 / 重置失败计数 / 编辑 max_concurrency / 删除

### 4.2 新建 `/api/admin/api-pool` 相关路由

- `GET /api/admin/api-pool/list?provider=fal` 列出 key（掩码）
- `POST /api/admin/api-pool/add` 添加 key（请求体含明文 key，入库后立即 fetch 返回掩码）
- `PATCH /api/admin/api-pool/[id]` 更新 key
- `DELETE /api/admin/api-pool/[id]` 删除
- `POST /api/admin/api-pool/[id]/reset` 重置失败计数

所有接口都校验 `user.email === '1825221780@qq.com'`。

### 验证清单

- [ ] 非管理员访问 `/admin/api-pool` → 302 跳首页
- [ ] 管理员能查看所有 key
- [ ] 添加新 key 成功，列表立即出现
- [ ] 编辑 max_concurrency 立即生效
- [ ] 禁用 key 后调度不再选它

---

## Phase 5：扩展到所有平台（2-3 小时）

### 5.1 按优先级改造

**优先级 1（视频生成，最堵的）**：
- `app/api/seedance/generate/route.ts` → `pickKey('ark')`
- `app/api/seedance/query/route.ts` → 提交时带 keyId 给前端，查询按 id 取

**优先级 2（n1n.ai，Kling/音频/Step 系列）**：
- 所有 `app/api/kling/*`
- 所有 `app/api/tts/*`
- 所有 `app/api/gem/generate-*`（不包括 storyboard-image，那是 fal）
- `app/api/prompt-optimizer/*`
- 统一用 `pickKey('yunwu')`

**优先级 3（剩余 fal 路由）**：
- `app/api/image/fal-query/route.ts`（完善轮询携带 keyId）
- `app/api/video/generate/route.ts`
- `app/api/video/query/route.ts`
- `app/api/gem/generate-storyboard-image/route.ts`

**优先级 4（阿里 Wan）**：
- 视频模块的 DashScope 调用

### 5.2 火山引擎签名特殊处理

火山引擎即梦用 `VOLC_ACCESS_KEY_ID + VOLC_SECRET_ACCESS_KEY` 两个字段，存 `api_keys` 时：
- `key_value = VOLC_ACCESS_KEY_ID`
- `secondary_value = VOLC_SECRET_ACCESS_KEY`
- provider = 'volc'

### 验证清单

- [ ] Seedance 视频生成走池，失败自动切换
- [ ] n1n.ai 调用走池
- [ ] 数据库里每个 provider 都有至少 1 条 key 时，全部功能正常
- [ ] 数据库全空时，所有功能退回 env 模式正常工作

---

## Phase 6：调用日志 + 监控页面（1-2 小时）

### 6.1 在 `pickKey` / `releaseKey` 里追加日志

每次调用结束（成功或失败）都写 `api_call_logs`：
- 持续时间
- 成功/失败
- 错误类型

### 6.2 扩展管理员页面

- 总览：过去 1 小时 / 24 小时 / 7 天 各 provider 的调用量、成功率
- 每个 key 的详细历史曲线

### 验证清单

- [ ] 每次调用都写了日志
- [ ] 管理员页面能看到日志聚合数据
- [ ] 查询性能不受影响（日志表加索引）

---

## Phase 7（可选）：排队削峰

### 7.1 什么时候做

Phase 1-6 做完后**大概率不需要**——因为：
- fal/Seedance 本身是异步队列
- 数据库并发计数已经能挡住超卖
- 你的用户规模（<1000）分到 20-50 个 key，很少会撞上"所有 key 都满"

### 7.2 如果真需要做

- 新建 `task_queue` 表
- `pickKey` 返回 null 时把请求塞入队列
- 有 Cron / setInterval 轮询 pending 任务，有空闲 key 就消费

**这一阶段先不做，留到真正出现排队问题再说**。

---

## 阶段依赖图

```
Phase 0（已完成调研）
  ↓
Phase 1（数据库 + 调度函数）← 前置
  ↓
Phase 2（Node 调度模块） ← 依赖 Phase 1
  ↓
Phase 3（fal 试点） ← 依赖 Phase 2
  ↓               ↓
Phase 4（管理后台） Phase 5（扩展所有平台）← 可并行
  ↓
Phase 6（监控日志）
  ↓
Phase 7（可选排队）
```

## 时机建议

你 50 个账号还没到位，但**现在可以做 Phase 1-3**：
- 建表、写调度代码、试点 fal（保持 env 回退）
- 产品上线行为不变（数据库空时走 env）
- 账号到位后直接在管理后台逐个添加，立即生效

**不需要等账号齐了才开工**。

---

## 中转站（卖 token）说明

你提到的"后期做中转站卖 token"——这是**完全独立的第二个产品**：
- 你当中间商，用户来你这买 token 用 AI
- 需要 API Gateway + 计费系统 + 用户额度管理
- 数据层面和账号池**完全隔离**

等账号池稳定跑半年后再议，现在不规划。
