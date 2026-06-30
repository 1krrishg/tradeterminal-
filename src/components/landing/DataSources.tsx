export function DataSources() {
  const sources = [
    {
      name: "Bright Data Web Unlocker",
      detail: "BigBasket · Rakuten · Mercado Libre · Zalando",
      badge: "Live",
      desc: "Real-time ecommerce scraping across 4 major marketplaces. Prices, seller counts, and reviews pulled fresh per query — not cached from a database.",
    },
    {
      name: "Government Portals",
      detail: "FSSAI · CBIC · Japan Customs · MHLW · EU TARIC",
      badge: "Official",
      desc: "Regulatory documents scraped directly from import authority websites. Duty rates, certification requirements, and labeling rules by destination.",
    },
    {
      name: "Qwen3.5-2B on Runpod Flash",
      detail: "RAG extraction · AMPERE GPU · BGE-M3 embeddings",
      badge: "AI",
      desc: "Scraped text is chunked, embedded via BGE-M3, and retrieved against your query. Qwen3.5-2B extracts structured JSON — compliance fields and market data.",
    },
    {
      name: "Freightos Shipping API",
      detail: "Air · Sea · Road · per-route estimates",
      badge: "Live",
      desc: "Shipping cost estimates per corridor. Combined with duty rate and product cost to compute the full landed cost and margin gap.",
    },
  ];

  return (
    <section className="border-b border-border bg-muted/20 py-10 sm:py-12">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-6">Where the data comes from</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {sources.map((s) => (
            <div key={s.name} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-foreground">{s.name}</div>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  s.badge === "Official" ? "bg-primary/10 text-primary" :
                  s.badge === "Live" ? "bg-destructive/10 text-destructive" :
                  s.badge === "AI" ? "bg-success/10 text-success" :
                  "bg-muted text-muted-foreground"
                }`}>{s.badge}</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground mb-2">{s.detail}</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
