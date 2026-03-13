-- ============================================================
-- 用户表（扩展 Supabase auth.users）
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_member boolean not null default false,
  member_expires_at timestamptz,
  balance numeric(10,2) not null default 0,  -- 图片/视频余额（元）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
create policy "用户只能读写自己" on public.users
  for all using (auth.uid() = id);

-- 新用户注册时自动创建 users 行
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 交易流水表
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in (
    'recharge',        -- 充值
    'membership',      -- 购买会员
    'image_deduct',    -- 图片扣费
    'video_deduct',    -- 视频扣费
    'refund'           -- 退款（生成失败）
  )),
  amount numeric(10,2) not null,   -- 正数=收入，负数=支出
  balance_after numeric(10,2) not null,
  description text,
  meta jsonb,                      -- 存 model_key、duration、resolution 等
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "用户只能读自己的流水" on public.transactions
  for select using (auth.uid() = user_id);
-- 写入只允许 service_role（后端）

-- ============================================================
-- 索引
-- ============================================================
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);

-- ============================================================
-- 原子扣费函数（供后端 RPC 调用）
-- 正数 amount = 扣费，负数 amount = 退款/充值
-- ============================================================
create or replace function public.deduct_balance(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_meta jsonb default '{}'
)
returns jsonb language plpgsql security definer as $$
declare
  v_balance numeric;
  v_balance_after numeric;
begin
  -- 锁定用户行
  select balance into v_balance
  from public.users
  where id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', '用户不存在');
  end if;

  v_balance_after := v_balance - p_amount;

  -- 余额不足（退款/充值时 p_amount 为负，不会触发此检查）
  if v_balance_after < 0 then
    return jsonb_build_object('success', false, 'error', '余额不足');
  end if;

  -- 更新余额
  update public.users
  set balance = v_balance_after, updated_at = now()
  where id = p_user_id;

  -- 写流水
  insert into public.transactions (user_id, type, amount, balance_after, description, meta)
  values (p_user_id, p_type, -p_amount, v_balance_after, p_description, p_meta);

  return jsonb_build_object('success', true, 'balance_after', v_balance_after);
end;
$$;

-- ============================================================
-- 支付订单表
-- ============================================================
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,           -- 商户订单号
  user_id uuid not null references public.users(id) on delete cascade,
  order_type text not null check (order_type in ('recharge', 'membership')),
  amount_rmb numeric(10,2) not null,       -- 订单金额（元）
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  payment_method text not null default 'alipay',
  trade_no text,                           -- 支付宝交易号
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;
create policy "用户只能读自己的订单" on public.payment_orders
  for select using (auth.uid() = user_id);

create index if not exists idx_payment_orders_user_id on public.payment_orders(user_id);
create index if not exists idx_payment_orders_order_no on public.payment_orders(order_no);
create index if not exists idx_payment_orders_status on public.payment_orders(status);
