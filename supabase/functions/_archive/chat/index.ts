import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are Ability — an AI trade operations assistant for India-Nepal, India-Bhutan, and India-Bangladesh road freight corridors.

You help with: bilty/LR generation, document compliance checks, GSTIN/HSN/IEC validation, customs duty, e-way bills, LC requirements, corridor-specific regulations, and risk flagging.

STRICT RULES:
- Reply ONLY in the same language the user wrote in (English, Hindi, or Nepali). Never mix languages in a single response.
- Never roleplay. Never pretend to be a person or make up names.
- If asked anything unrelated to trade, logistics, or documents, respond only with: "I can only help with trade and shipment questions."
- Be concise and specific. No filler. No hallucination.`;

const toolDeclarations = [
  {
    type: "function",
    function: {
      name: "validateGSTIN",
      description: "Validate a GSTIN number format and checksum",
      parameters: {
        type: "object",
        properties: {
          gstin: { type: "string", description: "The GSTIN number to validate" },
        },
        required: ["gstin"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validateHSN",
      description: "Validate an HSN code format for customs",
      parameters: {
        type: "object",
        properties: {
          hsn: { type: "string", description: "The HSN code to validate" },
        },
        required: ["hsn"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookupRegulation",
      description: "Look up trade regulations for India-Nepal, India-Bhutan, or India-Bangladesh corridors",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The regulation query" },
          corridor: { type: "string", description: "The trade corridor (e.g. India-Nepal, India-Bhutan, India-Bangladesh)" },
        },
        required: ["query", "corridor"],
      },
    },
  },
];

function validateGSTIN(gstin: string): Record<string, unknown> {
  if (gstin.length !== 15) {
    return { valid: false, gstin, error: "GSTIN must be exactly 15 characters" };
  }
  const upper = gstin.toUpperCase();
  const stateCode = parseInt(upper.slice(0, 2), 10);
  if (isNaN(stateCode) || stateCode < 1 || stateCode > 38) {
    return { valid: false, gstin, error: "Invalid state code (must be 01-38)" };
  }
  const panPart = upper.slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panPart)) {
    return { valid: false, gstin, error: "Invalid PAN segment" };
  }
  if (!/^[1-9A-Z]$/.test(upper[12])) {
    return { valid: false, gstin, error: "Invalid entity number at position 13" };
  }
  if (upper[13] !== "Z") {
    return { valid: false, gstin, error: "Position 14 must be Z" };
  }
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(upper[i]);
    if (val === -1) return { valid: false, gstin, error: `Invalid character '${upper[i]}'` };
    const product = val * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expectedChecksum = chars[(36 - (sum % 36)) % 36];
  if (upper[14] !== expectedChecksum) {
    return { valid: false, gstin, error: `Invalid checksum. Expected '${expectedChecksum}'` };
  }
  return { valid: true, gstin: upper, state_code: upper.slice(0, 2), pan_embedded: panPart };
}

function validateHSN(hsn: string): Record<string, unknown> {
  const cleaned = hsn.replace(/[\s.]/g, "");
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, hsn, error: "HSN code must contain only digits" };
  }
  if (cleaned.length !== 4 && cleaned.length !== 6 && cleaned.length !== 8) {
    return { valid: false, hsn, error: "HSN code must be 4, 6, or 8 digits" };
  }
  return { valid: true, hsn, cleaned, digits: cleaned.length };
}

async function lookupRegulation(query: string, corridor: string): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get("SUPA_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPA_SECRET");
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return { result: "Regulation lookup unavailable. Known rules: Nepal requires LC for goods >NPR 50,000. E-way bill mandatory for goods >Rs 50,000. All exports need IEC." };
  }
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await supabase
    .from("regulations")
    .select("title, summary, authority, effective_date, source_url")
    .or(`corridor.eq.${corridor},corridor.eq.All`)
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
    .limit(3);
  if (error || !data?.length) {
    return { result: `No regulations found for "${query}" on "${corridor}". General: Nepal requires LC >NPR 50,000. E-way bill >Rs 50,000. All exports need IEC.` };
  }
  return { regulations: data, count: data.length, corridor, query };
}

async function runTool(name: string, args: Record<string, string>): Promise<Record<string, unknown>> {
  if (name === "validateGSTIN") return validateGSTIN(args.gstin ?? "");
  if (name === "validateHSN") return validateHSN(args.hsn ?? "");
  if (name === "lookupRegulation") return await lookupRegulation(args.query ?? "", args.corridor ?? "");
  return { error: `Unknown tool: ${name}` };
}

const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { message, history } = await req.json();

    const messages: { role: string; content: string; tool_call_id?: string; name?: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const entry of history) {
        messages.push({ role: entry.role === "assistant" ? "assistant" : "user", content: entry.content });
      }
    }
    messages.push({ role: "user", content: message });

    // First call: non-streaming with tools to detect function calls
    const firstRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, tools: toolDeclarations, tool_choice: "auto", temperature: 0.3, max_tokens: 2048 }),
    });

    if (!firstRes.ok) {
      const err = await firstRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: (err as { error?: { message?: string } }).error?.message ?? `Groq error ${firstRes.status}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstData = await firstRes.json();
    const firstChoice = firstData?.choices?.[0];
    const toolCalls = firstChoice?.message?.tool_calls;

    if (toolCalls?.length) {
      // Execute all tool calls
      messages.push({ role: "assistant", content: firstChoice.message.content ?? "", ...{ tool_calls: toolCalls } } as never);
      for (const tc of toolCalls) {
        let args: Record<string, string> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        const result = await runTool(tc.function.name, args);
        messages.push({ role: "tool", content: JSON.stringify(result), tool_call_id: tc.id, name: tc.function.name });
      }
    }

    // Final streaming call without tools
    const streamRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 2048, stream: true }),
    });

    if (!streamRes.ok || !streamRes.body) {
      const err = await streamRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: (err as { error?: { message?: string } }).error?.message ?? "Stream error" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = streamRes.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (trimmed.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  const chunk = parsed?.choices?.[0]?.delta?.content;
                  if (chunk) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reply: chunk })}\n\n`));
                  }
                } catch { /* skip malformed */ }
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
