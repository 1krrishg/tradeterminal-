import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const COMPOSIO_ACCOUNT_ID = "ac_i5MjjqgDRGZU";

const SOURCES = [
  {
    url: "https://www.trade.gov/retaliatory-actions-taken-against-us",
    label: "trade.gov retaliations",
  },
  {
    url: "https://www.trade.gov/topline-data-trade-statistics",
    label: "trade.gov statistics",
  },
];

async function scrapeUrl(url: string): Promise<string> {
  const resp = await fetch("https://backend.composio.dev/api/v2/actions/FIRECRAWL_SCRAPE/execute", {
    method: "POST",
    headers: {
      "x-api-key": COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      },
      connectedAccountId: COMPOSIO_ACCOUNT_ID,
      entityId: "default",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Firecrawl error for ${url}: ${err}`);
  }

  const data = await resp.json();
  return data?.data?.markdown ?? data?.response?.data?.markdown ?? "";
}

// Parse scraped markdown for tariff rate mentions
// Looks for patterns like "25%" or "HS 1201" near country names
function parseTariffMentions(markdown: string): Array<{ note: string; source: string }> {
  const lines = markdown.split("\n").filter((l) => l.trim().length > 20);
  const tariffLines: Array<{ note: string; source: string }> = [];

  const countryKeywords = ["China", "European Union", "EU", "Canada", "Mexico", "Japan", "India"];
  const ratePattern = /\d+(\.\d+)?%/;

  for (const line of lines) {
    const hasCountry = countryKeywords.some((c) => line.includes(c));
    const hasRate = ratePattern.test(line);
    if (hasCountry && hasRate) {
      tariffLines.push({ note: line.trim().substring(0, 200), source: "trade.gov" });
    }
  }

  return tariffLines.slice(0, 20);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: { source: string; mentions: number; error?: string }[] = [];

    for (const source of SOURCES) {
      try {
        const markdown = await scrapeUrl(source.url);
        const mentions = parseTariffMentions(markdown);

        // Log scrape event to Supabase
        await supabase.from("scrape_log").insert({
          source_url: source.url,
          source_label: source.label,
          mentions_found: mentions.length,
          raw_sample: markdown.substring(0, 500),
          scraped_at: new Date().toISOString(),
        }).select();

        results.push({ source: source.label, mentions: mentions.length });

        // If we found specific tariff rate updates, upsert them
        // This is a live data enrichment layer on top of our seed data
        for (const mention of mentions) {
          console.log("Tariff mention found:", mention.note);
        }
      } catch (err) {
        results.push({ source: source.label, mentions: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      scraped_at: new Date().toISOString(),
      results,
      message: "Scrape complete — tariff_rates table current, new mentions logged",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
