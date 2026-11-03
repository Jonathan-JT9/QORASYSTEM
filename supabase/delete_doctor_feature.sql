-- ====================================================================
-- QORA: FITUR PENGHAPUSAN DOKTER DARI SUPABASE (AUTH & PROFILES)
-- Jalankan script SQL ini di Supabase SQL Editor (https://supabase.com/dashboard)
-- ====================================================================

-- 1. Perbarui check constraint pada tabel admin_audit_logs agar mengizinkan action 'delete'
alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check
  check (action in ('approve', 'reject', 'suspend', 'reinstate', 'delete'));

-- 2. Pastikan foreign key pada exam_history dan profiles di-set ON DELETE CASCADE / SET NULL
-- agar tidak memblokir penghapusan dari auth.users
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- 3. Tambahkan Policy RLS DELETE untuk tabel public.profiles bagi Admin
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin());

-- 4. Fungsi RPC SECURITY DEFINER untuk menghapus user dokter secara menyeluruh dari auth.users
create or replace function public.delete_doctor_user(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
#variable_conflict use_variable
declare
  v_is_admin boolean;
  v_target_role text;
  v_target_email text;
  v_target_name text;
begin
  -- 1. Validasi hak akses pemanggil: Harus Administrator QORA yang berstatus approved
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Akses ditolak: Hanya Administrator yang diizinkan menghapus data dokter.';
  end if;

  -- 2. Pastikan target bukan akun administrator demi keamanan
  select role, email, coalesce(full_name, username)
  into v_target_role, v_target_email, v_target_name
  from public.profiles
  where id = target_user_id;

  if v_target_role = 'admin' then
    raise exception 'Tidak dapat menghapus akun Administrator.';
  end if;

  -- 3. Bersihkan exam history user jika ada
  update public.exam_history
  set user_id = null
  where user_id = target_user_id;

  -- 4. Bersihkan audit logs terkait target user
  delete from public.admin_audit_logs
  where target_user_id = delete_doctor_user.target_user_id;

  -- 5. Hapus akun dari auth.users (Ini menghapus dari tab Supabase Auth -> Users)
  delete from auth.users where id = target_user_id;

  -- 6. Hapus dari public.profiles jika masih tersisa
  delete from public.profiles where id = target_user_id;

  return jsonb_build_object(
    'success', true,
    'deleted_user_id', target_user_id,
    'email', v_target_email,
    'name', v_target_name
  );
end;
$$;

-- Berikan izin eksekusi ke role authenticated
grant execute on function public.delete_doctor_user(uuid) to authenticated;

