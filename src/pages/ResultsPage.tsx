import { useLocation, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, TrendingDown, CheckCircle2, AlertTriangle, Lightbulb, RefreshCw, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Scenario = {
  name: string;
  description: string;
  tariff_rate: number;
  tariff_cost: number;
  net_proceeds: number;
  severity: "high" | "medium" | "low" | "none";
};

type SimResult = {
  hs_code: string;
  product_name: string;
  destination_country: string;
  shipment_value: number;
  mfn_rate: number;
  retaliation_rate: number;
  effective_rate: number;
  retaliation_note: string;
  tariff_cost_today: number;
  scenarios: Scenario[];
  risk_summary: string;
  recommendation: string;
  data_source: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) {
  return `${n}%`;
}

export default function ResultsPage() {
  const { state } = useLocation();
  const { toast } = useToast();
  const result: SimResult | undefined = state?.result;
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

  const severityColor = (s: string) => {
    if (s === "high") return "border-destructive/30 bg-destructive-soft";
    if (s === "medium") return "border-warning/30 bg-warning-soft";
    return "border-success/30 bg-success-soft";
  };

  const severityIcon = (s: string) => {
    if (s === "high") return <TrendingDown className="h-4 w-4 text-destructive" />;
    if (s === "medium") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="container mx-auto px-5 sm:px-6 py-10 max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/simulate" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
              <ArrowLeft className="h-3 w-3" /> New simulation
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
              {result.product_name} → {result.destination_country}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Shipment value: {fmt(result.shipment_value)}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="flex-shrink-0">
            <Link to="/simulate"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />New simulation</Link>
          </Button>
        </div>

        {/* Current tariff breakdown */}
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Current effective tariff</div>
          </div>
          {[
            { label: "HS Code", value: result.hs_code },
            { label: "MFN duty (baseline)", value: pct(result.mfn_rate) },
            { label: "Retaliatory tariff", value: result.retaliation_rate > 0 ? `+${pct(result.retaliation_rate)}` : "None", highlight: result.retaliation_rate > 0 ? "warning" : "success" },
            { label: "Effective rate today", value: pct(result.effective_rate), highlight: result.effective_rate >= 20 ? "destructive" : result.effective_rate > 0 ? "warning" : "success" },
            { label: "Tariff cost on this shipment", value: fmt(result.tariff_cost_today), highlight: result.tariff_cost_today > 0 ? "destructive" : "success" },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={`font-mono font-medium ${highlight === "destructive" ? "text-destructive" : highlight === "warning" ? "text-warning" : highlight === "success" ? "text-success" : "text-foreground"}`}>
                {value}
              </span>
            </div>
          ))}
          {result.retaliation_note && (
            <div className="px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
              {result.retaliation_note}
            </div>
          )}
        </div>

        {/* Scenarios */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Scenarios</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {result.scenarios.map((s) => (
              <div key={s.name} className={`rounded-xl border p-4 ${severityColor(s.severity)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-foreground">{s.name}</div>
                  {severityIcon(s.severity)}
                </div>
                <div className="font-mono text-2xl font-bold text-foreground mb-0.5">{pct(s.tariff_rate)}</div>
                <div className={`text-sm font-medium mb-2 ${s.tariff_cost > 0 ? "text-destructive" : "text-success"}`}>
                  {s.tariff_cost > 0 ? `-${fmt(s.tariff_cost)}` : "No tariff cost"}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI risk summary */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">AI Risk Summary</div>
          </div>
          <div className="p-4">
            <p className="text-sm text-foreground leading-relaxed">{result.risk_summary}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-xl border border-primary/20 bg-primary-soft p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-primary" />
            <div className="text-xs uppercase tracking-wider text-primary font-medium">Recommendation</div>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{result.recommendation}</p>
        </div>

        {/* Email alert — powered by Composio */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium text-foreground">Email this report</div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Get this simulation sent to your inbox via Composio.</p>
          {sent ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> Report sent successfully
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                type="email"
              />
              <Button onClick={handleSendAlert} disabled={sending || !email} className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          )}
        </div>

        {result.data_source && (
          <p className="text-xs text-muted-foreground">Data: {result.data_source}</p>
        )}
      </main>
      <Footer />
    </div>
  );
}
