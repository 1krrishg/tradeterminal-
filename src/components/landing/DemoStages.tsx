import { Upload, Search, BarChart3, Lightbulb, TrendingUp, ArrowDown } from "lucide-react";

export function DemoStages() {
  return (
    <section id="how" className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">How it works</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            From shipment to decision in 30 seconds.
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Stage
            icon={<Upload className="h-4 w-4 text-primary" />}
            num="01"
            title="Upload your trade document or search any product"
            desc="Drop an invoice, packing list, or any export doc — Mistral AI reads it and extracts product, HS code, destination, and value. Or search any of 12,788 products from the USITC catalog directly."
          />
          <Arrow />
          <Stage
            icon={<Search className="h-4 w-4 text-primary" />}
            num="02"
            title="We pull 29 years of rate history + live retaliation data"
            desc="TariffLens queries the official USITC database (1998–2026, 262k data points) for the MFN baseline, then cross-references live-scraped retaliatory tariffs updated hourly. You see exactly what the real rate is today."
          />
          <Arrow />
          <Stage
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            num="03"
            title="Simulation: dollar impact across 3 scenarios"
            desc="Today's rate, an escalation scenario based on historical volatility, and the best alternative market ranked by effective rate. Every number is quantified — no vague percentages, just exact dollar impact on your shipment."
          />
          <Arrow />
          <Stage
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            num="04"
            title="Risk score + 6–12 month rate prediction"
            desc="A 0–100 risk score driven by current exposure, historical volatility, and retaliation probability. Then a Groq-powered prediction: based on the rate pattern since 1998, what is likely to happen in the next 6–12 months — with specific years cited as precedent."
          />
          <Arrow />
          <Stage
            icon={<Lightbulb className="h-4 w-4 text-primary" />}
            num="05"
            title="One specific recommendation with dollar savings"
            desc="Reroute, hedge, accelerate, or stay the course — the AI picks one action and quantifies it. Not a paragraph of caveats. One sentence, one number."
          />
        </div>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="h-5 w-5 text-muted-foreground/40" />
    </div>
  );
}

function Stage({ icon, num, title, desc }: { icon: React.ReactNode; num: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 flex gap-4 items-start">
      <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-mono text-muted-foreground mb-0.5">{num}</div>
        <div className="font-semibold text-foreground text-sm mb-1">{title}</div>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
