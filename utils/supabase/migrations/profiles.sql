create table public.profiles (
  id uuid not null,
  email text null,
  credits_remaining integer null default 3,
  subscription_tier text null default 'free'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  default_brand_id uuid null,
  constraint profiles_pkey primary key (id),
  constraint profiles_default_brand_id_fkey foreign KEY (default_brand_id) references brand_details (id) on delete set null,
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_profiles_modtime BEFORE
update on profiles for EACH row
execute FUNCTION update_updated_at_column ();