import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

// Reliable static HTML sources — JS-rendered sites (USTR, trade.gov) return empty content
const SOURCES = [
  {
    url: "https://en.wikipedia.org/wiki/China%E2%80%93United_States_trade_war",
    label: "Wikipedia: US-China Trade War",
  },
  {
    url: "https://en.wikipedia.org/wiki/Canada%E2%80%93United_States_trade_war",
    label: "Wikipedia: US-Canada Trade War",
  },
  {
    url: "https://en.wikipedia.org/wiki/Trump_tariffs",
    label: "Wikipedia: Trump Tariffs",
  },
  {
    url: "https://en.wikipedia.org/wiki/United_States%E2%80%93Mexico%E2%80%93Canada_Agreement",
    label: "Wikipedia: USMCA",
  },
  {
    url: "https://en.wikipedia.org/wiki/United_States_trade_representative",
    label: "Wikipedia: USTR Overview",
  },
];

async function scrapeUrl(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "TariffLens-Bot/1.0 (tariff-lens.onrender.com; trade data research)" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  // Strip non-content tags, collapse whitespace, take first 10k chars for better coverage
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 10000);
}

type TariffEntry = {
  hs_code: string;
  product_name: string;
  destination_country: string;
  destination_code: string;
  mfn_rate: number;
  retaliation_rate: number;
  effective_rate: number;
  retaliation_note: string;
};

async function extractTariffsWithGroq(text: string): Promise<TariffEntry[]> {
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a trade policy data extractor with deep knowledge of international tariff schedules. Your job is to extract SPECIFIC tariff rates that foreign countries impose on US EXPORTS (goods leaving the US being taxed when they arrive in a foreign country).

Rules:
- Only extract entries where a specific numeric % rate is mentioned
- Retaliatory/retaliations are rates a foreign country added ON TOP of the normal MFN rate
- HS codes: soybeans=1201, bourbon/whiskey=2208, beef=0201, corn=1005, cars=8703, semiconductors/chips=8542, steel=7208, aluminum=7606, aircraft=8802, aircraft parts=8803, pork=0203, cotton=5201, lobster=0306, cranberries=0811, cigarettes=2402, motorcycles=8711, orange juice=2009, chemicals broadly=2900, medical devices=9018
- Common retaliation countries: China (CN), European Union (EU), Canada (CA), Mexico (MX), India (IN), Japan (JP), Turkey (TR)
- Return [] if no specific % rates found — do not guess`,
        },
        {
          role: "user",
          content: `Extract all tariff rates on US EXPORTS from this text. Return a JSON array only, no explanation.

Each item must have:
- hs_code: string (4-digit)
- product_name: string
- destination_country: string (full name)
- destination_code: string (2-letter)
- mfn_rate: number (baseline duty %, 0 if not mentioned)
- retaliation_rate: number (extra retaliatory % added by that country on US goods)
- effective_rate: number (mfn_rate + retaliation_rate)
- retaliation_note: string (1 sentence: why the retaliation exists)

Text:
${text.substring(0, 8000)}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!resp.ok) throw new Error(`Groq error: ${resp.status}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content ?? "[]";
  const json = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  // Extract just the JSON array if there's surrounding text
  const match = json.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    // Validate each entry
    return parsed.filter((e: TariffEntry) =>
      e.hs_code && e.product_name && e.destination_country &&
      typeof e.effective_rate === "number" && e.effective_rate > 0
    );
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];
    let totalUpserted = 0;
    const seenKeys = new Set<string>();

    for (const source of SOURCES) {
      try {
        const text = await scrapeUrl(source.url);
        const entries = await extractTariffsWithGroq(text);

        // Deduplicate within this scrape run
        const fresh = entries.filter(e => {
          const k = `${e.hs_code}::${e.destination_country.toLowerCase()}`;
          if (seenKeys.has(k)) return false;
          seenKeys.add(k);
          return true;
        });

        if (fresh.length > 0) {
          const { error } = await supabase
            .from("tariff_rates")
            .upsert(
              fresh.map(e => ({
                ...e,
                last_updated: new Date().toISOString().split("T")[0],
                synced_at: new Date().toISOString(),
              })),
              { onConflict: "hs_code,destination_country" }
            );
          if (error) console.error("Upsert error:", error);
          else totalUpserted += fresh.length;
        }

        await supabase.from("scrape_log").insert({
          source_url: source.url,
          source_label: source.label,
          mentions_found: fresh.length,
          raw_sample: fresh.length > 0
            ? fresh.slice(0, 3).map(e => `${e.product_name} → ${e.destination_country}: ${e.effective_rate}% (${e.retaliation_rate}% retaliation)`).join(" | ")
            : "No specific rates found in this article",
          scraped_at: new Date().toISOString(),
        });

        results.push({ url: source.url, label: source.label, entries_found: fresh.length, sample: fresh[0] ?? null });
      } catch (err) {
        console.error(`Failed ${source.url}:`, err);
        results.push({ url: source.url, label: source.label, entries_found: 0, error: String(err) });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      scraped_at: new Date().toISOString(),
      total_upserted: totalUpserted,
      sources_checked: SOURCES.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
