-- ============================================================
-- 剧本工作室 · 剧本项目表(6 阶段 AI 电影管线)
-- ① Novel Bible ② Beat Sheet ③ Character Bible ④ Environment Bible ⑤ Screenplay ⑥ Shooting Script
-- phase_1..phase_6 存六阶段结果;asset_bibles 存按需钻取的 Asset Bible
-- 纯文本数据,不占 Storage 配额;按 user_id 隔离(RLS)
-- 不涉及扣费/支付/会员,纯新增表
-- ============================================================
create table if not exists public.script_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default '未命名剧本',
  phase_1 text default '',   -- Novel Bible(小说)
  phase_2 text default '',   -- Beat Sheet(节拍表)
  phase_3 text default '',   -- Character Bible(人物设定)
  phase_4 text default '',   -- Environment Bible(场景世界)
  phase_5 text default '',   -- Screenplay(正式剧本)
  phase_6 text default '',   -- Shooting Script(拍摄剧本)
  inputs jsonb default '{}',        -- 各阶段输入框内容 {"0":"...","1":"..."}
  asset_bibles jsonb default '{}',  -- Asset Bible {资产标识: bible文本}(按需钻取)
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.script_projects enable row level security;
create policy "用户只能读写自己的剧本" on public.script_projects
  for all using (auth.uid() = user_id);

create index if not exists idx_script_projects_user on public.script_projects(user_id);

-- ============================================================
-- 若之前已建过旧版表(7阶段/无 asset_bibles),执行下面 ALTER 补列即可(已存在会自动跳过):
-- ============================================================
alter table public.script_projects add column if not exists asset_bibles jsonb default '{}';
-- 旧版 phase_7 列不再使用,保留无害,无需删除
