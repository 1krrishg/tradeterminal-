import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import type { ValidationWarning } from "@/types/lr";
import { fieldLabels, LorryReceiptData } from "@/types/lr";

interface ValidationPanelProps {
  warnings: ValidationWarning[];
  hasData: boolean;
}

export function ValidationPanel({ warnings, hasData }: ValidationPanelProps) {
  const errors = warnings.filter((w) => w.severity === "error");
  const warningsOnly = warnings.filter((w) => w.severity === "warning");

  if (!hasData) {
    return null;
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-lg">
        <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
        <div>
          <p className="font-medium text-success">All mandatory fields extracted</p>
          <p className="text-sm text-muted-foreground">The LR data is complete and ready for use.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="font-semibold text-destructive">
              {errors.length} Missing Mandatory Field{errors.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1 ml-7">
            {errors.map((error) => (
              <li key={error.field} className="text-sm text-destructive/80">
                <span className="font-medium">{fieldLabels[error.field as keyof typeof fieldLabels]}</span>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warningsOnly.length > 0 && (
        <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span className="font-semibold text-warning-foreground">
              {warningsOnly.length} Warning{warningsOnly.length > 1 ? "s" : ""}
            </span>
          </div>
          <ul className="space-y-1 ml-7">
            {warningsOnly.map((warning) => (
              <li key={warning.field} className="text-sm text-warning-foreground/80">
                <span className="font-medium">{fieldLabels[warning.field as keyof typeof fieldLabels]}</span>: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
