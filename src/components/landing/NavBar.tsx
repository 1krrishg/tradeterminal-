import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";

const linkBase = "transition-colors text-sm";
const linkInactive = "text-muted-foreground hover:text-foreground";

export function NavBar() {
  const { pathname } = useLocation();
  const onSim = pathname.startsWith("/simulate");
  const onResults = pathname.startsWith("/results");

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center min-w-0">
          <Logo className="h-7" withWordmark />
        </Link>

        {!onSim && !onResults && (
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#how" className={`${linkBase} ${linkInactive}`}>How it works</a>
            <a href="#scenarios" className={`${linkBase} ${linkInactive}`}>Live data</a>
            <a
              href="https://github.com/1krrishg/tariff-lens"
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkBase} ${linkInactive}`}
            >
              GitHub
            </a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {(onSim || onResults) && (
            <Button asChild size="sm" variant="outline">
              <Link to="/">← Home</Link>
            </Button>
          )}
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
            <Link to="/simulate">Simulate a shipment</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
