import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, CheckCircle2, AlertTriangle, Radio } from "lucide-react";

type TariffEntry = {
  hs_code: string;
  product_name: string;
  destination_country: string;
  effective_rate: number;
  retaliation_rate: number;
  retaliation_note: string;
  synced_at: string;
};

type ScrapeEntry = {
  source_label: string;
  mentions_found: number;
  scraped_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function severityFor(rate: number) {
  if (rate >= 25) return "high";
  if (rate >= 10) return "medium";
  if (rate > 0) return "low";
  return "none";
}

export function LiveFeed() {
  const [tariffs, setTariffs] = useState<TariffEntry[]>([]);
  const [scrapes, setScrapes] = useState<ScrapeEntry[]>([]);
  const [lastPing, setLastPing] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase
        .from("tariff_rates")
        .select("hs_code,product_name,destination_country,effective_rate,retaliation_rate,retaliation_note,synced_at")
        .gt("effective_rate", 0)
        .order("effective_rate", { ascending: false })
        .limit(8),
      supabase
        .from("scrape_log")
        .select("source_label,mentions_found,scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(3),
    ]);
    if (t) setTariffs(t);
    if (s) setScrapes(s);
    setLastPing(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-16 sm:py-20 border-b border-border bg-background">
      <div className="container mx-auto px-5 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-primary mb-2">Live tariff intelligence</div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              What US exporters are facing right now
            </h2>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/30 text-xs text-muted-foreground">
            <Radio className="h-3 w-3 text-success animate-pulse" />
            Live · refreshes every 30s
            {lastPing && <span className="font-mono">· {timeAgo(lastPing)}</span>}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tariff alerts feed */}
          <div className="lg:col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Active tariff alerts</div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg border border-border bg-muted/20 animate-pulse" />
                ))
              ) : tariffs.map((t) => {
                const sev = severityFor(t.effective_rate);
                return (
                  <div
                    key={`${t.hs_code}-${t.destination_country}`}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
                      sev === "high" ? "border-destructive/30 bg-destructive-soft" :
                      sev === "medium" ? "border-warning/30 bg-warning-soft" :
                      "border-success/30 bg-success-soft"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {sev === "high" ? <TrendingDown className="h-4 w-4 text-destructive flex-shrink-0" /> :
                       sev === "medium" ? <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" /> :
                       <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{t.product_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          → {t.destination_country}
                          {t.retaliation_rate > 0 && <span className="text-destructive ml-1">· +{t.retaliation_rate}% retaliation</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-mono font-bold text-lg ${sev === "high" ? "text-destructive" : sev === "medium" ? "text-warning" : "text-success"}`}>
                        {t.effective_rate}%
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">HS {t.hs_code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrape activity log */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Pipeline activity</div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-medium text-foreground">Scraper running</span>
              </div>
              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-muted/20 animate-pulse" />
                  ))
                ) : scrapes.length > 0 ? scrapes.map((s, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-xs font-medium text-foreground truncate">{s.source_label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground flex-shrink-0">{timeAgo(s.scraped_at)}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {s.mentions_found > 0 ? `${s.mentions_found} tariff mentions found` : "Fetched · parsing complete"}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    First scrape running…
                  </div>
                )}
              </div>
              <div className="px-4 py-2.5 bg-muted/20 border-t border-border">
                <div className="text-[10px] text-muted-foreground">Syncs every hour from USTR.gov</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <div className="text-xl font-bold text-foreground">{tariffs.filter(t => t.retaliation_rate > 0).length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Active retaliations</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <div className="text-xl font-bold text-destructive">
                  {tariffs.length > 0 ? Math.max(...tariffs.map(t => t.effective_rate)) : 0}%
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Peak rate tracked</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
