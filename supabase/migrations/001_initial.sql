create extension if not exists pgcrypto;

create table
  if not exists public.tracked_products (
    id uuid primary key default gen_random_uuid (),
    store_product_id text not null unique,
    name text not null,
    product_url text not null,
    image_url text,
    category text,
    description text,
    frequency_minutes integer not null default 120 check (frequency_minutes >= 30),
    active boolean not null default true,
    last_scraped_at timestamptz,
    last_success_at timestamptz,
    created_at timestamptz not null default now ()
  );

create table
  if not exists public.scrape_logs (
    id uuid primary key default gen_random_uuid (),
    product_id uuid not null references public.tracked_products (id) on delete cascade,
    run_id uuid not null,
    trigger text not null check (trigger in ('cron', 'manual', 'headed')),
    started_at timestamptz not null,
    finished_at timestamptz,
    outcome text not null check (outcome in ('success', 'retried', 'failed')),
    attempts integer not null default 1,
    http_status integer,
    error_code text,
    error_message text,
    duration_ms integer,
    parsed_snapshot jsonb
  );

create table
  if not exists public.price_history (
    id uuid primary key default gen_random_uuid (),
    product_id uuid not null references public.tracked_products (id) on delete cascade,
    price_cents integer not null check (price_cents > 0),
    currency text not null default 'INR',
    in_stock boolean not null,
    scraped_at timestamptz not null,
    log_id uuid references public.scrape_logs (id) on delete set null,
    unique (product_id, scraped_at)
  );

create table
  if not exists public.scrape_locks (
    name text primary key,
    run_id uuid not null,
    acquired_at timestamptz not null default now ()
  );

create index if not exists tracked_products_due on public.tracked_products (active, last_scraped_at);

create index if not exists price_history_product_time on public.price_history (product_id, scraped_at desc);

create index if not exists scrape_logs_product_time on public.scrape_logs (product_id, started_at desc);

alter table public.tracked_products enable row level security;

alter table public.price_history enable row level security;

alter table public.scrape_logs enable row level security;

create policy "tracked products read" on public.tracked_products for
select
  using (true);

create policy "history read" on public.price_history for
select
  using (true);

create policy "logs read" on public.scrape_logs for
select
  using (true);