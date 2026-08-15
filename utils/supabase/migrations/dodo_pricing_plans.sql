create table public.dodo_pricing_plans (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  name text not null,
  description text null,
  price numeric(10, 2) not null,
  credits integer not null,
  currency text not null default 'USD'::text,
  dodo_product_id text null,
  is_active boolean not null default true,
  metadata jsonb null default '{}'::jsonb,
  constraint dodo_pricing_plans_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists dodo_pricing_plans_active_idx on public.dodo_pricing_plans using btree (is_active) TABLESPACE pg_default;

create index IF not exists dodo_pricing_plans_dodo_product_id_idx on public.dodo_pricing_plans using btree (dodo_product_id) TABLESPACE pg_default;