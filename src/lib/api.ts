export interface AnalyzeRequest {
  product: string;
  origin: string;
  destination: string;
  shipment_value_usd?: number;
}

export interface SourcedItem {
  name?: string;
  description?: string;
  confidence: number;
  source: string;
}

export interface ComplianceData {
  hs_code: string;
  duty_rate_percent: number | null;
  required_documents: SourcedItem[];
  certifications: SourcedItem[];
  restrictions: SourcedItem[];
  labeling_requirements: SourcedItem[];
  common_rejection_reasons: string[];
  recent_regulation_changes: Array<{ description: string; date: string; source: string }>;
  import_fees_and_taxes: Array<{ name: string; estimated_amount: string }>;
}

export interface MarketData {
  local_avg_price: string;
  local_price_range: string;
  seller_count: number;
  competition_level: "low" | "medium" | "high";
  consumer_sentiment: "positive" | "mixed" | "negative";
  sentiment_summary: string;
  top_complaints: string[];
}

export interface ShippingData {
  carrier: string;
  estimated_cost_usd: number;
  transit_days: string;
  raw: string;
}

export interface LandedCost {
  product_cost_usd: number;
  shipping_usd: number;
  tariff_usd: number;
  other_fees_usd: number;
  total_usd: number;
}

export interface AnalyzeResponse {
  product: string;
  origin: string;
  destination: string;
  compliance: ComplianceData;
  market: MarketData;
  shipping: ShippingData | null;
  landed_cost: LandedCost | null;
  margin_gap_usd: number | null;
  margin_gap_label: string | null;
  data_source: string;
  cached: boolean;
  shipment_value_usd?: number | null;
  shipment_assumption?: string;
  error?: string;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export async function analyzeRoute(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
