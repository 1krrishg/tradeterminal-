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
            Trade Document Intelligence for transporters across India and the SAARC corridor.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Product</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
            <li><a href="#risk" className="hover:text-foreground">Risk Analyzer</a></li>
            <li><a href="#flow" className="hover:text-foreground">How it works</a></li>
            <li><Link to="/app" className="hover:text-foreground">Open the tool</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">For</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>Transporters</li>
            <li>Fleet operators</li>
            <li>Customs brokers</li>
            <li>Cross-border logistics</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto px-6 py-4 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Ability</span>
          <span>India · Bangladesh · Nepal · Bhutan</span>
        </div>
      </div>
    </footer>
  );
}
