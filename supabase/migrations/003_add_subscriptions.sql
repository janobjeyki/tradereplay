alter table public.profiles
  add column if not exists subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'canceled')),
  add column if not exists subscription_plan text not null default 'starter',
  add column if not exists subscription_price numeric(10,2) not null default 0,
  add column if not exists payment_method text
    check (payment_method in ('humo', 'uzcard', 'visa')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_expires_at timestamptz;

drop policy if exists "Users can CRUD own sessions" on public.sessions;

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can create subscribed sessions"
  on public.sessions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.subscription_status = 'active'
    )
  );

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);
