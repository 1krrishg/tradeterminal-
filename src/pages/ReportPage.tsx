import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { ReportHeader } from "@/components/report/ReportHeader";
import { NarrativeSection } from "@/components/report/NarrativeSection";
import { SignalGroupSection } from "@/components/report/SignalGroupSection";
import { DataConsistencyPanel } from "@/components/report/DataConsistencyPanel";
import { ActionItems } from "@/components/report/ActionItems";
import { generateBiltyHTML } from "@/lib/generateBilty";
import { useToast } from "@/hooks/use-toast";
import type { RiskAssessment } from "@/types/risk";
import type { LorryReceiptData } from "@/types/lr";
import type { ReconciliationResult } from "@/lib/documentReconciler";

interface ReportState {
  assessment: RiskAssessment;
  data: LorryReceiptData;
  reconciliation: ReconciliationResult;
}

export default function ReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [biltyOverride, setBiltyOverride] = useState(false);

  const state = location.state as ReportState | null;

  if (!state) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">No Analysis Data</h1>
          <p className="text-muted-foreground mb-6">
            Upload and analyze documents first to generate a risk report.
          </p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Upload
          </Button>
        </main>
      </div>
    );
  }

  const { assessment, data, reconciliation } = state;

  const handleDownloadJSON = () => {
    const exportData = {
      extraction: data,
      riskAssessment: {
        score: assessment.totalScore,
        rawScore: assessment.rawScore,
        category: assessment.category,
        classification: assessment.classification,
        companyTrust: assessment.companyTrust,
        needsReview: assessment.needsReview,
        primaryDriver: assessment.primaryDriver,
        narrative: assessment.narrative,
        signals: assessment.triggeredSignals.map((s) => ({
          id: s.id,
          ruleNumber: s.ruleNumber,
          name: s.name,
          category: s.category,
          severity: s.severity,
          score: s.score,
          detail: s.detail,
          whyItMatters: s.whyItMatters,
          whatToFix: s.whatToFix,
        })),
        confidence: assessment.confidence,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Risk_Report_${data.invoice_number || "shipment"}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-6 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Upload
        </Button>

        {/* Full-page report sections */}
        <div className="space-y-10">
          {/* 1. Header — Risk Level, Score, Primary Driver */}
          <ReportHeader assessment={assessment} />

          {/* 2. Primary Narrative */}
          <NarrativeSection assessment={assessment} />

          {/* 3. Key Risk Factors (Grouped by 6 categories) */}
          <SignalGroupSection triggeredSignals={assessment.triggeredSignals} />

          {/* 4. Data Consistency Panel */}
          <DataConsistencyPanel data={data} reconciliation={reconciliation} />

          {/* 5. What to Fix + Bilty Generation */}
          <ActionItems
            assessment={assessment}
            biltyOverride={biltyOverride}
            onBiltyOverride={() => setBiltyOverride(true)}
            onDownloadJSON={handleDownloadJSON}
            onDownloadBilty={handleDownloadBilty}
          />
        </div>

        {/* Footer spacing */}
        <div className="h-16" />
      </main>
    </div>
  );
}
