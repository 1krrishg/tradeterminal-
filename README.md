# TariffLens — US Export Tariff Risk Simulator

> **Know the tariff hit before you ship.**

**Live demo:** https://tariff-lens.onrender.com  
**GitHub:** https://github.com/1krrishg/tariff-lens

---

## What it does

TariffLens is a decision tool for US exporters. Upload a trade document or enter a shipment — instantly see:

1. **Current effective tariff** — MFN baseline duty + any retaliatory tariff the destination country has placed on US goods
2. **Dollar impact** — exactly how much this shipment loses to tariffs
3. **3 simulated scenarios** — Today / Escalation / Reroute to alternative market
4. **AI risk summary + one recommendation** — plain English, specific action, dollar-quantified

This is not a chatbot. It is a structured simulation tool built for a single decision: should I ship this, and where?

---

## The problem

$180B+ of US exports are hit by retaliatory tariffs annually. Most exporters discover the tariff AFTER committing to a shipment.

A Midwest soybean exporter shipping to China faces 28% effective tariff (3% MFN + 25% Chinese retaliation). On a $500,000 shipment that is **$140,000 in lost margin**. TariffLens shows this before the commitment — and tells the exporter to shift volume to Japan (0% retaliation) instead.

**Why ChatGPT can't do this:**
- ChatGPT's knowledge is frozen — it doesn't know today's rate after the latest trade negotiation
- ChatGPT gives a paragraph — TariffLens gives structured scenario cards with dollar amounts
- ChatGPT can't read your invoice and extract HS code + destination + value automatically
- ChatGPT can't alert you when a rate changes before your next shipment

---

## Sponsor stack

### Groq — `llama-3.3-70b-versatile`
**Role:** AI reasoning — generates risk summary and recommendation  
**File:** `supabase/functions/simulate-tariff/index.ts`  
After tariff lookup, shipment context + scenario data goes to Groq. Returns structured JSON with `risk_summary` and `recommendation`. Sub-second response.

### Mistral AI — `pixtral-12b-2409`
**Role:** Document intelligence — reads uploaded invoices and trade documents  
**File:** `supabase/functions/extract-shipment/index.ts`  
User uploads a PDF or image of their invoice. Mistral extracts product name, HS code, destination country, and shipment value. No form filling required.

### Supabase
**Role:** Database + edge functions + cron scheduling  
**Files:** All 4 edge functions, migrations  
- `tariff_rates` table — 25 entries across 6 countries, updated by pipeline
- `scrape_log` table — logs every hourly scrape
- Edge functions: `extract-shipment`, `simulate-tariff`, `send-alert`, `scrape-tariffs`
- pg_cron runs `scrape-tariffs` every hour automatically

### Render
**Role:** Frontend deployment  
**URL:** https://tariff-lens.onrender.com  
Static site, auto-deploys on push to main. Build: `npm run build`, publish: `dist`.

### Composio
**Role:** Email alerts + web scraping via Firecrawl  
**Files:** `supabase/functions/send-alert/index.ts`, `supabase/functions/scrape-tariffs/index.ts`  
- **Alerts:** Users email the simulation report from the results page via Composio Gmail
- **Scraping:** Composio Firecrawl scrapes USTR.gov for tariff updates hourly (connected account: `ac_i5MjjqgDRGZU`)

### Airbyte
**Role:** Data pipeline — ingests tariff CSV into Supabase  
Configured with File source → `https://raw.githubusercontent.com/1krrishg/tariff-lens/main/public/tariff-data.csv` → Supabase Postgres destination, hourly sync. (Supabase free tier restricts direct external Postgres — production uses dedicated instance.)

---

## Architecture

```
User uploads invoice / trade doc
           │
           ▼
  Mistral pixtral-12b          (extract-shipment function)
  Reads PDF/image → extracts HS code, destination, value
           │
           ▼
  Supabase tariff_rates table  (seeded + Airbyte pipeline)
  Lookup: MFN rate + retaliatory rate for HS code × country
           │
           ▼
  Groq llama-3.3-70b           (simulate-tariff function)
  Generates scenarios, risk summary, recommendation
           │
           ▼
  Results page
  Tariff breakdown · 3 scenario cards · AI recommendation
           │
           ▼
  Composio Gmail               (send-alert function)
  Emails simulation report to user

  ── Background (pg_cron, every hour) ──────────────────
  USTR.gov → scrape-tariffs function → scrape_log table
  Homepage live feed ← Supabase (refreshes every 30s)
```

---

## Data coverage

| Product | HS Code | Countries |
|---|---|---|
| Soybeans | 1201 | China, Canada, Japan, Mexico |
| Bourbon / Whiskey | 2208 | China, EU, Canada, Japan, India |
| Beef | 0201 | EU, Canada, Japan, Mexico, India |
| Corn / Maize | 1005 | China, Mexico |
| Semiconductors | 8542 | China, EU, Japan, India |
| Poultry | 0207 | China |
| Dairy | 0402 | EU |
| Passenger Cars | 8703 | EU, Canada |
| Aircraft parts | 8803 | China |

Sources: US Dept of Commerce Foreign Retaliations Database, USTR Section 301 tariff actions, WTO MFN rates.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Supabase Edge Functions (Deno) |
| AI reasoning | Groq llama-3.3-70b-versatile |
| AI document extraction | Mistral pixtral-12b-2409 |
| Database | Supabase Postgres |
| Scraping | Composio Firecrawl + direct HTTP fetch |
| Scheduling | Supabase pg_cron (hourly) |
| Alerts | Composio Gmail integration |
| Data pipeline | Airbyte Cloud (File connector → Postgres) |
| Deployment | Render (static site) |

---

## Try the demo

1. Go to https://tariff-lens.onrender.com
2. Click **Simulate a shipment**
3. Select: **Soybeans** · **China** · **$500,000**
4. Hit simulate — see the $140,000 tariff hit and AI recommendation

Or upload any US export invoice — Mistral will read it automatically.

---

## Key files

```
src/
  pages/
    Index.tsx           — Landing page with live tariff feed
    SimulatorPage.tsx   — Document upload + manual input form
    ResultsPage.tsx     — Tariff breakdown, scenarios, AI rec, email alert
  components/landing/
    LiveTicker.tsx      — Scrolling live tariff ticker (homepage)
    LiveFeed.tsx        — Live tariff alerts panel + pipeline log
  lib/
    tariff-data.ts      — Seeded tariff data (frontend fallback)

supabase/functions/
  extract-shipment/     — Mistral document extraction
  simulate-tariff/      — Tariff lookup + Groq reasoning
  send-alert/           — Composio email alert
  scrape-tariffs/       — Composio Firecrawl scraper (hourly)

supabase/migrations/
  20260612_tariff_rates.sql        — tariff_rates table + seed data
  20260612_scrape_log_and_cron.sql — scrape_log table + pg_cron job

public/
  tariff-data.csv       — Airbyte source file (hosted on GitHub)
```

---

Built at hackathon · June 12, 2026
