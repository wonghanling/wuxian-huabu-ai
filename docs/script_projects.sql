-- ============================================================
-- 剧本工作室 · 剧本项目表
-- 存用户的 7 阶段剧本文字内容 + 各阶段输入框内容
-- ①小说 ②Beat Sheet ③正式剧本 ④人物设计 ⑤场景设计 ⑥道具设计 ⑦拍摄剧本
-- 纯文本数据,不占 Storage 配额;按 user_id 隔离(RLS)
-- 不涉及扣费/支付/会员,纯新增表
-- 第一期:单用户单草稿(取最近一条);第二期再做多项目管理
-- ============================================================
create table if not exists public.script_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default '未命名剧本',
  phase_1 text default '',   -- 小说
  phase_2 text default '',   -- Beat Sheet
  phase_3 text default '',   -- 正式剧本
  phase_4 text default '',   -- 人物设计
  phase_5 text default '',   -- 场景设计
  phase_6 text default '',   -- 道具设计
  phase_7 text default '',   -- 拍摄剧本
  inputs jsonb default '{}', -- 各阶段的用户输入框内容 {"1":"...","2":"..."}
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.script_projects enable row level security;
create policy "用户只能读写自己的剧本" on public.script_projects
  for all using (auth.uid() = user_id);

create index if not exists idx_script_projects_user on public.script_projects(user_id);
