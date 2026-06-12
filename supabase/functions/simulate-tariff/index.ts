import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALTERNATIVES: Record<string, string[]> = {
  "China": ["Japan", "Canada", "Mexico"],
  "European Union": ["Canada", "Japan"],
  "Canada": ["Mexico", "Japan"],
  "Mexico": ["Canada", "Japan"],
  "India": ["Japan", "Canada"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { hs_code, destination_country, shipment_value, product_name } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up tariff from Supabase (populated by Airbyte sync)
    const { data: entry } = await supabase
      .from("tariff_rates")
      .select("*")
      .eq("hs_code", hs_code)
      .eq("destination_country", destination_country)
      .single();

    const mfn_rate = entry?.mfn_rate ?? 5;
    const retaliation_rate = entry?.retaliation_rate ?? 0;
    const effective_rate = entry?.effective_rate ?? mfn_rate;
    const retaliation_note = entry?.retaliation_note ?? "No specific retaliatory measure found for this product/destination.";
    const resolved_product = entry?.product_name ?? product_name ?? "Goods";

    const tariff_cost_today = Math.round(shipment_value * (effective_rate / 100));

    // Look up alternative markets from Supabase
    const altMarkets = (ALTERNATIVES[destination_country] ?? ["Japan"]).slice(0, 2);
    const altResults = await Promise.all(
      altMarkets.map(async (alt) => {
        const { data: altEntry } = await supabase
          .from("tariff_rates")
          .select("effective_rate, mfn_rate")
          .eq("hs_code", hs_code)
          .eq("destination_country", alt)
          .single();
        const altRate = altEntry?.effective_rate ?? altEntry?.mfn_rate ?? 3;
        return { country: alt, rate: altRate, cost: Math.round(shipment_value * (altRate / 100)) };
      })
    );

    const escalatedRate = parseFloat((effective_rate + Math.max(retaliation_rate * 0.2, 5)).toFixed(1));
    const escalatedCost = Math.round(shipment_value * (escalatedRate / 100));

    const scenarios = [
      {
        name: "Today",
        description: `Current effective rate at ${destination_country}: ${mfn_rate}% MFN${retaliation_rate > 0 ? ` + ${retaliation_rate}% retaliatory` : ""}.`,
        tariff_rate: effective_rate,
        tariff_cost: tariff_cost_today,
        net_proceeds: shipment_value - tariff_cost_today,
        severity: effective_rate >= 25 ? "high" : effective_rate >= 10 ? "medium" : effective_rate > 0 ? "low" : "none",
      },
      {
        name: "Escalation scenario",
        description: `If tensions escalate and retaliation rises ~20%, effective rate hits ${escalatedRate}%. Could occur if US-${destination_country} trade talks collapse.`,
        tariff_rate: escalatedRate,
        tariff_cost: escalatedCost,
        net_proceeds: shipment_value - escalatedCost,
        severity: escalatedRate >= 25 ? "high" : "medium",
      },
      {
        name: `Reroute to ${altResults[0]?.country ?? "Japan"}`,
        description: `${altResults[0]?.country ?? "Japan"} has ${altResults[0]?.rate ?? 0}% effective rate on this product. ${(altResults[0]?.rate ?? 0) === 0 ? "No retaliatory tariff in place." : "Lower exposure than primary destination."}`,
        tariff_rate: altResults[0]?.rate ?? 0,
        tariff_cost: altResults[0]?.cost ?? 0,
        net_proceeds: shipment_value - (altResults[0]?.cost ?? 0),
        severity: (altResults[0]?.rate ?? 0) === 0 ? "none" : (altResults[0]?.rate ?? 0) < effective_rate ? "low" : "medium",
      },
    ];

    const context = `
Product: ${resolved_product} (HS ${hs_code})
Destination: ${destination_country}
Shipment value: $${shipment_value.toLocaleString()}
MFN duty: ${mfn_rate}%
Retaliatory tariff: ${retaliation_rate > 0 ? `${retaliation_rate}% — ${retaliation_note}` : "None"}
Effective rate today: ${effective_rate}%
Tariff cost today: $${tariff_cost_today.toLocaleString()}
Scenario — Escalation: ${escalatedRate}% → -$${escalatedCost.toLocaleString()}
Scenario — Reroute to ${altResults[0]?.country}: ${altResults[0]?.rate}% → -$${altResults[0]?.cost.toLocaleString()}
`.trim();

    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: `You are a US export trade advisor specializing in tariff risk. Give concise, actionable analysis to US exporters facing retaliatory tariffs. Be specific, use dollar amounts, one clear action. Max 150 words per section.`,
          },
          {
            role: "user",
            content: `Write two things based on this shipment:

1. RISK SUMMARY (2-3 sentences): Explain the tariff situation in plain English — what the effective rate is, why it exists, and the dollar cost.

2. RECOMMENDATION (1-2 sentences): One specific action. Name it (reroute/hedge/accelerate/diversify) and quantify the benefit in dollars.

Shipment:
${context}

Return as JSON: {"risk_summary": "...", "recommendation": "..."}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!groqResp.ok) throw new Error(`Groq error: ${await groqResp.text()}`);

    const groqData = await groqResp.json();
    const rawContent = groqData.choices?.[0]?.message?.content ?? "{}";
    const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let aiOutput = { risk_summary: "", recommendation: "" };
    try {
      aiOutput = JSON.parse(jsonStr);
    } catch {
      const summaryMatch = rawContent.match(/"risk_summary"\s*:\s*"([^"]+)"/);
      const recMatch = rawContent.match(/"recommendation"\s*:\s*"([^"]+)"/);
      aiOutput = {
        risk_summary: summaryMatch?.[1] ?? rawContent.substring(0, 300),
        recommendation: recMatch?.[1] ?? "Consult a trade advisor for specific routing options.",
      };
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
      risk_summary: aiOutput.risk_summary,
      recommendation: aiOutput.recommendation,
      data_source: "TariffLens · Supabase · synced via Airbyte from US Dept of Commerce",
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
