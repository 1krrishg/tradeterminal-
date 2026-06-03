/**
 * Document Reconciler — compares data across Invoice, Packing List, and LC
 * to surface discrepancies consumed by the Red Flag Engine.
 */

import type { LorryReceiptData, GoodsLineItem } from "@/types/lr";

export interface Discrepancy {
  field: string;
  source1: string;
  source2: string;
  value1: string | number;
  value2: string | number;
  diffPercent: number | null;
}

export interface ReconciliationResult {
  weightDiscrepancies: Discrepancy[];
  quantityDiscrepancies: Discrepancy[];
  lcInvoiceDiscrepancies: Discrepancy[];
  /** Average weight diff % across all line items (null if not comparable) */
  avgWeightDiffPercent: number | null;
  /** Average qty diff % (null if not comparable) */
  avgQtyDiffPercent: number | null;
  /** LC vs Invoice value diff % */
  lcValueDiffPercent: number | null;
  /** LC vs Invoice quantity diff % */
  lcQtyDiffPercent: number | null;
}

function pctDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const base = Math.max(Math.abs(a), Math.abs(b));
  if (base === 0) return 0;
  return (Math.abs(a - b) / base) * 100;
}

function parseNum(v: string | number | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  const s = String(v);
  if (!s || s === "-" || s === "N/A" || s === "Not Mentioned" || s === "CONFLICT") return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

/**
 * Run reconciliation across extracted data.
 *
 * Because the edge function merges data from multiple documents into a single
 * LorryReceiptData object, we compare internal consistency (e.g. summary vs
 * line item totals, gross vs net, LC fields vs invoice fields).
 */
export function reconcileDocuments(
  data: LorryReceiptData,
  hasLCDocs: boolean
): ReconciliationResult {
  const weightDisc: Discrepancy[] = [];
  const qtyDisc: Discrepancy[] = [];
  const lcDisc: Discrepancy[] = [];

  // ── Weight: line-item calculated totals vs summary ──
  if (data.line_items.length > 0) {
    let calcGross = 0;
    let calcNet = 0;
    let calcPkgs = 0;
    for (const item of data.line_items) {
      calcGross += parseNum(item.item_gross_weight) ?? 0;
      calcNet += parseNum(item.item_net_weight) ?? 0;
      calcPkgs += parseNum(item.number_of_packages) ?? 0;
    }
    const summaryGross = parseNum(data.summary?.total_gross_weight);
    const summaryNet = parseNum(data.summary?.total_net_weight);
    const summaryPkgs = parseNum(data.summary?.total_packages);

    if (summaryGross !== null && calcGross > 0) {
      const diff = pctDiff(calcGross, summaryGross);
      if (diff > 1) {
        weightDisc.push({
          field: "gross_weight",
          source1: "Line Items Total",
          source2: "Summary",
          value1: calcGross,
          value2: summaryGross,
          diffPercent: diff,
        });
      }
    }
    if (summaryNet !== null && calcNet > 0) {
      const diff = pctDiff(calcNet, summaryNet);
      if (diff > 1) {
        weightDisc.push({
          field: "net_weight",
          source1: "Line Items Total",
          source2: "Summary",
          value1: calcNet,
          value2: summaryNet,
          diffPercent: diff,
        });
      }
    }
    if (summaryPkgs !== null && calcPkgs > 0) {
      const diff = pctDiff(calcPkgs, summaryPkgs);
      if (diff > 1) {
        qtyDisc.push({
          field: "packages",
          source1: "Line Items Total",
          source2: "Summary",
          value1: calcPkgs,
          value2: summaryPkgs,
          diffPercent: diff,
        });
      }
    }
  }

  // ── Legacy single-field weight vs summary ──
  const legacyGross = parseNum(data.gross_weight_kg);
  const summaryGross2 = parseNum(data.summary?.total_gross_weight);
  if (legacyGross !== null && summaryGross2 !== null) {
    const diff = pctDiff(legacyGross, summaryGross2);
    if (diff > 5) {
      weightDisc.push({
        field: "gross_weight_legacy",
        source1: "Invoice (legacy field)",
        source2: "Packing List (summary)",
        value1: legacyGross,
        value2: summaryGross2,
        diffPercent: diff,
      });
    }
  }

  // ── LC vs Invoice ──
  if (hasLCDocs || data.lc_number) {
    // Value comparison: declared_value / summary total_value vs LC (if we had LC value)
    // Since LC value isn't separately stored, flag CONFLICT markers
    const totalValue = parseNum(data.summary?.total_value) ?? parseNum(data.declared_value);
    // We check for CONFLICT fields which indicate AI found mismatches
    if (data.declared_value === "CONFLICT" || data.summary?.total_value === "CONFLICT") {
      lcDisc.push({
        field: "value",
        source1: "Invoice",
        source2: "LC",
        value1: data.declared_value || "unknown",
        value2: "CONFLICT detected",
        diffPercent: null,
      });
    }
  }

  // Compute averages
  const avgWeight =
    weightDisc.length > 0
      ? weightDisc.reduce((s, d) => s + (d.diffPercent ?? 0), 0) / weightDisc.length
      : null;
  const avgQty =
    qtyDisc.length > 0
      ? qtyDisc.reduce((s, d) => s + (d.diffPercent ?? 0), 0) / qtyDisc.length
      : null;

  return {
    weightDiscrepancies: weightDisc,
    quantityDiscrepancies: qtyDisc,
    lcInvoiceDiscrepancies: lcDisc,
    avgWeightDiffPercent: avgWeight,
    avgQtyDiffPercent: avgQty,
    lcValueDiffPercent: lcDisc.length > 0 ? 100 : null,
    lcQtyDiffPercent: null,
  };
}
