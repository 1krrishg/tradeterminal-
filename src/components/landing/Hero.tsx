import { ArrowRight, FileText, FileCheck2, ShieldAlert, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function Hero() {
  return (
    <section id="top" className="relative border-b border-border overflow-hidden">
      <div className="container mx-auto px-5 sm:px-6 pt-10 pb-12 md:pt-20 md:pb-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT: copy */}
          <div className="lg:col-span-5 lg:pt-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] sm:text-xs text-muted-foreground mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              India · Nepal · Bhutan · Bangladesh
            </div>

            <h1 className="text-[2rem] leading-[1.1] sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.05] font-semibold tracking-tight text-foreground mb-5">
              Your bilty is ready before the driver is.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mb-7 leading-relaxed">
              Upload your invoice, packing list, e-way bill, and LC.
              Ability reads every document, builds a clean LR, catches every mismatch — and explains it in plain language.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-5 font-medium w-full sm:w-auto"
              >
                <Link to="/auth">
                  Try it on your shipment
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 px-5 border-border hover:bg-secondary w-full sm:w-auto"
              >
                <a href="#demo">See it work ↓</a>
              </Button>
            </div>
          </div>

          {/* RIGHT: live system mock */}
          <div className="lg:col-span-7">
            <HeroMock />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
      {/* Window chrome */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive/60" />
          <span className="h-2 w-2 rounded-full bg-warning/60" />
          <span className="h-2 w-2 rounded-full bg-success/60" />
        </div>
        <div className="text-[10px] sm:text-[11px] font-mono text-muted-foreground truncate">
          ability · RRPL/25-26/1016 · India → Birgunj
        </div>
      </div>

      {/* Body — stacks on mobile, 3 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 md:divide-x divide-y md:divide-y-0 divide-border text-xs">
        {/* Documents */}
        <div className="md:col-span-4 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
            <span>Documents</span>
            <span className="text-success font-medium normal-case tracking-normal">4 uploaded</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            {[
              { name: "RRPL_inv.pdf", tag: "Invoice", state: "ok" },
              { name: "packing_list.pdf", tag: "Packing list", state: "ok" },
              { name: "eway_bill.jpg", tag: "E-way bill", state: "ok" },
              { name: "lc_nepal.pdf", tag: "LC", state: "ok" },
            ].map((d) => (
              <div
                key={d.name}
                className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] truncate text-foreground">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{d.tag}</div>
                </div>
                <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* LR preview */}
        <div className="md:col-span-5 p-3 sm:p-4 bg-muted/10">
          <div className="text-[10px] uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <FileCheck2 className="h-3 w-3" />
            Generated Lorry Receipt · LR-2847
          </div>
          <div className="rounded-md border border-border bg-card divide-y divide-border">
            {[
              ["Consignor", "Ratnaka Resins Pvt. Ltd."],
              ["Consignee", "To The Order Of NIC Asia Bank"],
              ["Vehicle", "DL-01-AB-4421"],
              ["Goods", "Microsilica GR-92 (HSN 2811)"],
              ["Gross weight", "7,540 kg"],
              ["Invoice value", "₹ 6,91,080"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 px-2.5 py-1.5">
                <span className="text-muted-foreground text-[11px]">{k}</span>
                <span className="font-medium text-foreground font-mono text-[11px] text-right truncate">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk flags */}
        <div className="md:col-span-3 p-3 sm:p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3 text-destructive" />
            Risk flags
          </div>
          <div className="space-y-1.5">
            <div className="rounded border border-destructive/30 bg-destructive-soft p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertCircle className="h-3 w-3 text-destructive" />
                <span className="text-[10px] uppercase font-medium text-destructive">High</span>
              </div>
              <div className="text-[11px] text-foreground font-medium leading-tight">
                Weight mismatch
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Inv 11,800 · Pkg 12,400
              </div>
            </div>
            <div className="rounded border border-warning/30 bg-warning-soft p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span className="text-[10px] uppercase font-medium text-warning">Med</span>
              </div>
              <div className="text-[11px] text-foreground font-medium leading-tight">
                GSTIN check failed
              </div>
            </div>
            <div className="rounded border border-warning/30 bg-warning-soft p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span className="text-[10px] uppercase font-medium text-warning">Med</span>
              </div>
              <div className="text-[11px] text-foreground font-medium leading-tight">
                Invoice no. missing
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              14 checks passed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
