-- ============================================================
-- 迁移：payment_orders.order_type 支持年套餐 / 两年套餐
-- 在 Supabase SQL Editor 执行一次即可（可重复执行，幂等）
-- ============================================================

-- 动态删除 order_type 上所有已存在的 CHECK 约束（防止约束名不一致导致残留）
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.payment_orders'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%order_type%'
  loop
    execute format('alter table public.payment_orders drop constraint %I', c.conname);
  end loop;
end $$;

-- 重新加上放开后的约束
alter table public.payment_orders
  add constraint payment_orders_order_type_check
  check (order_type in ('recharge', 'membership', 'membership_yearly', 'membership_2yearly'));

-- 验证：查看当前约束定义
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.payment_orders'::regclass
  and contype = 'c';
