alter table public.subscription_transactions
  add column if not exists card_exp_month integer,
  add column if not exists card_exp_year integer,
  add column if not exists provider_card_id text,
  add column if not exists provider_card_token text;

alter table public.subscription_transactions
  drop constraint if exists subscription_transactions_status_check;

alter table public.subscription_transactions
  add constraint subscription_transactions_status_check
  check (status in ('pending', 'authorized', 'failed', 'canceled'));
