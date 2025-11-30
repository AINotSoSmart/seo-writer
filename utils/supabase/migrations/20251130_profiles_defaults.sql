alter table public.profiles
  add column if not exists default_brand_id uuid references public.brand_details(id) on delete set null;

alter table public.profiles
  add column if not exists default_voice_id uuid references public.brand_voices(id) on delete set null;

comment on column public.profiles.default_brand_id is 'User preferred default brand for generation';
comment on column public.profiles.default_voice_id is 'User preferred default voice for generation';
