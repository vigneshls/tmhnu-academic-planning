-- TMHNU Staffing & Timetable — Supabase schema with Row Level Security
-- Run once in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board text not null check (board in ('CBSE', 'MATRIC', 'STATE')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'principal')),
  school_id uuid references public.schools (id) on delete set null,
  full_name text,
  constraint principal_needs_school check (role = 'admin' or school_id is not null)
);

create table if not exists public.rule_sets (
  board text primary key check (board in ('CBSE', 'MATRIC', 'STATE')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.school_data (
  school_id uuid primary key references public.schools (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Faculty list is kept separately so only management can change it
create table if not exists public.school_staff (
  school_id uuid primary key references public.schools (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid not null,
  action text not null,
  school_id uuid,
  detail jsonb
);

-- helpers (security definer so policies can read profiles without recursion)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
$$;

create or replace function public.my_school() returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from profiles where user_id = auth.uid()
$$;

alter table public.schools     enable row level security;
alter table public.profiles    enable row level security;
alter table public.rule_sets   enable row level security;
alter table public.school_data enable row level security;
alter table public.school_staff enable row level security;
alter table public.audit_log   enable row level security;

-- schools
create policy schools_read  on public.schools for select using (public.is_admin() or id = public.my_school());
create policy schools_write on public.schools for all    using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_read  on public.profiles for select using (user_id = auth.uid() or public.is_admin());
create policy profiles_write on public.profiles for all    using (public.is_admin()) with check (public.is_admin());

-- rule sets: everyone signed in reads, only management edits
create policy rules_read  on public.rule_sets for select using (auth.uid() is not null);
create policy rules_write on public.rule_sets for all    using (public.is_admin()) with check (public.is_admin());

-- school data: management = all schools, principal = own school only
create policy data_read   on public.school_data for select using (public.is_admin() or school_id = public.my_school());
create policy data_insert on public.school_data for insert with check (public.is_admin() or school_id = public.my_school());
create policy data_update on public.school_data for update using (public.is_admin() or school_id = public.my_school())
  with check (public.is_admin() or school_id = public.my_school());
create policy data_delete on public.school_data for delete using (public.is_admin());

-- faculty: management writes, principal reads own school
create policy staff_read  on public.school_staff for select using (public.is_admin() or school_id = public.my_school());
create policy staff_write on public.school_staff for all    using (public.is_admin()) with check (public.is_admin());

-- audit log: users write their own entries, management reads
create policy audit_insert on public.audit_log for insert with check (user_id = auth.uid());
create policy audit_read   on public.audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- After creating users in Authentication → Users, link them (example):
--
-- insert into public.schools (name, board) values
--   ('NS Vidyalaya Matriculation Higher Secondary School', 'MATRIC'),
--   ('TMHNU Matriculation Higher Secondary School, Muthuthevanpatti', 'MATRIC'),
--   ('NS Matriculation Higher Secondary School, Vadapudupatti', 'MATRIC');
--
-- insert into public.profiles (user_id, role, full_name)
--   select id, 'admin', 'Management' from auth.users where email = 'management@example.com';
--
-- insert into public.profiles (user_id, role, school_id, full_name)
--   select u.id, 'principal', s.id, 'Principal — NS Vidyalaya'
--   from auth.users u, public.schools s
--   where u.email = 'principal1@example.com' and s.name = 'NS Vidyalaya Matriculation Higher Secondary School';
