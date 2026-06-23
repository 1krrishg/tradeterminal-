import { ArrowRight, TrendingDown, Globe, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="top" className="relative border-b border-border overflow-hidden">
      <div className="container mx-auto px-5 sm:px-6 pt-10 pb-12 md:pt-20 md:pb-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 lg:pt-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] sm:text-xs text-muted-foreground mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              Live data · 12,788 products · 29 years of history
            </div>

            <h1 className="text-[2rem] leading-[1.1] sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.05] font-semibold tracking-tight text-foreground mb-5">
              Know the tariff hit before you ship. Or buy.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-7 leading-relaxed">
              For US exporters and importers. TariffLens classifies your product under the HTSUS using GRI rules, pulls 29 years of USITC rate history, cross-checks live retaliation data, and tells you the dollar impact. Takes 30 seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700 font-medium">
                🚢 Exporters — see foreign retaliation on your goods
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                📦 Importers — see US duties on what you buy
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-5 font-medium w-full sm:w-auto">
                <Link to="/simulate">
                  Simulate a shipment
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 border-border hover:bg-secondary w-full sm:w-auto">
                <a href="#how">See how it works ↓</a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-primary" /> USITC data 1998–2026</span>
              <span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-destructive" /> Live retaliation tracking</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> GRI classification + CBP rulings</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <HeroMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-warning/60" />
          <span className="h-2 w-2 rounded-full bg-success/60" />
        </div>
        <div className="text-[10px] sm:text-[11px] font-mono text-muted-foreground truncate">
          tariff-lens · soybeans → China · $500,000
        </div>
      </div>

      <div className="p-4 space-y-3 text-xs">
        {/* Risk score bar */}
        <div className="rounded-md border border-destructive/30 bg-destructive-soft p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Score</span>
            <span className="text-[10px] font-medium text-destructive bg-destructive-soft px-1.5 py-0.5 rounded">HIGH</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full w-[78%] bg-destructive rounded-full" />
            </div>
            <span className="font-mono text-destructive font-bold text-sm">78/100</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Retaliation probability: 85%</div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 divide-y divide-border">
          {[
            ["HS Code", "1201 — Soybeans", ""],
            ["MFN duty (USITC 2026)", "0%", ""],
            ["Retaliatory tariff · live", "+25% ← China on US ag", "warning"],
            ["Effective rate today", "25%", "destructive"],
            ["Tariff cost", "-$125,000", "destructive"],
          ].map(([k, v, color]) => (
            <div key={k} className="flex justify-between gap-3 px-2.5 py-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className={`font-mono font-medium text-right ${color === "destructive" ? "text-destructive" : color === "warning" ? "text-warning" : "text-foreground"}`}>{v}</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] uppercase tracking-wider text-muted-foreground pt-1">Scenarios</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Today", rate: "25%", impact: "-$125,000", cls: "border-destructive/30 bg-destructive-soft", neg: true },
            { label: "Escalation +40%", rate: "35%", impact: "-$175,000", cls: "border-destructive/50 bg-destructive/5", neg: true },
            { label: "Shift to Japan", rate: "0%", impact: "$0", cls: "border-success/30 bg-success-soft", neg: false },
          ].map((s) => (
            <div key={s.label} className={`rounded border p-2.5 ${s.cls}`}>
              <div className="text-[10px] text-muted-foreground mb-1">{s.label}</div>
              <div className="font-mono font-semibold text-sm text-foreground">{s.rate}</div>
              <div className={`text-[11px] font-medium ${s.neg ? "text-destructive" : "text-success"}`}>{s.impact}</div>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-warning/30 bg-warning-soft p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-warning mb-1">6–12 month prediction</div>
          <p className="text-[10px] text-foreground leading-relaxed">
            Soybeans spiked from 0% → 25% in 2018 and have held. Pattern suggests rate holds or escalates if USTR adds Section 301 action. Shift volume to Japan now.
          </p>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary-soft p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-primary mb-1">Recommendation</div>
          <p className="text-[10px] text-foreground leading-relaxed">
            <strong>Reroute to Japan</strong> — 0% effective rate, saves $125,000 on this shipment. Japan has no retaliatory measure on US soybeans.
          </p>
        </div>
      </div>
    </div>
  );
}
