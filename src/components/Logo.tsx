type Props = {
  className?: string;
  /** Show the wordmark next to the icon */
  withWordmark?: boolean;
};

/**
 * Ability logo — inline SVG so it stays crisp at every size and inherits
 * `currentColor` for theming. Icon is a document page with an upward
 * verification arrow, expressing "trade documents, verified".
 */
export function Logo({ className = "h-8 w-auto", withWordmark = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
        aria-label="Ability"
      >
        {/* Document page with folded corner */}
        <path
          d="M7 4h12l6 6v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          fill="hsl(var(--primary))"
        />
        {/* Folded corner highlight */}
        <path
          d="M19 4v4a2 2 0 0 0 2 2h4"
          stroke="hsl(var(--primary-foreground))"
          strokeOpacity="0.35"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Upward verification arrow */}
        <path
          d="M11 22l4-4 3 3 5-6"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 15h4v4"
          stroke="hsl(var(--primary-foreground))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          Ability
        </span>
      )}
    </span>
  );
}
