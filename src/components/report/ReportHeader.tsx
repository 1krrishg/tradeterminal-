import { ShieldCheck, ShieldAlert, AlertTriangle, TrendingUp, AlertCircle, Package, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RiskAssessment } from "@/types/risk";
import { RISK_CATEGORY_CONFIG } from "@/types/risk";

interface ReportHeaderProps {
  assessment: RiskAssessment;
}

export function ReportHeader({ assessment }: ReportHeaderProps) {
  const { totalScore, rawScore, category, primaryDriver, confidence, classification, needsReview } = assessment;
  const config = RISK_CATEGORY_CONFIG[category];

  const Icon = category === "clean" ? ShieldCheck : category === "attention" ? AlertTriangle : ShieldAlert;

  const bgClass =
    category === "clean"
      ? "from-green-950 to-green-900 border-green-700/30"
      : category === "attention"
      ? "from-yellow-950 to-amber-900 border-yellow-700/30"
      : "from-red-950 to-red-900 border-red-700/30";

  const iconBg =
    category === "clean"
      ? "bg-green-500/20 text-green-400"
      : category === "attention"
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-red-500/20 text-red-400";

  const scoreBg =
    category === "clean"
      ? "bg-green-500/10 border-green-500/30 text-green-300"
      : category === "attention"
      ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
      : "bg-red-500/10 border-red-500/30 text-red-300";

  const displayLabel = needsReview ? "Needs Review" : config.label;
  const displayEmoji = needsReview ? "🟠" : config.emoji;

  return (
    <section className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${bgClass} p-8 md:p-12`}>
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-8">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${iconBg}`}>
              <Icon className="h-10 w-10" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60 uppercase tracking-widest">Risk Assessment</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
                <span>{displayEmoji}</span>
                <span>{displayLabel}</span>
              </h1>
            </div>
          </div>

          {primaryDriver && (
            <div className="flex items-center gap-2 text-white/80">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <p className="text-lg">
                Primary concern: <span className="font-semibold text-white">{primaryDriver}</span>
              </p>
            </div>
          )}

          {/* Classification badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-white/10 text-white/80 border-white/20 gap-1.5">
              <Package className="h-3 w-3" />
              {classification.cargoType} Cargo
            </Badge>
            <Badge className="bg-white/10 text-white/80 border-white/20 gap-1.5">
              <HelpCircle className="h-3 w-3" />
              Classification: {classification.confidence}
            </Badge>
            {needsReview && (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                Manual Review Needed
              </Badge>
            )}
          </div>

          <p className="text-sm text-white/50">{needsReview ? "Score is elevated but confidence is low — manual verification recommended." : config.description}</p>
        </div>

        <div className={`flex flex-col items-center gap-2 rounded-2xl border px-8 py-6 ${scoreBg}`}>
          <p className="text-xs font-medium uppercase tracking-widest text-white/50">Risk Score</p>
          <p className="text-6xl font-black tabular-nums text-white">{totalScore}</p>
          <div className="flex items-center gap-2 mt-1">
            <AlertCircle className="h-3.5 w-3.5 text-white/50" />
            <p className="text-xs text-white/50">Confidence: {confidence}%</p>
          </div>
          {rawScore !== totalScore && (
            <p className="text-[10px] text-white/30 mt-1">Raw: {rawScore} → Adjusted: {totalScore}</p>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-8">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              category === "clean" ? "bg-green-400" : category === "attention" ? "bg-yellow-400" : "bg-red-400"
            }`}
            style={{ width: `${Math.min(totalScore, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-white/30">
          <span>0 — Clean</span>
          <span>20 — Attention</span>
          <span>50+ — Problem</span>
        </div>
      </div>
    </section>
  );
}
