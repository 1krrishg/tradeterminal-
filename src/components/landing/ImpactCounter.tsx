const stats = [
  {
    value: "4",
    label: "Live ecommerce markets scraped",
    sub: "BigBasket (India) · Rakuten (Japan) · Mercado Libre (Brazil) · Zalando (Germany)",
  },
  {
    value: "5",
    label: "Regulatory sources per destination",
    sub: "FSSAI · CBIC · Japan Customs · MHLW · EU TARIC — all live scraped",
  },
  {
    value: "< 60s",
    label: "From query to full dashboard",
    sub: "Scrape → embed → RAG → extract → shipping → landed cost, all in one pipeline",
  },
  {
    value: "2B",
    label: "Parameter model for extraction",
    sub: "Qwen3.5-2B on Runpod Flash GPU — multilingual, structured JSON output",
  },
];

export function ImpactCounter() {
  return (
    <section className="py-16 sm:py-20 border-b border-border">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.value}>
              <div className="text-3xl sm:text-4xl font-bold text-foreground mb-1.5 tabular-nums">{s.value}</div>
              <div className="text-sm font-medium text-foreground mb-1">{s.label}</div>
              <div className="text-xs text-muted-foreground leading-snug">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
