-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)
-- for a fresh project. Idempotent where practical.

-- 1. Profiles -----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'colaborador' check (role in ('auditor', 'colaborador')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- security definer + fixed search_path so this bypasses RLS when called from
-- inside a profiles policy; a plain subquery against public.profiles here
-- would re-trigger RLS on itself and recurse infinitely.
create or replace function public.is_auditor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'auditor');
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_select_auditor" on public.profiles;
create policy "profiles_select_auditor" on public.profiles
  for select using (public.is_auditor());

-- New auth users automatically get a profile row (default role: colaborador).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'colaborador');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To promote the first auditor account, run manually after they sign up:
--   update public.profiles set role = 'auditor' where email = 'auditor@example.com';

-- 2. Work hours configuration -------------------------------------------
create table if not exists public.work_hours_config (
  id uuid primary key,
  daily_hours numeric not null default 8,
  weekly_hours numeric not null default 40,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.work_hours_config enable row level security;

drop policy if exists "config_select_authenticated" on public.work_hours_config;
create policy "config_select_authenticated" on public.work_hours_config
  for select using (auth.role() = 'authenticated');

drop policy if exists "config_write_auditor" on public.work_hours_config;
create policy "config_write_auditor" on public.work_hours_config
  for all using (public.is_auditor()) with check (public.is_auditor());

insert into public.work_hours_config (id, daily_hours, weekly_hours)
values ('00000000-0000-0000-0000-000000000001', 8, 40)
on conflict (id) do nothing;

-- 3. Attendance records ---------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  taken_at timestamptz not null,
  photo_path text,
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  device_id text,
  auto_closed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Idempotent for existing projects created before location/device/auto-close tracking was added.
alter table public.attendance_records add column if not exists latitude double precision;
alter table public.attendance_records add column if not exists longitude double precision;
alter table public.attendance_records add column if not exists location_accuracy double precision;
alter table public.attendance_records add column if not exists device_id text;
alter table public.attendance_records add column if not exists auto_closed boolean not null default false;
-- System-generated "olvidó marcar salida" closes have no photo.
alter table public.attendance_records alter column photo_path drop not null;

create index if not exists attendance_records_user_taken_at_idx
  on public.attendance_records (user_id, taken_at);

alter table public.attendance_records enable row level security;

drop policy if exists "attendance_select_own" on public.attendance_records;
create policy "attendance_select_own" on public.attendance_records
  for select using (auth.uid() = user_id);

drop policy if exists "attendance_select_auditor" on public.attendance_records;
create policy "attendance_select_auditor" on public.attendance_records
  for select using (public.is_auditor());

drop policy if exists "attendance_insert_own" on public.attendance_records;
create policy "attendance_insert_own" on public.attendance_records
  for insert with check (auth.uid() = user_id);

-- 4. Devices ---------------------------------------------------------------
-- "Alerta" mode device recognition: every (user, device) pair is registered
-- on first sight as unapproved; the app never blocks on this, it's purely a
-- signal for the auditor to review and approve. See electron/main.js for how
-- device_id is generated/persisted per machine.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_id text not null,
  hostname text,
  first_seen_at timestamptz not null default now(),
  approved boolean not null default false,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  unique (user_id, device_id)
);

alter table public.devices enable row level security;

drop policy if exists "devices_select_own_or_auditor" on public.devices;
create policy "devices_select_own_or_auditor" on public.devices
  for select using (auth.uid() = user_id or public.is_auditor());

-- approved must be false on insert — otherwise a user could self-register
-- their own device as pre-approved, which would defeat the whole feature.
-- Only "devices_update_auditor" below can ever flip it to true.
drop policy if exists "devices_insert_own" on public.devices;
create policy "devices_insert_own" on public.devices
  for insert with check (auth.uid() = user_id and approved = false);

drop policy if exists "devices_update_auditor" on public.devices;
create policy "devices_update_auditor" on public.devices
  for update using (public.is_auditor()) with check (public.is_auditor());

-- 5. Auto-close forgotten "salida" marks -----------------------------------
-- Runs entirely inside Postgres (pg_cron), independent of any laptop being
-- on — a desktop app can't guarantee it's running at exactly 6pm. Free-tier
-- compatible: pg_cron is a Postgres extension, not a paid Supabase feature.
--
-- The job itself fires at 11:59pm (end of day), not 6pm — so a colaborador
-- still legitimately working past 6pm is never interrupted mid-shift. It only
-- kicks in once the day is basically over and 6pm clearly came and went
-- unmarked; the *recorded* exit time it assigns is still fixed at 18:00,
-- matching the regular end-of-shift default.
create extension if not exists pg_cron;

-- Peru doesn't observe DST, so a fixed America/Lima offset is safe year-round.
create or replace function public.auto_close_open_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.attendance_records (user_id, type, taken_at, auto_closed)
  select last_mark.user_id, 'out',
         (date_trunc('day', now() at time zone 'America/Lima') + interval '18 hours') at time zone 'America/Lima',
         true
  from (
    select distinct on (ar.user_id) ar.user_id, ar.type
    from public.attendance_records ar
    where (ar.taken_at at time zone 'America/Lima')::date = (now() at time zone 'America/Lima')::date
    order by ar.user_id, ar.taken_at desc
  ) last_mark
  where last_mark.type = 'in';
$$;

-- 04:59 UTC = 23:59 America/Lima (UTC-5) the same Lima calendar day (UTC is
-- ahead, so this lands on the following UTC date — that's expected and fine,
-- the function itself resolves "today" from Lima's wall clock, not UTC's).
-- cron.schedule updates the job in place if "auto-close-attendance" already
-- exists, so this is safe to re-run.
select cron.schedule('auto-close-attendance', '59 4 * * *', $$select public.auto_close_open_sessions();$$);

-- 6. Storage: attendance photos -------------------------------------------
-- Private bucket: photos are evidence for disputes, not shown anywhere in the
-- app UI, so nothing should be fetchable without going through RLS below.
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "attendance_photos_insert_own" on storage.objects;
create policy "attendance_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'attendance-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read access mirrors attendance_records: a user can fetch their own photos,
-- an auditor can fetch anyone's (e.g. via a signed URL if a dispute needs it).
drop policy if exists "attendance_photos_read_authenticated" on storage.objects;
drop policy if exists "attendance_photos_read_own_or_auditor" on storage.objects;
create policy "attendance_photos_read_own_or_auditor" on storage.objects
  for select using (
    bucket_id = 'attendance-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_auditor())
  );
