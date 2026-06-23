import type { RiskAssessment } from "@/types/risk";

interface NarrativeSectionProps {
  assessment: RiskAssessment;
}

export function NarrativeSection({ assessment }: NarrativeSectionProps) {
  const { narrative, category } = assessment;

  const borderClass =
    category === "clean"
      ? "border-l-green-500"
      : category === "attention"
      ? "border-l-yellow-500"
      : "border-l-red-500";

  // Parse markdown bold (**text**) into JSX
  const renderNarrative = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">Analysis Summary</h2>
      <div className={`border-l-4 ${borderClass} bg-muted/50 rounded-r-lg p-6`}>
        <p className="text-base leading-relaxed text-muted-foreground">
          {renderNarrative(narrative)}
        </p>
      </div>
    </section>
  );
}
