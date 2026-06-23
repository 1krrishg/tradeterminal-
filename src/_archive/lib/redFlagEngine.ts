/**
 * Red Flag Engine V3 — Context-Aware Risk Intelligence
 * 
 * Flow: Classify → Evaluate Rules → Apply Confidence → Apply Context Modifiers → Apply Trust → Cap at 100
 */

import type { LorryReceiptData } from "@/types/lr";
import type { ReconciliationResult } from "./documentReconciler";
import { generateNarrative } from "./narrativeGenerator";
import {
  type RiskAssessment,
  type TriggeredSignal,
  type SignalType,
  SEVERITY_SCORES,
  getRiskCategory,
} from "@/types/risk";
import { SIGNAL_MAP } from "@/lib/riskSignals";
import {
  classifyShipment,
  CONTEXT_MODIFIERS,
  TRUST_MULTIPLIERS,
  type CompanyTrust,
} from "./shipmentClassifier";

// ── Helpers ──

function parseNum(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const s = String(v);
  if (!s || s === "-" || s === "N/A" || s === "Not Mentioned" || s === "CONFLICT") return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function isMissing(v: string | number | boolean | undefined | null): boolean {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === "" || s === "-" || s === "N/A" || s === "Not Mentioned" || s === "CONFLICT";
}

function isRound(n: number): boolean {
  return n === Math.round(n) || n % 10 === 0 || n % 100 === 0 || n % 1000 === 0;
}

/** Determine the context modifier category for a signal */
function getModifierCategory(signalCategory: string): "physical" | "valuation" | null {
  if (signalCategory === "PHYSICAL_LOGISTICS") return "physical";
  if (signalCategory === "VALUATION") return "valuation";
  return null; // other categories get no modifier (×1.0)
}

interface RawSignal {
  signalId: string;
  detail: string;
  confidence: number; // 0–1
  signalType: SignalType;
}

function emitSignal(signalId: string, detail: string, confidence: number = 0.8, signalType: SignalType = "risk"): RawSignal {
  return { signalId, detail, confidence: Math.max(0, Math.min(1, confidence)), signalType };
}

// ── HS Code chapter keywords ──

const HS_CHAPTER_KEYWORDS: Record<string, string[]> = {
  "01": ["animal", "live", "livestock"],
  "02": ["meat", "beef", "pork", "chicken", "poultry"],
  "03": ["fish", "seafood", "shrimp", "prawn"],
  "04": ["dairy", "milk", "cheese", "butter", "egg"],
  "07": ["vegetable", "potato", "onion", "tomato"],
  "08": ["fruit", "apple", "mango", "banana", "grape"],
  "09": ["coffee", "tea", "spice", "pepper", "cardamom"],
  "10": ["cereal", "wheat", "rice", "corn", "maize"],
  "11": ["flour", "starch", "malt"],
  "15": ["oil", "fat", "grease"],
  "17": ["sugar", "confectionery", "candy"],
  "22": ["beverage", "alcohol", "wine", "beer", "spirit"],
  "25": ["salt", "mineral", "cement", "stone"],
  "27": ["petroleum", "fuel", "oil", "coal", "gas"],
  "28": ["chemical", "acid", "oxide"],
  "29": ["organic", "chemical"],
  "30": ["pharma", "medicine", "drug", "tablet", "capsule"],
  "39": ["plastic", "polymer", "resin"],
  "40": ["rubber"],
  "44": ["wood", "timber", "plywood"],
  "48": ["paper", "cardboard"],
  "50": ["silk"],
  "52": ["cotton"],
  "54": ["synthetic", "fiber", "filament"],
  "61": ["garment", "clothing", "knit", "apparel", "shirt", "trouser"],
  "62": ["garment", "clothing", "woven", "apparel", "suit", "dress"],
  "64": ["footwear", "shoe", "boot", "sandal"],
  "70": ["glass"],
  "71": ["jewel", "gold", "silver", "diamond", "precious"],
  "72": ["iron", "steel"],
  "73": ["iron", "steel", "pipe", "tube"],
  "74": ["copper"],
  "76": ["aluminium", "aluminum"],
  "84": ["machine", "machinery", "pump", "engine", "turbine"],
  "85": ["electric", "electronic", "circuit", "battery", "cable", "motor"],
  "87": ["vehicle", "car", "truck", "auto", "tractor"],
  "90": ["instrument", "optical", "medical", "measuring"],
  "94": ["furniture", "mattress", "lamp", "lighting"],
  "95": ["toy", "game", "sport"],
  "96": ["miscellaneous", "pen", "brush"],
};

// ── Thresholds ──

const THRESHOLDS = {
  valueCheapPerKg: 0.5,
  maxWeightPerPackageKg: 2000,
  roundedFieldsThreshold: 5,
  freightRatioHigh: 0.30,
  freightRatioCombined: 0.25,
  highValueThreshold: 50000,
};

// ── Engine ──

export function runRedFlagEngine(
  data: LorryReceiptData,
  reconciliation: ReconciliationResult,
  confidence: number
): RiskAssessment {
  const rawSignals: RawSignal[] = [];
  const lineItems = data.line_items.length > 0 ? data.line_items : [];

  // Precompute common values
  const totalValue = parseNum(data.summary?.total_value) ?? parseNum(data.declared_value);
  const totalWeight = parseNum(data.summary?.total_gross_weight) ?? parseNum(data.gross_weight_kg);
  const totalNetWeight = parseNum(data.summary?.total_net_weight) ?? parseNum(data.net_weight_kg);
  const freightAmount = parseNum(data.freight_amount);
  const totalPkgs = parseNum(data.summary?.total_packages) ?? parseNum(data.number_of_packages);

  // ═══════════════════════════════════════════════════════════
  // STEP 0: SHIPMENT CLASSIFICATION
  // ═══════════════════════════════════════════════════════════
  const classification = classifyShipment(
    totalWeight,
    totalPkgs,
    data.goods_description || null
  );

  // Data reliability factor (affects all confidences)
  const dataReliability = confidence >= 80 ? 1.0 : confidence >= 60 ? 0.8 : 0.6;

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 2: DOCUMENT VALIDATION & FORENSICS
  // ═══════════════════════════════════════════════════════════

  // R15: Item count mismatch
  if (lineItems.length > 0 && totalPkgs !== null) {
    let calcPkgs = 0;
    for (const item of lineItems) {
      calcPkgs += parseNum(item.number_of_packages) ?? 0;
    }
    if (calcPkgs > 0 && Math.abs(calcPkgs - totalPkgs) > 0) {
      const diff = Math.abs(calcPkgs - totalPkgs);
      const conf = diff > 5 ? 0.9 : diff > 1 ? 0.7 : 0.5;
      rawSignals.push(emitSignal("R15_ITEM_COUNT_MISMATCH",
        `Line items sum to ${calcPkgs} packages but summary shows ${totalPkgs} packages (difference: ${diff}).`,
        conf * dataReliability, "data_quality"
      ));
    }
  }

  // R16: Invoice total vs sum of line items
  if (lineItems.length > 0 && totalValue !== null) {
    let calcValue = 0;
    for (const item of lineItems) {
      calcValue += parseNum(item.value) ?? 0;
    }
    if (calcValue > 0) {
      const diff = Math.abs(calcValue - totalValue);
      const pct = (diff / Math.max(calcValue, totalValue)) * 100;
      if (pct > 1) {
        const conf = pct > 10 ? 0.95 : pct > 5 ? 0.8 : 0.6;
        rawSignals.push(emitSignal("R16_INVOICE_TOTAL_MISMATCH",
          `Line items sum to ${calcValue.toFixed(2)} but invoice total is ${totalValue.toFixed(2)} — ${pct.toFixed(1)}% difference.`,
          conf * dataReliability, "risk"
        ));
      }
    }
  }

  // R17: LC tolerance exceeded
  if (reconciliation.lcInvoiceDiscrepancies.length > 0) {
    const fields = reconciliation.lcInvoiceDiscrepancies.map((d) => d.field).join(", ");
    rawSignals.push(emitSignal("R17_LC_TOLERANCE_EXCEEDED",
      `Discrepancy detected between LC and Invoice on: ${fields}. Bank rejection likely.`,
      0.9 * dataReliability, "risk"
    ));
  }

  // R18: Currency mismatch
  if (data.declared_value === "CONFLICT" || data.freight_terms === "CONFLICT") {
    rawSignals.push(emitSignal("R18_CURRENCY_MISMATCH",
      "Different currencies appear to be referenced across documents.",
      0.75 * dataReliability, "data_quality"
    ));
  }

  // R19: Different consignee names
  if (data.consignee_name === "CONFLICT") {
    rawSignals.push(emitSignal("R19_CONSIGNEE_NAME_MISMATCH",
      "Consignee name differs across documents — may indicate document mixing or requires verification.",
      0.85 * dataReliability, "risk"
    ));
  }

  // R20: Inconsistent incoterms
  if (data.delivery_terms === "CONFLICT") {
    rawSignals.push(emitSignal("R20_INCOTERMS_INCONSISTENT",
      "Delivery terms (incoterms) differ across documents. Standardization recommended.",
      0.65 * dataReliability, "data_quality"
    ));
  }

  // R21: Gross vs Net weight logic
  if (totalWeight !== null && totalNetWeight !== null && totalNetWeight > 0 && totalWeight > 0) {
    if (totalNetWeight > totalWeight) {
      // Reduce confidence for ODC cargo where tare weight reporting varies
      const conf = classification.cargoType === "ODC" ? 0.5 : 0.85;
      rawSignals.push(emitSignal("R21_GROSS_NET_LOGIC",
        `Net weight (${totalNetWeight} kg) exceeds gross weight (${totalWeight} kg) — this appears physically inconsistent.`,
        conf * dataReliability, "data_quality"
      ));
    }
  }
  for (const item of lineItems) {
    const itemGross = parseNum(item.item_gross_weight) ?? parseNum(item.gross_weight_kg);
    const itemNet = parseNum(item.item_net_weight) ?? parseNum(item.net_weight_kg);
    if (itemGross !== null && itemNet !== null && itemNet > itemGross && itemGross > 0) {
      rawSignals.push(emitSignal("R21_GROSS_NET_LOGIC",
        `Item "${item.description}": net weight (${itemNet} kg) exceeds gross weight (${itemGross} kg).`,
        0.7 * dataReliability, "data_quality"
      ));
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 3: VALUATION INTELLIGENCE
  // ═══════════════════════════════════════════════════════════

  // R27: Value/kg deviation
  let isUndervalued = false;
  if (totalValue !== null && totalWeight !== null && totalWeight > 0) {
    const valuePerKg = totalValue / totalWeight;
    if (valuePerKg < THRESHOLDS.valueCheapPerKg) {
      isUndervalued = true;
      // Higher confidence when value is extremely low
      const conf = valuePerKg < 0.1 ? 0.9 : valuePerKg < 0.3 ? 0.75 : 0.6;
      rawSignals.push(emitSignal("R27_VALUE_KG_DEVIATION",
        `Value per kg is ${valuePerKg.toFixed(2)} — this appears statistically unusual and may require validation.`,
        conf * dataReliability, "risk"
      ));
    }
  }

  // R29: Freight ratio
  let isHighFreight = false;
  if (freightAmount !== null && totalValue !== null && totalValue > 0) {
    const freightRatio = freightAmount / totalValue;
    if (freightRatio > THRESHOLDS.freightRatioHigh) {
      isHighFreight = true;
      const conf = freightRatio > 0.5 ? 0.85 : 0.65;
      rawSignals.push(emitSignal("R29_FREIGHT_RATIO_HIGH",
        `Freight is ${(freightRatio * 100).toFixed(0)}% of goods value — this ratio appears elevated compared to typical shipments.`,
        conf * dataReliability, "risk"
      ));
    }
  }

  // R30: Insurance missing for high-value
  if (totalValue !== null && totalValue > THRESHOLDS.highValueThreshold) {
    rawSignals.push(emitSignal("R30_INSURANCE_MISSING",
      `Shipment value is ${totalValue.toFixed(0)} — consider verifying insurance coverage for high-value goods.`,
      0.4, "data_quality" // low confidence — it's advisory
    ));
  }

  // R35: Underpricing + high freight combo (valuation category)
  if (isUndervalued && freightAmount !== null && totalValue !== null && totalValue > 0) {
    const freightRatio = freightAmount / totalValue;
    if (freightRatio > THRESHOLDS.freightRatioCombined) {
      rawSignals.push(emitSignal("R35_UNDERPRICING_HIGH_FREIGHT",
        `Low goods value combined with freight at ${(freightRatio * 100).toFixed(0)}% of value — this pattern is sometimes associated with value shifting.`,
        0.8 * dataReliability, "risk"
      ));
    }
  }

  // Unit price variance across line items
  if (lineItems.length > 1) {
    const unitPrices: number[] = [];
    for (const item of lineItems) {
      const qty = parseNum(item.quantity);
      const val = parseNum(item.value);
      if (qty && val && qty > 0) unitPrices.push(val / qty);
    }
    if (unitPrices.length > 1) {
      const avg = unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length;
      const maxDeviation = Math.max(...unitPrices.map((p) => Math.abs(p - avg) / avg));
      if (maxDeviation > 0.5) {
        rawSignals.push(emitSignal("R27_VALUE_KG_DEVIATION",
          `Unit prices vary by up to ${(maxDeviation * 100).toFixed(0)}% within the invoice — pricing structure appears inconsistent.`,
          0.55 * dataReliability, "risk"
        ));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 4: PHYSICAL & LOGISTICS INTELLIGENCE
  // ═══════════════════════════════════════════════════════════

  // R38: Density Check — weight per package
  if (totalWeight !== null && totalPkgs !== null && totalPkgs > 0) {
    const weightPerPkg = totalWeight / totalPkgs;
    // For ODC, extremely high weight per package is expected — heavily reduce confidence
    if (weightPerPkg > THRESHOLDS.maxWeightPerPackageKg) {
      const conf = classification.cargoType === "ODC" ? 0.2 : 0.75;
      rawSignals.push(emitSignal("R38_DENSITY_ANOMALY",
        `${weightPerPkg.toFixed(0)} kg per package appears unusual for most commodity types (typical max: ${THRESHOLDS.maxWeightPerPackageKg} kg).`,
        conf * dataReliability, "risk"
      ));
    }
  }

  // R39: Packaging type mismatch
  if (!isMissing(data.packing_type) && !isMissing(data.goods_description)) {
    const packing = String(data.packing_type).toLowerCase();
    const desc = String(data.goods_description).toLowerCase();
    const fragileKeywords = ["glass", "ceramic", "electronic", "pharma", "medicine", "instrument"];
    const bulkPackaging = ["bulk", "loose", "jumbo"];
    const isFragile = fragileKeywords.some(kw => desc.includes(kw));
    const isBulk = bulkPackaging.some(kw => packing.includes(kw));
    if (isFragile && isBulk) {
      rawSignals.push(emitSignal("R39_PACKAGING_MISMATCH",
        `Fragile goods ("${data.goods_description}") declared in bulk/loose packaging — packaging may be inappropriate.`,
        0.7 * dataReliability, "risk"
      ));
    }
  }

  // Weight discrepancies from reconciliation
  if (reconciliation.avgWeightDiffPercent !== null && reconciliation.avgWeightDiffPercent > 5) {
    const conf = reconciliation.avgWeightDiffPercent > 15 ? 0.85 : 0.6;
    rawSignals.push(emitSignal("R21_GROSS_NET_LOGIC",
      `Weight differs by ${reconciliation.avgWeightDiffPercent.toFixed(1)}% between document sources.`,
      conf * dataReliability, "data_quality"
    ));
  }

  // Quantity discrepancies from reconciliation
  if (reconciliation.avgQtyDiffPercent !== null && reconciliation.avgQtyDiffPercent > 3) {
    const conf = reconciliation.avgQtyDiffPercent > 10 ? 0.8 : 0.55;
    rawSignals.push(emitSignal("R15_ITEM_COUNT_MISMATCH",
      `Quantity differs by ${reconciliation.avgQtyDiffPercent.toFixed(1)}% between documents.`,
      conf * dataReliability, "data_quality"
    ));
  }

  // HS Code vs Description clash
  let hasHSClash = false;
  for (const item of lineItems) {
    if (isMissing(item.hsn_code) || isMissing(item.description)) continue;
    const chapter = String(item.hsn_code).trim().substring(0, 2);
    const keywords = HS_CHAPTER_KEYWORDS[chapter];
    if (keywords) {
      const descLower = String(item.description).toLowerCase();
      const match = keywords.some((kw) => descLower.includes(kw));
      if (!match) {
        hasHSClash = true;
        rawSignals.push(emitSignal("R27_VALUE_KG_DEVIATION",
          `"${item.description}" under HS chapter ${chapter} doesn't match expected keywords (${keywords.slice(0, 3).join(", ")}…) — possible misclassification.`,
          0.6 * dataReliability, "risk"
        ));
        break;
      }
    }
  }

  // Missing core identity
  const missingIdentity: string[] = [];
  if (isMissing(data.consignor_name)) missingIdentity.push("Consignor/Shipper");
  if (isMissing(data.consignee_name)) missingIdentity.push("Consignee");
  const hasAnyHSCode = !isMissing(data.hsn_code) || lineItems.some((li) => !isMissing(li.hsn_code));
  if (!hasAnyHSCode) missingIdentity.push("HS Code");
  if (missingIdentity.length > 0) {
    rawSignals.push(emitSignal("R19_CONSIGNEE_NAME_MISMATCH",
      `Missing critical identity fields: ${missingIdentity.join(", ")}. These are typically required for customs clearance.`,
      0.9, "data_quality"
    ));
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 5: NETWORK & ADVANCED
  // ═══════════════════════════════════════════════════════════

  // R55: Data fields too clean
  const numericFields = [
    data.gross_weight_kg, data.net_weight_kg, data.declared_value,
    data.freight_amount, data.summary?.total_gross_weight,
    data.summary?.total_net_weight, data.summary?.total_value,
    data.summary?.total_packages,
    ...lineItems.map((i) => i.value),
    ...lineItems.map((i) => i.quantity),
  ];
  let roundCount = 0;
  let numericCount = 0;
  for (const f of numericFields) {
    const n = parseNum(f);
    if (n !== null && n > 0) {
      numericCount++;
      if (isRound(n)) roundCount++;
    }
  }
  if (numericCount >= 4 && roundCount >= THRESHOLDS.roundedFieldsThreshold) {
    rawSignals.push(emitSignal("R55_DATA_TOO_CLEAN",
      `${roundCount} of ${numericCount} numeric values are perfectly rounded — this is statistically unusual for real measurements.`,
      0.5, "data_quality"
    ));
  }

  // Low extraction confidence
  if (confidence < 70) {
    rawSignals.push(emitSignal("R55_DATA_TOO_CLEAN",
      `Extraction confidence is ${confidence}% — below the 70% reliability threshold. Values may need manual verification.`,
      0.4, "data_quality"
    ));
  }

  // ═══════════════════════════════════════════════════════════
  // CATEGORY 6: COMBO RULES
  // ═══════════════════════════════════════════════════════════

  // R56: HS mismatch + Low value
  if (hasHSClash && isUndervalued) {
    rawSignals.push(emitSignal("R56_HIGH_RISK_COMBO",
      "HS classification concern combined with unusual valuation — this pattern may indicate coordinated misclassification and undervaluation.",
      0.85 * dataReliability, "risk"
    ));
  }

  // R58: Undervaluation combo
  if (isUndervalued && isHighFreight) {
    rawSignals.push(emitSignal("R58_UNDERVALUATION_COMBO",
      "Low declared value combined with elevated freight costs — this pattern is sometimes associated with shifting dutiable value to non-dutiable charges.",
      0.8 * dataReliability, "risk"
    ));
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: APPLY CONFIDENCE × CONTEXT MODIFIERS
  // ═══════════════════════════════════════════════════════════

  const contextMod = CONTEXT_MODIFIERS[classification.cargoType];

  const triggeredSignals: TriggeredSignal[] = [];
  const seen = new Set<string>();

  for (const raw of rawSignals) {
    const def = SIGNAL_MAP[raw.signalId];
    if (!def) {
      console.warn(`Unknown signal ID: ${raw.signalId}`);
      continue;
    }

    // Dedup
    const key = `${raw.signalId}::${raw.detail.substring(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const baseScore = SEVERITY_SCORES[def.severity];

    // Apply context modifier based on category
    const modCat = getModifierCategory(def.category);
    let modifier = 1.0;
    if (modCat === "physical") modifier = contextMod.physical;
    else if (modCat === "valuation") modifier = contextMod.valuation;

    // Data quality issues get a flat 0.5x dampener — they shouldn't drive risk
    const typeDampener = raw.signalType === "data_quality" ? 0.5 : 1.0;

    const adjustedScore = Math.round(baseScore * raw.confidence * modifier * typeDampener);

    triggeredSignals.push({
      ...def,
      score: baseScore,
      detail: raw.detail,
      confidence: raw.confidence,
      adjustedScore,
      signalType: raw.signalType,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: COMPANY TRUST MODIFIER (V1: default medium)
  // ═══════════════════════════════════════════════════════════
  const companyTrust: CompanyTrust = "medium"; // V1: no DB yet
  const trustMultiplier = TRUST_MULTIPLIERS[companyTrust];

  const rawScore = triggeredSignals.reduce((sum, s) => sum + s.adjustedScore, 0);
  const totalScore = Math.min(100, Math.round(rawScore * trustMultiplier));

  const category = getRiskCategory(totalScore);

  // ═══════════════════════════════════════════════════════════
  // STEP 7: OUTPUT — NEEDS REVIEW LOGIC
  // ═══════════════════════════════════════════════════════════
  const avgConfidence = triggeredSignals.length > 0
    ? triggeredSignals.reduce((s, sig) => s + sig.confidence, 0) / triggeredSignals.length
    : 1;
  const needsReview = totalScore >= 50 && avgConfidence < 0.6;

  // Primary risk driver (from highest adjusted score)
  let primaryDriver: string | null = null;
  if (triggeredSignals.length > 0) {
    const sorted = [...triggeredSignals].sort((a, b) => b.adjustedScore - a.adjustedScore);
    const top = sorted[0];
    const driverLabels: Record<string, string> = {
      R15_ITEM_COUNT_MISMATCH: "Document Inconsistency",
      R16_INVOICE_TOTAL_MISMATCH: "Invoice Calculation Error",
      R17_LC_TOLERANCE_EXCEEDED: "LC-Invoice Discrepancy",
      R18_CURRENCY_MISMATCH: "Currency Inconsistency",
      R19_CONSIGNEE_NAME_MISMATCH: "Identity Mismatch",
      R20_INCOTERMS_INCONSISTENT: "Terms Inconsistency",
      R21_GROSS_NET_LOGIC: "Weight Data Error",
      R27_VALUE_KG_DEVIATION: "Undervaluation Risk",
      R29_FREIGHT_RATIO_HIGH: "Suspicious Cost Structure",
      R30_INSURANCE_MISSING: "Insurance Gap",
      R35_UNDERPRICING_HIGH_FREIGHT: "Valuation Manipulation Pattern",
      R38_DENSITY_ANOMALY: "Physical Anomaly",
      R39_PACKAGING_MISMATCH: "Packaging Risk",
      R55_DATA_TOO_CLEAN: "Data Quality Issue",
      R56_HIGH_RISK_COMBO: "Multi-Factor Risk Pattern",
      R58_UNDERVALUATION_COMBO: "Undervaluation Pattern",
    };
    primaryDriver = driverLabels[top.id] ?? top.name;
  }

  // Generate narrative
  const narrative = generateNarrative({
    totalScore,
    category,
    triggeredSignals,
    primaryDriver,
    confidence,
    classification,
    needsReview,
  });

  return {
    totalScore,
    rawScore,
    category,
    primaryDriver,
    triggeredSignals,
    confidence,
    narrative,
    classification,
    companyTrust,
    needsReview,
  };
}
