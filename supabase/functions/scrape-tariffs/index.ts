import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const SOURCES = [
  "https://ustr.gov/issue-areas/enforcement/section-301-investigations/tariff-actions",
  "https://ustr.gov/about-us/policy-offices/press-office/fact-sheets",
];

async function scrapeUrl(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "TariffLens-Bot/1.0 (tariff-lens.onrender.com)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const html = await resp.text();
  // Strip tags, collapse whitespace
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 8000);
}

const COUNTRIES = ["China", "European Union", "Canada", "Mexico", "Japan", "India"];
const RATE_RE = /(\d+(?:\.\d+)?)\s*%/g;

function extractMentions(text: string) {
  const sentences = text.split(/[.!?\n]/).filter((s) => s.length > 20);
  const hits: string[] = [];
  for (const s of sentences) {
    const hasCountry = COUNTRIES.some((c) => s.includes(c));
    const hasRate = RATE_RE.test(s);
    RATE_RE.lastIndex = 0;
    if (hasCountry && hasRate) hits.push(s.trim().substring(0, 200));
  }
  return hits.slice(0, 15);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const url of SOURCES) {
      try {
        const text = await scrapeUrl(url);
        const mentions = extractMentions(text);

        await supabase.from("scrape_log").insert({
          source_url: url,
          source_label: "trade.gov",
          mentions_found: mentions.length,
          raw_sample: mentions.slice(0, 3).join(" | "),
          scraped_at: new Date().toISOString(),
        });

        results.push({ url, mentions: mentions.length, sample: mentions[0] ?? null });
      } catch (err) {
        results.push({ url, mentions: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      scraped_at: new Date().toISOString(),
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
