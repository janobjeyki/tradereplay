-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Strategies table
create table if not exists strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  description text,
  color       text default '#3b82f6',
  created_at  timestamptz default now()
);

-- Add strategy_id to sessions
alter table sessions add column if not exists strategy_id uuid references strategies(id) on delete set null;

-- RLS
alter table strategies enable row level security;
create policy "Users manage own strategies" on strategies for all using (auth.uid() = user_id);

-- Add checklist column to strategies
alter table strategies add column if not exists checklist text[] default null;

-- Allow pending trade status
alter table trades drop constraint if exists trades_status_check;
alter table trades add constraint trades_status_check
  check (status in ('open', 'pending', 'closed'));

-- Subscription fields on profiles
alter table profiles
  add column if not exists subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'canceled')),
  add column if not exists subscription_plan text not null default 'start',
  add column if not exists subscription_price numeric(10,2) not null default 0,
  add column if not exists payment_method text
    check (payment_method in ('humo', 'uzcard', 'visa')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz;

-- Require active subscription to create sessions
drop policy if exists "Users can CRUD own sessions" on sessions;
create policy "Users can read own sessions" on sessions for select using (auth.uid() = user_id);
create policy "Users can create subscribed sessions" on sessions for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.subscription_status = 'active'
  )
);
create policy "Users can update own sessions" on sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own sessions" on sessions for delete using (auth.uid() = user_id);

-- Stored payment instrument metadata (never full PAN/CVV)
alter table profiles
  add column if not exists card_holder_name text,
  add column if not exists card_last4 text,
  add column if not exists card_exp_month integer,
  add column if not exists card_exp_year integer,
  add column if not exists payment_authorized_at timestamptz;

create table if not exists subscription_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(10,2) not null default 0,
  currency text not null default 'UZS',
  payment_method text not null check (payment_method in ('humo', 'uzcard', 'visa')),
  card_last4 text not null,
  card_holder_name text,
  card_exp_month integer,
  card_exp_year integer,
  provider_card_id text,
  provider_card_token text,
  status text not null check (status in ('pending', 'authorized', 'failed', 'canceled')),
  reference text not null,
  created_at timestamptz not null default now()
);

alter table subscription_transactions enable row level security;
drop policy if exists "Users can read own subscription transactions" on subscription_transactions;
create policy "Users can read own subscription transactions" on subscription_transactions for select using (auth.uid() = user_id);
drop policy if exists "Users can create own subscription transactions" on subscription_transactions;
create policy "Users can create own subscription transactions" on subscription_transactions for insert with check (auth.uid() = user_id);

-- Migrate any legacy 'starter' values
update profiles set subscription_plan = 'start' where subscription_plan = 'starter';
alter table profiles alter column subscription_plan set default 'start';

-- Promo codes
create table if not exists promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  product         text not null default 'start',
  discount_percent integer not null check (discount_percent between 1 and 100),
  assigned_email  text,
  used_by_user_id uuid references auth.users on delete set null,
  used_at         timestamptz,
  created_by      uuid references auth.users on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists promo_codes_assigned_email_idx on promo_codes (lower(assigned_email));

alter table promo_codes enable row level security;
drop policy if exists "Promo codes service access" on promo_codes;
create policy "Promo codes service access" on promo_codes for all using (false) with check (false);

-- Link promo redemption to a transaction.
alter table subscription_transactions
  add column if not exists promo_code_id uuid references promo_codes(id) on delete set null;

create index if not exists subscription_transactions_promo_code_idx
  on subscription_transactions (promo_code_id);
