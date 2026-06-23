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
            desc="Drop an invoice or packing list and we read it automatically: product, destination, value, everything. Or skip the upload and type what your product is. Either way takes under a minute."
          />
          <Arrow />
          <Stage
            icon={<FileSearch className="h-4 w-4 text-primary" />}
            num="02"
            title="We figure out the right customs product code for you"
            desc="Every country classifies goods under a standard product code system. Getting it wrong means wrong duties, delays, or rejected shipments. We identify the correct code, show you three options ranked by confidence, and cite a real government customs ruling to back it — something you can hand directly to your broker."
          />
          <Arrow />
          <Stage
            icon={<Search className="h-4 w-4 text-primary" />}
            num="03"
            title="29 years of rate history plus what countries are charging right now"
            desc="We pull the official US tariff rate going back to 1998 and cross-check it against live retaliatory taxes that China, the EU, Canada, and India have imposed on US goods. You see what countries are actually charging today, not what a government website says."
          />
          <Arrow />
          <Stage
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
            num="04"
            title="The dollar cost on your shipment, not just a percentage"
            desc="Percentages are abstract. We turn it into: today's scenario, a worst-case based on how rates have historically jumped on this product, and the best alternative country to ship to instead. Every number is calculated against your specific shipment value."
          />
          <Arrow />
          <Stage
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
            num="05"
            title="Where rates are likely to go over the next 6 to 12 months"
            desc="The prediction is grounded in what actually happened before: which year this rate last spiked, by how much, and how long it stayed elevated. We surface the historical pattern so you can see what tends to follow situations like this one."
          />
          <Arrow />
          <Stage
            icon={<Lightbulb className="h-4 w-4 text-primary" />}
            num="06"
            title="One action with a dollar figure"
            desc="Reroute, accelerate the shipment, or hold. One specific recommendation. No paragraph of maybes."
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
