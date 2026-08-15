create table public.dodo_webhook_events (
  id uuid not null default extensions.uuid_generate_v4 (),
  created_at timestamp with time zone not null default now(),
  dodo_event_id text not null,
  event_type text not null,
  processed boolean not null default false,
  processed_at timestamp with time zone null,
  data jsonb not null,
  error_message text null,
  retry_count integer not null default 0,
  constraint dodo_webhook_events_pkey primary key (id),
  constraint dodo_webhook_events_dodo_event_id_key unique (dodo_event_id)
) TABLESPACE pg_default;

create index IF not exists dodo_webhook_events_dodo_event_id_idx on public.dodo_webhook_events using btree (dodo_event_id) TABLESPACE pg_default;

create index IF not exists dodo_webhook_events_event_type_idx on public.dodo_webhook_events using btree (event_type) TABLESPACE pg_default;

create index IF not exists dodo_webhook_events_processed_idx on public.dodo_webhook_events using btree (processed) TABLESPACE pg_default;