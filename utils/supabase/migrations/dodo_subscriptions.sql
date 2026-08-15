create table public.dodo_subscriptions (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  user_id uuid not null,
  dodo_subscription_id text null,
  pricing_plan_id uuid not null,
  status text not null default 'pending'::text,
  metadata jsonb null default '{}'::jsonb,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamp with time zone null,
  next_billing_date timestamp with time zone null,
  canceled_at timestamp with time zone null,
  constraint dodo_subscriptions_pkey primary key (id),
  constraint dodo_subscriptions_dodo_subscription_id_key unique (dodo_subscription_id),
  constraint dodo_subscriptions_pricing_plan_id_fkey foreign KEY (pricing_plan_id) references dodo_pricing_plans (id),
  constraint dodo_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists dodo_subscriptions_cancel_next_idx on public.dodo_subscriptions using btree (cancel_at_period_end, next_billing_date) TABLESPACE pg_default;

create index IF not exists dodo_subscriptions_status_next_idx on public.dodo_subscriptions using btree (status, next_billing_date) TABLESPACE pg_default;

create index IF not exists dodo_subscriptions_user_id_idx on public.dodo_subscriptions using btree (user_id) TABLESPACE pg_default;

create index IF not exists dodo_subscriptions_dodo_subscription_id_idx on public.dodo_subscriptions using btree (dodo_subscription_id) TABLESPACE pg_default;

create index IF not exists dodo_subscriptions_status_idx on public.dodo_subscriptions using btree (status) TABLESPACE pg_default;