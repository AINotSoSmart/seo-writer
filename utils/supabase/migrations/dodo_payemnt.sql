create table public.dodo_payments (
  id uuid not null default extensions.uuid_generate_v4(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null,
  dodo_payment_id text unique not null, -- dodopayments payment ID
  dodo_checkout_session_id text, -- dodopayments checkout session ID
  pricing_plan_id uuid not null,
  amount numeric(10, 2) not null,
  currency text not null default 'USD',
  status text not null default 'pending', -- pending, completed, failed, refunded
  credits integer not null default 0,
  metadata jsonb default '{}',
  constraint dodo_payments_pkey primary key (id),
  constraint dodo_payments_user_id_fkey foreign key (user_id) references auth.users (id),
  constraint dodo_payments_pricing_plan_id_fkey foreign key (pricing_plan_id) references dodo_pricing_plans (id)
);

create index dodo_payments_user_id_idx on public.dodo_payments (user_id);
create index dodo_payments_dodo_payment_id_idx on public.dodo_payments (dodo_payment_id);
create index dodo_payments_status_idx on public.dodo_payments (status);