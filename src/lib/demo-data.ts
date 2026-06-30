import type { AnalyzeResponse } from "./api";

export const DEMO_RESULTS: Record<string, AnalyzeResponse> = {
  "spices_nepal_india": {
    product: "Spices", origin: "Nepal", destination: "India",
    compliance: {
      hs_code: "0910.91",
      duty_rate_percent: 30,
      required_documents: [
        { name: "Phytosanitary Certificate", confidence: 0.92, source: "https://www.fssai.gov.in/" },
        { name: "Certificate of Origin (Nepal)", confidence: 0.95, source: "https://www.cbic.gov.in/" },
        { name: "Commercial Invoice", confidence: 0.98, source: "https://www.cbic.gov.in/" },
        { name: "Packing List", confidence: 0.98, source: "https://www.cbic.gov.in/" },
        { name: "FSSAI Import License", confidence: 0.88, source: "https://www.fssai.gov.in/" },
      ],
      certifications: [
        { name: "FSSAI Food Safety Certification", confidence: 0.90, source: "https://www.fssai.gov.in/" },
        { name: "ISO 22000 Food Safety Management", confidence: 0.72, source: "https://www.fssai.gov.in/" },
        { name: "Organic Certification (if applicable)", confidence: 0.65, source: "https://apeda.gov.in/" },
      ],
      restrictions: [
        { description: "Pesticide residue must comply with FSSAI MRL limits — tested at port of entry", confidence: 0.93, source: "https://www.fssai.gov.in/" },
        { description: "Adulteration checks mandatory for all spice imports under FSS Act 2006", confidence: 0.89, source: "https://www.fssai.gov.in/" },
      ],
      labeling_requirements: [
        { description: "Hindi + English bilingual labels required", confidence: 0.91, source: "https://www.fssai.gov.in/" },
        { description: "Net weight in metric units", confidence: 0.95, source: "https://www.fssai.gov.in/" },
        { description: "Country of origin prominently displayed", confidence: 0.97, source: "https://www.cbic.gov.in/" },
        { description: "Best before / expiry date mandatory", confidence: 0.96, source: "https://www.fssai.gov.in/" },
      ],
      common_rejection_reasons: [
        "Pesticide residue exceeding FSSAI MRL limits",
        "Missing or incorrect FSSAI license number on label",
        "Adulteration detected (e.g. artificial colours in turmeric)",
        "Phytosanitary certificate not matching consignment",
      ],
      recent_regulation_changes: [
        { description: "FSSAI tightened MRL limits for 50 pesticides in spices effective Jan 2025", date: "January 2025", source: "https://www.fssai.gov.in/" },
        { description: "SAFTA preferential rate available at 0% for eligible Nepali exporters", date: "March 2024", source: "https://www.cbic.gov.in/" },
      ],
      import_fees_and_taxes: [
        { name: "Basic Customs Duty (BCD)", estimated_amount: "30%" },
        { name: "IGST (Integrated GST)", estimated_amount: "5%" },
        { name: "Social Welfare Surcharge", estimated_amount: "10% of BCD" },
        { name: "FSSAI inspection fee", estimated_amount: "~₹5,000–15,000 per consignment" },
      ],
    },
    market: {
      local_avg_price: "₹320/kg",
      local_price_range: "₹180–₹650/kg",
      seller_count: 2847,
      competition_level: "high",
      consumer_sentiment: "positive",
      sentiment_summary: "Indian consumers strongly prefer whole spices over ground, citing freshness and adulteration concerns. Nepali mountain-origin spices (cardamom, timur pepper, turmeric) command a 15–25% premium on BigBasket and Amazon.in due to perceived purity.",
      top_complaints: [
        "Adulteration concerns with imported ground spices",
        "Packaging quality — moisture and staleness complaints",
        "Inconsistent aroma/potency batch to batch",
      ],
    },
    shipping: {
      carrier: "Land freight via Raxaul-Birgunj border crossing",
      estimated_cost_usd: 180,
      transit_days: "2–4 days",
      raw: "",
    },
    landed_cost: {
      product_cost_usd: 500,
      shipping_usd: 180,
      tariff_usd: 150,
      other_fees_usd: 50,
      total_usd: 880,
    },
    margin_gap_usd: 504,
    margin_gap_label: "Profitable — target premium segment (mountain-origin, whole spices)",
    data_source: "Bright Data: BigBasket.com, Amazon.in · Regs: fssai.gov.in, cbic.gov.in · Shipping: Freightos · AI: Qwen3.5-2B on Runpod Flash",
    cached: true,
  },

  "textiles_bangladesh_germany": {
    product: "Textiles", origin: "Bangladesh", destination: "Germany",
    compliance: {
      hs_code: "5208.21",
      duty_rate_percent: 12,
      required_documents: [
        { name: "EUR.1 Movement Certificate (GSP)", confidence: 0.94, source: "https://ec.europa.eu/taxation_customs/" },
        { name: "Certificate of Origin", confidence: 0.97, source: "https://ec.europa.eu/" },
        { name: "REACH Compliance Declaration", confidence: 0.85, source: "https://echa.europa.eu/" },
        { name: "Commercial Invoice + Packing List", confidence: 0.99, source: "https://www.zoll.de/" },
      ],
      certifications: [
        { name: "OEKO-TEX Standard 100 (strongly recommended)", confidence: 0.88, source: "https://www.oeko-tex.com/" },
        { name: "GOTS Organic Textile Standard (if organic)", confidence: 0.75, source: "https://global-standard.org/" },
      ],
      restrictions: [
        { description: "Azo dyes banned under EU Directive 2002/61/EC", confidence: 0.96, source: "https://echa.europa.eu/" },
        { description: "REACH SVHC substance restrictions apply to all textiles", confidence: 0.93, source: "https://echa.europa.eu/" },
      ],
      labeling_requirements: [
        { description: "German language mandatory on care labels", confidence: 0.97, source: "https://www.zoll.de/" },
        { description: "Fibre composition required (EU Textile Regulation 1007/2011)", confidence: 0.99, source: "https://ec.europa.eu/" },
        { description: "Country of origin: 'Made in Bangladesh'", confidence: 0.98, source: "https://ec.europa.eu/" },
      ],
      common_rejection_reasons: [
        "Azo dye compounds exceeding EU limits",
        "Missing EUR.1 for GSP preferential rate",
        "Incorrect fibre content labeling",
        "SVHC substances above REACH thresholds",
      ],
      recent_regulation_changes: [
        { description: "EU Green Deal — Extended Producer Responsibility for textiles from 2025", date: "2025", source: "https://ec.europa.eu/" },
      ],
      import_fees_and_taxes: [
        { name: "EU Common Customs Duty", estimated_amount: "12%" },
        { name: "VAT (German)", estimated_amount: "19%" },
        { name: "GSP reduced rate (with EUR.1)", estimated_amount: "0%" },
      ],
    },
    market: {
      local_avg_price: "€18/meter",
      local_price_range: "€8–€45/meter",
      seller_count: 5200,
      competition_level: "high",
      consumer_sentiment: "mixed",
      sentiment_summary: "German consumers are increasingly sustainability-conscious. Bangladeshi textiles face perception challenges around worker conditions, but OEKO-TEX certified products see strong uptake in eco-conscious retailer channels like Zalando and Otto.",
      top_complaints: [
        "Sustainability / ethical sourcing concerns",
        "Inconsistent sizing vs German standards",
        "Slower delivery compared to EU suppliers",
      ],
    },
    shipping: {
      carrier: "Hapag-Lloyd / MSC — Chittagong → Hamburg",
      estimated_cost_usd: 1200,
      transit_days: "18–22 days",
      raw: "",
    },
    landed_cost: {
      product_cost_usd: 2000,
      shipping_usd: 1200,
      tariff_usd: 240,
      other_fees_usd: 150,
      total_usd: 3590,
    },
    margin_gap_usd: 580,
    margin_gap_label: "Marginal — get EUR.1 certificate to unlock 0% GSP rate and improve margin by ~$240",
    data_source: "Bright Data: Zalando.de, Otto.de · Regs: ec.europa.eu, echa.europa.eu · Shipping: Freightos · AI: Qwen3.5-2B on Runpod Flash",
    cached: true,
  },

  "coffee_ethiopia_japan": {
    product: "Coffee", origin: "Ethiopia", destination: "Japan",
    compliance: {
      hs_code: "0901.11",
      duty_rate_percent: 20,
      required_documents: [
        { name: "Phytosanitary Certificate", confidence: 0.97, source: "https://www.customs.go.jp/" },
        { name: "Certificate of Origin", confidence: 0.96, source: "https://www.customs.go.jp/" },
        { name: "Import Notification (Ministry of Health)", confidence: 0.91, source: "https://www.mhlw.go.jp/" },
        { name: "Commercial Invoice", confidence: 0.99, source: "https://www.customs.go.jp/" },
      ],
      certifications: [
        { name: "JAS Organic Certification (premium pricing)", confidence: 0.82, source: "https://www.maff.go.jp/" },
        { name: "Rainforest Alliance / Fairtrade", confidence: 0.80, source: "https://www.rainforest-alliance.org/" },
      ],
      restrictions: [
        { description: "Pesticide residue must comply with Japan positive list — 799 regulated substances", confidence: 0.95, source: "https://www.mhlw.go.jp/" },
        { description: "Ochratoxin A (mycotoxin) limit: 10 ppb for all coffee", confidence: 0.90, source: "https://www.mhlw.go.jp/" },
      ],
      labeling_requirements: [
        { description: "Japanese language label required by Food Labeling Act", confidence: 0.99, source: "https://www.caa.go.jp/" },
        { description: "Country of origin and roasting date", confidence: 0.97, source: "https://www.caa.go.jp/" },
        { description: "Net weight in grams", confidence: 0.98, source: "https://www.caa.go.jp/" },
      ],
      common_rejection_reasons: [
        "Pesticide residues exceeding Japan positive list limits",
        "Ochratoxin A above 10 ppb",
        "Label not in Japanese",
        "Incomplete phytosanitary documentation",
      ],
      recent_regulation_changes: [
        { description: "Japan lowered ochratoxin A limit to 10 ppb for coffee effective April 2024", date: "April 2024", source: "https://www.mhlw.go.jp/" },
      ],
      import_fees_and_taxes: [
        { name: "Basic customs duty (green coffee)", estimated_amount: "20%" },
        { name: "Consumption Tax (JCT)", estimated_amount: "10%" },
        { name: "Port handling fees", estimated_amount: "~¥15,000/shipment" },
      ],
    },
    market: {
      local_avg_price: "¥3,200/250g",
      local_price_range: "¥800–¥8,500/250g",
      seller_count: 3100,
      competition_level: "medium",
      consumer_sentiment: "positive",
      sentiment_summary: "Japanese specialty coffee market is booming. Ethiopian single-origin (Yirgacheffe, Sidamo) commands strong premium on Rakuten and Amazon.co.jp. Third-wave coffee culture drives demand for natural process and washed varieties with clear origin stories.",
      top_complaints: [
        "Freshness — long shipping time impacts aroma",
        "Price premium vs Brazilian or Vietnamese coffee",
        "Inconsistent roast profiles from smaller exporters",
      ],
    },
    shipping: {
      carrier: "Evergreen / ONE — Djibouti → Osaka",
      estimated_cost_usd: 890,
      transit_days: "22–28 days",
      raw: "",
    },
    landed_cost: {
      product_cost_usd: 1500,
      shipping_usd: 890,
      tariff_usd: 300,
      other_fees_usd: 120,
      total_usd: 2810,
    },
    margin_gap_usd: 1890,
    margin_gap_label: "Strong margin — Ethiopian specialty commands massive premium in Japan. Get JAS organic cert for max price.",
    data_source: "Bright Data: Rakuten.co.jp, Amazon.co.jp · Regs: customs.go.jp, mhlw.go.jp · Shipping: Freightos · AI: Qwen3.5-2B on Runpod Flash",
    cached: true,
  },
};

export function getDemoResult(product: string, origin: string, destination: string): AnalyzeResponse | null {
  const key = `${product.toLowerCase()}_${origin.toLowerCase()}_${destination.toLowerCase()}`;
  return DEMO_RESULTS[key] ?? null;
}
