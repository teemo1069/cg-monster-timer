create extension if not exists pgcrypto;

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username = lower(username)),
  password_salt text not null,
  password_hash text not null,
  password_iterations integer not null default 310000 check (password_iterations >= 210000),
  must_change_password boolean not null default true,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  disabled boolean not null default false,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.admin_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_account_id_idx
  on public.admin_sessions(account_id);

create index if not exists admin_sessions_expires_at_idx
  on public.admin_sessions(expires_at);

alter table public.admin_accounts enable row level security;
alter table public.admin_sessions enable row level security;

revoke all on table public.admin_accounts from anon, authenticated;
revoke all on table public.admin_sessions from anon, authenticated;
grant all on table public.admin_accounts to service_role;
grant all on table public.admin_sessions to service_role;

-- Create the first administrator through a private setup process.
-- Never commit a plaintext password, salt, or derived password hash here.

