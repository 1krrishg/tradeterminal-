import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-6 py-10 grid sm:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="mb-2">
            <Logo className="h-6" withWordmark />
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Trade compliance + market intelligence for small exporters. Know if your product will pass customs and make money before you ship.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Product</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><a href="#how" className="hover:text-foreground">How it works</a></li>
            <li><a href="#demo" className="hover:text-foreground">Live demo</a></li>
            <li><Link to="/analyze" className="hover:text-foreground">Analyze a route</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Destinations covered</div>
          <ul className="space-y-1.5 text-muted-foreground text-xs">
            <li>India · Japan · Germany</li>
            <li>Brazil · USA · UK</li>
            <li>More coming soon</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto px-6 py-4 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} TradeTerminal</span>
          <span>Built for small exporters · Runpod Flash Hack Day</span>
        </div>
      </div>
    </footer>
  );
}
