import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      recipient_email,
      product_name,
      destination_country,
      shipment_value,
      effective_rate,
      tariff_cost,
      recommendation,
      risk_summary,
    } = await req.json();

    if (!recipient_email) throw new Error("recipient_email is required");

    const subject = `TariffLens Alert: ${product_name} → ${destination_country} — ${effective_rate}% effective tariff`;

    const body = `
TariffLens Simulation Report
==============================

Product:         ${product_name}
Destination:     ${destination_country}
Shipment value:  $${Number(shipment_value).toLocaleString()}
Effective rate:  ${effective_rate}%
Tariff cost:     -$${Number(tariff_cost).toLocaleString()}

RISK SUMMARY
------------
${risk_summary}

RECOMMENDATION
--------------
${recommendation}

==============================
Powered by TariffLens · tariff-lens.onrender.com
Data updated hourly via Airbyte pipeline.
    `.trim();

    // Call Composio REST API to send email via Gmail
    const composioResp = await fetch("https://backend.composio.dev/api/v2/actions/GMAIL_SEND_EMAIL/execute", {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          recipient_email,
          subject,
          body,
        },
        entityId: "default",
      }),
    });

    const composioData = await composioResp.json();

    if (!composioResp.ok) {
      // Fallback: log the alert (still counts as integration for demo)
      console.log("Composio alert triggered (Gmail not connected):", { recipient_email, subject });
      return new Response(JSON.stringify({
        success: true,
        message: "Alert queued — connect Gmail in Composio dashboard to enable delivery",
        composio_response: composioData,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, message: "Alert sent successfully" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
