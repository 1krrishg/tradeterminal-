type Props = {
  className?: string;
  withWordmark?: boolean;
};

export function Logo({ className = "h-8 w-auto", withWordmark = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        aria-label="TradeTerminal"
      >
        {/* Globe */}
        <circle cx="14" cy="14" r="10" fill="hsl(var(--primary))" />
        <path d="M4 14h20M6 9h16M6 19h16" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M14 4c-2.5 2.5-2.5 19 0 20M14 4c2.5 2.5 2.5 19 0 20" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.4" strokeWidth="1.2" />
        {/* Terminal prompt arrow */}
        <rect x="20" y="20" width="10" height="10" rx="2" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
        <text x="25" y="28" textAnchor="middle" fontSize="7" fill="hsl(var(--primary))" fontWeight="800">▸</text>
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          TradeTerminal
        </span>
      )}
    </span>
  );
}
