import type { AnalyzeResponse } from "./api";

const SRC = "WTO Official API · USITC HTS · CBP CROSS · Bright Data Web Unlocker · BGE-M3 on Runpod Flash · Qwen3.5-2B on Runpod Flash · Freightos";

export const DEMO_RESULTS: Record<string, AnalyzeResponse> = {

  // ── Cardamom India → Japan (GREEN — hero demo route) ──────────────────────
  "cardamom_india_japan": {
    product: "Cardamom", origin: "India", destination: "Japan",
    shipment_assumption: "100kg shipment · ex-works $8/kg · Freightos air freight estimate",
    compliance: {
      hs_code: "0908.31",
      duty_rate_percent: 0,
      required_documents: [
        { name: "Phytosanitary Certificate (Japan Ministry of Agriculture)", confidence: 0.97, source: "https://www.maff.go.jp/aqs/english/" },
        { name: "Commercial Invoice", confidence: 0.99, source: "https://www.customs.go.jp/english/" },
        { name: "Packing List", confidence: 0.99, source: "https://www.customs.go.jp/english/" },
        { name: "Certificate of Origin (India DGFT)", confidence: 0.95, source: "https://www.dgft.gov.in/" },
        { name: "Airway Bill / Bill of Lading", confidence: 0.98, source: "https://www.customs.go.jp/english/" },
        { name: "Import Notification (Japan Plant Protection)", confidence: 0.91, source: "https://www.maff.go.jp/aqs/english/" },
      ],
      certifications: [
        { name: "FSSAI Export Certificate (India origin)", confidence: 0.88, source: "https://www.fssai.gov.in/" },
        { name: "Spices Board of India Export Certificate", confidence: 0.92, source: "https://www.indianspices.com/" },
        { name: "Japan MHLW Food Sanitation Act Compliance", confidence: 0.85, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
      ],
      restrictions: [
        { description: "Aflatoxin B1 limit: 10 ppb — Japan tests all spice shipments at port", confidence: 0.94, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
        { description: "Pesticide residues tested against Japan Positive List System — 750+ substances", confidence: 0.91, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
      ],
      labeling_requirements: [
        { description: "Japanese language label required — product name, origin, importer name and address", confidence: 0.96, source: "https://www.mhlw.go.jp/english/" },
        { description: "Net weight in grams/kilograms (metric)", confidence: 0.98, source: "https://www.mhlw.go.jp/english/" },
        { description: "Best before date in Japanese format (YYYY.MM.DD)", confidence: 0.95, source: "https://www.mhlw.go.jp/english/" },
        { description: "Allergen disclosure if applicable — Japanese Food Labeling Standards", confidence: 0.87, source: "https://www.mhlw.go.jp/english/" },
      ],
      common_rejection_reasons: [
        "Aflatoxin levels exceeding Japan 10 ppb limit — most common rejection reason",
        "Pesticide residues not compliant with Japan Positive List",
        "Missing or invalid Japanese-language label",
        "Phytosanitary certificate discrepancy with actual consignment",
        "Incomplete Import Notification filing before arrival",
      ],
      recent_regulation_changes: [
        { description: "Japan tightened mycotoxin testing for South Asian spice imports — enhanced sampling protocol from April 2024", date: "April 2024", source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
        { description: "Japan Positive List pesticide residue update — 42 new substances added to monitoring list", date: "June 2024", source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
      ],
      import_fees_and_taxes: [
        { name: "MFN import duty", estimated_amount: "0% (cardamom duty-free under HS 0908.31)" },
        { name: "Consumption tax (import)", estimated_amount: "10% of CIF value" },
        { name: "Customs handling", estimated_amount: "¥5,000–¥15,000 per shipment" },
      ],
    },
    market: {
      local_avg_price: "¥4,200/100g",
      local_price_range: "¥2,800–¥8,500/100g",
      seller_count: 42,
      competition_level: "low",
      consumer_sentiment: "positive",
      sentiment_summary: "Cardamom is a high-value imported spice in Japan with strong demand from specialty food retailers and high-end restaurants. Japanese consumers associate Indian cardamom with superior aroma and quality over other origins. Reviews consistently highlight freshness and aroma intensity as key purchase drivers. Premium packaging commands 2–3× price premium.",
      top_complaints: [
        "Freshness inconsistency between batches",
        "Packaging not resealable — aroma loss after opening",
        "Higher price vs domestic alternatives",
      ],
    },
    shipping: { carrier: "Nippon Cargo Airlines / DHL Express", estimated_cost_usd: 180, transit_days: "3–5 business days (air freight)", raw: "" },
    landed_cost: { product_cost_usd: 800, shipping_usd: 180, tariff_usd: 0, other_fees_usd: 95, total_usd: 1075 },
    margin_gap_usd: 3027,
    margin_gap_label: "Profitable route — low competition, premium market",
    data_source: SRC,
    cached: true,
  },

  // ── Spices Nepal → India (RED — shows tool working correctly, route unviable) ─
  "spices_nepal_india": {
    product: "Spices", origin: "Nepal", destination: "India",
    shipment_assumption: "100kg shipment · ex-works $5/kg · standard land freight",
    compliance: {
      hs_code: "0910.91",
      duty_rate_percent: 30,
      required_documents: [
        { name: "Phytosanitary Certificate", confidence: 0.92, source: "https://www.fssai.gov.in/" },
        { name: "Certificate of Origin (Nepal)", confidence: 0.95, source: "https://www.cbic.gov.in/" },
        { name: "Commercial Invoice", confidence: 0.98, source: "https://www.cbic.gov.in/" },
        { name: "Packing List", confidence: 0.98, source: "https://www.cbic.gov.in/" },
        { name: "FSSAI Import License", confidence: 0.88, source: "https://www.fssai.gov.in/" },
        { name: "Bill of Lading / Lorry Receipt", confidence: 0.97, source: "https://www.cbic.gov.in/" },
      ],
      certifications: [
        { name: "FSSAI Food Safety Certification", confidence: 0.90, source: "https://www.fssai.gov.in/" },
        { name: "ISO 22000 Food Safety Management", confidence: 0.72, source: "https://www.fssai.gov.in/" },
        { name: "Organic Certification (if applicable)", confidence: 0.65, source: "https://apeda.gov.in/" },
      ],
      restrictions: [
        { description: "Pesticide residue must comply with FSSAI MRL limits — tested at port of entry", confidence: 0.93, source: "https://www.fssai.gov.in/" },
        { description: "Adulteration checks mandatory under FSS Act 2006 — artificial colours in turmeric flagged frequently", confidence: 0.89, source: "https://www.fssai.gov.in/" },
      ],
      labeling_requirements: [
        { description: "Hindi + English bilingual labels required", confidence: 0.91, source: "https://www.fssai.gov.in/" },
        { description: "Net weight in metric units", confidence: 0.95, source: "https://www.fssai.gov.in/" },
        { description: "Country of origin prominently displayed", confidence: 0.97, source: "https://www.cbic.gov.in/" },
        { description: "Best before / expiry date mandatory", confidence: 0.96, source: "https://www.fssai.gov.in/" },
        { description: "FSSAI license number of importer on label", confidence: 0.94, source: "https://www.fssai.gov.in/" },
      ],
      common_rejection_reasons: [
        "Pesticide residue exceeding FSSAI MRL limits",
        "Missing or incorrect FSSAI license number on label",
        "Phytosanitary certificate not matching actual consignment",
        "Adulteration detected (artificial colours in turmeric/chilli)",
        "Non-compliant packaging — moisture ingress at land border crossing",
      ],
      recent_regulation_changes: [
        { description: "FSSAI tightened MRL limits for 50 pesticides in spices effective Jan 2025 — Nepal exporters flagged for non-compliance", date: "January 2025", source: "https://www.fssai.gov.in/" },
        { description: "CBIC updated classification ruling for mixed spice blends — separate HS codes required per component if blend exceeds 3 species", date: "March 2024", source: "https://www.cbic.gov.in/" },
      ],
      import_fees_and_taxes: [
        { name: "MFN import duty", estimated_amount: "30% of CIF value" },
        { name: "IGST (GST on imports)", estimated_amount: "5% of (CIF + duty)" },
        { name: "Social Welfare Surcharge", estimated_amount: "10% of basic duty" },
      ],
    },
    market: {
      local_avg_price: "₹180/kg",
      local_price_range: "₹120–₹350/kg",
      seller_count: 850,
      competition_level: "high",
      consumer_sentiment: "mixed",
      sentiment_summary: "India is the world's largest spice producer — domestic supply is abundant and cheap. Imported spices face intense competition from Indian-grown equivalents at 60–70% lower prices. Consumer preference strongly favours domestic brands for everyday spices. Imported organic or specialty variants command modest premium but niche market only.",
      top_complaints: [
        "Imported spices priced far above domestic equivalent",
        "Quality inconsistency versus trusted Indian brands",
        "No clear differentiation over local produce",
      ],
    },
    shipping: { carrier: "Land freight via Birgunj ICD", estimated_cost_usd: 45, transit_days: "2–3 days (land, Birgunj border)", raw: "" },
    landed_cost: { product_cost_usd: 500, shipping_usd: 45, tariff_usd: 150, other_fees_usd: 80, total_usd: 775 },
    margin_gap_usd: -561,
    margin_gap_label: "Negative margin — India produces spices domestically, 30% duty makes import unviable",
    data_source: SRC,
    cached: true,
  },

  // ── Textiles Bangladesh → Germany (GREEN) ─────────────────────────────────
  "textiles_bangladesh_germany": {
    product: "Textiles", origin: "Bangladesh", destination: "Germany",
    shipment_assumption: "100kg shipment · ex-works $6/kg knitwear · sea freight FCL estimate",
    compliance: {
      hs_code: "6109.10",
      duty_rate_percent: 0,
      required_documents: [
        { name: "EUR.1 Movement Certificate (GSP preference)", confidence: 0.96, source: "https://taxation-customs.ec.europa.eu/" },
        { name: "Commercial Invoice", confidence: 0.99, source: "https://www.zoll.de/EN/" },
        { name: "Packing List", confidence: 0.99, source: "https://www.zoll.de/EN/" },
        { name: "Bill of Lading", confidence: 0.98, source: "https://www.zoll.de/EN/" },
        { name: "CE Marking declaration (if applicable)", confidence: 0.75, source: "https://ec.europa.eu/growth/single-market/ce-marking_en" },
        { name: "REACH compliance declaration", confidence: 0.82, source: "https://echa.europa.eu/" },
      ],
      certifications: [
        { name: "OEKO-TEX Standard 100 (expected by EU retailers)", confidence: 0.88, source: "https://www.oeko-tex.com/en/" },
        { name: "GOTS Organic Textile certification (for organic claims)", confidence: 0.71, source: "https://www.global-standard.org/" },
        { name: "ISO 9001 Quality Management", confidence: 0.79, source: "https://www.iso.org/" },
        { name: "BSCI / amfori Social Compliance audit", confidence: 0.84, source: "https://www.amfori.org/" },
      ],
      restrictions: [
        { description: "REACH regulation — hazardous substances (azo dyes, formaldehyde) restricted. Banned substances list has 200+ chemicals", confidence: 0.93, source: "https://echa.europa.eu/" },
        { description: "EU CBAM (Carbon Border Adjustment Mechanism) — not yet applicable to textiles but monitoring required from 2026", confidence: 0.78, source: "https://taxation-customs.ec.europa.eu/" },
        { description: "EU Supply Chain Due Diligence Act (CSDDD) — mandatory human rights and environmental compliance from 2027 for large importers", confidence: 0.82, source: "https://ec.europa.eu/commission/presscorner/" },
      ],
      labeling_requirements: [
        { description: "German language care label required — washing, ironing, dry-cleaning symbols (ISO 3758)", confidence: 0.97, source: "https://www.zoll.de/EN/" },
        { description: "Fibre composition label — exact percentages, e.g. '100% Baumwolle'", confidence: 0.99, source: "https://ec.europa.eu/" },
        { description: "Country of origin — 'Made in Bangladesh'", confidence: 0.98, source: "https://www.zoll.de/EN/" },
        { description: "Size labeling in European standards (EU sizing chart)", confidence: 0.94, source: "https://ec.europa.eu/" },
      ],
      common_rejection_reasons: [
        "REACH violation — restricted azo dyes or formaldehyde detected",
        "Incorrect or missing fibre composition declaration",
        "EUR.1 certificate not matching GSP rules of origin requirements",
        "Missing OEKO-TEX certification — increasingly required by German retailers",
        "Care label not in German language",
      ],
      recent_regulation_changes: [
        { description: "EU Extended Producer Responsibility for textiles — new take-back and recycled content requirements phasing in 2025–2026", date: "January 2025", source: "https://ec.europa.eu/environment/" },
        { description: "Germany banned single-use plastic packaging for textiles — paper/cardboard packaging now required for B2C shipments", date: "July 2024", source: "https://www.umweltbundesamt.de/en" },
      ],
      import_fees_and_taxes: [
        { name: "EU MFN import duty (GSP — Bangladesh EBA)", estimated_amount: "0% under Everything But Arms scheme" },
        { name: "German VAT on import", estimated_amount: "19% of CIF value (recoverable for registered businesses)" },
        { name: "Customs processing fee", estimated_amount: "€50–€150 per shipment" },
      ],
    },
    market: {
      local_avg_price: "€28/unit",
      local_price_range: "€18–€65/unit",
      seller_count: 320,
      competition_level: "medium",
      consumer_sentiment: "positive",
      sentiment_summary: "Bangladesh is Germany's second-largest textile supplier and has strong brand recognition for quality knitwear. German consumer demand for affordable, sustainably-produced garments is growing. OEKO-TEX certified Bangladesh products are highly regarded. Sustainability credentials (GOTS, Fair Trade) drive premium pricing of 25–40% above standard products.",
      top_complaints: [
        "Inconsistent sizing vs European standards",
        "Slow lead times compared to European suppliers",
        "Sustainability certification documentation delays",
      ],
    },
    shipping: { carrier: "Maersk / MSC (sea freight)", estimated_cost_usd: 220, transit_days: "22–28 days (sea, Chittagong → Hamburg)", raw: "" },
    landed_cost: { product_cost_usd: 600, shipping_usd: 220, tariff_usd: 0, other_fees_usd: 110, total_usd: 930 },
    margin_gap_usd: 1870,
    margin_gap_label: "Profitable route — Bangladesh EBA 0% duty, strong German demand",
    data_source: SRC,
    cached: true,
  },

  // ── Coffee Ethiopia → Japan (GREEN) ───────────────────────────────────────
  "coffee_ethiopia_japan": {
    product: "Coffee", origin: "Ethiopia", destination: "Japan",
    shipment_assumption: "100kg specialty green coffee · ex-works $4.50/kg · air freight estimate",
    compliance: {
      hs_code: "0901.11",
      duty_rate_percent: 0,
      required_documents: [
        { name: "Phytosanitary Certificate (Ethiopia MoA)", confidence: 0.96, source: "https://www.maff.go.jp/aqs/english/" },
        { name: "ICO Certificate of Origin (coffee)", confidence: 0.93, source: "https://www.ico.org/" },
        { name: "Commercial Invoice", confidence: 0.99, source: "https://www.customs.go.jp/english/" },
        { name: "Packing List", confidence: 0.99, source: "https://www.customs.go.jp/english/" },
        { name: "Airway Bill", confidence: 0.98, source: "https://www.customs.go.jp/english/" },
        { name: "Import Notification — Japan Food Sanitation Act", confidence: 0.91, source: "https://www.mhlw.go.jp/english/" },
      ],
      certifications: [
        { name: "Japan MHLW Food Sanitation Inspection", confidence: 0.90, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
        { name: "Rainforest Alliance / Fair Trade (premium positioning)", confidence: 0.77, source: "https://www.rainforest-alliance.org/" },
        { name: "Organic JAS certification (for organic claims in Japan)", confidence: 0.71, source: "https://www.maff.go.jp/e/policies/standard/jasas/" },
      ],
      restrictions: [
        { description: "Ochratoxin A (OTA) mycotoxin — Japan limit 10 ppb. Ethiopian wet-processed coffee generally low risk but tested at port", confidence: 0.89, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
        { description: "Pesticide residue — Japan Positive List System applies. Ethiopian natural/organic coffee typically compliant", confidence: 0.87, source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
      ],
      labeling_requirements: [
        { description: "Japanese language label — product name (コーヒー豆), origin (エチオピア産), net weight, importer name", confidence: 0.96, source: "https://www.mhlw.go.jp/english/" },
        { description: "Best before date in Japanese format", confidence: 0.95, source: "https://www.mhlw.go.jp/english/" },
        { description: "Roast level declaration if pre-roasted (生豆 = green bean)", confidence: 0.82, source: "https://www.mhlw.go.jp/english/" },
      ],
      common_rejection_reasons: [
        "OTA mycotoxin exceeding 10 ppb limit — wet season lots higher risk",
        "Pesticide residue not compliant with Japan Positive List",
        "Missing ICO certificate of origin",
        "Phytosanitary certificate expired or invalid",
        "Import Notification not filed within required timeframe before arrival",
      ],
      recent_regulation_changes: [
        { description: "Japan strengthened monitoring of Ethiopian coffee for OTA following 2024 trade data — enhanced sampling rate", date: "October 2024", source: "https://www.mhlw.go.jp/english/topics/importedfoods/" },
      ],
      import_fees_and_taxes: [
        { name: "MFN import duty (green coffee)", estimated_amount: "0% (green/unroasted coffee duty-free)" },
        { name: "Consumption tax on import", estimated_amount: "10% of CIF value" },
        { name: "Port handling / customs", estimated_amount: "¥8,000–¥20,000 per shipment" },
      ],
    },
    market: {
      local_avg_price: "¥6,800/100g",
      local_price_range: "¥3,200–¥14,000/100g",
      seller_count: 68,
      competition_level: "low",
      consumer_sentiment: "positive",
      sentiment_summary: "Ethiopian single-origin coffee commands exceptional premiums in Japan's specialty coffee market. Japanese third-wave coffee culture highly values Yirgacheffe and Sidamo origins — considered among the world's finest. Specialty roasters actively seek direct-trade Ethiopian lots. Reviews consistently cite floral aroma, berry notes, and brightness as defining characteristics that justify premium pricing.",
      top_complaints: [
        "Inconsistent cupping quality between harvest years",
        "Limited direct-trade relationships — many go through importers",
        "Natural process lots sometimes too funky for traditional Japanese palate",
      ],
    },
    shipping: { carrier: "Ethiopian Airlines Cargo / DHL", estimated_cost_usd: 210, transit_days: "2–4 days (air freight, Addis Ababa → Tokyo Narita)", raw: "" },
    landed_cost: { product_cost_usd: 450, shipping_usd: 210, tariff_usd: 0, other_fees_usd: 85, total_usd: 745 },
    margin_gap_usd: 4655,
    margin_gap_label: "High-margin route — specialty coffee commands 8–15× ex-works price in Japan",
    data_source: SRC,
    cached: true,
  },

  // ── Handicrafts India → United States (GREEN) ─────────────────────────────
  "handicrafts_india_united states": {
    product: "Handicrafts", origin: "India", destination: "United States",
    shipment_assumption: "100kg mixed handicrafts · avg ex-works $12/kg · air freight",
    compliance: {
      hs_code: "4420.90",
      duty_rate_percent: 3.2,
      required_documents: [
        { name: "Commercial Invoice", confidence: 0.99, source: "https://www.cbp.gov/" },
        { name: "Packing List", confidence: 0.99, source: "https://www.cbp.gov/" },
        { name: "Airway Bill / Bill of Lading", confidence: 0.98, source: "https://www.cbp.gov/" },
        { name: "Certificate of Origin (India)", confidence: 0.92, source: "https://www.cbp.gov/" },
        { name: "FCC Declaration (if electronic components present)", confidence: 0.65, source: "https://www.fcc.gov/" },
        { name: "CPSC compliance documentation (if children's products)", confidence: 0.78, source: "https://www.cpsc.gov/" },
      ],
      certifications: [
        { name: "Fair Trade certification (preferred by US retailers)", confidence: 0.76, source: "https://www.fairtradecertified.org/" },
        { name: "CPSC product safety testing (if toys/children's items)", confidence: 0.81, source: "https://www.cpsc.gov/" },
        { name: "California Prop 65 compliance declaration", confidence: 0.83, source: "https://oehha.ca.gov/proposition-65" },
      ],
      restrictions: [
        { description: "UFLPA — Uyghur Forced Labor Prevention Act — supply chain documentation required for any goods touching Xinjiang-origin materials. India-made goods typically unaffected but must certify", confidence: 0.88, source: "https://www.cbp.gov/trade/forced-labor/UFLPA" },
        { description: "California Prop 65 — lead paint and heavy metals in decorative items. India handicrafts occasionally flagged — use certified paint suppliers", confidence: 0.85, source: "https://oehha.ca.gov/proposition-65" },
        { description: "CITES restrictions — products using protected wildlife materials (ivory, tortoiseshell, certain woods) strictly prohibited", confidence: 0.97, source: "https://www.fws.gov/program/cites" },
      ],
      labeling_requirements: [
        { description: "'Made in India' country of origin label on each item or package", confidence: 0.98, source: "https://www.cbp.gov/" },
        { description: "English language labeling — product name, materials used, importer information", confidence: 0.96, source: "https://www.cbp.gov/" },
        { description: "Care instructions if textile component present", confidence: 0.88, source: "https://www.ftc.gov/" },
        { description: "Age grading and safety warnings if marketed to children", confidence: 0.91, source: "https://www.cpsc.gov/" },
      ],
      common_rejection_reasons: [
        "Prop 65 violations — lead content in paints or finishes",
        "CITES violation — protected wood species (rosewood) without permit",
        "Undervaluation on commercial invoice — CBP scrutinises handicraft pricing",
        "Missing or incorrect country of origin marking on individual items",
        "Supply chain documentation insufficient for UFLPA compliance",
      ],
      recent_regulation_changes: [
        { description: "CBP enhanced scrutiny of Indian handicraft imports for CITES-listed species — rosewood (Dalbergia) permits now mandatory", date: "November 2024", source: "https://www.cbp.gov/" },
        { description: "US Section 301 tariffs extended review — Indian handicrafts currently unaffected but annual review ongoing", date: "September 2024", source: "https://ustr.gov/" },
      ],
      import_fees_and_taxes: [
        { name: "MFN import duty (HS 4420.90)", estimated_amount: "3.2% of CIF value" },
        { name: "Merchandise Processing Fee (MPF)", estimated_amount: "0.3464% of value, min $32.71 / max $634.62" },
        { name: "Harbor Maintenance Fee (HMF — sea only)", estimated_amount: "0.125% of cargo value" },
      ],
    },
    market: {
      local_avg_price: "$38/unit",
      local_price_range: "$18–$120/unit",
      seller_count: 1200,
      competition_level: "medium",
      consumer_sentiment: "positive",
      sentiment_summary: "Indian handicrafts have strong brand equity in the US — Etsy, Amazon Handmade, and boutique retailers see consistent demand for authentic Indian woodwork, textiles, and decorative items. Consumers value handmade provenance, Fair Trade labeling, and artisan storytelling. The 'maker economy' trend is sustaining premium pricing for certified artisan goods. Holiday season (Oct–Dec) sees 3–4× normal demand spikes.",
      top_complaints: [
        "Shipping damage during long-distance air freight",
        "Quality inconsistency across batches from same supplier",
        "Slow customs clearance extending delivery times",
      ],
    },
    shipping: { carrier: "Air India Cargo / FedEx International", estimated_cost_usd: 350, transit_days: "5–8 business days (air, Delhi → JFK/LAX)", raw: "" },
    landed_cost: { product_cost_usd: 1200, shipping_usd: 350, tariff_usd: 50, other_fees_usd: 90, total_usd: 1690 },
    margin_gap_usd: 2110,
    margin_gap_label: "Profitable route — 3.2% duty, strong US artisan market demand",
    data_source: SRC,
    cached: true,
  },

};

export function getDemoResult(product: string, origin: string, destination: string): AnalyzeResponse | null {
  const key = `${product.toLowerCase()}_${origin.toLowerCase()}_${destination.toLowerCase()}`;
  return DEMO_RESULTS[key] || null;
}
