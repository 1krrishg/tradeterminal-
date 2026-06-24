import { AlertTriangle, TrendingDown, CheckCircle2 } from "lucide-react";

const examples = [
  { product: "Soybeans", hs: "1201", dest: "China", mfn: 0, retaliation: 25, effective: 25, severity: "high", risk: 78, note: "2018 spike, held since" },
  { product: "Bourbon / Whiskey", hs: "2208", dest: "EU", mfn: 10, retaliation: 25, effective: 35, severity: "high", risk: 72, note: "Steel/aluminum dispute" },
  { product: "Beef", hs: "0201", dest: "EU", mfn: 12, retaliation: 25, effective: 37, severity: "high", risk: 81, note: "USMCA non-compliant" },
  { product: "Corn / Maize", hs: "1005", dest: "Mexico", mfn: 0, retaliation: 20, effective: 20, severity: "medium", risk: 54, note: "Post-USMCA tension" },
  { product: "Passenger Cars", hs: "8703", dest: "EU", mfn: 2, retaliation: 25, effective: 27, severity: "high", risk: 69, note: "Section 232 threat" },
  { product: "Semiconductors", hs: "8542", dest: "Japan", mfn: 0, retaliation: 0, effective: 0, severity: "none", risk: 12, note: "FTA — no retaliation" },
  { product: "Aircraft Parts", hs: "8803", dest: "China", mfn: 5, retaliation: 25, effective: 30, severity: "high", risk: 76, note: "Section 301 List 3" },
  { product: "Soybeans", hs: "1201", dest: "Japan", mfn: 0, retaliation: 0, effective: 0, severity: "none", risk: 8, note: "Best alt market" },
];

export function RiskGallery() {
  return (
    <section id="scenarios" className="py-16 sm:py-20 md:py-28 border-b border-border">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">Live tariff exposure map</div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">
            Real tariff rates across corridors right now.
          </h2>
          <p className="text-muted-foreground mt-3 text-sm">Live-scraped retaliatory data + WTO official MFN rates. Risk scores from 29-year USITC rate volatility analysis.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {examples.map((e) => (
            <div key={`${e.hs}-${e.dest}`} className={`rounded-xl border p-4 ${e.severity === "high" ? "border-destructive/30 bg-destructive-soft" : e.severity === "medium" ? "border-warning/30 bg-warning-soft" : "border-success/30 bg-success-soft"}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-mono text-muted-foreground">HS {e.hs}</div>
                {e.severity === "none"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  : e.severity === "high"
                  ? <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
              </div>
              <div className="font-semibold text-sm text-foreground mb-0.5">{e.product}</div>
              <div className="text-xs text-muted-foreground mb-2">→ {e.dest}</div>

              {/* Risk score mini bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Risk</span>
                  <span className={`text-[10px] font-mono font-bold ${e.risk >= 60 ? "text-destructive" : e.risk >= 30 ? "text-warning" : "text-success"}`}>{e.risk}/100</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${e.risk >= 60 ? "bg-destructive" : e.risk >= 30 ? "bg-warning" : "bg-success"}`} style={{ width: `${e.risk}%` }} />
                </div>
              </div>

              <div className="flex gap-3 text-[11px] mb-2">
                <div>
                  <div className="text-muted-foreground">MFN</div>
                  <div className="font-mono font-medium text-foreground">{e.mfn}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Retaliation</div>
                  <div className={`font-mono font-medium ${e.retaliation > 0 ? "text-destructive" : "text-success"}`}>{e.retaliation > 0 ? `+${e.retaliation}%` : "None"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Effective</div>
                  <div className={`font-mono font-semibold ${e.effective >= 20 ? "text-destructive" : e.effective > 0 ? "text-warning" : "text-success"}`}>{e.effective}%</div>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground italic">{e.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
