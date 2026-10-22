-- Stores wizard state separately from client profile data.
-- Run this migration in Supabase before deploying the updated intake page.

create table if not exists public.client_profile_intake_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_step smallint not null default 0 check (current_step between 0 and 5),
  has_started boolean not null default false,
  is_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.client_profile_intake_progress enable row level security;

-- Recreate these named policies safely if the migration is re-run.
drop policy if exists "client intake progress - users view own progress" on public.client_profile_intake_progress;
drop policy if exists "client intake progress - users create own progress" on public.client_profile_intake_progress;
drop policy if exists "client intake progress - users update own progress" on public.client_profile_intake_progress;

create policy "client intake progress - users view own progress"
  on public.client_profile_intake_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "client intake progress - users create own progress"
  on public.client_profile_intake_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "client intake progress - users update own progress"
  on public.client_profile_intake_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
