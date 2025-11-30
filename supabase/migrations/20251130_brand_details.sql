-- Create brand_details table
create table if not exists public.brand_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  website_url text not null,
  brand_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.brand_details enable row level security;

-- Create policies
create policy "Users can view their own brand details"
  on public.brand_details for select
  using (auth.uid() = user_id);

create policy "Users can insert their own brand details"
  on public.brand_details for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own brand details"
  on public.brand_details for update
  using (auth.uid() = user_id);

create policy "Users can delete their own brand details"
  on public.brand_details for delete
  using (auth.uid() = user_id);

-- Add index for faster lookups
create index if not exists brand_details_user_id_idx on public.brand_details(user_id);

-- Add updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_brand_details_updated_at
    before update on public.brand_details
    for each row
    execute function update_updated_at_column();
