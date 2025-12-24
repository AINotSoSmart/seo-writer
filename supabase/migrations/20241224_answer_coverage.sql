-- Migration: Add answer_coverage table for strategic content planning
-- Created: 2024-12-24

-- Create the answer_coverage table
create table public.answer_coverage (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  brand_id uuid null,
  cluster text not null,
  answer_unit text not null, -- Full user question, e.g. "How much does AI photo restoration cost?"
  coverage_state text not null, -- partial | strong | dominant
  first_covered_by uuid null,
  last_updated_at timestamp with time zone default now(),
  answer_embedding extensions.vector null,
  primary key (id),
  unique (user_id, brand_id, cluster, answer_unit),
  constraint answer_coverage_article_fkey foreign key (first_covered_by)
    references articles (id) on delete set null
);

-- Add index for faster lookups by user and cluster
create index idx_answer_coverage_user_cluster on public.answer_coverage (user_id, cluster);

-- Enable RLS
alter table public.answer_coverage enable row level security;

-- RLS Policies
create policy "Users can view their own coverage data"
  on public.answer_coverage for select
  using (auth.uid() = user_id);

create policy "Users can insert their own coverage data"
  on public.answer_coverage for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own coverage data"
  on public.answer_coverage for update
  using (auth.uid() = user_id);

create policy "Users can delete their own coverage data"
  on public.answer_coverage for delete
  using (auth.uid() = user_id);
