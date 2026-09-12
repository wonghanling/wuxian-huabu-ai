-- ============================================================
-- AI 生图板块（/studio）的生成历史
--
-- 与画布完全独立：画布是整体快照存储（canvas_snapshots 存整个画布的 JSON），
-- 没有行级的生成记录，所以这里新建一张。两者互不影响。
--
-- 图片文件本身在 Azure Blob（images/{userId}/...），这张表只记元数据 ——
-- 谁、何时、什么模型、什么提示词、图片地址。
-- ============================================================

create table if not exists public.studio_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,

  model         text not null,          -- 模型 id，如 gpt-image-2-5-sunburst
  prompt        text,                   -- 提示词。可空：Topaz 放大这类无提示词的模型
  image_url     text not null,          -- Azure 上的永久地址

  aspect_ratio  text,                   -- 比例，如 16:9
  quality       text,                   -- 清晰度，如 2k
  ref_count     int  default 0,         -- 用了几张参考图（用于区分文生图/图生图）

  created_at    timestamptz not null default now()
);

-- 历史列表按时间倒序翻页，这个索引是主要查询路径
create index if not exists studio_generations_user_time_idx
  on public.studio_generations (user_id, created_at desc);

-- ── RLS：用户只能看自己的记录 ──
alter table public.studio_generations enable row level security;

-- 读：只读自己的
drop policy if exists studio_gen_select_own on public.studio_generations;
create policy studio_gen_select_own
  on public.studio_generations for select
  using (auth.uid() = user_id);

-- 删：只删自己的（用户可以清理历史）
drop policy if exists studio_gen_delete_own on public.studio_generations;
create policy studio_gen_delete_own
  on public.studio_generations for delete
  using (auth.uid() = user_id);

-- 写入不给前端权限 —— 由后端用 service role key 插入。
-- 否则前端可伪造记录（比如刷一堆假记录，或写别人的 user_id）。
