import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WTO_API_KEY = Deno.env.get("WTO_API_KEY") ?? "";

// WTO reporter codes (importing country that sets the tariff)
const WTO_COUNTRY_CODES: Record<string, string> = {
  "United States": "842",
  "China": "156",
  "European Union": "918",
  "Canada": "124",
  "Mexico": "484",
  "Japan": "392",
  "India": "356",
  "South Korea": "410",
  "United Kingdom": "826",
  "Australia": "36",
  "Brazil": "76",
  "Singapore": "702",
  "Turkey": "792",
  "Vietnam": "704",
  "Indonesia": "360",
  "Thailand": "764",
  "Malaysia": "458",
};

// WTO partner codes (exporting/origin country)
const WTO_PARTNER_CODES: Record<string, string> = {
  "United States": "842",
  "China": "156",
  "European Union": "918",
  "Canada": "124",
  "Mexico": "484",
  "Japan": "392",
  "India": "356",
  "South Korea": "410",
  "United Kingdom": "826",
  "Australia": "36",
  "Brazil": "76",
  "Singapore": "702",
  "Turkey": "792",
  "Vietnam": "704",
  "Indonesia": "360",
  "Thailand": "764",
  "Malaysia": "458",
};

// Fetch MFN tariff rate a country charges on a given HS4 product
async function getWtoMfnRate(reporterCode: string, hs4: string): Promise<number | null> {
  if (!WTO_API_KEY) return null;
  try {
    const url = `https://api.wto.org/timeseries/v1/data?i=HS_A_0010&r=${reporterCode}&ps=2022&pc=${hs4}&fmt=json&mode=full&head=M&lang=1&max=1`;
    const resp = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": WTO_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.Dataset?.[0];
    return (row && typeof row.Value === "number") ? row.Value : null;
  } catch { return null; }
}

// Known FTAs — maps "Reporter::Partner" to agreement name
// WTO HS_A_0020 gives the best preferential rate the reporter offers to FTA partners
const FTA_AGREEMENTS: Record<string, string> = {
  "Canada::United States": "USMCA",
  "United States::Canada": "USMCA",
  "Mexico::United States": "USMCA",
  "United States::Mexico": "USMCA",
  "Canada::Mexico": "USMCA",
  "Mexico::Canada": "USMCA",
  "Australia::United States": "AUSFTA",
  "United States::Australia": "AUSFTA",
  "South Korea::United States": "KORUS",
  "United States::South Korea": "KORUS",
  "Japan::Australia": "JAEPA",
  "Australia::Japan": "JAEPA",
  "Japan::Canada": "CPTPP",
  "Canada::Japan": "CPTPP",
  "Japan::Vietnam": "CPTPP",
  "Vietnam::Japan": "CPTPP",
  "Japan::Singapore": "CPTPP",
  "Singapore::Japan": "CPTPP",
  "Canada::Australia": "CPTPP",
  "Australia::Canada": "CPTPP",
  "Australia::Vietnam": "CPTPP",
  "Vietnam::Australia": "CPTPP",
  "Singapore::Australia": "CPTPP",
  "Australia::Singapore": "CPTPP",
  "United Kingdom::European Union": "UK-EU TCA",
  "European Union::United Kingdom": "UK-EU TCA",
  "India::Singapore": "CECA",
  "Singapore::India": "CECA",
  "South Korea::Australia": "KAFTA",
  "Australia::South Korea": "KAFTA",
  "Japan::India": "CEPA",
  "India::Japan": "CEPA",
};

// Fetch WTO preferential rate (HS_A_0020) — the best rate the reporter offers to any FTA partner
// We use this when we know an FTA exists between origin and destination
async function getWtoPreferentialRate(reporterCode: string, hs4: string, agreementName: string): Promise<{ rate: number; agreement: string } | null> {
  if (!WTO_API_KEY) return null;
  try {
    const url = `https://api.wto.org/timeseries/v1/data?i=HS_A_0020&r=${reporterCode}&ps=2022&pc=${hs4}&fmt=json&mode=full&head=M&lang=1&max=1`;
    const resp = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": WTO_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.Dataset?.[0];
    if (!row || typeof row.Value !== "number") return null;
    return { rate: row.Value, agreement: agreementName };
  } catch { return null; }
}

// Simple in-memory rate limiter: 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

// All countries we know about for alternative routing
const ALL_COUNTRIES = [
  { name: "United States", code: "US" },
  { name: "Japan", code: "JP" },
  { name: "Canada", code: "CA" },
  { name: "Mexico", code: "MX" },
  { name: "European Union", code: "EU" },
  { name: "India", code: "IN" },
  { name: "South Korea", code: "KR" },
  { name: "Australia", code: "AU" },
  { name: "United Kingdom", code: "GB" },
  { name: "Brazil", code: "BR" },
  { name: "Singapore", code: "SG" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { hs_code, destination_country, origin_country, shipment_value, product_name, trade_mode, incoterms, quantity } = await req.json();
    const originCountry = origin_country || "United States";
    const isImporter = trade_mode === "importer";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Get live retaliation data from tariff_rates (scraped hourly) ──
    // Two lookups: global (origin_country IS NULL) + origin-specific (e.g. Section 301 China-only)
    // Stack both to get total additional duties for this corridor
    const [{ data: liveGlobal }, { data: liveOriginSpecific }] = await Promise.all([
      supabase
        .from("tariff_rates")
        .select("*")
        .eq("hs_code", hs_code.substring(0, 4))
        .eq("destination_country", destination_country)
        .is("origin_country", null)
        .maybeSingle(),
      supabase
        .from("tariff_rates")
        .select("*")
        .eq("hs_code", hs_code.substring(0, 4))
        .eq("destination_country", destination_country)
        .eq("origin_country", originCountry)
        .maybeSingle(),
    ]);
    // Merge: use global entry as base, stack origin-specific retaliation_rate on top
    const liveEntry = liveGlobal ?? liveOriginSpecific;
    const originSpecificRate = liveOriginSpecific?.retaliation_rate ?? 0;
    const originSpecificNote = liveOriginSpecific?.retaliation_note ?? null;

    // ── 2. Get baseline MFN rate from hts_catalog (USITC 2026 official data) ──
    const { data: catalogEntry } = await supabase
      .from("hts_catalog")
      .select("hts8, description, mfn_rate, col2_rate")
      .eq("hts8", hs_code)
      .maybeSingle();

    // Fallback: try 4-digit prefix match
    const { data: catalogFallback } = !catalogEntry ? await supabase
      .from("hts_catalog")
      .select("hts8, description, mfn_rate, col2_rate")
      .like("hts8", `${hs_code.substring(0, 4)}%`)
      .limit(1)
      .maybeSingle() : { data: null };

    const catalog = catalogEntry ?? catalogFallback;

    // ── 3. Get rate history for this HS code (25 years) ──
    const hs4 = hs_code.substring(0, 4);
    const { data: historyRows } = await supabase
      .from("rate_history")
      .select("year, mfn_rate")
      .like("hts8", `${hs4}%`)
      .order("year", { ascending: true })
      .limit(200);

    // Aggregate history by year — rate_history stores mfn_rate as decimal fraction (0.03 = 3%)
    // Always multiply by 100, then filter sentinels (USITC sentinel 9999.99 → 999999%)
    const historyByYear: Record<number, number[]> = {};
    for (const row of (historyRows ?? [])) {
      const raw = row.mfn_rate ?? 0;
      const pct = raw * 100;
      if (pct > 200) continue; // filter sentinels and compound-duty placeholders
      if (!historyByYear[row.year]) historyByYear[row.year] = [];
      historyByYear[row.year].push(pct);
    }
    const rateHistory = Object.entries(historyByYear)
      .map(([yr, rates]) => ({
        year: parseInt(yr),
        rate: parseFloat((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)),
      }))
      .sort((a, b) => a.year - b.year);

    // ── 4. Get volatility score ──
    const { data: volRow } = await supabase
      .from("hts_volatility")
      .select("volatility, max_year_jump, max_jump_year, risk_label, avg_rate, max_rate")
      .like("hts8", `${hs4}%`)
      .limit(1)
      .maybeSingle();

    // ── 5. USITC catalog rate (US domestic rate — used as fallback only) ──
    const rawCatalogMfn = catalog?.mfn_rate ?? 0;
    const isSentinel = rawCatalogMfn > 100;
    const catalogMfnPct = isSentinel ? 0 : (rawCatalogMfn <= 1 ? rawCatalogMfn * 100 : rawCatalogMfn);
    const usMfnFallback = liveEntry?.mfn_rate ?? (catalogMfnPct > 0 ? catalogMfnPct : 3);
    const retaliation_rate = (liveEntry?.retaliation_rate ?? 0) + originSpecificRate;
    const retaliation_note = [liveEntry?.retaliation_note, originSpecificNote].filter(Boolean).join(" | ") || null;
    const resolved_product = liveEntry?.product_name ?? catalog?.description ?? product_name ?? "Goods";
    const data_freshness = liveEntry?.synced_at ?? null;

    // ── 5b. WTO MFN + preferential rate — must run BEFORE effective_rate calculation ──
    // authoritative_mfn = what the DESTINATION country charges (their tariff on our goods)
    // This is the rate the exporter actually pays, not the US domestic rate
    const destWtoCode = WTO_COUNTRY_CODES[destination_country] ?? null;
    const ftaKey = `${destination_country}::${originCountry}`;
    const ftaAgreement = FTA_AGREEMENTS[ftaKey] ?? null;
    const [wtoMfn, wtoPref] = await Promise.all([
      destWtoCode ? getWtoMfnRate(destWtoCode, hs4) : Promise.resolve(null),
      (destWtoCode && ftaAgreement)
        ? getWtoPreferentialRate(destWtoCode, hs4, ftaAgreement)
        : Promise.resolve(null),
    ]);
    // authoritative_mfn: destination country's WTO rate (what they charge everyone)
    // Falls back to US catalog rate only if WTO API has no data for this corridor
    const authoritative_mfn = wtoMfn ?? usMfnFallback;
    const mfn_rate = authoritative_mfn; // alias for readability below

    // effective_rate uses the destination country's actual rate, not the US catalog rate
    const effective_rate = liveEntry?.effective_rate ?? parseFloat((authoritative_mfn + retaliation_rate).toFixed(2));
    const tariff_cost_today = Math.round(shipment_value * (effective_rate / 100));

    const preferential_rate = wtoPref?.rate ?? null;
    const preferential_saving = preferential_rate !== null
      ? Math.round(shipment_value * ((authoritative_mfn - preferential_rate) / 100))
      : null;

    // ── 6. Risk score (0–100) ──
    const volatility = volRow?.volatility ?? 0;
    const max_jump = volRow?.max_year_jump ?? 0;
    let risk_score = Math.min(100, Math.round(
      (effective_rate * 1.5) +
      (retaliation_rate > 0 ? 20 : 0) +
      (volatility * 200) +
      (max_jump * 150)
    ));
    // Derive label from current risk_score (not historical volatility label which may be stale)
    const risk_label = risk_score >= 60 ? "HIGH" : risk_score >= 30 ? "MEDIUM" : "LOW";

    // ── 7. Retaliation probability ──
    // Allies with stable trade relations rarely retaliate; active trade-war countries already have
    const ALLY_COUNTRIES = new Set(["Singapore", "Japan", "Canada", "Australia", "United Kingdom",
      "New Zealand", "South Korea", "Taiwan", "Germany", "France", "Netherlands"]);
    const ACTIVE_DISPUTE_COUNTRIES = new Set(["China", "Russia", "Iran", "Venezuela"]);
    const col2_rate = catalog?.col2_rate ?? 0;

    let retaliation_probability: number;
    if (retaliation_rate > 0) {
      // Already retaliating — probability of further escalation
      retaliation_probability = 0.60;
    } else if (ALLY_COUNTRIES.has(destination_country)) {
      // Stable ally — very low baseline, only if product is genuinely sensitive
      const ally_base = col2_rate > 0.20 ? 0.12 : 0.05;
      retaliation_probability = ally_base;
    } else if (ACTIVE_DISPUTE_COUNTRIES.has(destination_country)) {
      // Active trade disputes — elevated
      const hist_prob = max_jump > 0.05 ? 0.70 : max_jump > 0.02 ? 0.50 : 0.35;
      retaliation_probability = Math.min(0.90, hist_prob + (col2_rate > 0.15 ? 0.15 : 0));
    } else {
      // Neutral/other — moderate based on history
      const hist_prob = max_jump > 0.05 ? 0.40 : max_jump > 0.02 ? 0.25 : 0.12;
      retaliation_probability = Math.min(0.60, hist_prob + (col2_rate > 0.15 ? 0.10 : 0));
    }
    const retaliation_probability_pct = Math.round(retaliation_probability * 100);

    // ── 8. Alternative markets ──
    // Priority: live scraped retaliation data → WTO official MFN rate → exclude
    // Never fall back to the current product's own rate (makes all countries look identical)
    const altCountries = ALL_COUNTRIES.filter(c => c.name !== destination_country);
    const altResults = await Promise.all(
      altCountries.map(async (alt) => {
        // 1. Check live scraped retaliation data first
        const { data: altLive } = await supabase
          .from("tariff_rates")
          .select("effective_rate, mfn_rate, retaliation_rate")
          .eq("hs_code", hs_code.substring(0, 4))
          .eq("destination_country", alt.name)
          .maybeSingle();

        if (altLive) {
          const altRaw = altLive.effective_rate ?? altLive.mfn_rate ?? 0;
          if (altRaw <= 150) {
            return {
              country: alt.name,
              code: alt.code,
              rate: parseFloat(altRaw.toFixed(1)),
              cost: Math.round(shipment_value * (altRaw / 100)),
              retaliation: altLive.retaliation_rate ?? 0,
              saving: tariff_cost_today - Math.round(shipment_value * (altRaw / 100)),
              source: "live",
            };
          }
        }

        // 2. Fall back to WTO official MFN rate for this country
        const wtoCode = WTO_COUNTRY_CODES[alt.name];
        if (wtoCode) {
          const wtoRate = await getWtoMfnRate(wtoCode, hs_code.substring(0, 4));
          if (wtoRate !== null && wtoRate <= 150) {
            return {
              country: alt.name,
              code: alt.code,
              rate: parseFloat(wtoRate.toFixed(1)),
              cost: Math.round(shipment_value * (wtoRate / 100)),
              retaliation: 0,
              saving: tariff_cost_today - Math.round(shipment_value * (wtoRate / 100)),
              source: "wto",
            };
          }
        }

        return null;
      })
    );
    // Filter nulls, sort by rate, take top 3
    const bestAlts = altResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3);

    // ── 9. Scenarios ──
    // Escalation: use real historical max jump if available; otherwise use country-specific risk
    const historicalMaxRate = rateHistory.length > 0 ? Math.max(...rateHistory.map(r => r.rate)) : effective_rate;
    const worstHistoricalJump = historicalMaxRate - effective_rate;
    // Escalation is: worst historical spike OR country-risk bump (25% for dispute countries, 5% for allies)
    const countryEscalationAdder = ACTIVE_DISPUTE_COUNTRIES.has(destination_country) ? 25
      : ALLY_COUNTRIES.has(destination_country) ? 5 : 15;
    const escalationDelta = Math.max(worstHistoricalJump, countryEscalationAdder);
    const escalatedRate = parseFloat(Math.min(effective_rate + escalationDelta, 150).toFixed(1));
    const escalatedCost = Math.round(shipment_value * (escalatedRate / 100));
    const escalationLabel = ACTIVE_DISPUTE_COUNTRIES.has(destination_country)
      ? `+${escalationDelta.toFixed(0)}% retaliatory escalation`
      : ALLY_COUNTRIES.has(destination_country)
      ? `+${escalationDelta.toFixed(0)}% under new trade pressure`
      : `+${escalationDelta.toFixed(0)}% escalation scenario`;
    const bestAlt = bestAlts[0];

    const scenarios = [
      {
        name: "Today",
        description: `Current effective rate: ${mfn_rate}% MFN${retaliation_rate > 0 ? ` + ${retaliation_rate}% retaliatory` : ""}. ${retaliation_note ?? ""}`,
        tariff_rate: effective_rate,
        tariff_cost: tariff_cost_today,
        net_proceeds: shipment_value - tariff_cost_today,
        severity: effective_rate >= 25 ? "high" : effective_rate >= 10 ? "medium" : effective_rate > 0 ? "low" : "none",
      },
      {
        name: `Escalation (${escalationLabel})`,
        description: `If trade tensions rise, rate reaches ${escalatedRate}%. ${volRow?.max_jump_year ? `Worst historical jump was in ${volRow.max_jump_year}.` : ""} Retaliation probability: ${retaliation_probability_pct}%.`,
        tariff_rate: escalatedRate,
        tariff_cost: escalatedCost,
        net_proceeds: shipment_value - escalatedCost,
        severity: escalatedRate >= 25 ? "high" : escalatedRate >= 10 ? "medium" : "low",
      },
      {
        name: bestAlt ? `Reroute → ${bestAlt.country}` : "Alternative market",
        description: bestAlt
          ? `${bestAlt.country} has ${bestAlt.rate}% effective rate on this product${bestAlt.retaliation === 0 ? " — no retaliation" : ""}. Saves ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(bestAlt.saving)} vs shipping to ${destination_country}.`
          : "No better alternative found in our database.",
        tariff_rate: bestAlt?.rate ?? 0,
        tariff_cost: bestAlt?.cost ?? 0,
        net_proceeds: shipment_value - (bestAlt?.cost ?? 0),
        severity: (bestAlt?.rate ?? 0) === 0 ? "none" : (bestAlt?.rate ?? 0) < effective_rate ? "low" : "medium",
      },
    ];

    // ── 10. Groq AI analysis ──
    const histSummary = rateHistory.length > 0
      ? `Rate history (avg MFN by year): ${rateHistory.slice(-8).map(r => `${r.year}:${r.rate.toFixed(1)}%`).join(", ")}`
      : "No historical data available";

    const context = `
Product: ${resolved_product} (HS ${hs_code})
Origin: ${originCountry}
Destination: ${destination_country}
Shipment value: $${shipment_value.toLocaleString()}${incoterms ? `\nIncoterms: ${incoterms}` : ""}${quantity ? `\nQuantity: ${quantity}` : ""}
MFN duty (${destination_country} WTO rate): ${(mfn_rate)}%
Retaliatory tariff (live scraped): ${retaliation_rate > 0 ? `${retaliation_rate}%` : "None"} ${retaliation_note ? `— ${retaliation_note}` : ""}
Effective rate today: ${effective_rate}%
Tariff cost today: $${tariff_cost_today.toLocaleString()}
Risk score: ${risk_score}/100 (${risk_label})
Retaliation probability: ${retaliation_probability_pct}%
Max historical rate spike: ${(max_jump * 100).toFixed(1)}% ${volRow?.max_jump_year ? `in ${volRow.max_jump_year}` : ""}
${histSummary}
Best alternative: ${bestAlt ? `${bestAlt.country} at ${bestAlt.rate}% (saves $${bestAlt.saving.toLocaleString()})` : "none identified"}
`.trim();

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a senior international trade advisor specializing in tariff analysis. You combine live tariff data with 29-year historical patterns to give precise, dollar-quantified advice on the shipment corridor ${originCountry} → ${destination_country}. Focus on what ${destination_country} charges on this product, any retaliatory or additional duties, and the best alternatives. Be direct. Use specific numbers. Max 120 words per section.`,
          },
          {
            role: "user",
            content: `Based on this shipment data (${originCountry} → ${destination_country}) — including 29 years of rate history and live scraped tariff data — write:

1. RISK_SUMMARY (2-3 sentences): What is ${destination_country}'s current duty rate on this product from ${originCountry}? Explain the MFN rate, any retaliatory or additional duties in force, and the dollar cost. Reference historical rate pattern if relevant.

2. RECOMMENDATION (1-2 sentences): One specific action with dollar savings quantified. Be direct.

3. PREDICTION (2 sentences): Based on the historical rate pattern for this corridor and current trade climate, what is likely to happen to this rate in the next 6-12 months?

Return JSON: {"risk_summary": "...", "recommendation": "...", "prediction": "..."}

Data:
${context}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.25,
      }),
    });

    let aiOutput = { risk_summary: "", recommendation: "", prediction: "" };
    if (groqResp.ok) {
      const groqData = await groqResp.json();
      const raw = groqData.choices?.[0]?.message?.content ?? "{}";
      const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const match = jsonStr.match(/\{[\s\S]*\}/);
      try { aiOutput = JSON.parse(match?.[0] ?? "{}"); } catch { /* use defaults */ }
    }

    return new Response(JSON.stringify({
      hs_code,
      product_name: resolved_product,
      origin_country: originCountry,
      destination_country,
      shipment_value,
      mfn_rate: authoritative_mfn,
      retaliation_rate,
      effective_rate,
      retaliation_note,
      origin_specific_rate: originSpecificRate > 0 ? originSpecificRate : null,
      origin_specific_note: originSpecificNote,
      tariff_cost_today,
      // WTO preferential rate for this exact origin→destination corridor
      preferential_rate,
      preferential_saving,
      preferential_note: wtoPref ? `${ftaAgreement} preferential rate — ${originCountry} qualifies as FTA partner (WTO HS_A_0020)` : null,
      scenarios,
      risk_score,
      risk_label,
      retaliation_probability: retaliation_probability_pct,
      rate_history: rateHistory,
      alternative_markets: bestAlts,
      volatility_stats: volRow ? {
        volatility: volRow.volatility,
        max_year_jump: Math.min((volRow.max_year_jump ?? 0) * 100, 150),
        max_jump_year: volRow.max_jump_year,
        avg_rate: Math.min((volRow.avg_rate ?? 0) * 100, 150),
        max_rate: Math.min((volRow.max_rate ?? 0) * 100, 150),
      } : null,
      risk_summary: aiOutput.risk_summary,
      recommendation: aiOutput.recommendation,
      prediction: aiOutput.prediction,
      data_source: "USITC HTS 1998–2026 (262k rows) + WTO Official API + Live scraped retaliation data",
      data_freshness,
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
