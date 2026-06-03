import { AlertCircle, AlertTriangle } from "lucide-react";

/**
 * RiskGallery — a wall of real example flags.
 * No paragraphs. Just realistic alerts the way they appear in the product.
 */

const examples = [
  { sev: "high", title: "Weight mismatch", detail: "LR 12,400 kg · Invoice 11,800 kg" },
  { sev: "high", title: "Value exceeds LC limit", detail: "₹ 8,42,000 vs LC ₹ 8,00,000" },
  { sev: "high", title: "Vehicle number reused", detail: "MH-04-AB-7821 on LR-2802 (3 days ago)" },
  { sev: "med", title: "GSTIN check digit invalid", detail: "27AAACR5055K1Z5 — failed Mod-36" },
  { sev: "med", title: "Consignee address incomplete", detail: "Missing PIN / postal code on invoice" },
  { sev: "med", title: "HSN code mismatch", detail: "Invoice 5402.33 · Packing list 5403.31" },
  { sev: "med", title: "E-way bill expiring soon", detail: "Valid till 09 Nov · ETA 11 Nov" },
  { sev: "med", title: "Invoice number missing", detail: "Blank on copy 2 of invoice PDF" },
  { sev: "high", title: "Round-figure invoice value", detail: "₹ 8,00,000 exact — under-invoicing pattern" },
] as const;

export function RiskGallery() {
  return (
    <section id="risks" className="relative py-16 sm:py-20 md:py-28 border-b border-border">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-8 sm:mb-12">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
            What gets flagged
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1] mb-3">
            Real issues. Caught before dispatch.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            A sample of the 40+ checks Ability runs on every shipment.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {examples.map((e) => (
            <RiskCard key={e.title} {...e} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskCard({ sev, title, detail }: { sev: "high" | "med"; title: string; detail: string }) {
  const map = {
    high: { Icon: AlertCircle, border: "border-destructive/30", bg: "bg-destructive-soft", color: "text-destructive", label: "High" },
    med: { Icon: AlertTriangle, border: "border-warning/30", bg: "bg-warning-soft", color: "text-warning", label: "Med" },
  } as const;
  const { Icon, border, bg, color, label } = map[sev];
  return (
    <div className={`rounded-lg border ${border} bg-card overflow-hidden`}>
      <div className={`px-3 py-1.5 ${bg} border-b ${border} flex items-center justify-between`}>
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className={`text-[10px] uppercase font-medium tracking-wider ${color}`}>{label}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">SH-2847</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="text-sm font-medium text-foreground mb-1 leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground font-mono leading-snug break-words">{detail}</div>
      </div>
    </div>
  );
}
