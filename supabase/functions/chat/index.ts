import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt =
  "You are Ability, an AI Trade Operations Agent for India-Nepal, India-Bhutan, and India-Bangladesh export logistics. Help users with trade documents, bilty/LR generation, compliance, HSN codes, customs regulations, and risk detection. Be concise and specific.";

const toolDeclarations = [
  {
    name: "validateGSTIN",
    description: "Validate a GSTIN number format and checksum",
    parameters: {
      type: "object",
      properties: {
        gstin: {
          type: "string",
          description: "The GSTIN number to validate",
        },
      },
      required: ["gstin"],
    },
  },
  {
    name: "validateHSN",
    description: "Validate an HSN code format for customs",
    parameters: {
      type: "object",
      properties: {
        hsn: {
          type: "string",
          description: "The HSN code to validate",
        },
      },
      required: ["hsn"],
    },
  },
  {
    name: "lookupRegulation",
    description: "Look up trade regulations for India-Nepal, India-Bhutan, or India-Bangladesh corridors",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The regulation query",
        },
        corridor: {
          type: "string",
          description: "The trade corridor (e.g. India-Nepal, India-Bhutan, India-Bangladesh)",
        },
      },
      required: ["query", "corridor"],
    },
  },
];

function validateGSTIN(gstin: string): Record<string, unknown> {
  if (gstin.length !== 15) {
    return { valid: false, gstin, state_code: "", pan_embedded: "", error: "GSTIN must be exactly 15 characters" };
  }

  const upper = gstin.toUpperCase();
  const stateCodeStr = upper.slice(0, 2);
  const stateCode = parseInt(stateCodeStr, 10);

  if (isNaN(stateCode) || stateCode < 1 || stateCode > 38) {
    return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: "", error: "Invalid state code (must be 01-38)" };
  }

  const panPart = upper.slice(2, 12);
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(panPart)) {
    return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: panPart, error: "Invalid PAN segment (positions 3-12 must be 5 letters + 4 digits + 1 letter)" };
  }

  const entityChar = upper[12];
  const validEntity = /^[1-9A-Z]$/.test(entityChar);
  if (!validEntity) {
    return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: panPart, error: "Invalid entity number at position 13 (must be 1-9 or A-Z)" };
  }

  if (upper[13] !== "Z") {
    return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: panPart, error: "Position 14 must be Z" };
  }

  // Luhn-like mod 36 checksum
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(upper[i]);
    if (val === -1) {
      return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: panPart, error: `Invalid character '${upper[i]}' at position ${i + 1}` };
    }
    const product = val * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expectedChecksum = chars[(36 - (sum % 36)) % 36];
  if (upper[14] !== expectedChecksum) {
    return { valid: false, gstin, state_code: stateCodeStr, pan_embedded: panPart, error: `Invalid checksum character. Expected '${expectedChecksum}', got '${upper[14]}'` };
  }

  return { valid: true, gstin: upper, state_code: stateCodeStr, pan_embedded: panPart };
}

function validateHSN(hsn: string): Record<string, unknown> {
  const cleaned = hsn.replace(/[\s.]/g, "");
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, hsn, cleaned, digits: cleaned.length, error: "HSN code must contain only digits (after removing dots and spaces)" };
  }
  if (cleaned.length !== 4 && cleaned.length !== 6 && cleaned.length !== 8) {
    return { valid: false, hsn, cleaned, digits: cleaned.length, error: "HSN code must be 4, 6, or 8 digits" };
  }
  return { valid: true, hsn, cleaned, digits: cleaned.length };
}

async function lookupRegulation(query: string, corridor: string): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return {
      result: "Regulation lookup unavailable: Supabase not configured. Known rules: Nepal requires LC for goods >NPR 50,000. E-way bill mandatory for goods >Rs 50,000 within India. All exports need IEC.",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from("regulations")
    .select("title, summary, authority, effective_date, source_url")
    .or(`corridor.eq.${corridor},corridor.eq.All`)
    .or(`title.ilike.${searchTerm},summary.ilike.${searchTerm}`)
    .limit(3);

  if (error) {
    return {
      result: `Regulation lookup error: ${error.message}. Known rules: Nepal requires LC for goods >NPR 50,000. E-way bill mandatory for goods >Rs 50,000 within India. All exports need IEC.`,
    };
  }

  if (!data || data.length === 0) {
    return {
      result: `No specific regulations found for query "${query}" on corridor "${corridor}". General rules: Nepal requires LC for goods >NPR 50,000. E-way bill mandatory for goods >Rs 50,000 within India. All exports need IEC.`,
    };
  }

  return {
    regulations: data,
    count: data.length,
    corridor,
    query,
  };
}

async function runTool(name: string, args: Record<string, string>): Promise<Record<string, unknown>> {
  if (name === "validateGSTIN") {
    return validateGSTIN(args.gstin ?? "");
  }
  if (name === "validateHSN") {
    return validateHSN(args.hsn ?? "");
  }
  if (name === "lookupRegulation") {
    return await lookupRegulation(args.query ?? "", args.corridor ?? "");
  }
  return { error: `Unknown tool: ${name}` };
}

type ContentPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, string> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type Content = {
  role: string;
  parts: ContentPart[];
};

async function callGemini(
  apiKey: string,
  contents: Content[],
  includeTools: boolean,
  streaming: boolean,
): Promise<Response> {
  const body: Record<string, unknown> = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  if (includeTools) {
    body.tools = [{ functionDeclarations: toolDeclarations }];
  }

  const endpoint = streaming
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`
    : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  return await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function callGeminiWithRetry(
  apiKey: string,
  contents: Content[],
  includeTools: boolean,
  streaming: boolean,
): Promise<Response> {
  let response = await callGemini(apiKey, contents, includeTools, streaming);
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await callGemini(apiKey, contents, includeTools, streaming);
  }
  return response;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const keys = [Deno.env.get("GEMINI_API_KEY"), Deno.env.get("GEMINI_API_KEY_2")].filter(Boolean) as string[];
  if (keys.length === 0) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Pick key based on minute — simple time-based rotation
  const apiKey = keys[Math.floor(Date.now() / 60000) % keys.length];

  try {
    const { conversationId: _conversationId, message, history } = await req.json();

    const contents: Content[] = [];

    if (Array.isArray(history)) {
      for (const entry of history) {
        const role = entry.role === "assistant" ? "model" : "user";
        contents.push({ role, parts: [{ text: entry.content }] });
      }
    }

    contents.push({ role: "user", parts: [{ text: message }] });

    // First call: non-streaming, with tools enabled, to detect function calls
    let response = await callGeminiWithRetry(apiKey, contents, true, false);
    let data = await response.json();

    const candidate = data?.candidates?.[0];
    const parts: ContentPart[] = candidate?.content?.parts ?? [];

    const functionCallPart = parts.find(
      (p): p is { functionCall: { name: string; args: Record<string, string> } } =>
        "functionCall" in p,
    );

    let streamingContents: Content[] = contents;

    if (functionCallPart) {
      const { name, args } = functionCallPart.functionCall;
      const toolResult = await runTool(name, args);

      streamingContents = [
        ...contents,
        { role: "model", parts: [{ functionCall: { name, args } }] },
        {
          role: "user",
          parts: [{ functionResponse: { name, response: toolResult } }],
        },
      ];
    }

    // Final call: streaming, no tools
    const streamResponse = await callGeminiWithRetry(apiKey, streamingContents, false, true);

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          if (!streamResponse.body) {
            controller.enqueue(encoder.encode(`data: {"error": "No response body from Gemini"}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (possibly incomplete) line in the buffer
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;

              if (trimmed.startsWith("data: ")) {
                const jsonStr = trimmed.slice(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  const textChunk = parsed?.candidates?.[0]?.content?.parts?.find(
                    (p: ContentPart) => "text" in p,
                  )?.text;

                  if (textChunk) {
                    const sseChunk = `data: ${JSON.stringify({ reply: textChunk })}\n\n`;
                    controller.enqueue(encoder.encode(sseChunk));
                  }
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          }

          // Flush any remaining buffer content
          if (buffer.trim().startsWith("data: ")) {
            const jsonStr = buffer.trim().slice(6);
            if (jsonStr && jsonStr !== "[DONE]") {
              try {
                const parsed = JSON.parse(jsonStr);
                const textChunk = parsed?.candidates?.[0]?.content?.parts?.find(
                  (p: ContentPart) => "text" in p,
                )?.text;

                if (textChunk) {
                  const sseChunk = `data: ${JSON.stringify({ reply: textChunk })}\n\n`;
                  controller.enqueue(encoder.encode(sseChunk));
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const errorChunk = `data: ${JSON.stringify({ error: String(err) })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
