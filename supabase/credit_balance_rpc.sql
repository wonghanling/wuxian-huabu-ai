-- ============================================================
-- 原子充值 RPC（幂等）
--
-- 为什么需要它:
-- 现有充值入账是「读 balance → 加 → 写回」三步分开的，两个回调同时到达时
-- 后写的会覆盖先写的，用户白付一笔。而支付宝会重复推送通知直到收到 success，
-- Stripe 也明确 webhook 可能重复投递 —— 这不是理论风险。
--
-- 这个函数解决两件事:
--   1. 原子性 —— UPDATE ... SET balance = balance + amount，单条语句内完成
--   2. 幂等   —— 按订单号去重，同一订单重复调用只入账一次
--
-- 部署:在 Supabase SQL Editor 里执行本文件
-- ============================================================

-- 充值流水表:既是账单记录，也是幂等去重的依据
create table if not exists public.recharge_ledger (
  id            bigserial primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  -- 订单号(支付宝 out_trade_no / Stripe session id)。唯一约束是幂等的实现基础
  order_id      text not null unique,
  -- 实际入账的人民币金额
  amount_rmb    numeric(12,2) not null check (amount_rmb > 0),
  -- 用户实付的原始币种与金额（美元充值时记 USD/14.00，便于对账与客诉核查）
  paid_currency text,
  paid_amount   numeric(12,2),
  channel       text not null,          -- 'alipay' | 'stripe'
  balance_after numeric(12,2) not null, -- 入账后余额，便于对账
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists recharge_ledger_user_idx
  on public.recharge_ledger (user_id, created_at desc);

-- 只有 service role 能读写（webhook 用 service key 调用）
alter table public.recharge_ledger enable row level security;

comment on table public.recharge_ledger is
  '充值流水。order_id 唯一约束用于 webhook 幂等去重';


create or replace function public.credit_balance(
  p_user_id       uuid,
  p_order_id      text,
  p_amount_rmb    numeric,
  p_channel       text,
  p_paid_currency text default null,
  p_paid_amount   numeric default null,
  p_meta          jsonb   default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance_after numeric;
  v_existing      public.recharge_ledger;
begin
  if p_amount_rmb is null or p_amount_rmb <= 0 then
    return jsonb_build_object('success', false, 'error', '充值金额必须大于 0');
  end if;

  -- 幂等:该订单已入账过就直接返回上次结果，不再加钱。
  -- 放在事务最前面，重复投递的 webhook 走这条路径直接返回。
  select * into v_existing
  from public.recharge_ledger
  where order_id = p_order_id;

  if found then
    return jsonb_build_object(
      'success',       true,
      'already_done',  true,
      'balance_after', v_existing.balance_after
    );
  end if;

  -- 原子加钱:balance = balance + amount 在单条语句内完成，
  -- 并发调用由行锁串行化，不会互相覆盖。
  update public.users
  set balance = coalesce(balance, 0) + p_amount_rmb
  where id = p_user_id
  returning balance into v_balance_after;

  if v_balance_after is null then
    return jsonb_build_object('success', false, 'error', '用户不存在');
  end if;

  -- 写流水。order_id 的唯一约束是幂等的最后一道防线:
  -- 若两个请求同时通过了上面的存在性检查，这里会有一个抛 unique 冲突。
  insert into public.recharge_ledger (
    user_id, order_id, amount_rmb, paid_currency, paid_amount,
    channel, balance_after, meta
  ) values (
    p_user_id, p_order_id, p_amount_rmb, p_paid_currency, p_paid_amount,
    p_channel, v_balance_after, coalesce(p_meta, '{}'::jsonb)
  );

  return jsonb_build_object(
    'success',       true,
    'already_done',  false,
    'balance_after', v_balance_after
  );

exception
  -- 并发抢入同一订单:另一方已经加过钱了，本次回滚并按已完成返回。
  when unique_violation then
    select * into v_existing
    from public.recharge_ledger
    where order_id = p_order_id;
    return jsonb_build_object(
      'success',       true,
      'already_done',  true,
      'balance_after', coalesce(v_existing.balance_after, 0)
    );
end;
$$;

comment on function public.credit_balance is
  '原子充值 + 按 order_id 幂等。webhook 重复投递时只入账一次';

revoke all on function public.credit_balance from public, anon, authenticated;
