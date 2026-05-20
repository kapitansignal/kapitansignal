create table if not exists public.promo_settings (
  brand_id text primary key,
  promo_code text,
  trial_promo_code text,
  trial_requires_promo boolean not null default false,
  amount_7_days_cents integer,
  amount_15_days_cents integer,
  amount_30_days_cents integer,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.promo_settings add column if not exists trial_promo_code text;
alter table public.promo_settings add column if not exists trial_requires_promo boolean not null default false;

alter table public.promo_settings enable row level security;
