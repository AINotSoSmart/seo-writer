-- Add service management fields to track scheduled cancellations and billing dates
-- Safely re-runnable with IF NOT EXISTS

alter table public.dodo_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz null,
  add column if not exists next_billing_date timestamptz null,
  add column if not exists canceled_at timestamptz null;

-- Helpful indexes for operational reporting
create index if not exists dodo_subscriptions_cancel_next_idx
  on public.dodo_subscriptions (cancel_at_period_end, next_billing_date);

create index if not exists dodo_subscriptions_status_next_idx
  on public.dodo_subscriptions (status, next_billing_date);

-- Optional comments
comment on column public.dodo_subscriptions.cancel_at_period_end is 'True if subscription is scheduled to cancel at the end of the current period';
comment on column public.dodo_subscriptions.current_period_end is 'End of current billing period (UTC)';
comment on column public.dodo_subscriptions.next_billing_date is 'Next billing/renewal date (UTC)';
comment on column public.dodo_subscriptions.canceled_at is 'Timestamp when subscription became cancelled';