-- Data-preserving migration for existing Equipment Reservation deployments.
-- Existing users, permissions, reservations, statuses, and reminder timestamps are retained.
create extension if not exists pgcrypto;

alter table public.reservations add column if not exists auto_approve_at timestamptz;
alter table public.reservations add column if not exists auto_processed_at timestamptz;

-- Existing pending requests become eligible one minute after their original creation time.
update public.reservations
set auto_approve_at = created_at + interval '1 minute'
where auto_approve_at is null;

alter table public.reservations alter column auto_approve_at set default (now() + interval '1 minute');
alter table public.reservations alter column auto_approve_at set not null;

create table if not exists public.maintenance_blocks (
  id uuid primary key default gen_random_uuid(),
  equipment text not null check (equipment in ('Picomaster', 'Ellionix', 'Magnetic Annealing', 'AJA Oxide Sputter', 'Magnetotransport system (L6315)', 'Magnetotransport system (T4105)')),
  title text not null default 'Maintenance',
  reason text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_valid_time check (end_time > start_time)
);

create index if not exists reservations_auto_approve_idx on public.reservations (status, auto_approve_at);
create index if not exists maintenance_equipment_time_idx on public.maintenance_blocks (equipment, start_time, end_time);
alter table public.maintenance_blocks enable row level security;
