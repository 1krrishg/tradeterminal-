import { ArrowRight, Globe, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="top" className="relative border-b border-border overflow-hidden">
      <div className="container mx-auto px-5 sm:px-6 pt-10 pb-12 md:pt-20 md:pb-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          <div className="lg:col-span-5 lg:pt-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] sm:text-xs text-muted-foreground mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Bright Data · Runpod Flash · Qwen3.5-2B · live scraping
            </div>

            <h1 className="text-[2rem] leading-[1.1] sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.05] font-semibold tracking-tight text-foreground mb-5">
              Know if your product will sell before you ship it.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-7 leading-relaxed">
              TradeTerminal gives small exporters two answers in one shot — will customs let it through, and is there money in the market? Get live duty rates, required docs, and actual shelf prices from BigBasket, Rakuten, and Mercado Libre.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700 font-medium">
                🛃 Compliance — duties, docs, certifications
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                📈 Market — live prices, margin gap, demand
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-5 font-medium w-full sm:w-auto">
                <Link to="/analyze">
                  Analyze a route
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 px-5 border-border hover:bg-secondary w-full sm:w-auto">
                <a href="#how">See how it works ↓</a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> FSSAI · CBIC · Japan Customs · EU TARIC</span>
              <span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-success" /> Live ecommerce prices scraped per query</span>
              <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-primary" /> AI extraction via Qwen3.5-2B on GPU</span>
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
          tradeterminal · spices · Nepal → India
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 text-xs">
        {/* Compliance panel */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Compliance</div>
          <div className="rounded-md border border-border bg-muted/30 divide-y divide-border">
            {[
              ["HS Code", "0910.91"],
              ["Duty rate", "30%"],
              ["GST", "5%"],
              ["FSSAI license", "Required"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 px-2.5 py-1.5">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-medium text-foreground text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-warning/30 bg-warning-soft p-2.5">
            <div className="text-[10px] text-warning font-medium mb-0.5">Rejection risk</div>
            <p className="text-[10px] text-foreground">Pesticide residue testing required at border. 18% of shipments rejected.</p>
          </div>
        </div>

        {/* Market panel */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Market</div>
          <div className="rounded-md border border-border bg-muted/30 divide-y divide-border">
            {[
              ["Avg price", "₹320/kg"],
              ["Price range", "₹280–₹420"],
              ["Sellers", "1,240+"],
              ["Sentiment", "Positive"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 px-2.5 py-1.5">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-medium text-foreground text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-success/30 bg-success-soft p-2.5">
            <div className="text-[10px] text-success font-medium mb-0.5">Margin gap</div>
            <p className="text-[10px] text-foreground font-semibold">+$312 vs landed cost. Strong opportunity.</p>
          </div>
        </div>
      </div>

      {/* Landed cost bar */}
      <div className="px-4 pb-4">
        <div className="rounded-md border border-primary/20 bg-primary-soft p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-primary mb-1.5">Landed cost breakdown</div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              ["Product", "$500"],
              ["Shipping", "$95"],
              ["Tariff", "$150"],
              ["Fees", "$80"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] text-muted-foreground">{k}</div>
                <div className="text-[11px] font-mono font-semibold text-foreground">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-primary/20 flex justify-between">
            <span className="text-[10px] text-muted-foreground">Total landed</span>
            <span className="text-[11px] font-mono font-bold text-primary">$825</span>
          </div>
        </div>
      </div>
    </div>
  );
}
