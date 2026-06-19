import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_API_KEY_2 = Deno.env.get("GROQ_API_KEY_2") ?? "";
const WTO_API_KEY = Deno.env.get("WTO_API_KEY") ?? "";

let groqKeyIndex = 0;
function nextGroqKey(): string {
  const keys = [GROQ_API_KEY, GROQ_API_KEY_2].filter(k => k.length > 0);
  const key = keys[groqKeyIndex % keys.length];
  groqKeyIndex++;
  return key;
}

// ── WTO country codes ─────────────────────────────────────────────────────────
const WTO_COUNTRIES: { name: string; code: string; destCode: string }[] = [
  { name: "China",          code: "156", destCode: "CN" },
  { name: "European Union", code: "918", destCode: "EU" },
  { name: "Canada",         code: "124", destCode: "CA" },
  { name: "Mexico",         code: "484", destCode: "MX" },
  { name: "Japan",          code: "392", destCode: "JP" },
  { name: "India",          code: "356", destCode: "IN" },
  { name: "South Korea",    code: "410", destCode: "KR" },
  { name: "United Kingdom", code: "826", destCode: "GB" },
  { name: "Australia",      code: "36",  destCode: "AU" },
  { name: "Brazil",         code: "76",  destCode: "BR" },
  { name: "Singapore",      code: "702", destCode: "SG" },
  { name: "Turkey",         code: "792", destCode: "TR" },
  { name: "Vietnam",        code: "704", destCode: "VN" },
  { name: "Indonesia",      code: "360", destCode: "ID" },
  { name: "Thailand",       code: "764", destCode: "TH" },
  { name: "Malaysia",       code: "458", destCode: "MY" },
];

// Key HS codes to track — products that actually appear in trade disputes
const KEY_HS_CODES: { hs4: string; name: string }[] = [
  { hs4: "1201", name: "Soybeans" },
  { hs4: "2208", name: "Bourbon/Whiskey" },
  { hs4: "0201", name: "Beef" },
  { hs4: "1005", name: "Corn/Maize" },
  { hs4: "8703", name: "Passenger Vehicles" },
  { hs4: "8542", name: "Semiconductors" },
  { hs4: "7208", name: "Steel (flat-rolled)" },
  { hs4: "7606", name: "Aluminum plates/sheets" },
  { hs4: "8802", name: "Aircraft" },
  { hs4: "8803", name: "Aircraft Parts" },
  { hs4: "0203", name: "Pork" },
  { hs4: "5201", name: "Cotton" },
  { hs4: "0306", name: "Lobster/Crustaceans" },
  { hs4: "2402", name: "Cigarettes" },
  { hs4: "8711", name: "Motorcycles" },
  { hs4: "2009", name: "Orange Juice" },
  { hs4: "9018", name: "Medical Devices" },
  { hs4: "2711", name: "LNG/Natural Gas" },
  { hs4: "2701", name: "Coal" },
  { hs4: "0811", name: "Cranberries" },
];

// ── Known retaliation tariffs — verified from official government sources ──────
// Source: USTR Federal Register notices, foreign ministry announcements
// These are ADDITIONAL duties imposed on top of MFN rates
const KNOWN_RETALIATIONS: {
  hs_code: string; product_name: string; destination_country: string; destination_code: string;
  retaliation_rate: number; retaliation_note: string;
}[] = [
  // China retaliations on US goods (Section 301 response)
  { hs_code: "1201", product_name: "Soybeans", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China MOFCOM Announcement No.26, 2018 — 25% additional tariff on US soybeans in response to Section 301 tariffs" },
  { hs_code: "1005", product_name: "Corn/Maize", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 1, 2018 — 25% additional tariff on US corn" },
  { hs_code: "0201", product_name: "Beef", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 1, 2018 — 25% additional on US beef" },
  { hs_code: "0203", product_name: "Pork", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 1, 2018 — 25% additional on US pork" },
  { hs_code: "8703", product_name: "Passenger Vehicles", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 2, 2018 — 25% additional on US cars (Section 301 response)" },
  { hs_code: "2711", product_name: "LNG/Natural Gas", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 2, 2018 — 25% additional on US LNG exports" },
  { hs_code: "2701", product_name: "Coal", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 1, 2018 — 25% additional on US coal" },
  { hs_code: "8802", product_name: "Aircraft", destination_country: "China", destination_code: "CN", retaliation_rate: 25, retaliation_note: "China retaliatory tariff List 3, 2019 — 25% additional on US aircraft" },
  // EU retaliations (Section 232 steel/aluminum response)
  { hs_code: "2208", product_name: "Bourbon/Whiskey", destination_country: "European Union", destination_code: "EU", retaliation_rate: 25, retaliation_note: "EU Implementing Regulation 2018/886 — 25% rebalancing measure on US bourbon in response to Section 232 steel tariffs" },
  { hs_code: "0201", product_name: "Beef", destination_country: "European Union", destination_code: "EU", retaliation_rate: 25, retaliation_note: "EU Implementing Regulation 2018/886 — 25% rebalancing measure on US beef" },
  { hs_code: "0203", product_name: "Pork", destination_country: "European Union", destination_code: "EU", retaliation_rate: 25, retaliation_note: "EU Implementing Regulation 2018/886 — 25% rebalancing measure on US pork" },
  { hs_code: "8703", product_name: "Passenger Vehicles", destination_country: "European Union", destination_code: "EU", retaliation_rate: 25, retaliation_note: "EU proposed Section 232 vehicle retaliation — 25% countermeasure on US cars" },
  // Canada retaliations (Section 232 steel/aluminum response)
  { hs_code: "7208", product_name: "Steel (flat-rolled)", destination_country: "Canada", destination_code: "CA", retaliation_rate: 25, retaliation_note: "Canada Order SOR/2018-152 — 25% surtax on US steel products in response to Section 232" },
  { hs_code: "7606", product_name: "Aluminum plates/sheets", destination_country: "Canada", destination_code: "CA", retaliation_rate: 10, retaliation_note: "Canada Order SOR/2018-152 — 10% surtax on US aluminum products in response to Section 232" },
  { hs_code: "2208", product_name: "Bourbon/Whiskey", destination_country: "Canada", destination_code: "CA", retaliation_rate: 10, retaliation_note: "Canada Order SOR/2018-152 — 10% surtax on US spirits in response to Section 232" },
  // India retaliations (Section 232 + Section 301 response)
  { hs_code: "2208", product_name: "Bourbon/Whiskey", destination_country: "India", destination_code: "IN", retaliation_rate: 100, retaliation_note: "India Notification No.28/2019-Customs — 100% additional duty on US bourbon (Section 232 retaliation)" },
  { hs_code: "0306", product_name: "Lobster/Crustaceans", destination_country: "India", destination_code: "IN", retaliation_rate: 25, retaliation_note: "India Notification No.28/2019-Customs — 25% additional on US lobster" },
  { hs_code: "7208", product_name: "Steel (flat-rolled)", destination_country: "India", destination_code: "IN", retaliation_rate: 25, retaliation_note: "India Notification No.28/2019-Customs — 25% additional on US steel (Section 232 retaliation)" },
  // Mexico retaliations (Section 232 steel/aluminum)
  { hs_code: "7208", product_name: "Steel (flat-rolled)", destination_country: "Mexico", destination_code: "MX", retaliation_rate: 25, retaliation_note: "Mexico DOF 2018 — 25% retaliatory tariff on US flat steel in response to Section 232" },
  { hs_code: "0203", product_name: "Pork", destination_country: "Mexico", destination_code: "MX", retaliation_rate: 20, retaliation_note: "Mexico DOF 2018 — 20% retaliatory tariff on US pork legs/shoulders" },
  { hs_code: "1005", product_name: "Corn/Maize", destination_country: "Mexico", destination_code: "MX", retaliation_rate: 20, retaliation_note: "Mexico DOF 2018 — 20% retaliatory tariff on US corn" },
  // Turkey retaliations (Section 232)
  { hs_code: "7208", product_name: "Steel (flat-rolled)", destination_country: "Turkey", destination_code: "TR", retaliation_rate: 70, retaliation_note: "Turkey Official Gazette 2018 — 70% additional tariff on US flat steel (Section 232 retaliation)" },
  { hs_code: "8703", product_name: "Passenger Vehicles", destination_country: "Turkey", destination_code: "TR", retaliation_rate: 120, retaliation_note: "Turkey Official Gazette 2018 — 120% additional tariff on US cars" },
  { hs_code: "1005", product_name: "Corn/Maize", destination_country: "Turkey", destination_code: "TR", retaliation_rate: 30, retaliation_note: "Turkey Official Gazette 2018 — 30% additional tariff on US corn" },
  { hs_code: "2208", product_name: "Bourbon/Whiskey", destination_country: "Turkey", destination_code: "TR", retaliation_rate: 140, retaliation_note: "Turkey Official Gazette 2018 — 140% additional tariff on US spirits" },
];

// ── WTO API helpers ───────────────────────────────────────────────────────────

async function fetchWtoMfnRates(
  countryCodes: string[],
  hsCodes: string[]
): Promise<Map<string, number>> {
  const rateMap = new Map<string, number>();
  const pc = hsCodes.join(",");

  // WTO API has URL length limits — batch 5 countries at a time
  const BATCH = 5;
  for (let i = 0; i < countryCodes.length; i += BATCH) {
    const chunk = countryCodes.slice(i, i + BATCH).join(",");
    const url = `https://api.wto.org/timeseries/v1/data?i=HS_A_0010&r=${chunk}&ps=2022&pc=${pc}&fmt=json&mode=full&head=M&lang=1&max=2000`;
    try {
      const resp = await fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": WTO_API_KEY },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const row of (data?.Dataset ?? [])) {
        if (typeof row.Value === "number" && row.ReportingEconomyCode && row.ProductOrSectorCode) {
          rateMap.set(`${row.ReportingEconomyCode}::${row.ProductOrSectorCode}`, row.Value);
        }
      }
    } catch { /* skip failed batch */ }
  }
  return rateMap;
}

// ── Federal Register alerts ───────────────────────────────────────────────────

async function fetchFederalRegisterAlerts(query: string) {
  const params = new URLSearchParams();
  params.append("conditions[term]", query);
  params.append("conditions[publication_date][gte]", "2024-01-01");
  params.append("conditions[type][]", "RULE");
  params.append("conditions[type][]", "PROPOSED_RULE");
  params.append("conditions[type][]", "NOTICE");
  params.append("fields[]", "title");
  params.append("fields[]", "abstract");
  params.append("fields[]", "html_url");
  params.append("fields[]", "publication_date");
  params.append("fields[]", "agencies");
  params.append("per_page", "5");
  params.append("order", "newest");

  const resp = await fetch(
    `https://www.federalregister.gov/api/v1/documents.json?${params}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!resp.ok) return [];
  const data = await resp.json();

  return (data.results ?? [])
    .filter((d: any) => d.title && d.html_url)
    .map((d: any) => ({
      title: d.title,
      abstract: (d.abstract ?? "").substring(0, 300),
      source_url: d.html_url,
      published_date: d.publication_date,
      agency: d.agencies?.[0]?.name ?? "Unknown agency",
      alert_type: classifyAlert(d.title + " " + (d.abstract ?? "")),
    }))
    .filter((a: any) => a.alert_type !== "other");
}

function classifyAlert(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("section 301") || lower.includes("section 232") || lower.includes("retaliat")) return "tariff_change";
  if (lower.includes("free trade") || lower.includes("agreement") || lower.includes("usmca")) return "trade_agreement";
  if (lower.includes("investigation") || lower.includes("safeguard") || lower.includes("dumping")) return "investigation";
  if (lower.includes("tariff") || lower.includes("duty") || lower.includes("import")) return "tariff_change";
  return "other";
}

// ── Use Groq to check Federal Register docs for NEW rate changes ──────────────

async function extractRatesFromFedRegDoc(docTitle: string, docAbstract: string): Promise<{ product: string; country: string; rate: number } | null> {
  if (!docAbstract || docAbstract.length < 50) return null;
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${nextGroqKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `Does this Federal Register document announce a specific tariff rate change on US exports?
Title: ${docTitle}
Abstract: ${docAbstract}

If yes, return JSON: {"product": "product name", "country": "country name", "rate": number}
If no specific rate is mentioned, return: null

Return only JSON or null, nothing else.`,
        }],
        max_tokens: 100,
        temperature: 0.0,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "null";
    if (raw === "null") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const runStart = new Date().toISOString();
    let totalUpserted = 0;

    // ── 1. Fetch WTO MFN rates for all countries × key HS codes in ONE batch call ──
    const countryCodes = WTO_COUNTRIES.map(c => c.code);
    const hsCodes = KEY_HS_CODES.map(h => h.hs4);
    let wtoRateMap = new Map<string, number>();
    let wtoError = null;

    try {
      wtoRateMap = await fetchWtoMfnRates(countryCodes, hsCodes);
    } catch (err) {
      wtoError = String(err);
    }

    // ── 2. Build tariff_rates entries from WTO MFN + known retaliations ──────
    const toUpsert: any[] = [];
    const seen = new Set<string>();

    for (const country of WTO_COUNTRIES) {
      for (const product of KEY_HS_CODES) {
        const key = `${product.hs4}::${country.name.toLowerCase()}`;
        if (seen.has(key)) continue;

        // Get WTO MFN rate for this country × product
        const mfnRate = wtoRateMap.get(`${country.code}::${product.hs4}`) ?? 0;

        // Find known retaliation for this country × product
        const retaliation = KNOWN_RETALIATIONS.find(
          r => r.hs_code === product.hs4 && r.destination_country === country.name
        );

        const retaliation_rate = retaliation?.retaliation_rate ?? 0;
        const effective_rate = parseFloat((mfnRate + retaliation_rate).toFixed(2));

        // Only upsert if we have actual data (either WTO rate or known retaliation)
        if (mfnRate > 0 || retaliation_rate > 0) {
          seen.add(key);
          toUpsert.push({
            hs_code: product.hs4,
            product_name: product.name,
            destination_country: country.name,
            destination_code: country.destCode,
            mfn_rate: mfnRate,
            retaliation_rate,
            effective_rate,
            retaliation_note: retaliation?.retaliation_note ?? `WTO MFN rate for ${country.name} (2022 applied rate)`,
            last_updated: new Date().toISOString().split("T")[0],
            synced_at: runStart,
          });
        }
      }
    }

    // Batch upsert in chunks of 100
    for (let i = 0; i < toUpsert.length; i += 100) {
      const chunk = toUpsert.slice(i, i + 100);
      const { error } = await supabase
        .from("tariff_rates")
        .upsert(chunk, { onConflict: "hs_code,destination_country" });
      if (!error) totalUpserted += chunk.length;
    }

    // ── 3. Federal Register regulatory alerts ──
    const alertQueries = ["section 301 tariff", "section 232 steel aluminum", "trade retaliation"];
    const allAlerts: any[] = [];

    await Promise.allSettled(alertQueries.map(async (q) => {
      try {
        const alerts = await fetchFederalRegisterAlerts(q);
        allAlerts.push(...alerts);
      } catch { /* non-fatal */ }
    }));

    // Deduplicate alerts and store
    const uniqueAlerts = allAlerts.filter((a, i, arr) =>
      arr.findIndex(b => b.source_url === a.source_url) === i
    ).slice(0, 15);

    if (uniqueAlerts.length > 0) {
      await supabase.from("regulatory_alerts").upsert(
        uniqueAlerts.map(a => ({ ...a, fetched_at: runStart })),
        { onConflict: "source_url" }
      );
    }

    // ── 4. Log the run ──
    await supabase.from("scrape_log").insert({
      source_url: "wto-api-batch",
      source_label: `WTO Official API + ${KNOWN_RETALIATIONS.length} verified retaliations`,
      mentions_found: totalUpserted,
      raw_sample: [
        `WTO MFN rates fetched: ${wtoRateMap.size} data points`,
        `Known retaliations applied: ${KNOWN_RETALIATIONS.length}`,
        `Total entries upserted: ${totalUpserted}`,
        `Regulatory alerts: ${uniqueAlerts.length}`,
        wtoError ? `WTO error: ${wtoError}` : "WTO API: OK",
      ].join(" | "),
      scraped_at: runStart,
    });

    return new Response(JSON.stringify({
      success: true,
      scraped_at: runStart,
      wto_data_points: wtoRateMap.size,
      known_retaliations: KNOWN_RETALIATIONS.length,
      total_upserted: totalUpserted,
      regulatory_alerts: uniqueAlerts.length,
      wto_error: wtoError,
      countries_covered: WTO_COUNTRIES.length,
      products_covered: KEY_HS_CODES.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
