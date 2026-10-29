-- ====================================================================
-- QORA ADMIN PROVISIONING SCRIPT (FIX FOR "Database error querying schema")
-- Run this in the Supabase SQL Editor.
--
-- Credentials:
-- Username: Admin
-- Password: adqora
-- Email: admin@qora.system
-- ====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

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
  -- NOTE: GoTrue requires non-null empty strings for token/change columns
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

  -- 3. Ensure profile in public.profiles has role = 'admin' and status = 'approved'
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

  raise notice 'Admin account provisioned successfully. Username: %, Password: %', admin_username, admin_password;
end $$;
