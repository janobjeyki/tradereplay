alter table public.profiles
  add column if not exists card_holder_name text,
  add column if not exists card_last4 text,
  add column if not exists card_exp_month integer,
  add column if not exists card_exp_year integer,
  add column if not exists payment_authorized_at timestamptz;

create table if not exists public.subscription_transactions (
  id uuid primary key default uuid_generate_v4(),
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

alter table public.subscription_transactions enable row level security;

drop policy if exists "Users can read own subscription transactions"
  on public.subscription_transactions;

create policy "Users can read own subscription transactions"
  on public.subscription_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create own subscription transactions"
  on public.subscription_transactions;

create policy "Users can create own subscription transactions"
  on public.subscription_transactions for insert
  with check (auth.uid() = user_id);
