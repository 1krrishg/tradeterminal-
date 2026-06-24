import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WTO_API_KEY = Deno.env.get("WTO_API_KEY") ?? "";

// WTO reporter codes (importing country that sets the tariff)
const WTO_COUNTRY_CODES: Record<string, string> = {
  "United States": "840",
  "China": "156",
  "European Union": "918",
  "Canada": "124",
  "Mexico": "484",
  "Japan": "392",
  "India": "356",
  "South Korea": "410",
  "United Kingdom": "826",
  "Australia": "36",
  "Brazil": "76",
  "Singapore": "702",
  "Turkey": "792",
  "Vietnam": "704",
  "Indonesia": "360",
  "Thailand": "764",
  "Malaysia": "458",
};

// WTO partner codes (exporting/origin country)
const WTO_PARTNER_CODES: Record<string, string> = {
  "United States": "840",
  "China": "156",
  "European Union": "918",
  "Canada": "124",
  "Mexico": "484",
  "Japan": "392",
  "India": "356",
  "South Korea": "410",
  "United Kingdom": "826",
  "Australia": "36",
  "Brazil": "76",
  "Singapore": "702",
  "Turkey": "792",
  "Vietnam": "704",
  "Indonesia": "360",
  "Thailand": "764",
  "Malaysia": "458",
};

// Fetch MFN tariff rate a country charges on a given HS4 product
async function getWtoMfnRate(reporterCode: string, hs4: string): Promise<number | null> {
  if (!WTO_API_KEY) return null;
  try {
    const url = `https://api.wto.org/timeseries/v1/data?i=HS_A_0010&r=${reporterCode}&ps=2022&pc=${hs4}&fmt=json&mode=full&head=M&lang=1&max=1`;
    const resp = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": WTO_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.Dataset?.[0];
    return (row && typeof row.Value === "number") ? row.Value : null;
  } catch { return null; }
}

// Known FTAs — maps "Reporter::Partner" to agreement name
// WTO HS_A_0020 gives the best preferential rate the reporter offers to FTA partners
const FTA_AGREEMENTS: Record<string, string> = {
  "Canada::United States": "USMCA",
  "United States::Canada": "USMCA",
  "Mexico::United States": "USMCA",
  "United States::Mexico": "USMCA",
  "Canada::Mexico": "USMCA",
  "Mexico::Canada": "USMCA",
  "Australia::United States": "AUSFTA",
  "United States::Australia": "AUSFTA",
  "South Korea::United States": "KORUS",
  "United States::South Korea": "KORUS",
  "Japan::Australia": "JAEPA",
  "Australia::Japan": "JAEPA",
  "Japan::Canada": "CPTPP",
  "Canada::Japan": "CPTPP",
  "Japan::Vietnam": "CPTPP",
  "Vietnam::Japan": "CPTPP",
  "Japan::Singapore": "CPTPP",
  "Singapore::Japan": "CPTPP",
  "Canada::Australia": "CPTPP",
  "Australia::Canada": "CPTPP",
  "Australia::Vietnam": "CPTPP",
  "Vietnam::Australia": "CPTPP",
  "Singapore::Australia": "CPTPP",
  "Australia::Singapore": "CPTPP",
  "United Kingdom::European Union": "UK-EU TCA",
  "European Union::United Kingdom": "UK-EU TCA",
  "India::Singapore": "CECA",
  "Singapore::India": "CECA",
  "South Korea::Australia": "KAFTA",
  "Australia::South Korea": "KAFTA",
  "Japan::India": "CEPA",
  "India::Japan": "CEPA",
};

// ── OFAC Sanctions — trade with these countries is prohibited or heavily restricted ──
// Source: US Treasury OFAC, EU Council Regulations, UN Security Council Resolutions
const SANCTIONS: Record<string, { level: "prohibited" | "restricted"; note: string; authority: string }> = {
  "Russia": {
    level: "restricted",
    note: "Comprehensive US/EU/UK sanctions post Feb 2022 invasion of Ukraine. Most goods prohibited. Exceptions: food, medicine, certain humanitarian goods. Financial transactions blocked via SWIFT.",
    authority: "US EO 14024, EU Regulation 833/2014 (amended), UK Russia (Sanctions) Regulations 2019",
  },
  "Iran": {
    level: "prohibited",
    note: "Comprehensive OFAC sanctions. Nearly all trade prohibited without specific OFAC license. Exceptions: food, medicine, medical devices under TSRA.",
    authority: "IEEPA, IFCA, Iran Sanctions Act — 31 CFR Part 560",
  },
  "North Korea": {
    level: "prohibited",
    note: "Comprehensive OFAC sanctions. All trade prohibited. UN Security Council resolutions ban exports of coal, iron, seafood, textiles, and imports of luxury goods.",
    authority: "31 CFR Part 510, UN SC Resolutions 2270/2321/2375/2397",
  },
  "Cuba": {
    level: "restricted",
    note: "US embargo under CACR/TWEA. Most trade prohibited. Limited exceptions for food, medicine, telecommunications, and authorized travel-related goods.",
    authority: "31 CFR Part 515 (Cuban Assets Control Regulations), TWEA",
  },
  "Syria": {
    level: "prohibited",
    note: "Comprehensive OFAC sanctions (Syrian Sanctions Regulations). Nearly all trade and investment prohibited without specific license.",
    authority: "31 CFR Part 542, Caesar Syria Civilian Protection Act 2019",
  },
  "Belarus": {
    level: "restricted",
    note: "Sectoral EU/US/UK sanctions post 2021 election crisis and support for Russia invasion. Prohibitions on potash, petroleum, steel, tobacco, and financial services.",
    authority: "US EO 14038, EU Regulation 2021/1030",
  },
  "Myanmar": {
    level: "restricted",
    note: "US sectoral sanctions post 2021 military coup. Prohibitions on jade, rubies, and goods from military-owned entities. EU arms embargo.",
    authority: "US BURMA Act 2021, EO 14014",
  },
  "Venezuela": {
    level: "restricted",
    note: "US sectoral sanctions on gold, oil sector, and government entities. Financial restrictions on Venezuelan sovereign debt. Limited general trade still permitted.",
    authority: "EO 13808/13827/13835/13884, 31 CFR Part 591",
  },
};

// ── Section 232 exemptions — these countries have deals that override the blanket 25%/10% ──
// Source: USTR proclamations and bilateral deals
const SECTION_232_EXEMPT: Record<string, { steel: boolean; aluminum: boolean; note: string }> = {
  "Canada":        { steel: true,  aluminum: true,  note: "USMCA — fully exempt from Section 232 steel and aluminum tariffs" },
  "Mexico":        { steel: true,  aluminum: true,  note: "USMCA — fully exempt from Section 232 steel and aluminum tariffs" },
  "European Union":{ steel: true,  aluminum: true,  note: "US-EU TRQ deal (Oct 2021) — quota-based exemption from Section 232; tariff-free within quota volumes" },
  "United Kingdom":{ steel: true,  aluminum: true,  note: "US-UK Section 232 deal (Jun 2022) — quota-based exemption; tariff-free within agreed volumes" },
  "Japan":         { steel: true,  aluminum: false,  note: "US-Japan Section 232 deal (Apr 2022) — steel quota exemption; aluminum still faces 10%" },
  "South Korea":   { steel: true,  aluminum: false,  note: "US-South Korea Section 232 quota deal — steel exempt within quota; aluminum still faces 10%" },
};

// Steel HS chapters: 72xx, 73xx. Aluminum: 76xx.
// ── Regulatory flags — compliance warnings beyond tariff rates ──────────────
type RegulatoryFlag = {
  type: "PROHIBITED" | "WARNING" | "COMPLIANCE" | "OPPORTUNITY";
  title: string;
  detail: string;
  authority: string;
};

// HS4 prefixes subject to UFLPA (Xinjiang forced labor) scrutiny
const UFLPA_HS4_PREFIXES = [
  "5201","5202","5203","5204","5205","5206","5207","5208","5209","5210","5211","5212", // cotton
  "6101","6102","6103","6104","6105","6106","6107","6108","6109","6110","6111","6112", // knit apparel (cotton-based)
  "6201","6202","6203","6204","6205","6206","6207","6208","6209","6210","6211","6212", // woven apparel
  "8541",                                    // polysilicon / solar cells
  "7601","7604","7606","7607","7608","7609", // aluminum (Xinjiang is major aluminum producer)
  "2002","2005",                             // tomatoes (Xinjiang tomato paste)
];

// HS4 codes subject to BIS Export Administration Regulations (EAR)
const EAR_HS4 = new Set(["8542","8471","8517","8411","8802","8803","8543","8528","9014","9015"]);

// HS4 codes that may touch ITAR (defense articles) when going to restricted destinations
const ITAR_HS4 = new Set(["8802","8803","8411","9301","9302","9303","9304","9305","9306"]);
const ITAR_RESTRICTED = new Set(["China","Russia","Iran","North Korea","Syria","Belarus"]);

function computeRegulatoryFlags(
  originCountry: string,
  destinationCountry: string,
  hs4: string,
  ftaAgreement: string | null,
  shipmentValue: number
): RegulatoryFlag[] {
  const flags: RegulatoryFlag[] = [];

  // ── UFLPA — Xinjiang Forced Labor Prevention Act ──
  if (
    originCountry === "China" &&
    destinationCountry === "United States" &&
    UFLPA_HS4_PREFIXES.some(p => hs4.startsWith(p.substring(0, 4)))
  ) {
    flags.push({
      type: "PROHIBITED",
      title: "UFLPA — Xinjiang Forced Labor Risk",
      detail: "Goods in this HS category from China are subject to the Uyghur Forced Labor Prevention Act. CBP will detain shipments at the port unless the importer can prove by clear and convincing evidence that goods were not produced with forced labor in Xinjiang. Cotton, polysilicon, aluminum, and tomatoes are the highest-risk categories. Obtain full supply chain documentation (mill certificates, facility audits, satellite verification) before shipping.",
      authority: "Uyghur Forced Labor Prevention Act (PL 117-78) · CBP UFLPA Entity List · 19 USC 1307",
    });
  }

  // ── USMCA Rules of Origin ──
  if (
    destinationCountry === "United States" &&
    (originCountry === "Canada" || originCountry === "Mexico") &&
    ftaAgreement === "USMCA"
  ) {
    const isAuto    = hs4.startsWith("87");
    const isTextile = hs4.startsWith("61") || hs4.startsWith("62") || hs4.startsWith("52") || hs4.startsWith("63");
    const isSteel   = hs4.startsWith("72") || hs4.startsWith("73");
    const isAlum    = hs4.startsWith("76");

    if (isAuto) {
      flags.push({
        type: "COMPLIANCE",
        title: "USMCA Rules of Origin — Automotive (75% RVC Required)",
        detail: "To qualify for 0% USMCA rate on vehicles: 75% regional value content from North America, steel/aluminum must be melted and poured in North America, and EV batteries must have 50%+ North American content (rising to 100% by 2027). Failure to qualify = standard US MFN rate applies (2.5% cars, 25% trucks). Certify on importer's own statement — no certificate required but keep records 5 years.",
        authority: "USMCA Chapter 4 · Automotive Appendix · 19 CFR Part 182",
      });
    } else if (isTextile) {
      flags.push({
        type: "COMPLIANCE",
        title: "USMCA Rules of Origin — Textiles (Yarn-Forward)",
        detail: "Textiles must meet yarn-forward rule: yarn spun, fabric woven, and garments cut/sewn in North America. Tariff Preference Levels (TPL) exist for limited quantities that don't meet yarn-forward. Failure to qualify means standard US MFN apparel rates apply (typically 12–32%).",
        authority: "USMCA Chapter 4 · Annex 4-B · 19 CFR Part 182",
      });
    } else if (isSteel || isAlum) {
      flags.push({
        type: "COMPLIANCE",
        title: "USMCA Rules of Origin — Steel/Aluminum (Melt and Pour)",
        detail: "Steel and aluminum must be melted and poured in North America to qualify for USMCA treatment and Section 232 exemption. Basic production stage must occur in NA — not just final manufacturing. Third-country steel processed in Mexico/Canada does NOT qualify.",
        authority: "USMCA Chapter 4 · Steel/Aluminum Annex · Presidential Proclamation 9740",
      });
    } else {
      flags.push({
        type: "COMPLIANCE",
        title: "USMCA Rules of Origin — Verify Before Claiming 0%",
        detail: "To claim the USMCA preferential rate, goods must satisfy product-specific rules of origin (tariff classification change and/or regional value content). Self-certify origin on the commercial invoice or a separate statement. CBP can audit up to 5 years after entry. If goods fail origin verification, back duties + interest + possible penalties apply.",
        authority: "USMCA Chapter 4 · 19 CFR Part 182 · CBP Form 434",
      });
    }
  }

  // ── De minimis — Section 321 ──
  if (destinationCountry === "United States") {
    if (shipmentValue <= 800 && originCountry === "China") {
      flags.push({
        type: "WARNING",
        title: "De Minimis at Risk for China-Origin",
        detail: "US de minimis threshold is $800 (Section 321) — shipments below this value enter duty-free. However, executive actions in 2025 targeted Chinese-origin goods for de minimis elimination. Status is legally uncertain and changing rapidly. Do not build a business model relying on de minimis for China-origin shipments.",
        authority: "19 USC 1321 · Executive Order (2025) on de minimis · STOP Act (House-passed)",
      });
    } else if (shipmentValue <= 800) {
      flags.push({
        type: "OPPORTUNITY",
        title: "De Minimis May Apply — Duty-Free Entry",
        detail: `This shipment value ($${shipmentValue.toLocaleString()}) is at or below the US de minimis threshold of $800. Shipments under $800 may enter the US duty-free under Section 321, with no formal customs entry required. Limit: one de minimis entry per person per day. Does not apply to goods subject to AD/CVD orders or Section 232/301 in some cases.`,
        authority: "19 USC 1321 · 19 CFR Part 10.153",
      });
    }
  }

  // ── BIS/EAR Export Controls — US as exporter ──
  if (originCountry === "United States" && EAR_HS4.has(hs4)) {
    flags.push({
      type: "WARNING",
      title: "BIS Export Controls — EAR License May Be Required",
      detail: `HS ${hs4} is likely on the Commerce Control List (CCL). Classify your specific product by its Export Control Classification Number (ECCN). Advanced semiconductors (ECCN 3A001), encryption (5E002), and aerospace components require a BIS license for many destinations. Check whether your destination is on the Country Chart for your ECCN. Unlicensed export = criminal penalties up to $1M per violation.`,
      authority: "15 CFR Parts 730–774 (EAR) · BIS Commerce Control List · 50 USC 4801",
    });
  }

  // ── ITAR — Defense Articles to Restricted Destinations ──
  if (originCountry === "United States" && ITAR_HS4.has(hs4) && ITAR_RESTRICTED.has(destinationCountry)) {
    flags.push({
      type: "PROHIBITED",
      title: "ITAR — Defense Article Export Prohibited",
      detail: `Military aircraft, spacecraft, engines, and related components are defense articles under ITAR. Export to ${destinationCountry} is prohibited — a State Department license will not be granted for this destination. Violations carry criminal penalties of up to 20 years imprisonment and $1M per violation. Consult a licensed export control attorney before any transfer.`,
      authority: "22 CFR Parts 120–130 (ITAR) · USML Categories IV, VIII, XV · Arms Export Control Act",
    });
  }

  return flags;
}
function isSteel(hs4: string): boolean { return hs4.startsWith("72") || hs4.startsWith("73"); }
function isAluminum(hs4: string): boolean { return hs4.startsWith("76"); }

// Fetch WTO preferential rate (HS_A_0020) — the best rate the reporter offers to any FTA partner
// We use this when we know an FTA exists between origin and destination
async function getWtoPreferentialRate(reporterCode: string, hs4: string, agreementName: string): Promise<{ rate: number; agreement: string } | null> {
  if (!WTO_API_KEY) return null;
  try {
    const url = `https://api.wto.org/timeseries/v1/data?i=HS_A_0020&r=${reporterCode}&ps=2022&pc=${hs4}&fmt=json&mode=full&head=M&lang=1&max=1`;
    const resp = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": WTO_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const row = data?.Dataset?.[0];
    if (!row || typeof row.Value !== "number") return null;
    return { rate: row.Value, agreement: agreementName };
  } catch { return null; }
}

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
  { name: "United States", code: "US" },
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
    const { hs_code, destination_country, origin_country, shipment_value, product_name, trade_mode, incoterms, quantity } = await req.json();
    const originCountry = origin_country || "United States";
    const isImporter = trade_mode === "importer";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Sanctions check — return early with warning if corridor is sanctioned ──
    const originSanction = SANCTIONS[originCountry] ?? null;
    const destSanction = SANCTIONS[destination_country] ?? null;
    const activeSanction = originSanction ?? destSanction;
    if (activeSanction) {
      return new Response(JSON.stringify({
        hs_code,
        product_name: product_name ?? "Goods",
        origin_country: originCountry,
        destination_country,
        shipment_value,
        sanctions_alert: true,
        sanctions_level: activeSanction.level,
        sanctions_note: activeSanction.note,
        sanctions_authority: activeSanction.authority,
        sanctioned_party: originSanction ? originCountry : destination_country,
        mfn_rate: null,
        effective_rate: null,
        tariff_cost_today: null,
        risk_score: 100,
        risk_label: "PROHIBITED",
        risk_summary: `This corridor involves ${originSanction ? originCountry : destination_country}, which is subject to ${activeSanction.level === "prohibited" ? "comprehensive trade prohibitions" : "significant trade restrictions"} under ${activeSanction.authority}. Standard tariff analysis does not apply — consult a trade compliance attorney before proceeding.`,
        recommendation: "Do not ship without an OFAC license or legal clearance. Penalties include up to $1M per violation and criminal prosecution.",
        prediction: "Sanctions are unlikely to be lifted in the near term. Explore alternative markets.",
        data_source: "OFAC SDN List · US Treasury · EU Council Regulations · UN Security Council",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Section 232 exemption check — override global retaliation_rate for exempt origins ──
    const s232Exemption = destination_country === "United States" ? (SECTION_232_EXEMPT[originCountry] ?? null) : null;
    const hs4ForExemption = hs_code.substring(0, 4);
    const s232Overridden = s232Exemption && (
      (isSteel(hs4ForExemption) && s232Exemption.steel) ||
      (isAluminum(hs4ForExemption) && s232Exemption.aluminum)
    );
    const s232ExemptionNote = s232Overridden ? s232Exemption!.note : null;

    // ── 1. Get live retaliation data from tariff_rates (scraped hourly) ──
    // Two lookups: global (origin_country IS NULL) + origin-specific (e.g. Section 301 China-only)
    // Stack both to get total additional duties for this corridor
    const [{ data: liveGlobal }, { data: liveOriginSpecific }] = await Promise.all([
      supabase
        .from("tariff_rates")
        .select("*")
        .eq("hs_code", hs_code.substring(0, 4))
        .eq("destination_country", destination_country)
        .is("origin_country", null)
        .maybeSingle(),
      supabase
        .from("tariff_rates")
        .select("*")
        .eq("hs_code", hs_code.substring(0, 4))
        .eq("destination_country", destination_country)
        .eq("origin_country", originCountry)
        .maybeSingle(),
    ]);
    // Merge: use global entry as base, stack origin-specific retaliation_rate on top
    const liveEntry = liveGlobal ?? liveOriginSpecific;
    const originSpecificRate = liveOriginSpecific?.retaliation_rate ?? 0;
    const originSpecificNote = liveOriginSpecific?.retaliation_note ?? null;

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

    // Aggregate history by year — rate_history stores mfn_rate as decimal fraction (0.03 = 3%)
    // Always multiply by 100, then filter sentinels (USITC sentinel 9999.99 → 999999%)
    const historyByYear: Record<number, number[]> = {};
    for (const row of (historyRows ?? [])) {
      const raw = row.mfn_rate ?? 0;
      const pct = raw * 100;
      if (pct > 200) continue; // filter sentinels and compound-duty placeholders
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

    // ── 5. USITC catalog rate (US domestic rate — used as fallback only) ──
    const rawCatalogMfn = catalog?.mfn_rate ?? 0;
    const isSentinel = rawCatalogMfn > 100;
    const catalogMfnPct = isSentinel ? 0 : (rawCatalogMfn <= 1 ? rawCatalogMfn * 100 : rawCatalogMfn);
    // Only use USITC catalog as fallback when destination IS the US — it's a US-only dataset
    const usMfnFallback = destination_country === "United States"
      ? (liveEntry?.mfn_rate ?? (catalogMfnPct > 0 ? catalogMfnPct : 0))
      : null;
    const baseRetaliationRate = s232Overridden ? 0 : (liveEntry?.retaliation_rate ?? 0);
    const retaliation_rate = baseRetaliationRate + originSpecificRate;
    const retaliation_note = s232Overridden
      ? s232ExemptionNote
      : [liveEntry?.retaliation_note, originSpecificNote].filter(Boolean).join(" | ") || null;
    const resolved_product = liveEntry?.product_name ?? catalog?.description ?? product_name ?? "Goods";
    const data_freshness = liveEntry?.synced_at ?? null;

    // ── 5b. WTO MFN + preferential rate — must run BEFORE effective_rate calculation ──
    // authoritative_mfn = what the DESTINATION country charges (their tariff on our goods)
    // This is the rate the exporter actually pays, not the US domestic rate
    const destWtoCode = WTO_COUNTRY_CODES[destination_country] ?? null;
    const ftaKey = `${destination_country}::${originCountry}`;
    const ftaAgreement = FTA_AGREEMENTS[ftaKey] ?? null;
    const [wtoMfn, wtoPref] = await Promise.all([
      destWtoCode ? getWtoMfnRate(destWtoCode, hs4) : Promise.resolve(null),
      (destWtoCode && ftaAgreement)
        ? getWtoPreferentialRate(destWtoCode, hs4, ftaAgreement)
        : Promise.resolve(null),
    ]);
    // authoritative_mfn: destination country's WTO rate (what they charge everyone)
    // Falls back to US catalog rate only if WTO API has no data for this corridor
    const authoritative_mfn = wtoMfn ?? usMfnFallback;
    const mfn_rate = authoritative_mfn; // alias for readability below

    // Always recompute effective_rate from live WTO MFN + stacked duties.
    // Never use liveEntry.effective_rate — it was calculated at scrape time with mfnRate=0
    // (WTO batch fails) so it only contains the retaliation portion, missing the MFN base.
    const effective_rate = parseFloat(((authoritative_mfn ?? 0) + retaliation_rate).toFixed(2));
    const tariff_cost_today = Math.round(shipment_value * (effective_rate / 100));

    const regulatory_flags = computeRegulatoryFlags(
      originCountry,
      destination_country,
      hs4,
      ftaAgreement,
      shipment_value
    );

    const preferential_rate = wtoPref?.rate ?? null;
    const preferential_saving = (preferential_rate !== null && authoritative_mfn !== null)
      ? Math.round(shipment_value * ((authoritative_mfn - preferential_rate) / 100))
      : null;

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
    // Allies with stable trade relations rarely retaliate; active trade-war countries already have
    const ALLY_COUNTRIES = new Set(["Singapore", "Japan", "Canada", "Australia", "United Kingdom",
      "New Zealand", "South Korea", "Taiwan", "Germany", "France", "Netherlands"]);
    const ACTIVE_DISPUTE_COUNTRIES = new Set(["China", "Russia", "Iran", "Venezuela"]);
    const col2_rate = catalog?.col2_rate ?? 0;

    let retaliation_probability: number;
    if (retaliation_rate > 0) {
      // Already retaliating — probability of further escalation
      retaliation_probability = 0.60;
    } else if (ALLY_COUNTRIES.has(destination_country)) {
      // Stable ally — very low baseline, only if product is genuinely sensitive
      const ally_base = col2_rate > 0.20 ? 0.12 : 0.05;
      retaliation_probability = ally_base;
    } else if (ACTIVE_DISPUTE_COUNTRIES.has(destination_country)) {
      // Active trade disputes — elevated
      const hist_prob = max_jump > 0.05 ? 0.70 : max_jump > 0.02 ? 0.50 : 0.35;
      retaliation_probability = Math.min(0.90, hist_prob + (col2_rate > 0.15 ? 0.15 : 0));
    } else {
      // Neutral/other — moderate based on history
      const hist_prob = max_jump > 0.05 ? 0.40 : max_jump > 0.02 ? 0.25 : 0.12;
      retaliation_probability = Math.min(0.60, hist_prob + (col2_rate > 0.15 ? 0.10 : 0));
    }
    const retaliation_probability_pct = Math.round(retaliation_probability * 100);

    // ── 8. Alternative markets ──
    // Priority: live scraped retaliation data → WTO official MFN rate → exclude
    // Never fall back to the current product's own rate (makes all countries look identical)
    const altCountries = ALL_COUNTRIES.filter(c => c.name !== destination_country);
    const altResults = await Promise.all(
      altCountries.map(async (alt) => {
        // 1. Check live scraped retaliation data first
        const { data: altLive } = await supabase
          .from("tariff_rates")
          .select("effective_rate, mfn_rate, retaliation_rate")
          .eq("hs_code", hs_code.substring(0, 4))
          .eq("destination_country", alt.name)
          .maybeSingle();

        if (altLive) {
          const altRaw = altLive.effective_rate ?? altLive.mfn_rate ?? 0;
          if (altRaw <= 150) {
            return {
              country: alt.name,
              code: alt.code,
              rate: parseFloat(altRaw.toFixed(1)),
              cost: Math.round(shipment_value * (altRaw / 100)),
              retaliation: altLive.retaliation_rate ?? 0,
              saving: tariff_cost_today - Math.round(shipment_value * (altRaw / 100)),
              source: "live",
            };
          }
        }

        // 2. Fall back to WTO official MFN rate for this country
        const wtoCode = WTO_COUNTRY_CODES[alt.name];
        if (wtoCode) {
          const wtoRate = await getWtoMfnRate(wtoCode, hs_code.substring(0, 4));
          if (wtoRate !== null && wtoRate <= 150) {
            return {
              country: alt.name,
              code: alt.code,
              rate: parseFloat(wtoRate.toFixed(1)),
              cost: Math.round(shipment_value * (wtoRate / 100)),
              retaliation: 0,
              saving: tariff_cost_today - Math.round(shipment_value * (wtoRate / 100)),
              source: "wto",
            };
          }
        }

        return null;
      })
    );
    // Filter nulls, sort by rate, take top 3
    const bestAlts = altResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3);

    // ── 9. Scenarios ──
    // Escalation: use real historical max jump if available; otherwise use country-specific risk
    const historicalMaxRate = rateHistory.length > 0 ? Math.max(...rateHistory.map(r => r.rate)) : effective_rate;
    const worstHistoricalJump = historicalMaxRate - effective_rate;
    // Escalation is: worst historical spike OR country-risk bump (25% for dispute countries, 5% for allies)
    const countryEscalationAdder = ACTIVE_DISPUTE_COUNTRIES.has(destination_country) ? 25
      : ALLY_COUNTRIES.has(destination_country) ? 5 : 15;
    const escalationDelta = Math.max(worstHistoricalJump, countryEscalationAdder);
    const escalatedRate = parseFloat(Math.min(effective_rate + escalationDelta, 150).toFixed(1));
    const escalatedCost = Math.round(shipment_value * (escalatedRate / 100));
    const escalationLabel = ACTIVE_DISPUTE_COUNTRIES.has(destination_country)
      ? `+${escalationDelta.toFixed(0)}% retaliatory escalation`
      : ALLY_COUNTRIES.has(destination_country)
      ? `+${escalationDelta.toFixed(0)}% under new trade pressure`
      : `+${escalationDelta.toFixed(0)}% escalation scenario`;
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
        name: `Escalation (${escalationLabel})`,
        description: `If trade tensions rise, rate reaches ${escalatedRate}%. ${volRow?.max_jump_year ? `Worst historical jump was in ${volRow.max_jump_year}.` : ""} Retaliation probability: ${retaliation_probability_pct}%.`,
        tariff_rate: escalatedRate,
        tariff_cost: escalatedCost,
        net_proceeds: shipment_value - escalatedCost,
        severity: escalatedRate >= 25 ? "high" : escalatedRate >= 10 ? "medium" : "low",
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
Origin: ${originCountry}
Destination: ${destination_country}
Shipment value: $${shipment_value.toLocaleString()}${incoterms ? `\nIncoterms: ${incoterms}` : ""}${quantity ? `\nQuantity: ${quantity}` : ""}
MFN duty (${destination_country} WTO rate): ${(mfn_rate)}%
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
            content: `You are a senior international trade advisor specializing in tariff analysis. You combine live tariff data with 29-year historical patterns to give precise, dollar-quantified advice on the shipment corridor ${originCountry} → ${destination_country}. Focus on what ${destination_country} charges on this product, any retaliatory or additional duties, and the best alternatives. Be direct. Use specific numbers. Max 120 words per section.`,
          },
          {
            role: "user",
            content: `Based on this shipment data (${originCountry} → ${destination_country}) — including 29 years of rate history and live scraped tariff data — write:

1. RISK_SUMMARY (2-3 sentences): What is ${destination_country}'s current duty rate on this product from ${originCountry}? Explain the MFN rate, any retaliatory or additional duties in force, and the dollar cost. Reference historical rate pattern if relevant.

2. RECOMMENDATION (1-2 sentences): One specific action with dollar savings quantified. Be direct.

3. PREDICTION (2 sentences): Based on the historical rate pattern for this corridor and current trade climate, what is likely to happen to this rate in the next 6-12 months?

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
      origin_country: originCountry,
      destination_country,
      shipment_value,
      mfn_rate: authoritative_mfn,
      retaliation_rate,
      effective_rate,
      retaliation_note,
      origin_specific_rate: originSpecificRate > 0 ? originSpecificRate : null,
      origin_specific_note: originSpecificNote,
      section_232_exempt: s232Overridden ? true : null,
      section_232_note: s232ExemptionNote,
      sanctions_alert: false,
      tariff_cost_today,
      // WTO preferential rate for this exact origin→destination corridor
      preferential_rate,
      preferential_saving,
      preferential_note: wtoPref ? `${ftaAgreement} preferential rate — ${originCountry} qualifies as FTA partner (WTO HS_A_0020)` : null,
      scenarios,
      risk_score,
      risk_label,
      retaliation_probability: retaliation_probability_pct,
      rate_history: rateHistory,
      alternative_markets: bestAlts,
      volatility_stats: volRow ? {
        volatility: volRow.volatility,
        max_year_jump: Math.min((volRow.max_year_jump ?? 0) * 100, 150),
        max_jump_year: volRow.max_jump_year,
        avg_rate: Math.min((volRow.avg_rate ?? 0) * 100, 150),
        max_rate: Math.min((volRow.max_rate ?? 0) * 100, 150),
      } : null,
      regulatory_flags,
      risk_summary: aiOutput.risk_summary,
      recommendation: aiOutput.recommendation,
      prediction: aiOutput.prediction,
      data_source: "USITC HTS 1998–2026 (262k rows) + WTO Official API + Live scraped retaliation data",
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
