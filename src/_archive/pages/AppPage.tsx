import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, FileSearch, RefreshCw, ArrowLeft, FileText, FileCheck2, ShieldAlert, Truck, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileUpload, type DocumentCategory } from "@/components/FileUpload";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { supabase } from "@/integrations/supabase/client";
import type { UploadedFile, LorryReceiptData } from "@/types/lr";

type UserMode = "transporter" | "exporter";

type CategorizedFiles = Record<DocumentCategory, UploadedFile[]>;

const emptyFiles: CategorizedFiles = {
  INVOICE: [],
  PACKING_LIST: [],
  LC: [],
  EWAY_BILL: [],
};

export default function AppPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [files, setFiles] = useState<CategorizedFiles>(emptyFiles);
  const [isExtracting, setIsExtracting] = useState(false);
  const [mode, setMode] = useState<UserMode | null>(null);

  const handleFilesAdd = useCallback((category: DocumentCategory, newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => ({ ...prev, [category]: [...prev[category], ...uploadedFiles] }));
  }, []);

  const handleFileRemove = useCallback((category: DocumentCategory, id: string) => {
    setFiles((prev) => ({ ...prev, [category]: prev[category].filter((f) => f.id !== id) }));
  }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        return;
      }
      // Compress images to max 1200px to reduce token usage on free API tier
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
      img.src = url;
    });

  const handleExtract = async () => {
    const allFiles = Object.entries(files).flatMap(([category, categoryFiles]) =>
      categoryFiles.map((f) => ({ ...f, category: category as DocumentCategory }))
    );

    if (allFiles.length === 0) {
      toast({ title: "No files uploaded", description: "Please upload at least one document.", variant: "destructive" });
      return;
    }
    if (files.INVOICE.length === 0) {
      toast({ title: "Invoice required", description: "Please upload at least one invoice document.", variant: "destructive" });
      return;
    }

    setIsExtracting(true);
    setFiles((prev) => {
      const updated = { ...prev };
      for (const cat of Object.keys(updated) as DocumentCategory[]) {
        updated[cat] = updated[cat].map((f) => ({ ...f, status: "processing" as const }));
      }
      return updated;
    });

    try {
      const documents = await Promise.all(
        allFiles.map(async (f) => {
          const base64 = await fileToBase64(f.file);
          return {
            name: f.file.name,
            type: f.file.type.startsWith("image/") || f.file.type === "application/pdf" ? "image" : "text",
            data: base64,
            category: f.category,
          };
        })
      );

      const { data, error } = await supabase.functions.invoke("extract-lr", {
        body: { documents, generatePdf: false },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const extractedData = data.data as LorryReceiptData;
      const confidence = data.extraction_confidence ?? 80;

      setFiles((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated) as DocumentCategory[]) {
          updated[cat] = updated[cat].map((f) => ({ ...f, status: "done" as const }));
        }
        return updated;
      });

      navigate("/bilty", { state: { data: extractedData, confidence, hasLC: files.LC.length > 0 } });
    } catch (error) {
      console.error("Extraction error:", error);
      setFiles((prev) => {
        const updated = { ...prev };
        for (const cat of Object.keys(updated) as DocumentCategory[]) {
          updated[cat] = updated[cat].map((f) => ({ ...f, status: "error" as const }));
        }
        return updated;
      });
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "An error occurred during extraction.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleReset = () => setFiles(emptyFiles);
  const totalFiles = Object.values(files).flat().length;

  const modeConfig = {
    transporter: {
      label: "Transporter",
      headline: "Generate your bilty",
      sub: "Upload your invoice, packing list, e-way bill and LC. Ability reads every document and builds a clean, ready-to-sign Lorry Receipt in under 2 minutes.",
      btnLabel: "Generate bilty & run checks",
      pill2: "Generate bilty",
      steps: [
        { num: "01", icon: <FileText className="h-4 w-4 text-primary" />, title: "Read every document", desc: "Invoice, packing list, e-way bill, LC — every field extracted cleanly into structured data." },
        { num: "02", icon: <FileCheck2 className="h-4 w-4 text-primary" />, title: "Generate the LR", desc: "A bilty built from your documents. Conflicts resolved, missing fields surfaced, ready to sign." },
        { num: "03", icon: <ShieldAlert className="h-4 w-4 text-destructive" />, title: "Catch errors before dispatch", desc: "Weight mismatches, GSTIN failures, invoice number gaps — flagged before the truck leaves the gate." },
      ],
    },
    exporter: {
      label: "Exporter",
      headline: "Check your shipment documents",
      sub: "Upload your invoice, packing list, e-way bill and LC. Ability checks every field for compliance errors, cross-document mismatches, and corridor-specific risks before your goods reach the border.",
      btnLabel: "Check documents & flag risks",
      pill2: "Compliance report",
      steps: [
        { num: "01", icon: <FileText className="h-4 w-4 text-primary" />, title: "Extract all fields", desc: "HSN codes, GSTIN, IEC, invoice values, weights — pulled from every document you upload." },
        { num: "02", icon: <ShieldAlert className="h-4 w-4 text-destructive" />, title: "Cross-verify everything", desc: "Invoice vs packing list vs e-way bill vs LC. Any mismatch that can cause a customs hold gets flagged with a clear explanation." },
        { num: "03", icon: <FileCheck2 className="h-4 w-4 text-primary" />, title: "Corridor-specific checks", desc: "Nepal, Bhutan, Bangladesh rules applied — LC requirements, permitted goods lists, duty implications, and what to fix before dispatch." },
      ],
    },
  };

  // Mode selector screen
  if (!mode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <NavBar />
        <main className="flex-1 flex items-center justify-center">
          <div className="container mx-auto px-6 py-16 max-w-2xl">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-10"
            >
              <ArrowLeft className="h-3 w-3" />
              Back
            </Link>
            <div className="mb-10">
              <div className="text-xs font-medium uppercase tracking-wider text-primary mb-3">Get started</div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-3">
                What are you trying to do?
              </h1>
              <p className="text-muted-foreground">Pick your role. The tool adjusts to what you actually need.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Transporter card */}
              <button
                onClick={() => setMode("transporter")}
                className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-[var(--shadow-elevated)] transition-all p-6"
              >
                <div className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div className="font-semibold text-foreground mb-1.5">I'm a Transporter</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I need to make a bilty / LR for this shipment. Upload documents, get a ready-to-sign Lorry Receipt.
                </p>
                <div className="mt-4 text-xs font-medium text-primary flex items-center gap-1">
                  Generate bilty →
                </div>
              </button>

              {/* Exporter card */}
              <button
                onClick={() => navigate("/chat")}
                className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-[var(--shadow-elevated)] transition-all p-6"
              >
                <div className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:border-primary/30 transition-colors">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="font-semibold text-foreground mb-1.5">I'm an Exporter</div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I need to check if my shipment documents are correct before the truck reaches the border.
                </p>
                <div className="mt-4 text-xs font-medium text-primary flex items-center gap-1">
                  Check documents →
                </div>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const cfg = modeConfig[mode];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavBar />

      <main className="flex-1">
        {/* Page header */}
        <section className="border-b border-border bg-secondary/40">
          <div className="container mx-auto px-6 py-8">
            <button
              onClick={() => { setMode(null); setFiles(emptyFiles); }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-3 w-3" />
              Change role
            </button>
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
                  {cfg.label}
                </div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-2">
                  {cfg.headline}
                </h1>
                <p className="text-muted-foreground max-w-xl">{cfg.sub}</p>
              </div>

              {/* Pipeline pills */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Pill icon={<FileText className="h-3 w-3" />} label="Extract" />
                <span>→</span>
                <Pill icon={<FileCheck2 className="h-3 w-3" />} label={cfg.pill2} />
                <span>→</span>
                <Pill icon={<ShieldAlert className="h-3 w-3" />} label="Flag risk" />
              </div>
            </div>
          </div>
        </section>

        {/* Tool */}
        <section className="py-10 md:py-14">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Upload column */}
              <div className="lg:col-span-7">
                <div className="bg-card border border-border rounded-xl p-6 md:p-7 shadow-[var(--shadow-card)]">
                  <div className="mb-5">
                    <h2 className="text-lg font-semibold text-foreground">Documents</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Invoice is required. The rest are optional but improve accuracy of cross-checks.
                    </p>
                  </div>

                  <FileUpload
                    files={files}
                    onFilesAdd={handleFilesAdd}
                    onFileRemove={handleFileRemove}
                    disabled={isExtracting}
                  />

                  <div className="flex gap-3 mt-6 pt-6 border-t border-border">
                    <Button
                      onClick={handleExtract}
                      disabled={totalFiles === 0 || isExtracting}
                      className="flex-1 h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing…
                        </>
                      ) : (
                        <>
                          <FileSearch className="mr-2 h-4 w-4" />
                          {cfg.btnLabel}
                        </>
                      )}
                    </Button>

                    {totalFiles > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isExtracting}
                        className="h-11 border-border hover:bg-secondary"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <aside className="lg:col-span-5 space-y-4">
                {cfg.steps.map((s) => (
                  <SidebarStep key={s.num} num={s.num} icon={s.icon} title={s.title} desc={s.desc} />
                ))}
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-foreground">
      {icon}
      {label}
    </span>
  );
}

function SidebarStep({
  num,
  icon,
  title,
  desc,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-7 w-7 rounded-md bg-secondary border border-border flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{num}</span>
      </div>
      <div className="font-semibold text-foreground text-sm mb-1">{title}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
