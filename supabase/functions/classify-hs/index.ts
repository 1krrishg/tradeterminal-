import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface Candidate {
  hts8: string;
  heading: string; // 4-digit
  description: string;
  gri_rule: string;
  reasoning: string;
  confidence: number;
  disqualified?: string;
}

interface LlmCandidate {
  hts8: string;
  heading: string;
  description: string;
  gri_rule: string;
  reasoning: string;
  confidence: number;
  disqualified_headings?: string;
}

interface CbpRuling {
  rulingNumber?: string;
  reference?: string;
  subject?: string;
  issueDate?: string;
  tariffNumbers?: string[];
}

// Search CBP CROSS rulings for a given HS code + product
async function searchCbpRulings(query: string, hs4: string): Promise<CbpRuling | null> {
  try {
    const url = `https://rulings.cbp.gov/api/search?term=${encodeURIComponent(query)}&collection=ALL&pageSize=5&page=1`;
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const rulings: CbpRuling[] = data?.results ?? data?.rulings ?? [];
    // Find ruling where tariffNumbers contains a code starting with hs4
    const match = rulings.find((r) =>
      r.tariffNumbers?.some((t: string) => t.replace(/\./g, "").startsWith(hs4))
    );
    return match ?? rulings[0] ?? null;
  } catch {
    return null;
  }
}

// Validate HS code exists in USITC catalog, return description + mfn_rate
async function validateInUsitc(
  supabase: ReturnType<typeof createClient>,
  hts8: string
): Promise<{ description: string; mfn_rate: number } | null> {
  const clean = hts8.replace(/\./g, "").replace(/\s/g, "");
  const { data } = await supabase
    .from("hts_catalog")
    .select("description, mfn_rate")
    .like("hts8", `${clean.substring(0, 8)}%`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function parseJson(raw: string): unknown {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* */ } }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return [JSON.parse(objMatch[0])]; } catch { /* */ } }
  return [];
}

// Deterministic confidence scoring on top of LLM estimate
function scoreConfidence(
  llmConfidence: number,
  hasCbpRuling: boolean,
  cbpHsMatches: boolean,
  usitcValidated: boolean,
  griRule: string,
  isAmbiguous: boolean,
): number {
  let score = llmConfidence;
  if (hasCbpRuling) score += 15;
  if (cbpHsMatches) score += 10; // CBP ruling's HS matches our candidate
  if (usitcValidated) score += 10;
  if (griRule === "1") score += 5; // GRI 1 = clearest, most defensible
  if (griRule === "3") score -= 10; // competing headings = more ambiguity
  if (isAmbiguous) score -= 10;
  return Math.min(99, Math.max(5, Math.round(score)));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description || description.trim().length < 2) {
      return new Response(JSON.stringify({ error: "description required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Groq GRI classification ──────────────────────────────────────
    const groqResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.0,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are a licensed US customs broker with 20 years of experience classifying goods under the Harmonized Tariff Schedule of the United States (HTSUS).

Apply the WCO General Rules of Interpretation (GRI) in strict order:
- GRI 1: Classify by the section/chapter notes and the heading that most specifically describes the product. This is the most common and most defensible rule.
- GRI 2a: Incomplete or unfinished articles classify as the complete article.
- GRI 2b: Mixtures or combinations — classify by the constituent material that gives essential character.
- GRI 3a: When two headings compete, the most specific heading wins.
- GRI 3b: If still tied, classify by essential character.
- GRI 3c: If still tied, the heading that appears last in the tariff wins.
- GRI 6: Apply GRI 1-5 at the subheading level.

Key rules you must follow:
- Never classify a product under a chapter it is explicitly excluded from by section or chapter notes.
- Finished electrical/electronic goods go in Section XVI or XVII — not Section XV (metals).
- Textiles: classify by chief weight of fiber.
- Food: classify by preparation method and ingredient.
- All candidates MUST be genuinely different HS codes. Never return the same 8-digit code more than once.
- All candidates must be plausible for the described product. Never suggest a completely unrelated chapter (e.g. do NOT suggest iron/steel for a food product, or electronics for agricultural goods).
- If only one heading clearly fits, provide 2 candidates: the correct one plus the closest alternative (even if from the same chapter, it must have a different 8-digit code). Do NOT return a third duplicate just to reach 3.
- If the product could plausibly fall under multiple headings, list up to 3 distinct codes.
- Confidence for candidates 2 and 3 must reflect genuine ambiguity — if GRI 1 is clear, candidates 2 and 3 should be below 40.

Return a JSON array of 2 or 3 candidates (never fewer than 2, never more than 3), ranked by confidence. All hts8 codes must be unique. Each candidate:
{
  "hts8": "8-digit HTSUS code, no dots",
  "heading": "4-digit heading number",
  "description": "exact heading text from the HTSUS",
  "gri_rule": "which GRI rule resolved classification (e.g. '1', '3a', '3b', '6')",
  "reasoning": "one sentence: why this heading fits the product description",
  "confidence": integer 0-100,
  "disqualified_headings": "other headings considered and why rejected (or empty string)"
}

Return ONLY the JSON array. No markdown, no explanation.`,
          },
          {
            role: "user",
            content: `Classify this product under the HTSUS using GRI: "${description}"`,
          },
        ],
      }),
    });

    if (!groqResp.ok) throw new Error(`Groq error: ${await groqResp.text()}`);
    const groqData = await groqResp.json();
    const raw = groqData.choices?.[0]?.message?.content ?? "[]";
    const llmCandidates = parseJson(raw) as LlmCandidate[];

    if (!Array.isArray(llmCandidates) || llmCandidates.length === 0) {
      throw new Error("LLM returned no candidates");
    }

    // ── Step 2: Parallel enrichment — CBP rulings + USITC validation ─────────
    const enriched = await Promise.all(
      llmCandidates.slice(0, 3).map(async (c) => {
        const hs4 = (c.hts8 ?? "").substring(0, 4);
        const searchTerm = `${description} ${c.description ?? ""}`.substring(0, 80);

        const [cbpRuling, usitcRow] = await Promise.all([
          searchCbpRulings(searchTerm, hs4),
          validateInUsitc(supabase, c.hts8 ?? ""),
        ]);

        const cbpHsMatches = cbpRuling?.tariffNumbers?.some(
          (t: string) => t.replace(/\./g, "").startsWith(hs4)
        ) ?? false;

        // Penalise heavily if USITC description shares no words with LLM description
        // (catches cases where the LLM returned a wrong HS code that happens to exist in USITC)
        let descMismatch = false;
        if (usitcRow?.description && c.description) {
          const llmWords = new Set(c.description.toLowerCase().split(/\W+/).filter(w => w.length > 3));
          const usitcWords = usitcRow.description.toLowerCase().split(/\W+/).filter(w => w.length > 3);
          const overlap = usitcWords.filter(w => llmWords.has(w)).length;
          descMismatch = overlap === 0 && usitcWords.length > 2;
        }

        const finalConfidence = scoreConfidence(
          descMismatch ? Math.min(c.confidence ?? 50, 20) : (c.confidence ?? 50),
          !!cbpRuling,
          cbpHsMatches,
          !!usitcRow && !descMismatch,
          c.gri_rule ?? "1",
          (c.disqualified_headings ?? "").length > 20,
        );

        return {
          hts8: c.hts8,
          heading: c.heading ?? (c.hts8 ?? "").substring(0, 4),
          description: c.description,
          usitc_description: usitcRow?.description ?? null,
          gri_rule: c.gri_rule ?? "1",
          reasoning: c.reasoning,
          confidence: finalConfidence,
          disqualified: c.disqualified_headings ?? "",
          mfn_rate: usitcRow?.mfn_rate ?? null,
          usitc_validated: !!usitcRow,
          cbp_ruling: cbpRuling ? {
            number: cbpRuling.rulingNumber ?? cbpRuling.reference ?? null,
            subject: cbpRuling.subject ?? null,
            date: cbpRuling.issueDate ?? null,
            hs_match: cbpHsMatches,
          } : null,
        } as Candidate & {
          mfn_rate: number | null;
          usitc_validated: boolean;
          cbp_ruling: { number: string | null; subject: string | null; date: string | null; hs_match: boolean } | null;
        };
      })
    );

    // Deduplicate by hts8 — keep highest-confidence entry for each code
    const seenCodes = new Set<string>();
    const deduped = enriched
      .sort((a, b) => b.confidence - a.confidence)
      .filter(c => {
        if (seenCodes.has(c.hts8)) return false;
        seenCodes.add(c.hts8);
        return true;
      });

    return new Response(JSON.stringify({ candidates: deduped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
