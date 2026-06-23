const stats = [
  { value: "12,788", label: "Products you can simulate, from soybeans to semiconductors" },
  { value: "29 yrs", label: "Of official US tariff history, going back to 1998" },
  { value: "25+", label: "Active retaliatory taxes tracked from China, EU, Canada, and India" },
  { value: "$180B+", label: "US export value sitting under active retaliatory tariffs in 2024" },
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
