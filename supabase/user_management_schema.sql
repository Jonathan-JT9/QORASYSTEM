-- ====================================================================
-- QORA USER MANAGEMENT & ROLE-BASED ACCESS CONTROL (RBAC) SCHEMA
-- Run this script in the Supabase SQL Editor.
-- ====================================================================

-- 1. EXTENSIONS
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 2. EXAM HISTORY (Ensure existing table is preserved)
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

-- 3. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('doctor', 'admin')) default 'doctor',
  status text not null check (status in ('pending', 'approved', 'rejected', 'suspended')) default 'pending',
  username text not null unique,
  email text not null,
  full_name text not null,
  specialty text,
  str_number text,
  str_expiry date,
  str_document_path text,
  sip_number text,
  sip_expiry date,
  sip_document_path text,
  institution text,
  rejection_reason text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_email_lower_idx on public.profiles (lower(email));

-- 4. ADMIN AUDIT LOGS TABLE
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('approve', 'reject', 'suspend', 'reinstate')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);
create index if not exists audit_logs_target_user_idx on public.admin_audit_logs (target_user_id);

-- 5. PRIVATE STORAGE BUCKET FOR DOCTOR DOCUMENTS
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doctor-documents',
  'doctor-documents',
  false,
  10485760, -- 10MB limit
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 6. HELPER FUNCTION: CHECK IF CURRENT USER IS ADMIN
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

grant execute on function public.is_admin() to authenticated, anon;

-- 7. HELPER FUNCTION: CHECK IF CURRENT USER IS APPROVED DOCTOR
create or replace function public.is_approved_doctor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'doctor' and status = 'approved'
  );
$$;

grant execute on function public.is_approved_doctor() to authenticated, anon;

-- 8. RPC: GET EMAIL BY USERNAME (SECURE CROSS-DEVICE LOGIN)
create or replace function public.get_auth_email_by_username(input_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email
  from public.profiles
  where lower(username) = lower(trim(input_username))
  limit 1;
$$;

grant execute on function public.get_auth_email_by_username(text) to anon, authenticated;

-- 9. TRIGGER: AUTO-CREATE PROFILE ON AUTH.USERS INSERT
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_full_name text;
  v_specialty text;
  v_str_number text;
  v_str_expiry date;
  v_sip_number text;
  v_sip_expiry date;
  v_institution text;
  v_role text;
  v_status text;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', v_username);
  v_specialty := new.raw_user_meta_data->>'specialty';
  v_str_number := new.raw_user_meta_data->>'str_number';
  v_sip_number := new.raw_user_meta_data->>'sip_number';
  v_institution := new.raw_user_meta_data->>'institution';

  if new.raw_user_meta_data->>'str_expiry' is not null and new.raw_user_meta_data->>'str_expiry' != '' then
    begin
      v_str_expiry := (new.raw_user_meta_data->>'str_expiry')::date;
    exception when others then
      v_str_expiry := null;
    end;
  end if;

  if new.raw_user_meta_data->>'sip_expiry' is not null and new.raw_user_meta_data->>'sip_expiry' != '' then
    begin
      v_sip_expiry := (new.raw_user_meta_data->>'sip_expiry')::date;
    exception when others then
      v_sip_expiry := null;
    end;
  end if;

  -- Security: Public signups are ALWAYS 'doctor' and 'pending'
  v_role := 'doctor';
  v_status := 'pending';

  insert into public.profiles (
    id,
    username,
    email,
    full_name,
    specialty,
    str_number,
    str_expiry,
    str_document_path,
    sip_number,
    sip_expiry,
    sip_document_path,
    institution,
    role,
    status
  ) values (
    new.id,
    v_username,
    new.email,
    v_full_name,
    v_specialty,
    v_str_number,
    v_str_expiry,
    new.raw_user_meta_data->>'str_document_path',
    v_sip_number,
    v_sip_expiry,
    new.raw_user_meta_data->>'sip_document_path',
    v_institution,
    v_role,
    v_status
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 10. ROW LEVEL SECURITY (RLS) POLICIES

-- PROFILES RLS
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id and role = 'doctor' and status = 'pending');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Regular doctors cannot elevate their own role or status
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ADMIN AUDIT LOGS RLS
alter table public.admin_audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.admin_audit_logs;
create policy "audit_logs_select_admin"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "audit_logs_insert_admin" on public.admin_audit_logs;
create policy "audit_logs_insert_admin"
  on public.admin_audit_logs
  for insert
  to authenticated
  with check (public.is_admin() and auth.uid() = admin_id);

-- EXAM HISTORY RLS UPDATE (Only approved doctors or admin can access)
alter table public.exam_history enable row level security;

drop policy if exists "exam_history_select_own" on public.exam_history;
drop policy if exists "exam_history_insert_own" on public.exam_history;
drop policy if exists "exam_history_select_anon_demo" on public.exam_history;
drop policy if exists "exam_history_insert_anon_demo" on public.exam_history;

create policy "exam_history_select_own"
  on public.exam_history
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and (public.is_approved_doctor() or public.is_admin())
  );

create policy "exam_history_insert_own"
  on public.exam_history
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (public.is_approved_doctor() or public.is_admin())
  );

-- STORAGE POLICIES FOR 'doctor-documents'
drop policy if exists "doctor_docs_insert_own" on storage.objects;
create policy "doctor_docs_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'doctor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "doctor_docs_select_own" on storage.objects;
create policy "doctor_docs_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'doctor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "doctor_docs_select_admin" on storage.objects;
create policy "doctor_docs_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'doctor-documents'
    and public.is_admin()
  );

drop policy if exists "doctor_docs_update_own" on storage.objects;
create policy "doctor_docs_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'doctor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 11. SECURE INITIAL ADMIN PROVISIONING
-- Credentials configured:
-- username: Admin
-- password: adqora
-- email: admin@qora.system
do $$
declare
  admin_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  admin_email text := 'admin@qora.system';
  admin_username text := 'Admin';
  admin_password text := 'adqora';
  encrypted_pw text;
begin
  encrypted_pw := crypt(admin_password, gen_salt('bf'));

  -- 1. Insert or fix existing auth.users record
  if not exists (select 1 from auth.users where email = admin_email or id = admin_id) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username', admin_username, 'name', 'Administrator QORA', 'role', 'admin'),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );
  else
    update auth.users
    set encrypted_password = encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = jsonb_build_object('username', admin_username, 'name', 'Administrator QORA', 'role', 'admin'),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change = coalesce(email_change, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, '')
    where email = admin_email or id = admin_id;
  end if;

  -- 2. Insert or fix corresponding record in auth.identities (Required by GoTrue)
  if not exists (select 1 from auth.identities where user_id = admin_id or (provider = 'email' and provider_id = admin_id::text)) then
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      admin_id,
      admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email),
      'email',
      admin_id::text,
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set identity_data = jsonb_build_object('sub', admin_id::text, 'email', admin_email),
        updated_at = now()
    where user_id = admin_id;
  end if;

  -- 3. Ensure profile row is created/updated as admin with approved status
  insert into public.profiles (
    id,
    username,
    email,
    full_name,
    role,
    status,
    created_at,
    updated_at
  ) values (
    admin_id,
    admin_username,
    admin_email,
    'Administrator QORA',
    'admin',
    'approved',
    now(),
    now()
  )
  on conflict (id) do update set
    username = admin_username,
    role = 'admin',
    status = 'approved',
    email = admin_email;
end $$;
