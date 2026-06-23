import { Upload, Search, BarChart3, Lightbulb, TrendingUp, ArrowDown, FileSearch } from "lucide-react";

export function DemoStages() {
  return (
    <section id="how" className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">How it works</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            From product to decision in 30 seconds.
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Stage
            icon={<Upload className="h-4 w-4 text-primary" />}
            num="01"
            title="Upload a document or just describe what you're shipping"
            desc="Drop a commercial invoice or packing list and we extract everything: product, HS code, destination, shipment value. Mistral OCR reads the PDF; a separate model pulls the fields. Or skip the upload and describe your product in plain English."
            source="Mistral OCR · pixtral-12b-2409"
          />
          <Arrow />
          <Stage
            icon={<FileSearch className="h-4 w-4 text-primary" />}
            num="02"
            title="We figure out the right HS code for customs"
            desc="Every product crossing a border needs an HS code — the 8-digit international classification number that determines what duty rate applies. We apply the WCO's GRI rules (the 6-step system customs authorities follow), validate the code against the USITC HTS catalog, and look up an actual CBP ruling number from the US Customs database that covers a similar product. You get 3 candidates ranked by confidence, with the ruling citation you can hand to your broker."
            source="USITC HTS catalog · CBP CROSS (120k+ public rulings) · WCO GRI"
          />
          <Arrow />
          <Stage
            icon={<Search className="h-4 w-4 text-primary" />}
            num="03"
            title="29 years of MFN rate history, plus what's live right now"
            desc="We pull the official MFN duty rate from the USITC HTS catalog for every year from 1998 to 2026 — that's the baseline rate every WTO member pays. Then we hit the WTO Timeseries API (indicator HS_A_0010) to get the current official rate for the destination country. On top of that, live retaliatory tariffs get layered in: China's Section 301 response, the EU's rebalancing measures, Canada's 25% across-the-board. The effective rate you see is what they're actually charging today."
            source="USITC HTS 1998–2026 · WTO Timeseries API (HS_A_0010) · Live retaliation scraping"
          />
          <Arrow />
          <Stage
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            num="04"
            title="The dollar cost on your specific shipment"
            desc="Percentages don't mean much in isolation. We calculate three scenarios against your exact shipment value: today's effective rate (MFN + any active retaliation), a worst-case based on the biggest single-year rate jump this product has seen in the USITC history, and the best alternative country from WTO tariff data. If an FTA applies — USMCA, KORUS, CPTPP, AUSFTA — we pull the preferential rate from WTO indicator HS_A_0020 and show the saving."
            source="USITC hts_volatility · WTO HS_A_0020 preferential rates · FTA corridors"
          />
          <Arrow />
          <Stage
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            num="05"
            title="Where rates are likely to go in the next 6 to 12 months"
            desc="The prediction is grounded in what actually happened before on this specific HS code: which year the rate last spiked, by how many percentage points, whether it recovered. We surface the historical volatility pattern alongside current geopolitical signals so you can see what tends to follow situations like this one."
            source="USITC rate_history · hts_volatility table · 29-year spike analysis"
          />
          <Arrow />
          <Stage
            icon={<Lightbulb className="h-4 w-4 text-primary" />}
            num="06"
            title="One action with a dollar figure attached"
            desc="Reroute to a lower-tariff country, accelerate the shipment before a rate change, or hold and wait. One recommendation. One number. No paragraph of maybes."
            source="Groq llama-3.3-70b · grounded in the rate data above"
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
