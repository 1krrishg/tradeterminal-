// ===== Trade Risk Intelligence — Core Types & Scoring =====

import type { CargoType, ClassificationConfidence, CompanyTrust, ShipmentClassification } from "@/lib/shipmentClassifier";

export type RiskSeverity = "minor" | "medium" | "major" | "critical";
export type RiskCategory = "clean" | "attention" | "problem";
export type SignalCategory =
  | "BEHAVIORAL"
  | "DOCUMENT_FORENSICS"
  | "VALUATION"
  | "PHYSICAL_LOGISTICS"
  | "NETWORK_ADVANCED"
  | "COMBO";

/** Whether a signal is a data-quality issue vs a true risk signal */
export type SignalType = "risk" | "data_quality";

export const SEVERITY_SCORES: Record<RiskSeverity, number> = {
  minor: 5,
  medium: 12,
  major: 25,
  critical: 40,
};

export function getRiskCategory(score: number): RiskCategory {
  if (score < 20) return "clean";
  if (score < 50) return "attention";
  return "problem";
}

export const RISK_CATEGORY_CONFIG: Record<
  RiskCategory,
  { label: string; emoji: string; color: string; description: string }
> = {
  clean: {
    label: "Looks Clean",
    emoji: "🟢",
    color: "text-green-600",
    description: "No significant risk indicators detected.",
  },
  attention: {
    label: "Needs Attention",
    emoji: "🟡",
    color: "text-yellow-600",
    description: "Some inconsistencies found — manual review recommended.",
  },
  problem: {
    label: "Likely Problem",
    emoji: "🔴",
    color: "text-red-600",
    description: "Multiple high-risk signals triggered — investigate before proceeding.",
  },
};

export const SIGNAL_CATEGORY_LABELS: Record<SignalCategory, string> = {
  BEHAVIORAL: "Behavioral Intelligence",
  DOCUMENT_FORENSICS: "Document Validation & Forensics",
  VALUATION: "Valuation Intelligence",
  PHYSICAL_LOGISTICS: "Physical & Logistics Intelligence",
  NETWORK_ADVANCED: "Network & Advanced Anomaly Detection",
  COMBO: "Intelligent Combo Rules",
};

export const SIGNAL_CATEGORY_DESCRIPTIONS: Record<SignalCategory, string> = {
  BEHAVIORAL: "Patterns detected across shipment history — agent changes, port switching, classification cycling.",
  DOCUMENT_FORENSICS: "Internal consistency checks across Invoice, Packing List, and LC documents.",
  VALUATION: "Price, value, and cost structure analysis to detect undervaluation or manipulation.",
  PHYSICAL_LOGISTICS: "Physical characteristics, packaging, density, and route anomalies.",
  NETWORK_ADVANCED: "Cross-entity relationships, shared details, and statistical outliers.",
  COMBO: "High-confidence patterns where multiple risk signals converge — strongest indicators.",
};

// ---------- Signal definition ----------

export interface RiskSignalDefinition {
  id: string;
  name: string;
  category: SignalCategory;
  severity: RiskSeverity;
  ruleNumber: number;
  isActive: boolean;
  whyItMatters: string;
  whatToFix: string;
}

export interface TriggeredSignal extends RiskSignalDefinition {
  /** Base score from severity tier */
  score: number;
  /** Dynamic detail for this specific shipment */
  detail: string;
  /** Confidence in this specific signal (0–1) */
  confidence: number;
  /** Score after confidence × context modifier */
  adjustedScore: number;
  /** Whether this is a data issue vs a true risk signal */
  signalType: SignalType;
}

export interface RiskAssessment {
  totalScore: number;
  /** Raw sum before company trust modifier */
  rawScore: number;
  category: RiskCategory;
  primaryDriver: string | null;
  triggeredSignals: TriggeredSignal[];
  /** Overall extraction confidence 0-100 */
  confidence: number;
  narrative: string;
  /** Shipment classification */
  classification: ShipmentClassification;
  /** Company trust level used */
  companyTrust: CompanyTrust;
  /** Whether score is high but confidence is low → "Needs Review" */
  needsReview: boolean;
}
