create table public.dodo_subscription_changes (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null,
  from_plan_id uuid null,
  to_plan_id uuid null,
  checkout_session_id text null,
  status text not null,
  change_type text not null,
  reason text null,
  completed_at timestamp with time zone null,
  error_message text null,
  metadata jsonb null default '{}'::jsonb,
  constraint dodo_subscription_changes_pkey primary key (id),
  constraint dodo_subscription_changes_from_plan_id_fkey foreign KEY (from_plan_id) references dodo_pricing_plans (id),
  constraint dodo_subscription_changes_to_plan_id_fkey foreign KEY (to_plan_id) references dodo_pricing_plans (id),
  constraint dodo_subscription_changes_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint dodo_subscription_changes_change_type_check check (
    (
      change_type = any (
        array[
          'new'::text,
          'change'::text,
          'cancellation'::text,
          'reactivation'::text
        ]
      )
    )
  ),
  constraint dodo_subscription_changes_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'completed'::text,
          'failed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists dodo_subscription_changes_status_idx on public.dodo_subscription_changes using btree (status) TABLESPACE pg_default;

create index IF not exists dodo_subscription_changes_change_type_idx on public.dodo_subscription_changes using btree (change_type) TABLESPACE pg_default;

create index IF not exists dodo_subscription_changes_checkout_session_idx on public.dodo_subscription_changes using btree (checkout_session_id) TABLESPACE pg_default;

create index IF not exists dodo_subscription_changes_created_at_idx on public.dodo_subscription_changes using btree (created_at desc) TABLESPACE pg_default;

create index IF not exists dodo_subscription_changes_user_id_idx on public.dodo_subscription_changes using btree (user_id) TABLESPACE pg_default;