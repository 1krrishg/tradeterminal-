/**
 * Shipment Classification Engine
 * Infers cargo type (ODC / LOOSE / MIXED) before rules run.
 */

export type CargoType = "ODC" | "LOOSE" | "MIXED";
export type ClassificationConfidence = "high" | "medium" | "low";

export interface ShipmentClassification {
  cargoType: CargoType;
  confidence: ClassificationConfidence;
  weightPerPackage: number | null;
  reasoning: string;
}

/** Context multipliers applied per cargo type */
export const CONTEXT_MODIFIERS: Record<CargoType, { physical: number; valuation: number }> = {
  ODC:   { physical: 0.3, valuation: 0.7 },
  LOOSE: { physical: 1.2, valuation: 1.0 },
  MIXED: { physical: 0.6, valuation: 1.0 },
};

export type CompanyTrust = "high" | "medium" | "low";

export const TRUST_MULTIPLIERS: Record<CompanyTrust, number> = {
  high: 0.6,
  medium: 1.0,
  low: 1.4,
};

export function classifyShipment(
  totalWeight: number | null,
  numberOfPackages: number | null,
  goodsDescription: string | null
): ShipmentClassification {
  const wpp =
    totalWeight !== null && numberOfPackages !== null && numberOfPackages > 0
      ? totalWeight / numberOfPackages
      : null;

  let cargoType: CargoType = "MIXED";
  const signals: string[] = [];
  let positiveSignals = 0;
  let negativeSignals = 0; // conflicting

  // Rule 1: total weight > 20000 AND packages < 5 → ODC
  if (totalWeight !== null && totalWeight > 20000 && numberOfPackages !== null && numberOfPackages < 5) {
    signals.push(`Heavy shipment (${totalWeight} kg) with few packages (${numberOfPackages}) → ODC`);
    cargoType = "ODC";
    positiveSignals++;
  }
  // Rule 2: weight per package > 5000 → ODC
  else if (wpp !== null && wpp > 5000) {
    signals.push(`Weight per package ${wpp.toFixed(0)} kg > 5000 → ODC`);
    cargoType = "ODC";
    positiveSignals++;
  }
  // Rule 3: many small packages → LOOSE
  else if (numberOfPackages !== null && numberOfPackages > 50 && wpp !== null && wpp < 500) {
    signals.push(`${numberOfPackages} packages at ${wpp.toFixed(0)} kg each → LOOSE`);
    cargoType = "LOOSE";
    positiveSignals++;
  } else {
    signals.push("Default classification → MIXED");
  }

  // Description-based reinforcement
  if (goodsDescription) {
    const desc = goodsDescription.toLowerCase();
    const odcKeywords = ["machinery", "turbine", "transformer", "generator", "heavy", "odc", "over-dimensional"];
    const looseKeywords = ["bags", "cartons", "boxes", "loose", "parcels", "packets", "bundles"];

    if (odcKeywords.some(kw => desc.includes(kw))) {
      if (cargoType === "ODC") positiveSignals++;
      else negativeSignals++;
      signals.push("Description suggests ODC cargo");
    }
    if (looseKeywords.some(kw => desc.includes(kw))) {
      if (cargoType === "LOOSE") positiveSignals++;
      else if (cargoType !== "MIXED") negativeSignals++;
      signals.push("Description suggests loose/packaged cargo");
    }
  }

  // Confidence assessment
  let confidence: ClassificationConfidence;
  if (totalWeight === null || numberOfPackages === null) {
    confidence = "low";
  } else if (negativeSignals > 0) {
    confidence = "medium";
  } else if (positiveSignals >= 2) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  return {
    cargoType,
    confidence,
    weightPerPackage: wpp,
    reasoning: signals.join("; "),
  };
}
