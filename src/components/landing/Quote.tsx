export function Quote() {
  return (
    <section className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-3xl">
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground leading-snug mb-6">
            "We didn't know China had a 25% retaliatory tariff on our soybeans until we were already committed to the shipment. That cost us $125,000 in margin on a single load."
          </blockquote>
          <div className="text-sm text-muted-foreground mb-10">
            <span className="font-medium text-foreground">Midwest soybean exporter</span> · $12M annual export volume
          </div>

          {/* Why not ChatGPT */}
          <div className="border-t border-border pt-8">
            <div className="text-xs font-medium uppercase tracking-wider text-primary mb-5">Why not just ask ChatGPT?</div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  problem: "Frozen knowledge",
                  detail: "ChatGPT's training data is months old. Tariff rates change overnight after a trade negotiation. Our scraper runs hourly."
                },
                {
                  problem: "No dollar numbers",
                  detail: "ChatGPT gives you a paragraph. TariffLens gives you the exact dollar cost on your specific shipment value."
                },
                {
                  problem: "No historical context",
                  detail: "ChatGPT can't tell you this product's rate spiked in 2018, held for 6 years, and is likely to spike again. We can."
                },
              ].map((item) => (
                <div key={item.problem} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-sm font-semibold text-foreground mb-1.5">{item.problem}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
