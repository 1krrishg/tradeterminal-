-- Scrape log table — tracks every Composio/Firecrawl run
create table if not exists public.scrape_log (
  id bigint generated always as identity primary key,
  source_url text,
  source_label text,
  mentions_found int default 0,
  raw_sample text,
  scraped_at timestamptz default now()
);

alter table public.scrape_log enable row level security;
create policy "public read" on public.scrape_log for select using (true);

-- Enable pg_cron extension
create extension if not exists pg_cron;

-- Schedule scrape-tariffs edge function every hour
select cron.schedule(
  'scrape-tariffs-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qszregcopfbiavgwvfip.supabase.co/functions/v1/scrape-tariffs',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
