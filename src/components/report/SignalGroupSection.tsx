import { ChevronDown, AlertTriangle, ShieldAlert, Info, AlertCircle, Database, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import type { TriggeredSignal, SignalCategory } from "@/types/risk";
import { SIGNAL_CATEGORY_LABELS, SIGNAL_CATEGORY_DESCRIPTIONS } from "@/types/risk";

interface SignalGroupSectionProps {
  triggeredSignals: TriggeredSignal[];
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  minor: { bg: "bg-muted/50", border: "border-muted-foreground/20", badge: "bg-muted text-muted-foreground" },
  medium: { bg: "bg-yellow-500/5", border: "border-yellow-500/20", badge: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  major: { bg: "bg-orange-500/5", border: "border-orange-500/20", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  critical: { bg: "bg-red-500/5", border: "border-red-500/20", badge: "bg-red-500/15 text-red-700 dark:text-red-400" },
};

const CATEGORY_ICONS: Record<SignalCategory, typeof AlertTriangle> = {
  BEHAVIORAL: AlertCircle,
  DOCUMENT_FORENSICS: AlertTriangle,
  VALUATION: ShieldAlert,
  PHYSICAL_LOGISTICS: AlertCircle,
  NETWORK_ADVANCED: Info,
  COMBO: ShieldAlert,
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
}

function SignalCard({ signal }: { signal: TriggeredSignal }) {
  const [expanded, setExpanded] = useState(false);
  const styles = SEVERITY_STYLES[signal.severity];

  return (
    <div
      className={`rounded-xl border ${styles.border} ${styles.bg} p-4 cursor-pointer transition-all hover:shadow-sm`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {signal.signalType === "data_quality" ? (
              <Database className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
            )}
            <span className="font-semibold text-sm text-foreground">{signal.name}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${styles.badge} border-0`}>
              {signal.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{signal.adjustedScore}
            </Badge>
            <span className="text-[10px] text-muted-foreground">Rule #{signal.ruleNumber}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{signal.detail}</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">Confidence:</span>
            <ConfidenceBar confidence={signal.confidence} />
            {signal.signalType === "data_quality" && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-600 dark:text-blue-400">
                Data Issue
              </Badge>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform mt-1 ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
          <div className="flex gap-3">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
            <div className="text-sm">
              <span className="font-semibold text-foreground">Why it matters: </span>
              <span className="text-muted-foreground">{signal.whyItMatters}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5 text-orange-500" />
            <div className="text-sm">
              <span className="font-semibold text-foreground">What to fix: </span>
              <span className="text-muted-foreground">{signal.whatToFix}</span>
            </div>
          </div>
          {signal.score !== signal.adjustedScore && (
            <div className="text-[11px] text-muted-foreground/70 pl-7">
              Base: +{signal.score} → Adjusted: +{signal.adjustedScore} (confidence × context modifier applied)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SignalGroupSection({ triggeredSignals }: SignalGroupSectionProps) {
  // Separate risk signals from data issues
  const riskSignals = triggeredSignals.filter(s => s.signalType === "risk");
  const dataIssues = triggeredSignals.filter(s => s.signalType === "data_quality");

  const renderGroup = (signals: TriggeredSignal[], title: string, description?: string) => {
    const grouped: Partial<Record<SignalCategory, TriggeredSignal[]>> = {};
    for (const sig of signals) {
      if (!grouped[sig.category]) grouped[sig.category] = [];
      grouped[sig.category]!.push(sig);
    }
    const categories = (Object.keys(grouped) as SignalCategory[]).sort((a, b) => {
      const scoreA = grouped[a]!.reduce((s, sig) => s + sig.adjustedScore, 0);
      const scoreB = grouped[b]!.reduce((s, sig) => s + sig.adjustedScore, 0);
      return scoreB - scoreA;
    });
    if (categories.length === 0) return null;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="space-y-6">
          {categories.map((cat) => {
            const sigs = grouped[cat]!;
            const catScore = sigs.reduce((s, sig) => s + sig.adjustedScore, 0);
            const CatIcon = CATEGORY_ICONS[cat];
            return (
              <Collapsible key={cat} defaultOpen>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <CatIcon className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="font-semibold text-sm text-foreground">{SIGNAL_CATEGORY_LABELS[cat]}</p>
                        <p className="text-xs text-muted-foreground">{SIGNAL_CATEGORY_DESCRIPTIONS[cat]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {sigs.length} signal{sigs.length > 1 ? "s" : ""} · +{catScore}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-3 pl-2">
                    {sigs.sort((a, b) => b.adjustedScore - a.adjustedScore).map((sig, idx) => (
                      <SignalCard key={`${sig.id}-${idx}`} signal={sig} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-8">
      <h2 className="text-xl font-semibold text-foreground">Key Risk Factors</h2>
      {renderGroup(riskSignals, "🔴 Risk Signals", "Trade risk indicators that may require investigation.")}
      {renderGroup(dataIssues, "📋 Data Quality Issues", "Data inconsistencies — these have reduced impact on the overall risk score.")}
      {riskSignals.length === 0 && dataIssues.length === 0 && (
        <p className="text-muted-foreground">No signals triggered.</p>
      )}
    </section>
  );
}
