import type { ReconciliationResult } from "@/lib/documentReconciler";
import type { LorryReceiptData } from "@/types/lr";
import { ArrowLeftRight, CheckCircle2, XCircle } from "lucide-react";

interface DataConsistencyPanelProps {
  data: LorryReceiptData;
  reconciliation: ReconciliationResult;
}

function ComparisonRow({
  label,
  value1,
  value2,
  source1,
  source2,
  diffPercent,
}: {
  label: string;
  value1: string | number;
  value2: string | number;
  source1: string;
  source2: string;
  diffPercent: number | null;
}) {
  const hasDiff = diffPercent !== null && diffPercent > 1;

  return (
    <div className={`grid grid-cols-[1fr,auto,1fr] items-center gap-4 p-4 rounded-xl border ${
      hasDiff ? "border-red-500/20 bg-red-500/5" : "border-green-500/20 bg-green-500/5"
    }`}>
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">{source1}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value1}</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <ArrowLeftRight className={`h-4 w-4 ${hasDiff ? "text-red-500" : "text-green-500"}`} />
        {hasDiff ? (
          <span className="text-xs font-semibold text-red-500">
            {diffPercent!.toFixed(1)}% diff
          </span>
        ) : (
          <span className="text-xs font-semibold text-green-500">Match</span>
        )}
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">{source2}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value2}</p>
      </div>
    </div>
  );
}

export function DataConsistencyPanel({ data, reconciliation }: DataConsistencyPanelProps) {
  const allDiscrepancies = [
    ...reconciliation.weightDiscrepancies,
    ...reconciliation.quantityDiscrepancies,
    ...reconciliation.lcInvoiceDiscrepancies,
  ];

  const hasIssues = allDiscrepancies.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Data Consistency Check</h2>
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <>
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">{allDiscrepancies.length} issue(s) found</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">All consistent</span>
            </>
          )}
        </div>
      </div>

      {allDiscrepancies.length > 0 ? (
        <div className="space-y-3">
          {allDiscrepancies.map((disc, idx) => (
            <div key={idx}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {disc.field.replace(/_/g, " ")}
              </p>
              <ComparisonRow
                label={disc.field}
                value1={disc.value1}
                value2={disc.value2}
                source1={disc.source1}
                source2={disc.source2}
                diffPercent={disc.diffPercent}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            All document values are internally consistent
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Weight, quantity, and value fields match across Invoice, Packing List, and LC.
          </p>
        </div>
      )}
    </section>
  );
}
