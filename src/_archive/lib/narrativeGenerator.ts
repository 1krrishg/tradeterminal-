/**
 * Template-based narrative generator V2 — probabilistic, context-aware language.
 */

import type { TriggeredSignal, RiskCategory, SignalCategory } from "@/types/risk";
import type { ShipmentClassification } from "@/lib/shipmentClassifier";

interface NarrativeInput {
  totalScore: number;
  category: RiskCategory;
  triggeredSignals: TriggeredSignal[];
  primaryDriver: string | null;
  confidence: number;
  classification: ShipmentClassification;
  needsReview: boolean;
}

const CATEGORY_RISK_PHRASES: Record<SignalCategory, string> = {
  BEHAVIORAL: "behavioral patterns in shipment history",
  DOCUMENT_FORENSICS: "document consistency",
  VALUATION: "valuation and pricing structure",
  PHYSICAL_LOGISTICS: "physical and logistics characteristics",
  NETWORK_ADVANCED: "network-level anomaly patterns",
  COMBO: "converging risk patterns",
};

export function generateNarrative(input: NarrativeInput): string {
  const { totalScore, category, triggeredSignals, primaryDriver, confidence, classification, needsReview } = input;

  if (triggeredSignals.length === 0) {
    return `This shipment has been analyzed across all available risk dimensions and no significant issues were detected. All document fields appear consistent, valuation seems reasonable, and no structural anomalies were found. Classified as **${classification.cargoType}** cargo (${classification.confidence} confidence). Extraction confidence is ${confidence}%. The shipment appears ready for customs filing.`;
  }

  const parts: string[] = [];

  // Classification context
  parts.push(`Shipment classified as **${classification.cargoType}** cargo (${classification.confidence} confidence). ${classification.reasoning.split(";")[0]}.`);

  // Opening — probabilistic language
  const riskSignals = triggeredSignals.filter(s => s.signalType === "risk");
  const dataIssues = triggeredSignals.filter(s => s.signalType === "data_quality");

  if (needsReview) {
    parts.push(`The analysis identified ${triggeredSignals.length} finding${triggeredSignals.length > 1 ? "s" : ""} with a risk score of ${totalScore}, but confidence in these findings is relatively low. **This shipment needs manual review** before drawing conclusions.`);
  } else if (category === "problem") {
    parts.push(`This shipment has triggered ${riskSignals.length} risk signal${riskSignals.length > 1 ? "s" : ""} and ${dataIssues.length} data quality finding${dataIssues.length > 1 ? "s" : ""}, resulting in a combined risk score of ${totalScore}. There is a high probability of genuine issues that require investigation.`);
  } else if (category === "attention") {
    parts.push(`This shipment has flagged ${triggeredSignals.length} area${triggeredSignals.length > 1 ? "s" : ""} that may benefit from review, with a total risk score of ${totalScore}.`);
  } else {
    parts.push(`This shipment shows minor findings with a risk score of ${totalScore}. These appear to be low-probability concerns.`);
  }

  // Primary driver
  if (primaryDriver) {
    parts.push(`The primary area of concern is **${primaryDriver}**.`);
  }

  // Group signals by category
  const grouped: Partial<Record<SignalCategory, TriggeredSignal[]>> = {};
  for (const sig of triggeredSignals) {
    if (!grouped[sig.category]) grouped[sig.category] = [];
    grouped[sig.category]!.push(sig);
  }

  const categoryEntries = Object.entries(grouped) as [SignalCategory, TriggeredSignal[]][];
  categoryEntries.sort((a, b) => {
    const scoreA = a[1].reduce((s, sig) => s + sig.adjustedScore, 0);
    const scoreB = b[1].reduce((s, sig) => s + sig.adjustedScore, 0);
    return scoreB - scoreA;
  });

  // Describe top patterns with probabilistic language
  for (const [cat, signals] of categoryEntries.slice(0, 3)) {
    const highConfSignals = signals.filter(s => s.confidence >= 0.7);
    const lowConfSignals = signals.filter(s => s.confidence < 0.7);

    if (highConfSignals.length > 0) {
      parts.push(`In ${CATEGORY_RISK_PHRASES[cat]}, ${highConfSignals.map(s => s.name.toLowerCase()).join(", ")} ${highConfSignals.length > 1 ? "were" : "was"} flagged with moderate-to-high confidence.`);
    }
    if (lowConfSignals.length > 0 && highConfSignals.length === 0) {
      parts.push(`Some findings in ${CATEGORY_RISK_PHRASES[cat]} were noted but with lower certainty — these may warrant a quick check.`);
    }
  }

  // Data vs risk separation note
  if (dataIssues.length > 0 && riskSignals.length > 0) {
    parts.push(`Note: ${dataIssues.length} of the findings relate to data quality (missing or inconsistent values) rather than trade risk indicators. These have been weighted lower in the overall score.`);
  } else if (dataIssues.length > 0 && riskSignals.length === 0) {
    parts.push(`All findings relate to data quality rather than trade risk. The underlying shipment may be clean — resolving the data issues would provide a clearer picture.`);
  }

  // Confidence caveat
  if (confidence < 70) {
    parts.push(`Extraction confidence is ${confidence}%, which is below the reliability threshold. Manual verification of extracted values is recommended before acting on these findings.`);
  }

  // Closing
  if (needsReview) {
    parts.push("**Recommendation: Manual review required — score is elevated but confidence is insufficient for automated decision.**");
  } else if (category === "problem") {
    parts.push("**Recommendation: Investigate flagged issues before proceeding with customs filing.**");
  } else if (category === "attention") {
    parts.push("A brief review of the flagged items is recommended before proceeding.");
  }

  return parts.join(" ");
}
