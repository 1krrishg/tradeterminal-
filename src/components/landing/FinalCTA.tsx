import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-5 sm:px-6 text-center">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Free · No account required · Results in under 60 seconds
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-5">
          Stop guessing. Start exporting<br className="hidden sm:block" /> with real numbers.
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          Pick your product, origin, and destination. TradeTerminal scrapes live market data and regulatory sources, then runs it through AI to give you compliance and margin data in one dashboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8 text-base font-medium">
            <Link to="/analyze">
              Analyze a route — free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Bright Data Web Unlocker · Runpod Flash GPU · Qwen3.5-2B · BGE-M3 embeddings · Freightos shipping rates
        </p>
      </div>
    </section>
  );
}
