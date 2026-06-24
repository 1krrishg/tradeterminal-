import { useLocation, Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft, TrendingDown, CheckCircle2, AlertTriangle, Lightbulb,
  RefreshCw, Mail, Loader2, TrendingUp, Globe2, Clock, ShieldAlert,
  FileSearch, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Scenario = {
  name: string; description: string;
  tariff_rate: number; tariff_cost: number; net_proceeds: number;
  severity: "high" | "medium" | "low" | "none";
};
type AltMarket = { country: string; code: string; rate: number; cost: number; saving: number; retaliation: number };
type HistoryPoint = { year: number; rate: number };

type SimResult = {
  hs_code: string; product_name: string; destination_country: string;
  shipment_value: number; mfn_rate: number; retaliation_rate: number;
  effective_rate: number; retaliation_note: string; tariff_cost_today: number;
  scenarios: Scenario[];
  risk_score: number; risk_label: string;
  retaliation_probability: number;
  rate_history: HistoryPoint[];
  alternative_markets: AltMarket[];
  volatility_stats: { volatility: number; max_year_jump: number; max_jump_year: number; avg_rate: number; max_rate: number } | null;
  risk_summary: string; recommendation: string; prediction: string;
  data_source: string; data_freshness: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function RiskMeter({ score, label }: { score: number; label: string }) {
  const color = score >= 60 ? "bg-destructive" : score >= 30 ? "bg-warning" : "bg-success";
  const textColor = score >= 60 ? "text-destructive" : score >= 30 ? "text-warning" : "text-success";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <div className={`text-sm font-bold font-mono w-12 text-right ${textColor}`}>{score}/100</div>
      <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${score >= 60 ? "bg-destructive-soft text-destructive" : score >= 30 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
        {label}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: HistoryPoint[] }) {
  if (!data || data.length < 2) return <div className="text-xs text-muted-foreground italic">No historical data</div>;
  const rates = data.map(d => d.rate); // already in percentage from edge function
  const minR = Math.min(...rates);
  const maxR = Math.max(...rates);
  const range = maxR - minR || 0.01;
  const w = 320, h = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * (w - 20) + 10;
    const y = h - ((d.rate - minR) / range) * (h - 10) - 5;
    return `${x},${y}`;
  }).join(" ");

  // Find spike year
  let maxIdx = 0;
  rates.forEach((r, i) => { if (r > rates[maxIdx]) maxIdx = i; });
  const spikeX = (maxIdx / (data.length - 1)) * (w - 20) + 10;
  const spikeY = h - ((rates[maxIdx] - minR) / range) * (h - 10) - 5; // rates already %

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 60 }}>
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" />
        {maxR > minR && (
          <>
            <circle cx={spikeX} cy={spikeY} r="3" fill="hsl(var(--destructive))" />
            <text x={spikeX} y={spikeY - 6} textAnchor="middle" fontSize="9" fill="hsl(var(--destructive))" fontFamily="monospace">
              {data[maxIdx]?.year}
            </text>
          </>
        )}
      </svg>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-0.5 px-2.5">
        <span>{data[0]?.year}</span>
        <span className="text-muted-foreground">{minR.toFixed(1)}%–{maxR.toFixed(1)}% range</span>
        <span>{data[data.length - 1]?.year}</span>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const { state } = useLocation();
  const { toast } = useToast();
  const result: SimResult | undefined = state?.result;
  const tradeMode: "exporter" | "importer" = state?.input?.tradeMode ?? "exporter";
  const isImporter = tradeMode === "importer";
  const classification = state?.classification ?? null;
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendAlert = async () => {
    if (!email || !result) return;
    setSending(true);
    try {
      await supabase.functions.invoke("send-alert", {
        body: {
          recipient_email: email,
          product_name: result.product_name,
          destination_country: result.destination_country,
          shipment_value: result.shipment_value,
          effective_rate: result.effective_rate,
          tariff_cost: result.tariff_cost_today,
          recommendation: result.recommendation,
          risk_summary: result.risk_summary,
        },
      });
      setSent(true);
      toast({ title: "Report sent", description: `Simulation emailed to ${email}` });
    } catch {
      toast({ title: "Failed to send", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center px-6">
          <p className="text-muted-foreground">No simulation data found.</p>
          <Button asChild variant="outline"><Link to="/simulate"><ArrowLeft className="h-4 w-4 mr-2" />Back to simulator</Link></Button>
        </div>
        <Footer />
      </div>
    );
  }

  // Sanctions block — return early before trying to render null rates
  if ((result as any).sanctions_alert) {
    const r = result as any;
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <main className="container mx-auto px-5 sm:px-6 py-10 max-w-3xl space-y-5">
          <div>
            <Link to="/simulate" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
              <ArrowLeft className="h-3 w-3" /> New simulation
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">{r.product_name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{r.origin_country} → {r.destination_country}</p>
          </div>
          <div className="rounded-xl border-2 border-destructive/40 bg-destructive-soft p-6 space-y-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-destructive flex-shrink-0" />
              <div>
                <div className="font-semibold text-destructive text-lg">
                  {r.sanctions_level === "prohibited" ? "Trade Prohibited" : "Trade Restricted"} — {r.sanctioned_party}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Standard tariff analysis does not apply</div>
              </div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{r.sanctions_note}</p>
            <div className="rounded-lg border border-destructive/20 bg-background/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Legal authority</div>
              <p className="text-xs text-foreground font-mono">{r.sanctions_authority}</p>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning-soft p-3">
              <p className="text-sm font-medium text-warning">{r.recommendation}</p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/simulate"><ArrowLeft className="h-4 w-4 mr-2" />Try a different corridor</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const sevColor = (s: string) =>
    s === "high" ? "border-destructive/30 bg-destructive-soft" :
    s === "medium" ? "border-warning/30 bg-warning-soft" : "border-success/30 bg-success-soft";

  const sevIcon = (s: string) =>
    s === "high" ? <TrendingDown className="h-4 w-4 text-destructive" /> :
    s === "medium" ? <AlertTriangle className="h-4 w-4 text-warning" /> :
    <CheckCircle2 className="h-4 w-4 text-success" />;

  const hasPrediction = !!result.prediction;
  const hasAltMarkets = result.alternative_markets?.length > 0;
  const hasHistory = result.rate_history?.length > 1;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="container mx-auto px-5 sm:px-6 py-10 max-w-3xl space-y-5">

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Link to="/simulate" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> New simulation
            </Link>
            <Button asChild variant="outline" size="sm" className="flex-shrink-0">
              <Link to="/simulate"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />New</Link>
            </Button>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-foreground leading-snug">
            {result.product_name.length > 60 ? result.product_name.substring(0, 60) + "…" : result.product_name}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 break-words">
            {(result as any).origin_country || "Origin"} → {result.destination_country} · {fmt(result.shipment_value)} shipment
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${isImporter ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-orange-50 text-orange-700 border border-orange-200"}`}>
            {isImporter ? "📦 Import analysis" : "🚢 Export analysis"}
          </div>
        </div>

        {/* THE BIG NUMBER — tariff cost, front and center */}
        <div className={`rounded-xl border p-5 sm:p-6 ${result.tariff_cost_today > 0 ? "border-destructive/30 bg-destructive-soft" : "border-success/30 bg-success-soft"}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                {isImporter ? `Duty owed at ${result.destination_country} border` : "Tariff cost on this shipment"}
              </div>
              <div className={`text-4xl sm:text-5xl font-bold font-mono ${result.tariff_cost_today > 0 ? "text-destructive" : "text-success"}`}>
                {result.tariff_cost_today > 0 ? `-${fmt(result.tariff_cost_today)}` : "No cost"}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">
                {result.effective_rate}% on {fmt(result.shipment_value)}
                {result.retaliation_rate > 0 && (
                  <span className="text-destructive ml-2">· includes {result.retaliation_rate}% retaliatory tax</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Risk score</div>
              <div className={`text-3xl font-bold font-mono ${(result.risk_score ?? 0) >= 60 ? "text-destructive" : (result.risk_score ?? 0) >= 30 ? "text-warning" : "text-success"}`}>
                {result.risk_score ?? 0}<span className="text-lg font-normal text-muted-foreground">/100</span>
              </div>
              <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mt-1 ${(result.risk_score ?? 0) >= 60 ? "bg-destructive-soft text-destructive" : (result.risk_score ?? 0) >= 30 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}>
                {result.risk_label ?? "LOW"}
              </div>
            </div>
          </div>
          {result.retaliation_note && (
            <div className="mt-3 pt-3 border-t border-destructive/10 text-xs text-muted-foreground">
              {result.retaliation_note}
            </div>
          )}
        </div>

        {/* Recommendation — moved up because it's the most actionable thing */}
        {result.recommendation && (
          <div className="rounded-xl border border-primary/20 bg-primary-soft p-5">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <div className="text-xs uppercase tracking-wider text-primary font-medium">What to do</div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{result.recommendation}</p>
          </div>
        )}

        {/* FTA savings banner */}
        {(result as any).preferential_rate !== null && (result as any).preferential_rate !== undefined && (result as any).preferential_saving > 0 && (
          <div className="rounded-xl border border-success/30 bg-success-soft p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-success">Free trade agreement rate available</div>
              <div className="text-xs text-muted-foreground mt-0.5">{(result as any).preferential_note}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold text-success font-mono">{(result as any).preferential_rate}%</div>
              <div className="text-xs text-success font-medium">saves {fmt((result as any).preferential_saving)}</div>
            </div>
          </div>
        )}

        {/* Classification card — shows which product code was used and why */}
        {classification && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <FileSearch className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground">How we classified this product</div>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="font-mono text-lg font-bold text-foreground">{classification.hts8}</div>
                <div className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${classification.confidence >= 75 ? "bg-success-soft text-success" : classification.confidence >= 55 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>
                  {classification.confidence}% confident
                </div>
                <div className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono mt-1">
                  Rule {classification.gri_rule}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{classification.description}</p>
              <p className="text-xs text-foreground/70 italic">"{classification.reasoning}"</p>
              {classification.cbp_ruling?.number && (
                <div className="flex items-center gap-1.5 pt-1">
                  <ExternalLink className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[11px] text-primary">
                    Backed by CBP Ruling {classification.cbp_ruling.number}
                    {classification.cbp_ruling.date ? ` (${classification.cbp_ruling.date.substring(0, 4)})` : ""}
                    {" "} — an official US Customs decision on a similar product
                  </span>
                </div>
              )}
              {!classification.usitc_validated && (
                <div className="flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  <span className="text-[11px] text-warning">This code was not found in our US rate database — verify with your customs broker</span>
                </div>
              )}
            </div>
            <div className="px-4 py-2 bg-muted/20 border-t border-border text-[10px] text-muted-foreground">
              Classification follows standard international customs rules (WCO General Rules of Interpretation)
            </div>
          </div>
        )}

        {/* Tariff breakdown — the actual numbers */}
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Full tariff breakdown</div>
            {result.data_freshness && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(result.data_freshness).toLocaleDateString()}
              </div>
            )}
          </div>
          {[
            { label: "Product code", value: result.hs_code, note: "Used for customs classification" },
            { label: "Trade route", value: `${(result as any).origin_country || "Origin"} → ${result.destination_country}` },
            { label: `${result.destination_country} MFN rate (all origins)`, value: `${result.mfn_rate}%`, note: "WTO bound rate — what this country charges every trading partner" },
            (result as any).preferential_rate !== null && (result as any).preferential_rate !== undefined
              ? { label: "FTA preferential rate", value: `${(result as any).preferential_rate}%`, highlight: "success", note: (result as any).preferential_note ?? "If your goods qualify under the agreement" }
              : null,
            { label: isImporter ? `Additional ${result.destination_country} duties (live)` : "Retaliatory duty from destination (live)", value: result.retaliation_rate > 0 ? `+${result.retaliation_rate}%` : "None active", highlight: result.retaliation_rate > 0 ? "warning" : "success" },
            (result as any).origin_specific_rate > 0
              ? { label: `Origin-specific duty (${(result as any).origin_country} → ${result.destination_country})`, value: `+${(result as any).origin_specific_rate}%`, highlight: "destructive", note: (result as any).origin_specific_note ?? "Applies to your origin country only" }
              : null,
            { label: "Effective rate on your shipment", value: `${result.effective_rate}%`, highlight: result.effective_rate >= 20 ? "destructive" : result.effective_rate > 0 ? "warning" : "success" },
            { label: isImporter ? `Total duty owed at ${result.destination_country} customs` : "Total tariff cost on this shipment", value: fmt(result.tariff_cost_today), highlight: result.tariff_cost_today > 10000 ? "destructive" : result.tariff_cost_today > 0 ? "warning" : "success" },
          ].filter(Boolean).map(({ label, value, highlight, note }: any) => (
            <div key={label} className="px-4 py-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-mono font-medium ${highlight === "destructive" ? "text-destructive" : highlight === "warning" ? "text-warning" : highlight === "success" ? "text-success" : "text-foreground"}`}>
                  {value}
                </span>
              </div>
              {note && <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>}
            </div>
          ))}
        </div>

        {/* Rate history — bigger, more context */}
        {hasHistory && (
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  US rate history · {result.rate_history[0]?.year}–{result.rate_history[result.rate_history.length - 1]?.year}
                </div>
                <div className="text-sm font-medium text-foreground">What the US has charged on this product over time</div>
              </div>
              {result.volatility_stats && (
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Average</div>
                    <div className="text-sm font-mono font-medium text-foreground">{result.volatility_stats.avg_rate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Peak</div>
                    <div className="text-sm font-mono font-bold text-destructive">{result.volatility_stats.max_rate.toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>
            <Sparkline data={result.rate_history} />
            <div className="mt-3 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground leading-relaxed">
              {result.volatility_stats?.max_jump_year
                ? <>Biggest single-year jump: <span className="text-destructive font-medium">+{result.volatility_stats.max_year_jump.toFixed(1)} percentage points</span> in {result.volatility_stats.max_jump_year}.
                  {result.effective_rate > 0 && result.volatility_stats.max_rate && result.effective_rate >= result.volatility_stats.max_rate - 1
                    ? " The rate is currently at its historical peak."
                    : " The current rate is below the historical peak."}</>
                : result.rate_history.every(r => r.rate === 0)
                  ? "The US charges 0% on this product domestically — this is accurate, not missing data. The destination country's rate shown above is separate."
                  : "No major rate spikes recorded in the historical data."}
            </div>
          </div>
        )}

        {/* Scenarios */}
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">What happens if things change</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {result.scenarios.map((s) => (
              <div key={s.name} className={`rounded-xl border p-4 ${sevColor(s.severity)}`}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="text-xs font-medium text-foreground leading-snug">{s.name}</div>
                  {sevIcon(s.severity)}
                </div>
                <div className="flex items-baseline gap-3 sm:block">
                  <div className="font-mono text-2xl font-bold text-foreground mb-0.5">{s.tariff_rate}%</div>
                  <div className={`text-sm font-medium sm:mb-2 ${s.tariff_cost > 0 ? "text-destructive" : "text-success"}`}>
                    {s.tariff_cost > 0 ? `-${fmt(s.tariff_cost)}` : "No cost"}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 sm:mt-0">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alternative markets */}
        {hasAltMarkets && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {isImporter ? "Other countries to source from" : "Other countries to sell to"} · ranked by tax rate
              </div>
            </div>
            <div className="divide-y divide-border">
              {result.alternative_markets.map((m) => (
                <div key={m.country} className="flex items-center justify-between px-4 py-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{m.country}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {m.retaliation === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-soft text-success font-medium">
                          {isImporter ? `No extra ${result.destination_country} duties` : "No retaliatory tax"}
                        </span>
                      )}
                      {(m as any).source === "wto" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium border border-blue-200">Official rate</span>
                      )}
                      {(m as any).source === "live" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-soft text-success font-medium">Live</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className={`font-mono text-sm font-bold ${m.rate === 0 ? "text-success" : m.rate < result.effective_rate ? "text-warning" : "text-muted-foreground"}`}>
                      {m.rate}%
                    </div>
                    {m.saving > 0 && (
                      <div className="text-[11px] text-success font-medium">saves {fmt(m.saving)}</div>
                    )}
                    {m.saving < 0 && (
                      <div className="text-[11px] text-destructive font-medium">{fmt(Math.abs(m.saving))} more</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-muted/20 border-t border-border text-[10px] text-muted-foreground">
              Rates from the WTO official database · retaliation data updated daily
            </div>
          </div>
        )}

        {/* Risk analysis */}
        {result.risk_summary && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Risk analysis</div>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3 w-3 text-muted-foreground" />
                <div className="text-[10px] text-muted-foreground">
                  {isImporter ? "Probability of rate escalation" : "Retaliation probability"}: <span className={`font-medium ${(result.retaliation_probability ?? 0) >= 60 ? "text-destructive" : (result.retaliation_probability ?? 0) >= 30 ? "text-warning" : "text-success"}`}>{result.retaliation_probability ?? 0}%</span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-foreground leading-relaxed">{result.risk_summary}</p>
            </div>
          </div>
        )}

        {/* Prediction */}
        {hasPrediction && (
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-warning" />
              <div className="text-xs uppercase tracking-wider text-warning font-medium">Where rates are likely going · next 6 to 12 months</div>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{result.prediction}</p>
          </div>
        )}

        {/* Email alert */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium text-foreground">Email this report</div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Send the full simulation to your inbox.</p>
          {sent ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Report sent
            </div>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" type="email" />
              <Button onClick={handleSendAlert} disabled={sending || !email} className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{result.data_source}</p>
      </main>
      <Footer />
    </div>
  );
}
