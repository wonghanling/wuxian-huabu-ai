-- 工作流模板表
-- 用于存储可复用的画布快照，首页展示，用户可一键复制到自己的画布

create table if not exists workflow_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  cover_url text,                                             -- 静态封面图（editor.toImage 自动生成的 jpg）
  preview_video_url text,                                     -- hover 自动播放的短 mp4（管理员上传）
  snapshot_json jsonb not null,                               -- tldraw getSnapshot 的完整快照
  category text,                                              -- 分类：通用/视频/图像/音频/创作
  tags text[] default '{}',                                   -- 标签
  is_public boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- 预留未来字段
  parent_template_id uuid references workflow_templates(id),  -- remix 源模板
  version int default 1,                                      -- 版本号
  is_featured boolean default false,                          -- 精选
  use_count int default 0                                     -- 使用次数
);

-- 索引
create index if not exists idx_templates_public_category
  on workflow_templates(is_public, category)
  where is_public = true;

create index if not exists idx_templates_featured
  on workflow_templates(is_featured)
  where is_featured = true;

create index if not exists idx_templates_created_at
  on workflow_templates(created_at desc);

-- RLS
alter table workflow_templates enable row level security;

-- 任何人都能读公开模板
drop policy if exists "public templates readable by all" on workflow_templates;
create policy "public templates readable by all"
  on workflow_templates for select
  using (is_public = true);

-- 创建者能读自己所有模板
drop policy if exists "creators read own templates" on workflow_templates;
create policy "creators read own templates"
  on workflow_templates for select
  using (auth.uid() = created_by);

-- 只有创建者能改自己的
drop policy if exists "creators update own templates" on workflow_templates;
create policy "creators update own templates"
  on workflow_templates for update
  using (auth.uid() = created_by);

drop policy if exists "creators delete own templates" on workflow_templates;
create policy "creators delete own templates"
  on workflow_templates for delete
  using (auth.uid() = created_by);

-- 写入走服务端 service_role，绕过 RLS，所以不需要 insert policy
