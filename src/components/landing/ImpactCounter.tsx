const stats = [
  { value: "12,788", label: "HS codes with 29 years of rate history in our database" },
  { value: "262k", label: "Data points across 1998–2026 USITC tariff records" },
  { value: "$180B+", label: "US export value hit by active retaliatory tariffs in 2024" },
  { value: "30s", label: "From shipment details to full risk simulation with prediction" },
];

export function ImpactCounter() {
  return (
    <section className="py-16 sm:py-20 border-b border-border">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.value}>
              <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2 tabular-nums">{s.value}</div>
              <div className="text-sm text-muted-foreground leading-snug">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
