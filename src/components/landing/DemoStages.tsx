import { Upload, Search, BarChart3, Lightbulb, TrendingUp, ArrowDown, FileSearch } from "lucide-react";

export function DemoStages() {
  return (
    <section id="how" className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">How it works</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            From product description to decision in 30 seconds.
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Stage
            icon={<Upload className="h-4 w-4 text-primary" />}
            num="01"
            title="Upload a trade document or describe your product"
            desc="Drop an invoice or packing list and Mistral OCR reads it: product name, HS code, origin, destination, value, incoterms. Or just type what the product is and skip the upload."
          />
          <Arrow />
          <Stage
            icon={<FileSearch className="h-4 w-4 text-primary" />}
            num="02"
            title="GRI classification with a CBP ruling citation"
            desc="TariffLens applies the WCO General Rules of Interpretation in order, returns the top 3 HS code candidates with confidence scores, and cites a real CBP CROSS ruling to back each one. You can hand this to your customs broker as an audit trail."
          />
          <Arrow />
          <Stage
            icon={<Search className="h-4 w-4 text-primary" />}
            num="03"
            title="29 years of rate history + live retaliation data"
            desc="The USITC database goes back to 1998 (262k data points). TariffLens pulls the MFN baseline for your product and cross-checks live retaliatory tariffs from China MOFCOM, EU Official Journal, Canada Gazette, and India Customs Notifications."
          />
          <Arrow />
          <Stage
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            num="04"
            title="Dollar impact across three scenarios"
            desc="Today's rate, an escalation scenario built from the actual historical jump pattern for this product, and the best alternative market by effective rate. Every number is the dollar cost on your specific shipment value."
          />
          <Arrow />
          <Stage
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            num="05"
            title="Risk score + 6 to 12 month prediction"
            desc="A 0 to 100 risk score from current exposure, 29-year volatility, and retaliation probability. Then a prediction grounded in the historical rate pattern: what happened in analogous episodes since 1998 and what tends to follow."
          />
          <Arrow />
          <Stage
            icon={<Lightbulb className="h-4 w-4 text-primary" />}
            num="06"
            title="One recommendation with a number attached"
            desc="Reroute, hedge, accelerate, or hold. One action, one dollar figure. Not a list of considerations."
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
