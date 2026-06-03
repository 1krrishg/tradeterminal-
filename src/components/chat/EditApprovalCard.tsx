import { CheckCircle2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiffEntry {
  field: string;
  old: any;
  new: any;
  reason?: string;
}

interface EditApprovalCardProps {
  title: string;
  diff: DiffEntry[];
  onApprove: () => void;
  onReject: () => void;
  isApplied?: boolean;
}

function formatValue(val: any): string {
  if (val === undefined || val === null) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

export function EditApprovalCard({
  title,
  diff,
  onApprove,
  onReject,
  isApplied = false,
}: EditApprovalCardProps) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Edit2 className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-semibold text-amber-800 dark:text-amber-400 text-sm">{title}</span>
      </div>

      {/* Diff table */}
      {diff.length > 0 ? (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-amber-200 dark:border-amber-700">
                <th className="text-left py-1.5 pr-3 font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">Field</th>
                <th className="text-left py-1.5 pr-3 font-semibold text-red-600 dark:text-red-400">Old</th>
                <th className="text-left py-1.5 pr-3 font-semibold text-green-600 dark:text-green-400">New</th>
                <th className="text-left py-1.5 font-semibold text-amber-700 dark:text-amber-400">Reason</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((entry, i) => (
                <tr
                  key={i}
                  className="border-b border-amber-100 dark:border-amber-800/40 last:border-0"
                >
                  <td className="py-1.5 pr-3 font-medium text-foreground whitespace-nowrap align-top">
                    {entry.field}
                  </td>
                  <td className="py-1.5 pr-3 align-top">
                    <span className="line-through text-red-600 dark:text-red-400 break-all">
                      {formatValue(entry.old)}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 align-top">
                    <span className="text-green-700 dark:text-green-400 font-medium break-all">
                      {formatValue(entry.new)}
                    </span>
                  </td>
                  <td className="py-1.5 text-muted-foreground align-top">
                    {entry.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">No changes detected.</p>
      )}

      {/* Footer */}
      {isApplied ? (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-green-100 border border-green-200 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-950/30 dark:border-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Changes Applied
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
            onClick={onApprove}
            disabled={diff.length === 0}
          >
            Apply Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
