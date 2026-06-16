import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const { hs_code, destination_country, shipment_value, product_name, trade_mode } = await req.json();
    const isImporter = trade_mode === "importer";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Get live retaliation data from tariff_rates (scraped hourly) ──
    const { data: liveEntry } = await supabase
      .from("tariff_rates")
      .select("*")
      .eq("hs_code", hs_code.substring(0, 4))
      .eq("destination_country", destination_country)
      .maybeSingle();

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

    // Aggregate history by year — stored as decimal fractions, convert to pct, filter sentinels
    const historyByYear: Record<number, number[]> = {};
    for (const row of (historyRows ?? [])) {
      const raw = row.mfn_rate ?? 0;
      // Skip sentinel values (9999+), keep real rates only
      if (raw > 100) continue;
      // Convert decimal → percentage
      const pct = raw <= 1 ? raw * 100 : raw;
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

    // ── 5. Compose rates ──
    // hts_catalog stores mfn_rate as decimal fraction (0.068 = 6.8%) — multiply by 100
    // tariff_rates stores rates already as percentages (e.g. 25 = 25%)
    // Cap at 150 to filter USITC sentinel values like 9999.99
    const rawCatalogMfn = catalog?.mfn_rate ?? 0;
    // Sentinel: USITC stores 9999.99 for compound/specific duties. Treat those as unknown (0).
    const isSentinel = rawCatalogMfn > 100;
    const catalogMfnPct = isSentinel ? 0 : (rawCatalogMfn <= 1 ? rawCatalogMfn * 100 : rawCatalogMfn);
    // Fallback 3% represents a typical US MFN rate when ad-valorem component is unavailable
    const mfn_rate = liveEntry?.mfn_rate ?? (catalogMfnPct > 0 ? catalogMfnPct : 3);
    const retaliation_rate = liveEntry?.retaliation_rate ?? 0;
    const effective_rate = liveEntry?.effective_rate ?? parseFloat((mfn_rate + retaliation_rate).toFixed(2));
    const retaliation_note = liveEntry?.retaliation_note ?? null;
    const resolved_product = liveEntry?.product_name ?? catalog?.description ?? product_name ?? "Goods";
    const data_freshness = liveEntry?.synced_at ?? null;

    const tariff_cost_today = Math.round(shipment_value * (effective_rate / 100));

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
    // Products that had US additional duties imposed → historically trigger retaliation
    // Proxy: if col2_rate > 0.15, product is politically sensitive
    const col2_rate = catalog?.col2_rate ?? 0;
    const base_prob = retaliation_rate > 0 ? 0.85 : 0; // already retaliating
    const hist_prob = max_jump > 0.05 ? 0.65 : max_jump > 0.02 ? 0.40 : 0.20;
    const sensitivity_prob = col2_rate > 0.15 ? 0.15 : 0;
    const retaliation_probability = Math.min(0.98, base_prob || (hist_prob + sensitivity_prob));
    const retaliation_probability_pct = Math.round(retaliation_probability * 100);

    // ── 8. Alternative markets ──
    const altCountries = ALL_COUNTRIES.filter(c => c.name !== destination_country).slice(0, 6);
    const altResults = await Promise.all(
      altCountries.map(async (alt) => {
        const { data: altLive } = await supabase
          .from("tariff_rates")
          .select("effective_rate, mfn_rate, retaliation_rate")
          .eq("hs_code", hs_code.substring(0, 4))
          .eq("destination_country", alt.name)
          .maybeSingle();
        // Filter sentinel values from alt market rates; fall back to this product's mfn_rate
        const altRaw = altLive?.effective_rate ?? altLive?.mfn_rate ?? mfn_rate;
        const altRate = altRaw > 150 ? mfn_rate : altRaw;
        return {
          country: alt.name,
          code: alt.code,
          rate: parseFloat(altRate.toFixed(1)),
          cost: Math.round(shipment_value * (altRate / 100)),
          retaliation: altLive?.retaliation_rate ?? 0,
          saving: tariff_cost_today - Math.round(shipment_value * (altRate / 100)),
        };
      })
    );
    const bestAlts = altResults.sort((a, b) => a.rate - b.rate).slice(0, 3);

    // ── 9. Scenarios ──
    const escalatedRate = parseFloat(Math.min(effective_rate * 1.4, effective_rate + 25).toFixed(1));
    const escalatedCost = Math.round(shipment_value * (escalatedRate / 100));
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
        name: "Escalation (+40%)",
        description: `If trade tensions escalate, rate reaches ${escalatedRate}%. Historical precedent: ${volRow?.max_jump_year ? `${volRow.max_jump_year} spike` : "rate has jumped before"}. Probability: ${retaliation_probability_pct}%.`,
        tariff_rate: escalatedRate,
        tariff_cost: escalatedCost,
        net_proceeds: shipment_value - escalatedCost,
        severity: escalatedRate >= 25 ? "high" : "medium",
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
Destination: ${destination_country}
Shipment value: $${shipment_value.toLocaleString()}
MFN duty (USITC 2026): ${(mfn_rate)}%
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
            content: isImporter
              ? "You are a senior US import trade advisor. You combine live tariff data with 29-year historical patterns to give precise, dollar-quantified advice to US importers. Focus on what they pay at US customs, Section 301/232 duties, and sourcing alternatives. Be direct. Use specific numbers. Max 120 words per section."
              : "You are a senior US export trade advisor. You combine live tariff data with 29-year historical patterns to give precise, dollar-quantified advice. Be direct. Use specific numbers. Max 120 words per section.",
          },
          {
            role: "user",
            content: isImporter
              ? `Based on this import shipment data — including 29 years of US duty rate history and live scraped data — write:

1. RISK_SUMMARY (2-3 sentences): What is the US import duty situation for this product from ${destination_country}? Explain the MFN duty, any additional Section 301/232 duties, and the dollar cost at US customs. Reference historical rate pattern if relevant.

2. RECOMMENDATION (1-2 sentences): One specific action — e.g. source from a lower-duty country, time the shipment, or request a tariff exclusion — with dollar savings quantified. Be direct.

3. PREDICTION (2 sentences): Based on the historical US duty rate pattern and current trade climate, what is likely to happen to this import cost in the next 6-12 months?

Return JSON: {"risk_summary": "...", "recommendation": "...", "prediction": "..."}

Data:
${context}`
              : `Based on this shipment data — including 29 years of rate history and live scraped tariff data — write:

1. RISK_SUMMARY (2-3 sentences): What is happening right now with this product's tariff situation? Explain the effective rate, why retaliation exists (if any), and the dollar cost. Reference the historical pattern if relevant.

2. RECOMMENDATION (1-2 sentences): One specific action with dollar savings quantified. Be direct.

3. PREDICTION (2 sentences): Based on the historical rate pattern and current trade climate, what is likely to happen to this rate in the next 6-12 months? Reference specific years from history if the pattern is telling.

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
      destination_country,
      shipment_value,
      mfn_rate,
      retaliation_rate,
      effective_rate,
      retaliation_note,
      tariff_cost_today,
      scenarios,
      risk_score,
      risk_label,
      retaliation_probability: retaliation_probability_pct,
      rate_history: rateHistory,
      alternative_markets: bestAlts,
      volatility_stats: volRow ? {
        volatility: volRow.volatility,
        // Convert decimal fractions to percentages for display, cap sentinels
        max_year_jump: Math.min((volRow.max_year_jump ?? 0) * 100, 150),
        max_jump_year: volRow.max_jump_year,
        avg_rate: Math.min((volRow.avg_rate ?? 0) * 100, 150),
        max_rate: Math.min((volRow.max_rate ?? 0) * 100, 150),
      } : null,
      risk_summary: aiOutput.risk_summary,
      recommendation: aiOutput.recommendation,
      prediction: aiOutput.prediction,
      data_source: "USITC HTS 1998–2026 (262k rows) + Live scraped retaliation data",
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
