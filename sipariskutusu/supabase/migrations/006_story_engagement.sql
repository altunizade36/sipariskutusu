-- Story engagement (likes + comments)

create table if not exists public.story_likes (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(story_id, user_id)
);

create index if not exists story_likes_story_idx on public.story_likes(story_id);
create index if not exists story_likes_user_idx on public.story_likes(user_id);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_idx on public.story_comments(story_id);
create index if not exists story_comments_user_idx on public.story_comments(user_id);

alter table public.story_likes enable row level security;
alter table public.story_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_likes' and policyname = 'Story likes read'
  ) then
    create policy "Story likes read" on public.story_likes
    for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_likes' and policyname = 'Manage own story likes'
  ) then
    create policy "Manage own story likes" on public.story_likes
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_comments' and policyname = 'Story comments read'
  ) then
    create policy "Story comments read" on public.story_comments
    for select using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_comments' and policyname = 'Manage own story comments'
  ) then
    create policy "Manage own story comments" on public.story_comments
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
