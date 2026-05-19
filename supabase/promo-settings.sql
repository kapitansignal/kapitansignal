create table if not exists public.promo_settings (
  brand_id text primary key,
  promo_code text,
  amount_7_days_cents integer,
  amount_15_days_cents integer,
  amount_30_days_cents integer,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.promo_settings enable row level security;

