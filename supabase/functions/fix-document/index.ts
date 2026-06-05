import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a trade document correction engine. Given extracted shipment data and a fix request, return ONLY a JSON patch object with the fields to change. Be precise. Never change fields not mentioned in the fix request.`;

/**
 * Extract only the fields from extractedData that are relevant to the fix request.
 * This minimizes tokens sent to the model.
 */
function extractRelevantFields(
  fixRequest: string,
  extractedData: Record<string, unknown>
): Record<string, unknown> {
  const lower = fixRequest.toLowerCase();

  // Always include a small identity slice so the model has context
  const relevant: Record<string, unknown> = {};

  // Freight-related keywords
  if (
    lower.includes("freight") ||
    lower.includes("payment term") ||
    lower.includes("to pay") ||
    lower.includes("paid") ||
    lower.includes("tbb") ||
    lower.includes("to be billed")
  ) {
    for (const key of [
      "freight_terms",
      "freight_payment_term",
      "freight_amount",
      "freight_basis",
      "freight_type",
      "billing_party",
      "delivery_terms",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // HSN / line item keywords
  if (
    lower.includes("hsn") ||
    lower.includes("line item") ||
    lower.includes("split") ||
    lower.includes("separate") ||
    lower.includes("goods") ||
    lower.includes("description") ||
    lower.includes("quantity") ||
    lower.includes("unit") ||
    lower.includes("packing") ||
    lower.includes("weight") ||
    lower.includes("value")
  ) {
    if (extractedData["line_items"] !== undefined)
      relevant["line_items"] = extractedData["line_items"];
    if (extractedData["summary"] !== undefined)
      relevant["summary"] = extractedData["summary"];
  }

  // Consignee / bank / LC keywords
  if (
    lower.includes("consignee") ||
    lower.includes("bank") ||
    lower.includes("lc") ||
    lower.includes("letter of credit") ||
    lower.includes("order of")
  ) {
    for (const key of [
      "consignee_name",
      "consignee_address",
      "consignee_gstin",
      "consignee_iec",
      "consignee_pan",
      "lc_number",
      "lc_date",
      "lc_issuing_bank",
      "lc_advising_bank",
      "notify_party_name",
      "notify_party_address",
      "notify_party_iec",
      "notify_party_pan",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Consignor / exporter keywords
  if (
    lower.includes("consignor") ||
    lower.includes("exporter") ||
    lower.includes("shipper")
  ) {
    for (const key of [
      "consignor_name",
      "consignor_address",
      "consignor_gstin",
      "consignor_iec",
      "consignor_pan",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Notify party / importer keywords
  if (
    lower.includes("notify") ||
    lower.includes("importer") ||
    lower.includes("buyer")
  ) {
    for (const key of [
      "notify_party_name",
      "notify_party_address",
      "notify_party_iec",
      "notify_party_pan",
      "notify_party_gstin",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Vehicle / transport keywords
  if (
    lower.includes("vehicle") ||
    lower.includes("truck") ||
    lower.includes("driver") ||
    lower.includes("transport") ||
    lower.includes("mode")
  ) {
    for (const key of [
      "vehicle_number",
      "vehicle_type",
      "driver_name",
      "driver_phone",
      "transport_mode",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // E-way bill keywords
  if (lower.includes("eway") || lower.includes("e-way") || lower.includes("e way")) {
    for (const key of ["eway_bill_number", "eway_bill_date", "eway_bill_valid_upto"]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Invoice / LUT / LR keywords
  if (lower.includes("invoice")) {
    for (const key of ["invoice_number", "invoice_date"]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }
  if (lower.includes("lut") || lower.includes("letter of undertaking")) {
    if (extractedData["lut_arn"] !== undefined) relevant["lut_arn"] = extractedData["lut_arn"];
  }
  if (lower.includes("lr") || lower.includes("lorry receipt")) {
    for (const key of ["lr_number", "lr_date", "issuing_branch"]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Location keywords
  if (
    lower.includes("origin") ||
    lower.includes("destination") ||
    lower.includes("port") ||
    lower.includes("customs") ||
    lower.includes("border") ||
    lower.includes("via") ||
    lower.includes("from") ||
    lower.includes("to ")
  ) {
    for (const key of [
      "origin_city",
      "origin_state",
      "destination_city",
      "customs_port",
      "border_crossing",
      "via_location",
      "from_location",
      "to_location",
    ]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Delivery / country of origin
  if (lower.includes("delivery") || lower.includes("country")) {
    for (const key of ["delivery_terms", "country_of_origin"]) {
      if (extractedData[key] !== undefined) relevant[key] = extractedData[key];
    }
  }

  // Remarks
  if (lower.includes("remark")) {
    if (extractedData["remarks"] !== undefined) relevant["remarks"] = extractedData["remarks"];
  }

  // If nothing matched, send the full extractedData as fallback (safer than empty)
  if (Object.keys(relevant).length === 0) {
    return extractedData;
  }

  return relevant;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { extractedData, fixRequest, conversationHistory } = await req.json();

    if (!extractedData || typeof extractedData !== "object") {
      return new Response(
        JSON.stringify({ error: "extractedData is required and must be an object" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!fixRequest || typeof fixRequest !== "string" || !fixRequest.trim()) {
      return new Response(
        JSON.stringify({ error: "fixRequest is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Set GROQ_API_KEY in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build minimal context — only send relevant fields
    const relevantFields = extractRelevantFields(fixRequest, extractedData as Record<string, unknown>);

    // Build conversation context if provided
    let conversationContext = "";
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-6); // cap at last 6 turns
      conversationContext = "\n\nPrevious conversation context:\n" +
        recentHistory
          .map((msg: { role?: string; content?: string }) =>
            `${(msg.role || "user").toUpperCase()}: ${msg.content || ""}`
          )
          .join("\n");
    }

    const userPrompt = `Current document fields (relevant to fix request only):
${JSON.stringify(relevantFields, null, 2)}
${conversationContext}

Fix request: "${fixRequest.trim()}"

Return ONLY a JSON object containing the fields to update and their new values. Do not include unchanged fields. Do not include any explanation outside the JSON.`;

    const groqBody = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    };

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify(groqBody),
      });
      if (response.status !== 429) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text() ?? "No response";
      console.error(`Groq API error: ${response?.status}`, errorText);
      if (response?.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Groq API error: ${response?.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No AI response content:", JSON.stringify(aiResponse));
      throw new Error("No AI response content");
    }

    console.log("Raw fix AI response:", content.substring(0, 500));

    // Parse JSON patch from response
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Clean up common AI issues
    jsonStr = jsonStr
      .replace(/,\s*,/g, ",")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .trim();

    let patch: Record<string, unknown>;
    try {
      patch = JSON.parse(jsonStr);
    } catch {
      console.error("JSON parse failed, attempting object extraction. Raw:", jsonStr.substring(0, 500));
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          patch = JSON.parse(objMatch[0]);
        } catch {
          throw new Error("JSON parse failed after recovery attempt");
        }
      } else {
        throw new Error("JSON parse failed - no valid object found in AI response");
      }
    }

    // Build the diff array by comparing every key in patch against extractedData
    const diff: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    for (const [field, newValue] of Object.entries(patch)) {
      const oldValue = (extractedData as Record<string, unknown>)[field];
      if (JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null)) {
        diff.push({ field, oldValue: oldValue ?? null, newValue });
      }
    }

    // Merge patch into extractedData to produce the full updated document
    const updatedData: Record<string, unknown> = {
      ...(extractedData as Record<string, unknown>),
      ...patch,
    };

    // Build a human-readable explanation
    const changedFields = diff.map((d) => d.field);
    let explanation: string;
    if (changedFields.length === 0) {
      explanation = `No changes were required. The current document already satisfies: "${fixRequest.trim()}".`;
    } else {
      explanation =
        `Applied fix for: "${fixRequest.trim()}". ` +
        `Updated ${changedFields.length} field(s): ${changedFields.join(", ")}.`;
    }

    return new Response(
      JSON.stringify({
        updatedData,
        patch,
        diff,
        explanation,
        requiresApproval: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fix-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "fix-document failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
