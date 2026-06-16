import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

// ── Sources ──────────────────────────────────────────────────────────────────
// Mix of official government sources + Wikipedia for narrative context.
// Federal Register API returns real JSON — most reliable.
// Wikipedia plain HTML — good for retaliation context.
// USTR/CBP pages — static HTML sections where accessible.

const HTML_SOURCES = [
  {
    url: "https://en.wikipedia.org/wiki/China%E2%80%93United_States_trade_war",
    label: "Wikipedia: US-China Trade War",
    country_hint: "China",
    authority: "narrative", // narrative | official
  },
  {
    url: "https://en.wikipedia.org/wiki/Trump_tariffs",
    label: "Wikipedia: Trump Tariffs (2025)",
    country_hint: null,
    authority: "narrative",
  },
  {
    url: "https://en.wikipedia.org/wiki/Canada%E2%80%93United_States_trade_war",
    label: "Wikipedia: US-Canada Trade War",
    country_hint: "Canada",
    authority: "narrative",
  },
  {
    url: "https://en.wikipedia.org/wiki/United_States_trade_representative",
    label: "Wikipedia: USTR Overview",
    country_hint: null,
    authority: "narrative",
  },
  {
    // USTR publishes plain-HTML press release lists
    url: "https://ustr.gov/about-us/policy-offices/press-office/press-releases",
    label: "USTR: Press Releases",
    country_hint: null,
    authority: "official",
  },
];

// Federal Register API — official US government regulatory announcements
// Free JSON API, no auth needed. Returns documents mentioning tariffs.
const FEDERAL_REGISTER_QUERIES = [
  "tariff retaliation china",
  "section 301 tariff",
  "section 232 steel aluminum",
  "trade war tariff rate",
];

// ── Types ─────────────────────────────────────────────────────────────────────

type RawEntry = {
  hs_code: string;
  product_name: string;
  destination_country: string;
  destination_code: string;
  mfn_rate: number;
  retaliation_rate: number;
  effective_rate: number;
  retaliation_note: string;
  source_url: string;
  authority: string; // "official" | "narrative"
};

type RegulatoryAlert = {
  title: string;
  abstract: string;
  source_url: string;
  published_date: string;
  agency: string;
  alert_type: string; // "tariff_change" | "trade_agreement" | "investigation"
};

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "TariffLens-Bot/1.0 (tariff research tool; contact: krrish_goel@ug29.mesaschool.co)",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  const html = await resp.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 12000);
}

async function fetchFederalRegister(query: string): Promise<RegulatoryAlert[]> {
  const params = new URLSearchParams({
    "conditions[term]": query,
    "conditions[publication_date][gte]": "2024-01-01",
    "conditions[type][]": "RULE",
    "conditions[type][]": "PROPOSED_RULE",
    "conditions[type][]": "NOTICE",
    "fields[]": "title,abstract,html_url,publication_date,agencies",
    "per_page": "5",
    "order": "newest",
  });

  const resp = await fetch(
    `https://www.federalregister.gov/api/v1/documents.json?${params}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!resp.ok) return [];

  const data = await resp.json();
  const docs = data.results ?? [];

  return docs
    .filter((d: any) => d.title && d.html_url)
    .map((d: any) => ({
      title: d.title,
      abstract: (d.abstract ?? "").substring(0, 300),
      source_url: d.html_url,
      published_date: d.publication_date,
      agency: d.agencies?.[0]?.name ?? "Unknown agency",
      alert_type: classifyAlert(d.title + " " + (d.abstract ?? "")),
    }))
    .filter((a: RegulatoryAlert) => a.alert_type !== "other");
}

function classifyAlert(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("section 301") || lower.includes("section 232") || lower.includes("retaliat")) return "tariff_change";
  if (lower.includes("free trade") || lower.includes("agreement") || lower.includes("usmca")) return "trade_agreement";
  if (lower.includes("investigation") || lower.includes("safeguard") || lower.includes("dumping")) return "investigation";
  if (lower.includes("tariff") || lower.includes("duty") || lower.includes("import")) return "tariff_change";
  return "other";
}

// ── Groq extraction ───────────────────────────────────────────────────────────

async function extractWithGroq(text: string, sourceUrl: string, authority: string): Promise<RawEntry[]> {
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
          content: `You are a trade policy data extractor. Extract SPECIFIC tariff rates that foreign countries impose on US EXPORTS.

Rules — be strict:
- Only extract entries with an explicit numeric % rate stated in the text
- Do NOT guess or infer rates not directly stated
- Retaliation = extra % a foreign country added on top of normal MFN duty on US goods
- HS codes must be 4-digit. Use these known mappings:
  soybeans=1201, bourbon/whiskey=2208, beef=0201, corn=1005, cars=8703,
  semiconductors=8542, steel=7208, aluminum=7606, aircraft=8802,
  aircraft parts=8803, pork=0203, cotton=5201, lobster=0306,
  cranberries=0811, cigarettes=2402, motorcycles=8711, orange juice=2009,
  chemicals=2900, medical devices=9018, LNG=2711, coal=2701, seafood=0302
- Countries: China (CN), EU (EU), Canada (CA), Mexico (MX), India (IN),
  Japan (JP), Turkey (TR), South Korea (KR), Brazil (BR), UK (GB)
- Return [] if no rates are clearly stated — never fabricate numbers`,
        },
        {
          role: "user",
          content: `Extract all foreign tariffs on US exports from this text. Return a JSON array only.

Each item:
- hs_code: string (4-digit, from known list above)
- product_name: string (plain English name)
- destination_country: string (full country/region name)
- destination_code: string (2-letter)
- mfn_rate: number (normal baseline duty %, 0 if not mentioned)
- retaliation_rate: number (extra retaliatory % this country added)
- effective_rate: number (mfn_rate + retaliation_rate)
- retaliation_note: string (1 sentence explaining why — cite date/policy if mentioned)

Text:
${text.substring(0, 9000)}`,
        },
      ],
      max_tokens: 2500,
      temperature: 0.05, // very low temp = less hallucination
    }),
  });

  if (!resp.ok) throw new Error(`Groq error ${resp.status}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content ?? "[]";
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e: any) =>
        e.hs_code && e.product_name && e.destination_country &&
        typeof e.effective_rate === "number" && e.effective_rate > 0 &&
        e.effective_rate <= 300 // sanity cap
      )
      .map((e: any) => ({ ...e, source_url: sourceUrl, authority }));
  } catch {
    return [];
  }
}

// ── Verification layer ────────────────────────────────────────────────────────

// Validate that an HS code exists in our hts_catalog (authoritative USITC data)
async function validateHsCodes(
  entries: RawEntry[],
  supabase: ReturnType<typeof createClient>
): Promise<{ entry: RawEntry; valid: boolean; reason?: string }[]> {
  const codes = [...new Set(entries.map(e => e.hs_code))];

  // Check which 4-digit codes exist in hts_catalog (as hs4 generated column)
  const { data: validCodes } = await supabase
    .from("hts_catalog")
    .select("hs4")
    .in("hs4", codes)
    .limit(100);

  const validSet = new Set((validCodes ?? []).map((r: any) => r.hs4));

  return entries.map(entry => {
    // Rate sanity check
    if (entry.effective_rate > 300) {
      return { entry, valid: false, reason: `Rate ${entry.effective_rate}% exceeds 300% sanity cap` };
    }
    if (entry.retaliation_rate < 0) {
      return { entry, valid: false, reason: "Negative retaliation rate" };
    }
    // HS code validation
    if (!validSet.has(entry.hs_code)) {
      // Allow well-known codes even if not in catalog (some 4-digit codes map differently)
      const knownCodes = new Set(["1201","2208","0201","1005","8703","8542","7208","7606","8802","8803","0203","5201","0306","0811","2402","8711","2009","2900","9018","2711","2701","0302"]);
      if (!knownCodes.has(entry.hs_code)) {
        return { entry, valid: false, reason: `HS code ${entry.hs_code} not found in USITC catalog` };
      }
    }
    return { entry, valid: true };
  });
}

// Cross-source corroboration: entries with same hs_code+country from multiple sources
// get a higher confidence score
function computeConfidence(
  allEntries: (RawEntry & { valid: boolean })[],
  entry: RawEntry & { valid: boolean }
): number {
  if (!entry.valid) return 0;

  const sameKey = allEntries.filter(
    e => e.valid && e.hs_code === entry.hs_code &&
    e.destination_country.toLowerCase() === entry.destination_country.toLowerCase()
  );

  // Multiple sources agree within 5 percentage points → high confidence
  const rates = sameKey.map(e => e.effective_rate);
  const maxRate = Math.max(...rates);
  const minRate = Math.min(...rates);
  const spread = maxRate - minRate;

  if (sameKey.length >= 2 && spread <= 5) return 95; // corroborated
  if (sameKey.length >= 2 && spread <= 15) return 75; // partial agreement
  if (entry.authority === "official") return 80;       // single official source
  if (entry.authority === "narrative") return 55;      // single Wikipedia source
  return 50;
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const runStart = new Date().toISOString();
    const allRaw: RawEntry[] = [];
    const sourceResults: any[] = [];

    // ── 1. Scrape all HTML sources in parallel ──
    await Promise.allSettled(
      HTML_SOURCES.map(async (source) => {
        try {
          const text = await fetchHtml(source.url);
          const entries = await extractWithGroq(text, source.url, source.authority);
          allRaw.push(...entries);
          sourceResults.push({
            label: source.label,
            url: source.url,
            authority: source.authority,
            extracted: entries.length,
            sample: entries[0] ? `${entries[0].product_name} → ${entries[0].destination_country}: ${entries[0].effective_rate}%` : "none",
          });
        } catch (err) {
          sourceResults.push({ label: source.label, url: source.url, error: String(err), extracted: 0 });
        }
      })
    );

    // ── 2. Fetch Federal Register regulatory alerts ──
    const allAlerts: RegulatoryAlert[] = [];
    await Promise.allSettled(
      FEDERAL_REGISTER_QUERIES.map(async (q) => {
        try {
          const alerts = await fetchFederalRegister(q);
          allAlerts.push(...alerts);
        } catch {
          // non-fatal
        }
      })
    );

    // Deduplicate alerts by URL
    const uniqueAlerts = allAlerts.filter((a, i, arr) =>
      arr.findIndex(b => b.source_url === a.source_url) === i
    ).slice(0, 15);

    // Store regulatory alerts
    if (uniqueAlerts.length > 0) {
      await supabase
        .from("regulatory_alerts")
        .upsert(
          uniqueAlerts.map(a => ({
            title: a.title,
            abstract: a.abstract,
            source_url: a.source_url,
            published_date: a.published_date,
            agency: a.agency,
            alert_type: a.alert_type,
            fetched_at: runStart,
          })),
          { onConflict: "source_url" }
        );
    }

    // ── 3. Verification layer ──
    const validated = await validateHsCodes(allRaw, supabase);
    const withValidity = validated.map(v => ({ ...v.entry, valid: v.valid, reason: v.reason }));

    // Compute confidence scores
    const withConfidence = withValidity.map(entry => ({
      ...entry,
      confidence: computeConfidence(withValidity, entry),
    }));

    // Only upsert entries that pass validation (confidence > 0)
    const verified = withConfidence.filter(e => e.confidence > 0);

    // Deduplicate by hs_code+country, keep highest-confidence entry
    const deduped = new Map<string, typeof verified[0]>();
    for (const entry of verified) {
      const k = `${entry.hs_code}::${entry.destination_country.toLowerCase()}`;
      const existing = deduped.get(k);
      if (!existing || entry.confidence > existing.confidence) {
        deduped.set(k, entry);
      }
    }

    const toUpsert = [...deduped.values()];
    let totalUpserted = 0;

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from("tariff_rates")
        .upsert(
          toUpsert.map(e => ({
            hs_code: e.hs_code,
            product_name: e.product_name,
            destination_country: e.destination_country,
            destination_code: e.destination_code,
            mfn_rate: e.mfn_rate,
            retaliation_rate: e.retaliation_rate,
            effective_rate: e.effective_rate,
            retaliation_note: `${e.retaliation_note} [Source: ${e.source_url.substring(0, 60)}... | Confidence: ${e.confidence}%]`,
            last_updated: new Date().toISOString().split("T")[0],
            synced_at: runStart,
          })),
          { onConflict: "hs_code,destination_country" }
        );
      if (error) console.error("Upsert error:", error);
      else totalUpserted = toUpsert.length;
    }

    // Log the run
    await supabase.from("scrape_log").insert({
      source_url: "multi-source-run",
      source_label: `${HTML_SOURCES.length} sources + Federal Register API`,
      mentions_found: totalUpserted,
      raw_sample: [
        `Extracted: ${allRaw.length} raw entries`,
        `Passed validation: ${verified.length}`,
        `Rejected: ${withValidity.filter(e => !e.valid).length} (invalid HS codes or rates)`,
        `Regulatory alerts: ${uniqueAlerts.length}`,
        `Upserted: ${totalUpserted}`,
      ].join(" | "),
      scraped_at: runStart,
    });

    return new Response(JSON.stringify({
      success: true,
      scraped_at: runStart,
      sources_checked: HTML_SOURCES.length,
      total_raw_extracted: allRaw.length,
      passed_validation: verified.length,
      rejected: withValidity.filter(e => !e.valid).map(e => ({ hs_code: e.entry.hs_code, reason: e.reason })),
      total_upserted: totalUpserted,
      regulatory_alerts: uniqueAlerts.length,
      confidence_breakdown: {
        high: withConfidence.filter(e => e.confidence >= 80).length,
        medium: withConfidence.filter(e => e.confidence >= 55 && e.confidence < 80).length,
        low: withConfidence.filter(e => e.confidence > 0 && e.confidence < 55).length,
        rejected: withConfidence.filter(e => e.confidence === 0).length,
      },
      sources: sourceResults,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
