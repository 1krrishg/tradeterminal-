import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function FinalCTA() {
  return (
    <section className="relative py-20 sm:py-24 md:py-32">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-[1.1] mb-5">
            Verify your next shipment before it costs you.
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-8">
            Upload your documents. Get a clean Lorry Receipt and a clear risk report — in seconds.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-6 font-medium w-full sm:w-auto"
          >
            <Link to="/chat">
              Open the tool
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
