-- ============================================================================
-- Filmavo TV 素材表
-- ============================================================================
-- 在 Supabase SQL Editor 里完整执行一次。
--
-- 用途：/filmavo-tv 的"精选素材"和 /filmavo-tv/skill 的 Skill 列表，
-- 改内容不再需要改代码发版，在 /admin/tv-assets 后台上传即可。
--
-- 验证：select * from tv_assets;  应返回空表不报错
-- ============================================================================

create table if not exists tv_assets (
  id uuid primary key default gen_random_uuid(),

  -- 归属分区：
  --   'showcase' → /filmavo-tv 精选素材区
  --   'skill'    → /filmavo-tv/skill
  category text not null default 'showcase' check (category in ('showcase', 'skill')),

  title text not null,
  -- 副标题/说明。showcase 用不到时留空，skill 用来写这条技巧讲什么
  description text,

  -- 素材类型与地址
  kind text not null default 'video' check (kind in ('video', 'image')),
  src text not null,                    -- Supabase Storage 的公开 URL
  -- 视频的封面图（可选）。不填则用视频首帧
  poster text,

  -- showcase：显示用什么模型做的，如 "Seedance 2.5"
  model text,
  -- skill：点击跳转地址，如 /canvas?templateId=xxx
  href text,

  -- 排序：数字越小越靠前；相同则按 created_at 倒序
  sort_order int not null default 100,
  -- false = 暂时下架，前台不显示（不用删就能隐藏）
  visible boolean not null default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 前台按 分区 + 可见 + 排序 查询
create index if not exists idx_tv_assets_query
  on tv_assets(category, visible, sort_order, created_at desc);

-- ============================================================================
-- RLS：前台匿名可读（只读 visible=true 的行），写入一律经服务端 service_role
-- ============================================================================
alter table tv_assets enable row level security;

-- 允许任何人读取已上架的素材（TV 首页对未登录用户也要能看）
drop policy if exists "tv_assets public read" on tv_assets;
create policy "tv_assets public read"
  on tv_assets for select
  using (visible = true);

-- 不加 insert/update/delete 策略 = 前端无法直接写，
-- 只有 /api/admin/tv-assets（service_role + 邮箱白名单）能改。

-- 完成。执行 select * from tv_assets; 验证（应返回空表不报错）
