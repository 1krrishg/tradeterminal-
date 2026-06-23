const stats = [
  {
    value: "12,788",
    label: "Products in the USITC HTS catalog",
    sub: "From soybeans (HS 1201) to semiconductors (HS 8542)",
  },
  {
    value: "29 yrs",
    label: "Of official MFN rate records",
    sub: "USITC data going back to 1998 — every rate change on record",
  },
  {
    value: "25+",
    label: "Active retaliatory measures tracked",
    sub: "China 25% on US ag, EU 25% on steel/whiskey, Canada 25%, India 20-100%",
  },
  {
    value: "$180B+",
    label: "US export value under active retaliation",
    sub: "Based on WTO trade flow data and live retaliatory tariff coverage",
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
