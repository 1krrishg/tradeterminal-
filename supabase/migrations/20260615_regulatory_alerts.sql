-- Regulatory alerts from Federal Register API
-- Stores upcoming/recent official US government tariff rule changes

create table if not exists regulatory_alerts (
  id bigint generated always as identity primary key,
  title text not null,
  abstract text,
  source_url text unique not null,
  published_date date,
  agency text,
  alert_type text, -- tariff_change | trade_agreement | investigation
  fetched_at timestamptz default now()
);

alter table regulatory_alerts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'regulatory_alerts' and policyname = 'public read regulatory_alerts'
  ) then
    create policy "public read regulatory_alerts"
      on regulatory_alerts for select using (true);
  end if;
end $$;

create index if not exists regulatory_alerts_published_idx on regulatory_alerts(published_date desc);
create index if not exists regulatory_alerts_type_idx on regulatory_alerts(alert_type);
