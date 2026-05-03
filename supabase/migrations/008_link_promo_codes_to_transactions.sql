-- Track which promo code (if any) was applied to a subscription transaction.
alter table public.subscription_transactions
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null;

create index if not exists subscription_transactions_promo_code_idx
  on public.subscription_transactions (promo_code_id);
