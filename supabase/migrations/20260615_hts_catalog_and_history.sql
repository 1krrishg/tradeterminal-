-- HTS product catalog (from 2026 data — authoritative product descriptions)
-- 12,000+ real HS codes so any product can be looked up, not just our 9 seeds
create table if not exists public.hts_catalog (
  hts8 text primary key,
  hs4 text generated always as (left(hts8, 4)) stored,
  description text not null,
  mfn_rate numeric default 0,       -- US MFN rate on this product (decimal, e.g. 0.068 = 6.8%)
  col2_rate numeric default 0,       -- Column 2 (hostile country) rate
  updated_year int default 2026
);

create index if not exists hts_catalog_hs4_idx on public.hts_catalog (hs4);
create index if not exists hts_catalog_desc_idx on public.hts_catalog using gin(to_tsvector('english', description));

alter table public.hts_catalog enable row level security;
create policy "public read" on public.hts_catalog for select using (true);

-- Rate history — year-by-year MFN rates for every HS code
-- Powers trend charts, volatility scores, and pattern detection
create table if not exists public.rate_history (
  id bigint generated always as identity primary key,
  hts8 text not null,
  year int not null,
  mfn_rate numeric default 0,
  col2_rate numeric default 0,
  unique (hts8, year)
);

create index if not exists rate_history_hts8_idx on public.rate_history (hts8);
create index if not exists rate_history_year_idx on public.rate_history (year);

alter table public.rate_history enable row level security;
create policy "public read" on public.rate_history for select using (true);

-- Volatility scores — precomputed per HS code, updated after bulk load
-- volatility = max rate change in any single year over 1998-2026
create table if not exists public.hts_volatility (
  hts8 text primary key,
  avg_rate numeric,
  max_rate numeric,
  min_rate numeric,
  volatility numeric,        -- stddev of mfn_rate across years
  max_year_jump numeric,     -- biggest single-year rate increase
  max_jump_year int,         -- the year that spike happened
  risk_label text            -- 'HIGH' / 'MEDIUM' / 'LOW'
);

alter table public.hts_volatility enable row level security;
create policy "public read" on public.hts_volatility for select using (true);
