alter table public.trades
  drop constraint if exists trades_status_check;

alter table public.trades
  add constraint trades_status_check
  check (status in ('open', 'pending', 'closed'));
