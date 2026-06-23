import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name, file_type } = await req.json();
    if (!file_base64) throw new Error("No file provided");

    // Strip the data:...;base64, prefix if present
    const base64Data = file_base64.includes(",") ? file_base64.split(",")[1] : file_base64;
    const mediaType = file_type?.startsWith("image/") ? file_type : "image/jpeg";

    const isImage = file_type?.startsWith("image/") || file_name?.match(/\.(jpg|jpeg|png|webp)$/i);

    let messages;

    if (isImage) {
      messages = [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64Data}` },
            },
            {
              type: "text",
              text: `You are a trade document parser. Extract the following fields from this trade document (commercial invoice, packing list, bill of lading, airway bill, etc.) and return ONLY valid JSON with these exact keys:
{
  "product_name": "string — the main product/goods being shipped, be specific",
  "hs_code": "string — HS/HTS code digits only, no dots (e.g. '847130'). Infer from product if not explicit.",
  "origin_country": "string — country where goods were manufactured or shipped FROM (e.g. United States, China). Look for 'country of origin', 'shipper', 'port of loading', 'made in'.",
  "destination_country": "string — country the goods are going TO. Look for 'consignee', 'ship to', 'port of discharge', 'buyer'.",
  "shipment_value": "number — total invoice value in USD. Convert from other currencies using approximate rate if needed. Return 0 if not found.",
  "currency": "string — original currency code if not USD (e.g. EUR, GBP, CNY)",
  "incoterms": "string — shipping terms (e.g. FOB, CIF, DDP, EXW, DAP). Return empty string if not found.",
  "quantity": "string — number of units and unit type (e.g. '100 cartons', '500 kg', '12 pallets')",
  "exporter_name": "string — name of the exporting/selling company",
  "importer_name": "string — name of the importing/buying company",
  "notes": "string — any other tariff-relevant information (special duties mentioned, free trade agreement reference, bonded warehouse, etc.)"
}
Return ONLY the JSON object. No markdown, no explanation.`,
            },
          ],
        },
      ];
    } else {
      // For PDFs, use text extraction via Mistral
      messages = [
        {
          role: "user",
          content: `You are a trade document parser. The following is a base64-encoded PDF trade document (commercial invoice, bill of lading, packing list, airway bill, etc.).
Extract the key shipment fields and return ONLY valid JSON:
{
  "product_name": "string — main product being shipped",
  "hs_code": "string — HS/HTS code digits only, no dots. Infer from product if not explicit.",
  "origin_country": "string — country goods were manufactured or shipped FROM",
  "destination_country": "string — country goods are going TO",
  "shipment_value": number — total value in USD (convert if needed),
  "currency": "string — original currency if not USD",
  "incoterms": "string — shipping terms (FOB, CIF, DDP, EXW, etc.) or empty string",
  "quantity": "string — number of units/weight",
  "exporter_name": "string — selling/shipping company",
  "importer_name": "string — buying/receiving company",
  "notes": "string"
}
Document (base64): ${base64Data.substring(0, 2000)}...
Return ONLY the JSON.`,
        },
      ];
    }

    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages,
        max_tokens: 512,
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Mistral error: ${err}`);
    }

    const mistralData = await resp.json();
    const raw = mistralData.choices?.[0]?.message?.content ?? "{}";

    // Parse JSON — strip markdown fences if present
    const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let extracted: Record<string, unknown> = {};
    try {
      extracted = JSON.parse(jsonStr);
    } catch {
      extracted = { notes: "Could not parse document" };
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
