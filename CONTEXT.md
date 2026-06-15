# TariffLens — Full Context for AI Assistant

> Read this entire file before doing anything. This is the complete project state.

---

## What this project is

**TariffLens** — a tariff risk simulator for US exporters. Built at the AWS Harness Engineering Hackathon in San Francisco (June 12, 2026). Placed top 6 out of 300+.

A US exporter uploads a trade invoice or enters a shipment manually. The tool:
1. Uses Mistral pixtral-12b to extract product, HS code, destination, shipment value from the document
2. Looks up the current effective tariff (MFN + retaliatory) from Supabase
3. Generates 3 scenarios with dollar impact
4. Uses Groq llama-3.3-70b to write a risk summary + one recommendation
5. Shows a live tariff ticker on the homepage pulling from Supabase in real time

---

## Live URLs

- **Production:** https://tariff-lens.onrender.com
- **GitHub:** https://github.com/1krrishg/tariff-lens
- **Local dev:** `npm run dev` → http://localhost:8082

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Supabase Edge Functions (Deno) |
| AI reasoning | Groq llama-3.3-70b-versatile |
| Document extraction | Mistral pixtral-12b-2409 |
| Database | Supabase Postgres |
| Scraping | Direct HTTP fetch → Groq parsing → upsert to DB |
| Alerts | Composio Gmail integration |
| Scheduling | Supabase pg_cron (hourly) |
| Data pipeline | Airbyte Cloud (configured, free tier firewall blocked live connection) |
| Deployment | Render (static site, auto-deploys on push to main) |

---

## Repository structure

```
src/
  pages/
    Index.tsx              — Landing page (hero + live ticker + live feed + how it works)
    SimulatorPage.tsx      — /simulate — document upload + manual form
    ResultsPage.tsx        — /results — tariff breakdown, 3 scenarios, AI rec, email alert
    NotFound.tsx           — 404
  components/
    landing/
      NavBar.tsx           — Top nav with "Simulate a shipment" CTA
      Hero.tsx             — Hero section with mock demo
      LiveTicker.tsx       — Scrolling ticker strip (pulls from Supabase, refreshes 30s)
      LiveFeed.tsx         — Full live feed panel + pipeline activity log
      DemoStages.tsx       — How it works (4 steps)
      RiskGallery.tsx      — Tariff exposure map grid
      Quote.tsx            — Exporter quote
      ImpactCounter.tsx    — Stats ($180B+, 38%, 47 countries, 30s)
      FinalCTA.tsx         — Bottom CTA
      Footer.tsx           — Footer
      RegulationPreview.tsx — Empty stub (removed feature)
    Logo.tsx               — TariffLens globe+magnifier logo
    FileUpload.tsx         — (legacy from Ability, not used)
    Header.tsx             — (legacy, not used)
    ui/                    — shadcn/ui components
  lib/
    tariff-data.ts         — Seeded tariff data (frontend fallback, 25 entries)
  integrations/
    supabase/client.ts     — Supabase client
  App.tsx                  — Routes: / | /simulate | /results
  index.css                — Design system + ticker animation

supabase/
  functions/
    extract-shipment/      — Calls Mistral pixtral-12b to read uploaded documents
    simulate-tariff/       — Looks up Supabase + calls Groq for reasoning
    send-alert/            — Calls Composio Gmail to email simulation report
    scrape-tariffs/        — Scrapes Wikipedia trade war articles → Groq parses → upserts to DB
  migrations/
    20260612_tariff_rates.sql        — tariff_rates table + seed data (25 rows)
    20260612_scrape_log_and_cron.sql — scrape_log table + pg_cron hourly job
  config.toml

public/
  tariff-data.csv          — Airbyte source file (hosted on GitHub raw)

README.md                  — Full judge-facing documentation
CONTEXT.md                 — This file
```

---

## Supabase project

- **Project ref:** `qszregcopfbiavgwvfip`
- **URL:** `https://qszregcopfbiavgwvfip.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenJlZ2NvcGZiaWF2Z3d2ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjI4MDYsImV4cCI6MjA5NTkzODgwNn0.6kEdoJ63_sUsMNafzggVHFPJCopco3RliddII0Y-wUk`
- **DB host (pooler):** `aws-1-us-east-1.pooler.supabase.com`
- **Linked project:** already linked via `.temp/linked-project.json`

### Tables
- `tariff_rates` — hs_code, product_name, destination_country, destination_code, mfn_rate, retaliation_rate, effective_rate, retaliation_note, last_updated, synced_at. Unique on (hs_code, destination_country).
- `scrape_log` — source_url, source_label, mentions_found, raw_sample, scraped_at

### Edge functions deployed
- `extract-shipment` — Mistral document parser
- `simulate-tariff` — Groq reasoning + tariff lookup
- `send-alert` — Composio Gmail alert
- `scrape-tariffs` — Wikipedia scraper + Groq parser + DB upsert

### Secrets set on Supabase
- `GROQ_API_KEY`
- `MISTRAL_API_KEY`
- `COMPOSIO_API_KEY`

---

## API keys (also in .env.local)

Keys are stored in `.env.local` (gitignored). The following services need keys:

| Variable | Service | Where to get it |
|---|---|---|
| `GROQ_API_KEY` | Groq | console.groq.com |
| `MISTRAL_API_KEY` | Mistral AI | console.mistral.ai |
| `COMPOSIO_API_KEY` | Composio | app.composio.dev → API Keys |
| `COMPOSIO_ACCOUNT_ID` | Composio connected account | app.composio.dev → Connected Accounts |
| `VITE_SUPABASE_URL` | Supabase | Project settings |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase | Project settings → API |

For Supabase secrets (used by edge functions), run:
```
npx supabase secrets set GROQ_API_KEY=... MISTRAL_API_KEY=... COMPOSIO_API_KEY=... --project-ref qszregcopfbiavgwvfip
```

---

## How the scraper works

1. pg_cron fires `scrape-tariffs` every hour
2. Fetches Wikipedia: China-US trade war, Canada-US trade war, Trump tariffs articles
3. Strips HTML → sends raw text to Groq
4. Groq extracts structured tariff entries (hs_code, product, country, rates)
5. Upserts into `tariff_rates` table — overwrites seed data with live data
6. Logs to `scrape_log` table — visible on homepage live feed

**Known limitation:** Wikipedia pages with JS rendering return sparse text. Works best on static Wikipedia articles. USTR.gov and trade.gov return 404s or JS-rendered pages.

---

## What's NOT done / known issues

- **Airbyte:** Configured but can't connect to Supabase free tier (firewall blocks external Postgres). Architecture is there, just needs paid Supabase or a different DB.
- **Composio Gmail:** Wired up but needs Gmail OAuth connected in Composio dashboard to actually deliver emails.
- **HS code coverage:** Only 9 product categories seeded. Unknown products fall back to 5% generic rate — doesn't break, just less accurate.
- **Scraper mentions:** Wikipedia articles are text-heavy but tariff % mentions are sparse. Groq extracts what it finds — 1-3 entries per run typically.
- **Live ticker:** Requires Render to have deployed latest commit. Hard refresh (Cmd+Shift+R) if it looks stale.

---

## Demo script (for pitching)

1. Open https://tariff-lens.onrender.com — point at live ticker scrolling
2. Click "Simulate a shipment"
3. Select: Soybeans + China + $500,000
4. Hit simulate → show $140,000 tariff hit
5. Point at recommendation: "Shift to Japan — saves $140k"

One line: *"TariffLens is the tool my dad never had. He exports goods across India, Nepal, Bhutan, Bangladesh. Tariffs change overnight. He figures it out himself. This does it in 30 seconds."*

---

## Owner

- **Builder:** Krrish Goel (krrish_goel@ug29.mesaschool.co)
- **GitHub:** https://github.com/1krrishg
- **Team:** Krrish Goel + Hansikha Chowdary Chundru
- **Context:** Built at AWS Harness Hackathon SF, June 12 2026. Top 6/300+.
