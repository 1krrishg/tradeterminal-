import { CheckCircle2, AlertTriangle, Download, FileText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RiskAssessment, TriggeredSignal } from "@/types/risk";

interface ActionItemsProps {
  assessment: RiskAssessment;
  biltyOverride: boolean;
  onBiltyOverride: () => void;
  onDownloadJSON: () => void;
  onDownloadBilty: () => void;
}

function deduplicateActions(signals: TriggeredSignal[]): string[] {
  const actions = new Set<string>();
  for (const sig of signals) {
    if (sig.whatToFix) {
      // Take the first sentence as a concise action
      const firstSentence = sig.whatToFix.split(". ")[0];
      actions.add(firstSentence);
    }
  }
  return Array.from(actions);
}

export function ActionItems({
  assessment,
  biltyOverride,
  onBiltyOverride,
  onDownloadJSON,
  onDownloadBilty,
}: ActionItemsProps) {
  const { triggeredSignals, category, totalScore } = assessment;
  const biltyBlocked = category === "problem" && !biltyOverride;
  const actions = deduplicateActions(triggeredSignals);

  return (
    <div className="space-y-8">
      {/* What to Fix */}
      {actions.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Recommended Actions</h2>
          <div className="bg-muted/30 rounded-xl p-6 space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {actions.length === 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Status</h2>
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">Ready for Filing</p>
              <p className="text-sm text-muted-foreground">No actions required — shipment appears clean.</p>
            </div>
          </div>
        </section>
      )}

      {/* Bilty Generation */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Generate Documents</h2>

        {biltyBlocked && (
          <div className="flex items-start gap-4 p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
            <ShieldAlert className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-600 dark:text-red-400">
                High risk detected — Bilty generation blocked
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Risk score is {totalScore}. Review and resolve the flagged signals above before generating documents.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                onClick={onBiltyOverride}
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                I understand the risks — proceed anyway
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={onDownloadJSON} variant="outline" className="flex-1 h-12">
            <Download className="mr-2 h-4 w-4" />
            Risk Report (JSON)
          </Button>
          <Button
            onClick={onDownloadBilty}
            variant={biltyBlocked ? "outline" : "default"}
            className="flex-1 h-12"
            disabled={biltyBlocked}
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate Bilty
          </Button>
        </div>
      </section>
    </div>
  );
}
