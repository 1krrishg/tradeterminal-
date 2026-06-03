import type { ReactNode } from "react";
import { FileText, Upload, FileCheck2, ShieldAlert, CheckCircle2, AlertCircle, AlertTriangle, ArrowDown } from "lucide-react";

/**
 * DemoStages — show, don't tell.
 * Three stacked panels representing the three real product states:
 *   1. Upload — what goes in
 *   2. Extract — what gets pulled out
 *   3. Verify — what the system flags
 *
 * Designed to be readable on phone (single column) and dense on desktop.
 */
export function DemoStages() {
  return (
    <section id="demo" className="relative py-16 sm:py-20 md:py-28 border-b border-border bg-secondary/40">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-14">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
            How it works
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1]">
            Documents in. Verified Lorry Receipt out.
          </h2>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <Stage1Upload />
          <StageArrow />
          <Stage2Extract />
          <StageArrow />
          <Stage3Verify />
        </div>
      </div>
    </section>
  );
}

function StageArrow() {
  return (
    <div className="flex justify-center">
      <div className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center">
        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

function StageHeader({
  step,
  title,
  hint,
}: {
  step: string;
  title: string;
  hint: ReactNode;
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3 mb-4 flex-col sm:flex-row">
      <div>
        <div className="text-[11px] font-mono text-primary mb-1">{step}</div>
        <div className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</div>
      </div>
      <div className="text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

/* ---------------- STAGE 1: Upload ---------------- */
function Stage1Upload() {
  const docs = [
    { name: "invoice_2847.pdf", tag: "Invoice", icon: FileText },
    { name: "packing_list.pdf", tag: "Packing list", icon: FileText },
    { name: "eway_bill.jpg", tag: "E-way bill", icon: FileText },
    { name: "lc_001.pdf", tag: "Letter of credit", icon: FileText },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-[var(--shadow-card)]">
      <StageHeader step="01 · Upload" title="Drop in your trade documents" hint="PDF · Scan · Photo" />
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Upload className="h-3.5 w-3.5" />
          4 files attached
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {docs.map((d) => (
            <div
              key={d.name}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2"
            >
              <d.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-foreground truncate">{d.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{d.tag}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STAGE 2: Extract ---------------- */
function Stage2Extract() {
  const fields: Array<[string, string, string]> = [
    ["LR number", "LR-2847", "LR"],
    ["Date", "08 Nov 2024", "LR"],
    ["Consignor", "Reliance Industries Ltd", "Invoice"],
    ["Consignor GSTIN", "27AAACR5055K1Z5", "Invoice"],
    ["Consignee", "Padma Textiles, Dhaka", "Invoice"],
    ["Vehicle", "MH-04-AB-7821", "E-way"],
    ["Goods", "Polyester yarn", "Packing"],
    ["HSN", "5402.33", "Invoice"],
    ["Packages", "248 bags", "Packing"],
    ["Weight (gross)", "12,400 kg", "Packing"],
    ["Invoice value", "₹ 8,42,000", "Invoice"],
    ["LC reference", "LC-DH-44218", "LC"],
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-[var(--shadow-card)]">
      <StageHeader
        step="02 · Extract & generate"
        title="A clean, standardized Lorry Receipt"
        hint={<span className="inline-flex items-center gap-1 text-success"><FileCheck2 className="h-3.5 w-3.5" /> 12 fields · 96% confidence</span> as unknown as string}
      />

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Table header */}
        <div className="hidden sm:grid grid-cols-12 bg-muted/50 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-4">Field</div>
          <div className="col-span-6">Value</div>
          <div className="col-span-2 text-right">Source</div>
        </div>
        <div className="divide-y divide-border bg-card">
          {fields.map(([k, v, src]) => (
            <div
              key={k}
              className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm items-center"
            >
              <div className="col-span-12 sm:col-span-4 text-muted-foreground text-xs">{k}</div>
              <div className="col-span-9 sm:col-span-6 font-mono text-[12px] sm:text-[13px] text-foreground truncate">
                {v}
              </div>
              <div className="col-span-3 sm:col-span-2 text-right">
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-primary-soft text-primary border border-primary/20 font-medium">
                  {src}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- STAGE 3: Verify ---------------- */
function Stage3Verify() {
  const flags = [
    {
      sev: "high" as const,
      title: "Weight mismatch across documents",
      detail: "LR 12,400 kg · Invoice 11,800 kg · Difference 600 kg",
      sub: "Resolve before dispatch — likely customs hold at border.",
    },
    {
      sev: "high" as const,
      title: "Invoice value vs LC limit",
      detail: "Invoice ₹ 8,42,000 · LC max ₹ 8,00,000",
      sub: "LC will not honour the excess. Bank may reject.",
    },
    {
      sev: "med" as const,
      title: "GSTIN check digit invalid",
      detail: "Consignor GSTIN failed Mod-36 validation",
      sub: "Recheck the printed GSTIN on the invoice.",
    },
    {
      sev: "med" as const,
      title: "Invoice number missing on copy 2",
      detail: "Field blank in the second invoice page",
      sub: "Customs may reject at border crossing.",
    },
    {
      sev: "low" as const,
      title: "HSN format unusual",
      detail: "5402.33 — verify against current customs schedule",
      sub: "Soft warning. Verify at your end.",
    },
  ];

  const passed = [
    "Vehicle number matches RTO format",
    "Consignee address present on all docs",
    "E-way bill validity active",
    "Packing list matches invoice line items",
    "Date sequence consistent",
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-[var(--shadow-card)]">
      <StageHeader
        step="03 · Verify"
        title="Risks flagged in plain language"
        hint={<span className="inline-flex items-center gap-1.5 text-destructive"><ShieldAlert className="h-3.5 w-3.5" /> 5 issues · 14 checks passed</span> as unknown as string}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
        <SummaryTile color="destructive" label="High" value="2" />
        <SummaryTile color="warning" label="Medium" value="2" />
        <SummaryTile color="success" label="Passed" value="14" />
      </div>

      {/* Flags */}
      <div className="space-y-2">
        {flags.map((f) => (
          <FlagRow key={f.title} {...f} />
        ))}
      </div>

      {/* Passed checks (compact) */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-success" />
          Checks passed
        </div>
        <div className="flex flex-wrap gap-1.5">
          {passed.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-success-soft border border-success/20 text-foreground"
            >
              <CheckCircle2 className="h-2.5 w-2.5 text-success" />
              {p}
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground px-2 py-0.5">+ 9 more</span>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ color, label, value }: { color: "destructive" | "warning" | "success"; label: string; value: string }) {
  const cls = {
    destructive: "border-destructive/30 bg-destructive-soft text-destructive",
    warning: "border-warning/30 bg-warning-soft text-warning",
    success: "border-success/30 bg-success-soft text-success",
  }[color];
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider font-medium opacity-90">{label}</div>
      <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function FlagRow({
  sev,
  title,
  detail,
  sub,
}: {
  sev: "high" | "med" | "low";
  title: string;
  detail: string;
  sub: string;
}) {
  const map = {
    high: { Icon: AlertCircle, cls: "border-destructive/30 bg-destructive-soft", label: "High", labelCls: "text-destructive" },
    med: { Icon: AlertTriangle, cls: "border-warning/30 bg-warning-soft", label: "Med", labelCls: "text-warning" },
    low: { Icon: AlertTriangle, cls: "border-border bg-muted/30", label: "Low", labelCls: "text-muted-foreground" },
  } as const;
  const { Icon, cls, label, labelCls } = map[sev];
  return (
    <div className={`rounded-md border ${cls} p-3`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 ${labelCls} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <div className="text-sm font-medium text-foreground leading-tight">{title}</div>
            <span className={`text-[10px] uppercase font-medium ${labelCls} flex-shrink-0`}>{label}</span>
          </div>
          <div className="text-xs text-muted-foreground font-mono break-words">{detail}</div>
          <div className="text-xs text-foreground/80 mt-1">{sub}</div>
        </div>
      </div>
    </div>
  );
}
