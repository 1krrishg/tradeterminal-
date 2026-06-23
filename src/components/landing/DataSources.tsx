export function DataSources() {
  const sources = [
    {
      name: "USITC HTS Catalog",
      detail: "262,000 rate records · 1998–2026",
      badge: "Official",
      desc: "US International Trade Commission official tariff schedule. Every MFN rate, every year, going back to 1998.",
    },
    {
      name: "WTO Timeseries API",
      detail: "HS_A_0010 · HS_A_0020",
      badge: "Official",
      desc: "World Trade Organization's official tariff API. We pull the current MFN rate for the destination country, not a cached estimate.",
    },
    {
      name: "CBP CROSS",
      detail: "120,000+ US Customs rulings",
      badge: "Public",
      desc: "US Customs and Border Protection's public ruling database. When we classify your product, we cite the actual ruling number.",
    },
    {
      name: "Live retaliation data",
      detail: "Scraped daily · 25+ measures",
      badge: "Live",
      desc: "China's 25% on US ag, EU's 25% on steel/whiskey, Canada's 25% on goods — tracked and updated when new measures land.",
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
