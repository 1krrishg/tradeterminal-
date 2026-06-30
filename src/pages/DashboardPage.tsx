import { useLocation, Link } from "react-router-dom";
import {
  ArrowLeft, Zap, Shield, TrendingUp, AlertTriangle, CheckCircle2,
  ExternalLink, RefreshCw, Package, Globe, DollarSign, Users,
  MessageSquare, ThumbsDown, Truck, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyzeResponse, SourcedItem } from "@/lib/api";

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 75 ? "bg-success-soft text-success border-success/20"
    : pct >= 50 ? "bg-warning-soft text-warning border-warning/20"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {pct}%
    </span>
  );
}

function SourceLink({ source }: { source: string }) {
  if (!source || source === "unknown") return null;
  const isUrl = source.startsWith("http");
  return isUrl ? (
    <a href={source} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
      <ExternalLink className="h-2.5 w-2.5" />source
    </a>
  ) : (
    <span className="text-[10px] text-muted-foreground">{source}</span>
  );
}

function ItemRow({ item, nameKey = "name" }: { item: SourcedItem; nameKey?: "name" | "description" }) {
  const label = item.name || item.description || "—";
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground leading-snug">{label}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <ConfidenceBadge confidence={item.confidence} />
          <SourceLink source={item.source} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
    </div>
  );
}

function CompetitionBadge({ level }: { level: "low" | "medium" | "high" }) {
  const map = {
    low: "bg-success-soft text-success border-success/20",
    medium: "bg-warning-soft text-warning border-warning/20",
    high: "bg-destructive-soft text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${map[level]}`}>
      {level} competition
    </span>
  );
}

function SentimentBadge({ sentiment }: { sentiment: "positive" | "mixed" | "negative" }) {
  const map = {
    positive: "bg-success-soft text-success border-success/20",
    mixed: "bg-warning-soft text-warning border-warning/20",
    negative: "bg-destructive-soft text-destructive border-destructive/20",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${map[sentiment]}`}>
      {sentiment} sentiment
    </span>
  );
}

export default function DashboardPage() {
  const { state } = useLocation();
  const result: AnalyzeResponse | undefined = state?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No analysis data. Go back and run a query.</p>
        <Button asChild variant="outline"><Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
      </div>
    );
  }

  const { compliance, market, shipping, landed_cost, margin_gap_usd, margin_gap_label } = result;
  const marginPositive = (margin_gap_usd ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm tracking-tight">TradeTerminal</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground font-medium">
            {result.product} · {result.origin} → {result.destination}
          </span>
          {result.cached && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">cached</span>
          )}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />New query</Link>
        </Button>
      </header>

      {/* Margin gap hero bar */}
      {margin_gap_usd !== null && margin_gap_usd !== undefined && (
        <div className={`px-6 py-4 border-b ${marginPositive ? "bg-success-soft border-success/20" : "bg-destructive-soft border-destructive/20"}`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Margin gap (local price − landed cost)</div>
              <div className={`text-3xl font-bold font-mono ${marginPositive ? "text-success" : "text-destructive"}`}>
                {marginPositive ? "+" : ""}{fmtUSD(margin_gap_usd)}
                <span className="text-sm font-normal text-muted-foreground ml-2">per unit</span>
              </div>
            </div>
            <div className={`text-sm font-medium px-4 py-2 rounded-lg border ${marginPositive ? "border-success/30 text-success bg-success-soft" : "border-destructive/30 text-destructive bg-destructive-soft"}`}>
              {margin_gap_label ?? (marginPositive ? "Profitable route" : "Margin negative — review costs")}
            </div>
          </div>
        </div>
      )}

      {/* Two-panel dashboard */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: COMPLIANCE ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Compliance</h2>
              <span className="text-xs text-muted-foreground">Will it get through customs?</span>
            </div>

            {/* HS Code + Duty rate */}
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Classification & Duty</div>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">HS Code</span>
                <span className="font-mono font-medium text-foreground">{compliance.hs_code || "N/A"}</span>
              </div>
              <div className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Duty rate</span>
                <span className={`font-mono font-bold text-lg ${(compliance.duty_rate_percent ?? 0) > 20 ? "text-destructive" : (compliance.duty_rate_percent ?? 0) > 5 ? "text-warning" : "text-success"}`}>
                  {compliance.duty_rate_percent !== null && compliance.duty_rate_percent !== undefined ? `${compliance.duty_rate_percent}%` : "N/A"}
                </span>
              </div>
              {compliance.import_fees_and_taxes.map((fee, i) => (
                <div key={i} className="px-4 py-2.5 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{fee.name}</span>
                  <span className="font-medium text-foreground">{fee.estimated_amount}</span>
                </div>
              ))}
            </div>

            {/* Required documents */}
            {compliance.required_documents.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <SectionHeader icon={Package} title="Required Documents" />
                </div>
                <div className="px-4">
                  {compliance.required_documents.map((d, i) => <ItemRow key={i} item={d} />)}
                </div>
              </div>
            )}

            {/* Certifications */}
            {compliance.certifications.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <SectionHeader icon={CheckCircle2} title="Certifications" />
                </div>
                <div className="px-4">
                  {compliance.certifications.map((c, i) => <ItemRow key={i} item={c} />)}
                </div>
              </div>
            )}

            {/* Restrictions */}
            {compliance.restrictions.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-card overflow-hidden">
                <div className="px-4 py-3 bg-destructive-soft border-b border-destructive/20">
                  <SectionHeader icon={AlertTriangle} title="Restrictions" />
                </div>
                <div className="px-4">
                  {compliance.restrictions.map((r, i) => <ItemRow key={i} item={r} />)}
                </div>
              </div>
            )}

            {/* Labeling requirements */}
            {compliance.labeling_requirements.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <SectionHeader icon={Package} title="Labeling Requirements" />
                </div>
                <div className="px-4">
                  {compliance.labeling_requirements.map((l, i) => <ItemRow key={i} item={l} />)}
                </div>
              </div>
            )}

            {/* Common rejection reasons */}
            {compliance.common_rejection_reasons.length > 0 && (
              <div className="rounded-xl border border-warning/20 bg-warning-soft overflow-hidden">
                <div className="px-4 py-3 border-b border-warning/20">
                  <div className="text-xs font-semibold uppercase tracking-wider text-warning flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" /> Common Rejection Reasons
                  </div>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {compliance.common_rejection_reasons.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-warning mt-0.5 shrink-0">·</span> {r}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent regulation changes */}
            {compliance.recent_regulation_changes.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Regulation Changes</div>
                </div>
                <div className="px-4 divide-y divide-border">
                  {compliance.recent_regulation_changes.map((c, i) => (
                    <div key={i} className="py-2.5">
                      <div className="text-sm text-foreground leading-snug">{c.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        <SourceLink source={c.source} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Data source note */}
            <div className="text-[10px] text-muted-foreground px-1">{result.data_source}</div>
          </div>

          {/* ── RIGHT: MARKET ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Market Intelligence</h2>
              <span className="text-xs text-muted-foreground">Will it make money?</span>
            </div>

            {/* Pricing overview */}
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              <div className="px-4 py-2 bg-muted/30">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Local Market Pricing — {result.destination}</div>
              </div>
              <div className="px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Avg market price</div>
                <div className="text-3xl font-bold font-mono text-foreground">{market.local_avg_price}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Range: {market.local_price_range}</div>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Sellers in market</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground">{market.seller_count > 0 ? market.seller_count.toLocaleString() : "—"}</span>
                  <CompetitionBadge level={market.competition_level} />
                </div>
              </div>
            </div>

            {/* Consumer sentiment */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consumer Sentiment</div>
                </div>
                <SentimentBadge sentiment={market.consumer_sentiment} />
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed">{market.sentiment_summary}</p>
              </div>
              {market.top_complaints.length > 0 && (
                <div className="px-4 pb-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <ThumbsDown className="h-3 w-3" /> Top complaints
                  </div>
                  <div className="space-y-1">
                    {market.top_complaints.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-destructive mt-0.5 shrink-0">·</span> {c}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Shipping */}
            {shipping && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shipping — Freightos</div>
                </div>
                <div className="divide-y divide-border">
                  <div className="px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">Carrier</span>
                    <span className="font-medium text-foreground">{shipping.carrier}</span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated cost</span>
                    <span className="font-mono font-bold text-foreground">{fmtUSD(shipping.estimated_cost_usd)}</span>
                  </div>
                  <div className="px-4 py-2.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">Transit time</span>
                    <span className="text-foreground">{shipping.transit_days}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Landed cost breakdown */}
            {landed_cost && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Landed Cost Breakdown</div>
                </div>
                <div className="divide-y divide-border">
                  {[
                    { label: "Product cost", value: landed_cost.product_cost_usd },
                    { label: "Shipping", value: landed_cost.shipping_usd },
                    { label: "Tariff / duty", value: landed_cost.tariff_usd },
                    { label: "Other fees", value: landed_cost.other_fees_usd },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-2.5 flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-foreground">{value > 0 ? fmtUSD(value) : "—"}</span>
                    </div>
                  ))}
                  <div className="px-4 py-3 flex justify-between text-sm bg-muted/20">
                    <span className="font-semibold text-foreground">Total landed cost</span>
                    <span className="font-mono font-bold text-foreground text-base">{fmtUSD(landed_cost.total_usd)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Margin gap detail */}
            {margin_gap_usd !== null && margin_gap_usd !== undefined && landed_cost && (
              <div className={`rounded-xl border p-5 ${marginPositive ? "border-success/30 bg-success-soft" : "border-destructive/30 bg-destructive-soft"}`}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Margin gap</div>
                <div className={`text-4xl font-bold font-mono mb-1 ${marginPositive ? "text-success" : "text-destructive"}`}>
                  {marginPositive ? "+" : ""}{fmtUSD(margin_gap_usd)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Local avg {market.local_avg_price} − landed {fmtUSD(landed_cost.total_usd)}
                </div>
                <div className={`mt-3 text-sm font-medium ${marginPositive ? "text-success" : "text-destructive"}`}>
                  {margin_gap_label}
                </div>
              </div>
            )}

            {/* Globe context */}
            <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <Globe className="h-8 w-8 text-muted-foreground/30" />
              <div>
                <div className="text-xs font-medium text-foreground">{result.origin} → {result.destination}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Market data scraped via Bright Data · Ecommerce: BigBasket / Rakuten / Mercado Libre · Reviews: multilingual NLP via BGE-M3 + Qwen3.5-2B on Runpod Flash
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        TradeTerminal · Built for Runpod Flash Hack Day
      </footer>
    </div>
  );
}
