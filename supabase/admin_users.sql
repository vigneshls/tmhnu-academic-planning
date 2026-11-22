-- Management creates logins and sets passwords directly (no confirmation email, no email rate limit).
-- Only an active administrator can call these; everyone else gets an error.

create or replace function public.admin_create_user(p_email text, p_password text, p_role text, p_school uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid := gen_random_uuid(); em text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Only management can create logins.'; end if;
  if p_role not in ('admin', 'principal') then raise exception 'Invalid role.'; end if;
  if p_role = 'principal' and p_school is null then raise exception 'Choose the school for this principal.'; end if;
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  if exists (select 1 from auth.users where email = em) then raise exception 'A user with this email already exists.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em, crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  insert into public.profiles (user_id, role, school_id, full_name, email, active)
  values (uid, p_role, case when p_role = 'admin' then null else p_school end, nullif(trim(p_name), ''), em, true);
  return uid;
end $$;

create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Only management can reset passwords.'; end if;
  if length(p_password) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user;
  if not found then raise exception 'User not found.'; end if;
end $$;

revoke all on function public.admin_create_user(text, text, text, uuid, text) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, uuid, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
