import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") ?? "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";

const EXTRACTION_PROMPT = `You are a trade document parser. Extract the following fields and return ONLY valid JSON with these exact keys:
{
  "product_name": "string — the main product/goods being shipped, be specific",
  "hs_code": "string — HS/HTS code digits only, no dots (e.g. '847130'). Infer from product description if not explicit.",
  "origin_country": "string — country where goods were manufactured or shipped FROM. Look for 'country of origin', 'shipper country', 'port of loading', 'made in', 'manufacturer'.",
  "destination_country": "string — country the goods are going TO. Look for 'consignee country', 'ship to', 'port of discharge', 'buyer country', 'importer'.",
  "shipment_value": number — total invoice value as a number in USD. Convert from other currencies using approximate current rate. Use 0 if genuinely not found.,
  "currency": "string — original currency code if not USD (EUR, GBP, CNY, INR, etc.). Empty string if USD.",
  "incoterms": "string — shipping/delivery terms (FOB, CIF, DDP, EXW, DAP, CFR, FCA, CPT, CIP). Empty string if not found.",
  "quantity": "string — number of units with unit type (e.g. '100 cartons', '500 kg', '12 pallets', '200 pieces'). Empty string if not found.",
  "exporter_name": "string — name of the exporting/selling/shipping company.",
  "importer_name": "string — name of the importing/buying/consignee company.",
  "notes": "string — any tariff-relevant info: free trade agreement references, special duty programs (GSP, USMCA, etc.), bonded warehouse, country of origin certificate mentions."
}
Return ONLY the JSON object. No markdown fences, no explanation.`;

// ── Step 1: For images — send directly to Pixtral ────────────────────────────
async function extractFromImage(base64Data: string, mediaType: string): Promise<Record<string, unknown>> {
  const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "pixtral-12b-2409",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64Data}` },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
      max_tokens: 900,
      temperature: 0.0,
    }),
  });

  if (!resp.ok) throw new Error(`Mistral image error: ${await resp.text()}`);
  const data = await resp.json();
  return parseJson(data.choices?.[0]?.message?.content ?? "{}");
}

// ── Step 2: For PDFs — use Mistral OCR to get text, then Groq to extract ─────
async function extractFromPdf(base64Data: string): Promise<Record<string, unknown>> {
  // First: OCR the PDF with Mistral's document understanding
  const ocrResp = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-ocr-latest",
      document: {
        type: "document_url",
        document_url: `data:application/pdf;base64,${base64Data}`,
      },
    }),
  });

  let documentText = "";
  if (ocrResp.ok) {
    const ocrData = await ocrResp.json();
    // Mistral OCR returns pages array with markdown text
    const pages = ocrData?.pages ?? [];
    documentText = pages.map((p: any) => p.markdown ?? p.text ?? "").join("\n\n").substring(0, 6000);
  }

  // If OCR failed or returned nothing, fall back to asking Pixtral to interpret the PDF data URL
  if (!documentText.trim()) {
    const fallbackResp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document_url",
                document_url: `data:application/pdf;base64,${base64Data}`,
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
        max_tokens: 900,
        temperature: 0.0,
      }),
    });
    if (fallbackResp.ok) {
      const fallbackData = await fallbackResp.json();
      return parseJson(fallbackData.choices?.[0]?.message?.content ?? "{}");
    }
    throw new Error("PDF extraction failed — both OCR and vision fallback returned nothing");
  }

  // Second: extract structured fields from OCR text using Groq (fast, cheap)
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
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\nDocument text:\n${documentText}`,
        },
      ],
      max_tokens: 900,
      temperature: 0.0,
    }),
  });

  if (!groqResp.ok) throw new Error(`Groq extraction error: ${await groqResp.text()}`);
  const groqData = await groqResp.json();
  return parseJson(groqData.choices?.[0]?.message?.content ?? "{}");
}

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON object from surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return { notes: "Could not parse document — please fill in manually" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_name, file_type } = await req.json();
    if (!file_base64) throw new Error("No file provided");

    const base64Data = file_base64.includes(",") ? file_base64.split(",")[1] : file_base64;
    const isImage = file_type?.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file_name ?? "");
    const mediaType = file_type?.startsWith("image/") ? file_type : "image/jpeg";

    const extracted = isImage
      ? await extractFromImage(base64Data, mediaType)
      : await extractFromPdf(base64Data);

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
