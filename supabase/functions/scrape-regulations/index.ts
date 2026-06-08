import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Real browser UA — PIB and govt sites block non-browser UAs
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Source registry ────────────────────────────────────────────────────────
// type "rss-hindi" = RSS feed with Hindi content, skip keyword filter, use Groq to assess
const SOURCES: Array<{
  url: string;
  authority: string;
  corridor: string;
  keywords: string[];
  type: "rss" | "rss-hindi" | "html";
}> = [
  // ── India (PIB — Hindi RSS, Groq decides relevance) ───────────────────
  {
    url: "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3",
    authority: "DGFT",
    corridor: "All",
    type: "rss-hindi",
    keywords: [], // Groq handles filtering
  },
  {
    url: "https://pib.gov.in/RssMain.aspx?ModId=9&Lang=1&Regid=3",
    authority: "CBIC",
    corridor: "All",
    type: "rss-hindi",
    keywords: [],
  },
  {
    url: "https://pib.gov.in/RssMain.aspx?ModId=4&Lang=1&Regid=3",
    authority: "RBI",
    corridor: "All",
    type: "rss-hindi",
    keywords: [],
  },
  {
    url: "https://pib.gov.in/RssMain.aspx?ModId=12&Lang=1&Regid=3",
    authority: "MoCI",
    corridor: "All",
    type: "rss-hindi",
    keywords: [],
  },
  // ── India (English RSS — keyword filter works) ────────────────────────
  {
    url: "https://www.cbic.gov.in/entities/cbicrss",
    authority: "CBIC",
    corridor: "All",
    type: "rss",
    keywords: ["customs", "duty", "tariff", "notification", "circular", "eway", "export", "import", "hsn"],
  },
  // ── Nepal ─────────────────────────────────────────────────────────────
  {
    url: "https://ird.gov.np/rss/en",
    authority: "IRD-Nepal",
    corridor: "India-Nepal",
    type: "rss",
    keywords: ["customs", "vat", "duty", "tariff", "trade", "import", "export", "revenue"],
  },
  {
    url: "https://www.customs.gov.np/en/notices",
    authority: "Nepal-Customs",
    corridor: "India-Nepal",
    type: "html",
    keywords: ["customs", "duty", "valuation", "declaration", "tariff", "import", "export", "birgunj"],
  },
  {
    url: "https://www.mof.gov.np/en/press-release",
    authority: "Nepal-MoF",
    corridor: "India-Nepal",
    type: "html",
    keywords: ["budget", "revenue", "customs", "duty", "tariff", "trade", "import"],
  },
  // ── Bangladesh ────────────────────────────────────────────────────────
  {
    url: "https://nbr.gov.bd/rss.xml",
    authority: "NBR-Bangladesh",
    corridor: "India-Bangladesh",
    type: "rss",
    keywords: ["customs", "duty", "vat", "tariff", "import", "export", "trade", "india"],
  },
  // ── Bhutan ────────────────────────────────────────────────────────────
  {
    url: "https://www.mof.gov.bt/category/press-release/feed/",
    authority: "Bhutan-MoF",
    corridor: "India-Bhutan",
    type: "rss",
    keywords: ["trade", "customs", "duty", "tariff", "import", "export", "india", "phuentsholing", "jaigaon"],
  },
  // ── English trade news (keyword filter works) ─────────────────────────
  {
    url: "https://economictimes.indiatimes.com/rssfeeds/7771250.cms",
    authority: "ET-Trade",
    corridor: "All",
    type: "rss",
    keywords: ["customs", "dgft", "trade policy", "export", "import", "nepal", "bhutan", "bangladesh", "cbic", "ftp", "tariff", "duty"],
  },
  {
    url: "https://www.livemint.com/rss/economy",
    authority: "Mint",
    corridor: "All",
    type: "rss",
    keywords: ["customs", "dgft", "export", "import", "trade", "cbic", "nepal", "bhutan", "bangladesh", "tariff"],
  },
];

// ── Groq helper ───────────────────────────────────────────────────────────
async function groqChat(systemPrompt: string, userPrompt: string, maxTokens = 300): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

// ── For Hindi PIB titles: Groq decides if relevant AND summarizes in one call
async function assessHindi(title: string, corridor: string): Promise<string | null> {
  const system = `You are a trade regulation filter for India's cross-border road freight corridors (India-Nepal, India-Bhutan, India-Bangladesh).

You receive a Hindi news title. Decide if it's relevant to: customs duty, trade policy, import/export rules, foreign trade, DGFT, CBIC, RBI/FEMA, bilateral trade, transport regulations, HSN/tariff changes, or cross-border logistics.

If RELEVANT: reply with a single English sentence summarising what changed and who is affected.
If NOT RELEVANT (sports, politics, health, defence, infrastructure unrelated to trade): reply only with the word SKIP`;

  const user = `Title (Hindi): ${title}\nDefault corridor: ${corridor}`;
  const result = await groqChat(system, user, 120);
  return result.trim().toUpperCase() === "SKIP" ? null : result;
}

// ── For English items: summarize + filter in one call ────────────────────
async function summarize(title: string, description: string, corridor: string): Promise<string | null> {
  const system = `You summarize trade regulation updates for export operations teams on India's cross-border road freight corridors (India-Nepal, India-Bhutan, India-Bangladesh).

Summarize in 2 sentences max. Be specific: what changed, who is affected, any dates or deadlines.
If the content is completely unrelated to trade/customs/logistics: reply only with the word SKIP.
Never discuss military, defence, weapons, or nuclear topics.`;

  const user = `Corridor: ${corridor}\nTitle: ${title}\nContent: ${description.slice(0, 600)}`;
  const result = await groqChat(system, user, 200);
  return result.trim().toUpperCase() === "SKIP" ? null : result;
}

// ── Extract items from HTML using Groq ────────────────────────────────────
async function extractFromHTML(html: string, sourceUrl: string): Promise<Array<{ title: string; description: string; link: string; pubDate: string }>> {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 3000);

  const system = `Extract structured trade regulation notices from webpage text. Return ONLY a valid JSON array, no explanation, no markdown.`;
  const user = `Extract up to 8 items about customs, trade policy, duty, tariff, import/export rules, or transport permits.
Format: [{"title":"...","description":"...","link":"...","pubDate":"..."}]
Empty string for missing fields. Return [] if nothing relevant.
Source: ${sourceUrl}
Text: ${text}`;

  const result = await groqChat(system, user, 1000);
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}

// ── Parse RSS XML ─────────────────────────────────────────────────────────
function parseRSS(xml: string): Array<{ title: string; description: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; description: string; link: string; pubDate: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const b = match[1];
    const title = (b.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1] ?? b.match(/<title>(.*?)<\/title>/s)?.[1] ?? "").trim();
    const description = (b.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s)?.[1] ?? b.match(/<description>(.*?)<\/description>/s)?.[1] ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const link = (b.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/s)?.[1] ?? b.match(/<link>(.*?)<\/link>/s)?.[1] ?? "").trim();
    const pubDate = (b.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "").trim();
    if (title) items.push({ title, description, link, pubDate });
  }
  return items.slice(0, 15);
}

function isRelevant(item: { title: string; description: string }, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const text = (item.title + " " + item.description).toLowerCase();
  return keywords.some(k => text.includes(k.toLowerCase()));
}

function detectCorridor(text: string, fallback: string): string {
  const t = text.toLowerCase();
  if (t.includes("nepal") || t.includes("birgunj") || t.includes("raxaul") || t.includes("biratnagar") || t.includes("नेपाल")) return "India-Nepal";
  if (t.includes("bangladesh") || t.includes("benapole") || t.includes("petrapole") || t.includes("बांग्लादेश")) return "India-Bangladesh";
  if (t.includes("bhutan") || t.includes("phuentsholing") || t.includes("jaigaon") || t.includes("भूटान")) return "India-Bhutan";
  return fallback;
}

function detectTags(text: string, authority: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (t.includes("hsn") || t.includes("tariff") || t.includes("classification") || t.includes("टैरिफ")) tags.push("HSN/tariff");
  if (t.includes("gstin") || t.includes("gst")) tags.push("GST");
  if (t.includes("lc") || t.includes("letter of credit")) tags.push("LC");
  if (t.includes("freight") || t.includes("transport") || t.includes("lorry") || t.includes("truck") || t.includes("bilty")) tags.push("freight");
  if (t.includes("customs") || t.includes("duty") || t.includes("clearance") || t.includes("सीमाशुल्क") || t.includes("शुल्क")) tags.push("customs");
  if (t.includes("eway") || t.includes("e-way")) tags.push("eway-bill");
  if (t.includes("iec") || t.includes("import export code")) tags.push("IEC");
  if (t.includes("fema") || t.includes("remittance") || t.includes("forex")) tags.push("FEMA");
  if (t.includes("permit") || t.includes("vehicle") || t.includes("driver")) tags.push("vehicle-permit");
  if (t.includes("valuation") || t.includes("invoice")) tags.push("valuation");
  if (t.includes("ban") || t.includes("prohibited") || t.includes("restricted")) tags.push("prohibited-goods");
  if (t.includes("bilateral") || t.includes("treaty") || t.includes("agreement") || t.includes("mou")) tags.push("bilateral-treaty");
  if (t.includes("export") || t.includes("निर्यात")) tags.push("export-policy");
  if (t.includes("import") || t.includes("आयात")) tags.push("import-policy");
  if (tags.length === 0) tags.push("general");
  tags.push(authority.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  return tags;
}

// ── Main handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPA_URL") ?? "",
    Deno.env.get("SUPA_SECRET") ?? ""
  );

  const results = {
    sources_attempted: SOURCES.length,
    scraped: 0,
    relevant: 0,
    inserted: 0,
    skipped_duplicate: 0,
    skipped_irrelevant: 0,
    errors: [] as string[],
  };

  for (const source of SOURCES) {
    try {
      const res = await fetch(source.url, {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*",
          "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        results.errors.push(`${source.authority}: HTTP ${res.status}`);
        continue;
      }

      const body = await res.text();
      let items: Array<{ title: string; description: string; link: string; pubDate: string }> = [];

      if (source.type === "rss" || source.type === "rss-hindi") {
        items = parseRSS(body);
      } else {
        try {
          items = await extractFromHTML(body, source.url);
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {
          results.errors.push(`${source.authority} HTML: ${String(e).slice(0, 80)}`);
          continue;
        }
      }

      results.scraped += items.length;

      for (const item of items) {
        // For English RSS: fast keyword pre-filter before hitting Groq
        if (source.type === "rss" && !isRelevant(item, source.keywords)) {
          results.skipped_irrelevant++;
          continue;
        }

        results.relevant++;
        const titleKey = item.title.slice(0, 200);

        // Dedup
        const { data: existing } = await supabase
          .from("regulations")
          .select("id")
          .eq("title", titleKey)
          .single();

        if (existing) { results.skipped_duplicate++; continue; }

        const text = item.title + " " + item.description;
        const corridor = detectCorridor(text, source.corridor);

        // Get summary — Hindi uses assessHindi, English uses summarize
        let summary: string | null = null;
        try {
          if (source.type === "rss-hindi") {
            summary = await assessHindi(item.title, corridor);
          } else {
            summary = await summarize(item.title, item.description, corridor);
          }
        } catch (e) {
          results.errors.push(`Groq [${source.authority}]: ${String(e).slice(0, 60)}`);
          summary = item.description.slice(0, 200) || item.title;
        }

        if (summary === null) { results.skipped_irrelevant++; continue; }

        const tags = detectTags(text, source.authority);

        let link = item.link || source.url;
        if (link.startsWith("/")) {
          try { const base = new URL(source.url); link = `${base.protocol}//${base.host}${link}`; } catch { link = source.url; }
        }

        let effectiveDate: string | null = null;
        if (item.pubDate) {
          try { effectiveDate = new Date(item.pubDate).toISOString().split("T")[0]; } catch { /* skip */ }
        }

        const { error } = await supabase.from("regulations").insert({
          authority: source.authority,
          corridor,
          title: titleKey,
          summary,
          source_url: link,
          effective_date: effectiveDate,
          tags,
        });

        if (error) results.errors.push(`Insert [${source.authority}]: ${error.message}`);
        else results.inserted++;

        // ~30 RPM on Groq free tier = 2s between calls to be safe
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {
      results.errors.push(`${source.authority}: ${String(e).slice(0, 120)}`);
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
