-- Enable pg_cron extension (free on Supabase)
create extension if not exists pg_cron;

-- Drop old weekly job if it exists
select cron.unschedule('scrape-regulations-weekly') where exists (
  select 1 from cron.job where jobname = 'scrape-regulations-weekly'
);

-- Run scrape-regulations every day at 6am UTC (11:30am IST)
-- Picks up overnight policy changes before the working day starts
select cron.schedule(
  'scrape-regulations-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://qszregcopfbiavgwvfip.supabase.co/functions/v1/scrape-regulations',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
