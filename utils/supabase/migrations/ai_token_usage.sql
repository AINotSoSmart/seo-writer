-- AI Token Usage Table
-- Tracks monthly AI token consumption per user

create table public.ai_token_usage (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  tokens_used bigint not null default 0,
  tokens_limit bigint not null default 200000,
  cycle_start_date timestamp with time zone not null default now(),
  last_request_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Index for efficient lookups
create index ai_token_usage_user_id_idx on public.ai_token_usage using btree (user_id);

-- Trigger for updated_at
create trigger update_ai_token_usage_modtime before update on ai_token_usage
  for each row execute function update_updated_at_column();

-- Enable RLS
alter table public.ai_token_usage enable row level security;

-- Users can only read their own usage
create policy "Users can view their own AI usage"
  on public.ai_token_usage
  for select
  using (auth.uid() = user_id);

-- Service role can do anything (for API routes)
create policy "Service role full access to AI usage"
  on public.ai_token_usage
  for all
  using (true)
  with check (true);

-- Comment on table
comment on table public.ai_token_usage is 'Tracks monthly AI token consumption per user (200k tokens/month for subscribers)';
