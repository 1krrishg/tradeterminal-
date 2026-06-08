import { Button } from "@/components/ui/button";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";

const linkBase = "transition-colors";
const linkInactive = "text-muted-foreground hover:text-foreground";
const linkActive = "text-foreground";

export function NavBar() {
  const { pathname } = useLocation();
  const onChat = pathname.startsWith("/chat");
  const onApp = pathname.startsWith("/app") || pathname.startsWith("/bilty");

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-5 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center min-w-0">
          <Logo className="h-7" withWordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm">
          {!onChat && !onApp && (
            <>
              <a href="#demo" className={`${linkBase} ${linkInactive}`}>How it works</a>
              <a href="#risks" className={`${linkBase} ${linkInactive}`}>What we flag</a>
            </>
          )}
          <NavLink
            to="/chat"
            className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkInactive}`}
          >
            Open workspace
          </NavLink>
        </nav>

        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0">
          <Link to="/app">Try it</Link>
        </Button>
      </div>
    </header>
  );
}
