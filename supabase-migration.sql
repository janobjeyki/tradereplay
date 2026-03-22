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
