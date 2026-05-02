-- Add win_rate column to sessions so it can be shown in the sessions list
-- without re-loading all trades. Written by the workspace when advancing candles.
alter table public.sessions
  add column if not exists win_rate numeric(5,1) not null default 0;
