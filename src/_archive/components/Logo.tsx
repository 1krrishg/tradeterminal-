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
        aria-label="TariffLens"
      >
        {/* Globe circle */}
        <circle cx="16" cy="16" r="11" fill="hsl(var(--primary))" />
        {/* Latitude lines */}
        <path d="M5 16h22M7 10.5h18M7 21.5h18" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
        {/* Longitude arc */}
        <path d="M16 5c-3 3-3 18 0 22M16 5c3 3 3 18 0 22" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.4" strokeWidth="1.2" />
        {/* Magnifier */}
        <circle cx="20" cy="20" r="5" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2" />
        <line x1="24" y1="24" x2="27" y2="27" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
        {/* Dollar inside lens */}
        <text x="20" y="23" textAnchor="middle" fontSize="5" fill="hsl(var(--primary))" fontWeight="700">$</text>
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          TariffLens
        </span>
      )}
    </span>
  );
}
