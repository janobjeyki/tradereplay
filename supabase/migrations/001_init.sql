-- ═══════════════════════════════════════════════════════════════
--  TradeLab — Supabase Migration 001
--  Run this in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── profiles ────────────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  display_name text,
  language    text not null default 'en' check (language in ('en','ru','uz')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── sessions ────────────────────────────────────────────────────
create table public.sessions (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users on delete cascade not null,
  name         text not null,
  symbol       text not null,
  start_date   date not null,
  end_date     date not null,
  start_capital numeric(14,2) not null,
  end_capital   numeric(14,2) not null default 0,
  candle_index  integer not null default 0,
  is_completed  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can CRUD own sessions"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── trades ──────────────────────────────────────────────────────
create table public.trades (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references public.sessions on delete cascade not null,
  user_id       uuid references auth.users on delete cascade not null,
  side          text not null check (side in ('buy','sell')),
  entry_price   numeric(18,5) not null,
  exit_price    numeric(18,5),
  quantity      numeric(10,2) not null default 0.1,
  stop_loss     numeric(18,5),
  take_profit   numeric(18,5),
  pnl           numeric(12,2),
  status        text not null default 'open' check (status in ('open','closed')),
  opened_at_idx integer not null,
  closed_at_idx integer,
  weekday       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.trades enable row level security;

create policy "Users can CRUD own trades"
  on public.trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── candle_cache ─────────────────────────────────────────────────
-- Stores generated candle data per session so replays are consistent
create table public.candle_cache (
  session_id uuid references public.sessions on delete cascade primary key,
  candles    jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.candle_cache enable row level security;

create policy "Users can read own candle cache"
  on public.candle_cache for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_updated_at before update on public.sessions
  for each row execute procedure public.update_updated_at();
create trigger trades_updated_at before update on public.trades
  for each row execute procedure public.update_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ── indexes ──────────────────────────────────────────────────────
create index sessions_user_id_idx on public.sessions(user_id);
create index trades_session_id_idx on public.trades(session_id);
create index trades_user_id_idx on public.trades(user_id);
