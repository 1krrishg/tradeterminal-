import { useLocation, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { ArrowLeft, FileCheck, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { LRTable } from "@/components/LRTable";
import { useToast } from "@/hooks/use-toast";
import { reconcileDocuments } from "@/lib/documentReconciler";
import { runRedFlagEngine } from "@/lib/redFlagEngine";
import { generateBiltyHTML } from "@/lib/generateBilty";
import { generateDeclaration } from "@/types/lr";
import { mandatoryFields } from "@/types/lr";
import type { LorryReceiptData, ValidationWarning } from "@/types/lr";

interface BiltyState {
  data: LorryReceiptData;
  confidence: number;
  hasLC: boolean;
}

function validateData(data: LorryReceiptData): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  for (const field of mandatoryFields) {
    const value = data[field];
    if (typeof value === "boolean" ? !value : !value) {
      warnings.push({ field, message: `${field} is required`, severity: "error" });
    }
  }
  return warnings;
}

export default function BiltyPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const state = location.state as BiltyState | null;

  const [data, setData] = useState<LorryReceiptData>(() => {
    const d = state?.data ?? ({} as LorryReceiptData);
    if (!d.declaration_text && d.invoice_number) {
      d.declaration_text = generateDeclaration(d);
    }
    return d;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const confidence = state?.confidence ?? 0;
  const warnings = validateData(data);
  const errorCount = warnings.filter((w) => w.severity === "error").length;

  const handleFieldChange = useCallback((field: keyof LorryReceiptData, value: string | boolean) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">No Extraction Data</h1>
          <p className="text-muted-foreground mb-6">Upload documents first to generate a Bilty.</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
        </main>
      </div>
    );
  }

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    // Small delay to show the loading state, then run analysis
    setTimeout(() => {
      try {
        const reconciliation = reconcileDocuments(data, state.hasLC);
        const assessment = runRedFlagEngine(data, reconciliation, confidence);
        navigate("/report", {
          state: { assessment, data, reconciliation },
        });
      } catch (err) {
        console.error("Analysis error:", err);
        toast({ title: "Analysis failed", description: String(err), variant: "destructive" });
        setIsAnalyzing(false);
      }
    }, 500);
  };

  const handleDownloadBilty = () => {
    const html = generateBiltyHTML(data);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Bilty_${data.lr_number || "extracted"}_${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Bilty downloaded", description: "Open the HTML file in a browser and print to PDF." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Upload
        </Button>

        {/* Header summary */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Bilty / Lorry Receipt</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Review extracted fields below. Edit any incorrect values before running analysis.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Extraction Confidence</p>
                <p className={`text-lg font-bold ${confidence >= 70 ? "text-green-600" : confidence >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                  {confidence}%
                </p>
              </div>
              {errorCount > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Missing Fields</p>
                  <p className="text-lg font-bold text-destructive">{errorCount}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editable fields table */}
        <LRTable data={data} warnings={warnings} onDataChange={handleFieldChange} />

        {/* Action buttons */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border py-4 mt-6 -mx-4 px-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={handleDownloadBilty}>
            <Download className="mr-2 h-4 w-4" />
            Download Bilty
          </Button>
          <Button onClick={handleRunAnalysis} disabled={isAnalyzing} size="lg">
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <FileCheck className="mr-2 h-5 w-5" />
                Run Risk Analysis
              </>
            )}
          </Button>
        </div>

        <div className="h-16" />
      </main>
    </div>
  );
}
