import { Globe, Search, BarChart3, DollarSign, TrendingUp, ArrowDown } from "lucide-react";

export function DemoStages() {
  return (
    <section id="how" className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">How it works</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            From product to dashboard in under 60 seconds.
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Stage
            icon={<Globe className="h-4 w-4 text-primary" />}
            num="01"
            title="Pick your product, origin, and destination"
            desc="Type your product name, select where it's coming from, and where you want to sell it. That's the entire input. No HS codes, no customs forms, no prior knowledge required."
            source="3 fields · instant start"
          />
          <Arrow />
          <Stage
            icon={<Search className="h-4 w-4 text-primary" />}
            num="02"
            title="We scrape regulatory portals and live ecommerce simultaneously"
            desc="Bright Data Web Unlocker hits government import authority sites (FSSAI for India, Japan Customs, EU TARIC) for duty rates, required documents, and certification requirements — while also scraping live shelf prices from BigBasket, Rakuten, Mercado Libre, or Zalando depending on destination."
            source="Bright Data · FSSAI · CBIC · Japan Customs · MHLW · EU TARIC · BigBasket · Rakuten · Mercado Libre · Zalando"
          />
          <Arrow />
          <Stage
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            num="03"
            title="RAG pipeline extracts structured data from scraped text"
            desc="All scraped text is chunked into 500-token segments and embedded via BGE-M3 (multilingual). The most relevant chunks are retrieved and sent to Qwen3.5-2B running on a Runpod Flash GPU. The model outputs a structured JSON with compliance fields and market fields — with confidence scores and source URLs."
            source="BGE-M3 embeddings · ChromaDB · Qwen3.5-2B on Runpod Flash AMPERE GPU"
          />
          <Arrow />
          <Stage
            icon={<DollarSign className="h-4 w-4 text-primary" />}
            num="04"
            title="Shipping cost fetched from Freightos, landed cost computed"
            desc="We call Freightos for a per-route shipping estimate. Then we add it to the extracted duty rate and product cost to compute your full landed cost breakdown — product, shipping, tariff, fees, total. The margin gap is the live local market price minus your landed cost."
            source="Freightos API · computed landed cost · live price delta"
          />
          <Arrow />
          <Stage
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            num="05"
            title="Two panels: compliance left, market right"
            desc="The left panel shows everything customs needs — HS code, duty rate, required documents, certifications, labeling rules, common rejection reasons, and recent regulation changes. The right panel shows the market opportunity — local pricing, seller count, consumer sentiment, top complaints, landed cost breakdown, and your margin gap as a single big number."
            source="Confidence-scored compliance · live market intelligence · margin gap"
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

function Stage({ icon, num, title, desc, source }: { icon: React.ReactNode; num: string; title: string; desc: string; source: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 flex gap-4 items-start">
      <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono text-muted-foreground mb-0.5">{num}</div>
        <div className="font-semibold text-foreground text-sm mb-1">{title}</div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{desc}</p>
        <div className="text-[10px] font-mono text-primary/70 bg-primary/5 border border-primary/10 rounded px-2 py-1 inline-block">
          {source}
        </div>
      </div>
    </div>
  );
}
