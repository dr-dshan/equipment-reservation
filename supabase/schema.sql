create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  supervisor text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  equipment text not null check (equipment in ('Picomaster', 'Ellionix', 'Magnetic Annealing', 'AJA Oxide Sputter', 'Magnetotransport system (L6315)', 'Magnetotransport system (T4105)')),
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, equipment)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  equipment text not null check (equipment in ('Picomaster', 'Ellionix', 'Magnetic Annealing', 'AJA Oxide Sputter', 'Magnetotransport system (L6315)', 'Magnetotransport system (T4105)')),
  name text not null,
  email text not null,
  supervisor text not null,
  purpose text not null,
  notes text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  approval_token_hash text unique,
  auto_approve_at timestamptz not null default (now() + interval '1 minute'),
  auto_processed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint valid_time check (end_time > start_time)
);

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

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists equipment_permissions_user_equipment_idx on public.equipment_permissions (user_id, equipment);
create index if not exists reservations_equipment_time_idx on public.reservations (equipment, start_time, end_time);
create index if not exists reservations_status_idx on public.reservations (status);
create index if not exists reservations_reminder_idx on public.reservations (status, reminder_sent_at, start_time);
create index if not exists reservations_auto_approve_idx on public.reservations (status, auto_approve_at);
create index if not exists maintenance_equipment_time_idx on public.maintenance_blocks (equipment, start_time, end_time);

alter table public.profiles enable row level security;
alter table public.equipment_permissions enable row level security;
alter table public.reservations enable row level security;
alter table public.maintenance_blocks enable row level security;

-- No public policies are required.
-- The app reads/writes through server-side API routes using the service-role key.
