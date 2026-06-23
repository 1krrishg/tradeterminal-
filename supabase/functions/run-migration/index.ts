import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const DB_URL = Deno.env.get("SUPABASE_DB_URL") ?? "";
  
  // Use pg driver via npm
  const { Client } = await import("npm:pg@8.11.3");
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  
  const SQL = `
create table if not exists public.hts_catalog (
  hts8 text primary key,
  hs4 text generated always as (left(hts8, 4)) stored,
  description text not null,
  mfn_rate numeric default 0,
  col2_rate numeric default 0,
  updated_year int default 2026
);
create index if not exists hts_catalog_hs4_idx on public.hts_catalog (hs4);
create index if not exists hts_catalog_desc_idx on public.hts_catalog using gin(to_tsvector('english', description));
alter table public.hts_catalog enable row level security;

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

create table if not exists public.hts_volatility (
  hts8 text primary key,
  avg_rate numeric, max_rate numeric, min_rate numeric,
  volatility numeric, max_year_jump numeric, max_jump_year int, risk_label text
);
alter table public.hts_volatility enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='hts_catalog' and policyname='public read') then
    create policy "public read" on public.hts_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='rate_history' and policyname='public read') then
    create policy "public read" on public.rate_history for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='hts_volatility' and policyname='public read') then
    create policy "public read" on public.hts_volatility for select using (true);
  end if;
end $$;
`;

  try {
    await client.query(SQL);
    await client.end();
    return new Response(JSON.stringify({ success: true, message: "Tables created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    await client.end();
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
