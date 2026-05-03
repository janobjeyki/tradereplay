-- Rename existing 'starter' plan rows to 'start' and update default.
update public.profiles
  set subscription_plan = 'start'
  where subscription_plan = 'starter';

alter table public.profiles
  alter column subscription_plan set default 'start';

-- Promo codes table for admin-generated discounts.
create table if not exists public.promo_codes (
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

create index if not exists promo_codes_assigned_email_idx
  on public.promo_codes (lower(assigned_email));

alter table public.promo_codes enable row level security;

drop policy if exists "Promo codes service access" on public.promo_codes;
create policy "Promo codes service access"
  on public.promo_codes
  for all
  using (false)
  with check (false);
