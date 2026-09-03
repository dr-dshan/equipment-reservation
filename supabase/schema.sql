create extension if not exists pgcrypto;

create table if not exists public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  equipment text not null check (equipment in ('Picomaster', 'Ellionix', 'Magnetic Annealing')),
  name text not null,
  email text not null,
  supervisor text not null,
  purpose text not null,
  notes text not null default '',
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  approval_token_hash text unique,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reminder_sent_at timestamptz,
  constraint valid_time check (end_time > start_time)
);

create index if not exists reservations_equipment_time_idx
  on public.reservations (equipment, start_time, end_time);

create index if not exists reservations_status_idx
  on public.reservations (status);

alter table public.allowed_users enable row level security;
alter table public.reservations enable row level security;

-- The browser never queries these tables directly.
-- All reads/writes go through server-side Next.js API routes using the service-role key.

-- Safe migration for databases created with an earlier version.
alter table public.reservations
  add column if not exists reminder_sent_at timestamptz;
