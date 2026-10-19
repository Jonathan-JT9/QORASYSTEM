-- QORA exam history
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.exam_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  patient_code text,
  filename text,
  predicted_label text not null check (predicted_label in ('Normal', 'TB')),
  probability_tb double precision,
  probability_normal double precision,
  confidence double precision,
  interpretation text,
  notes text
);

create index if not exists exam_history_created_at_idx on public.exam_history (created_at desc);
create index if not exists exam_history_user_id_idx on public.exam_history (user_id);

alter table public.exam_history enable row level security;

drop policy if exists "exam_history_select_own" on public.exam_history;
drop policy if exists "exam_history_insert_own" on public.exam_history;
drop policy if exists "exam_history_select_anon_demo" on public.exam_history;
drop policy if exists "exam_history_insert_anon_demo" on public.exam_history;

create policy "exam_history_select_own"
  on public.exam_history
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "exam_history_insert_own"
  on public.exam_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Demo: persist rows without login (user_id is null). Remove in production.
create policy "exam_history_select_anon_demo"
  on public.exam_history
  for select
  to anon
  using (user_id is null);

create policy "exam_history_insert_anon_demo"
  on public.exam_history
  for insert
  to anon
  with check (user_id is null);

comment on table public.exam_history is 'QORA CXR classification history (TB vs Normal). Not a medical record of record.';
