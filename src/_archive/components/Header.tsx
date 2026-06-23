import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo className="h-7" withWordmark />
          <div className="hidden sm:block border-l border-border pl-3">
            <p className="text-sm text-muted-foreground">
              Lorry Receipt Intelligence & Trade Risk Analyzer
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
