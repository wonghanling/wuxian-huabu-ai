-- ============================================================
-- 语音 ID 库（人声/场景声音色库）
-- 存用户的语音 voice_id:语音设计生成的、复刻出来的、手动收藏的
-- 纯文本数据,不占 Storage 配额;按 user_id 隔离(RLS)
-- 不涉及扣费/支付/会员,纯新增表
-- ============================================================
create table if not exists public.voice_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  voice_id text not null,                    -- MiniMax 的 voice_id
  name text,                                 -- 用户起的名字
  description text,                          -- 音色描述
  source text not null default 'manual',     -- design|clone|manual
  voice_type text not null default 'human',  -- human人声 | scene场景声
  created_at timestamptz not null default now(),
  unique(user_id, voice_id)
);

alter table public.voice_library enable row level security;
create policy "用户只能读写自己的音色" on public.voice_library
  for all using (auth.uid() = user_id);

create index if not exists idx_voice_library_user on public.voice_library(user_id);
