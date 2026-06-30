import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";

const linkBase = "transition-colors text-sm";
const linkInactive = "text-muted-foreground hover:text-foreground";

export function NavBar() {
  const { pathname } = useLocation();
  const onAnalyze = pathname.startsWith("/analyze");
  const onDashboard = pathname.startsWith("/dashboard");
  const onApp = onAnalyze || onDashboard;

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center min-w-0">
          <Logo className="h-7" withWordmark />
        </Link>

        {!onApp && (
          <nav className="hidden md:flex items-center gap-7 text-sm">
            <a href="#how" className={`${linkBase} ${linkInactive}`}>How it works</a>
            <a href="#demo" className={`${linkBase} ${linkInactive}`}>Live demo</a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {onApp && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/">← Home</Link>
            </Button>
          )}
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
            <Link to="/analyze" className="whitespace-nowrap">
              <span className="hidden sm:inline">Analyze a route</span>
              <span className="sm:hidden">Analyze</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
