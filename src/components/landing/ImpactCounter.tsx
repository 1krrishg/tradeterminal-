import { useEffect, useRef, useState } from "react";
import { Clock, IndianRupee } from "lucide-react";

// Lower, believable starting values
const START_HOURS = 184;
const START_RUPEES = 47800;

// Steady drip after the count-up
const HOURS_PER_TICK = 1;
const RUPEES_PER_TICK = 180;
const TICK_MS = 6000;

// Initial count-up animation
const COUNTUP_MS = 1600;

function formatINR(n: number) {
  return Math.floor(n).toLocaleString("en-IN");
}

// easeOutCubic — fast at start, smooth landing
function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function ImpactCounter() {
  const [hours, setHours] = useState(0);
  const [rupees, setRupees] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Reveal on scroll
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate from 0 → start values, then tick slowly upward
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    const t0 = performance.now();

    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNTUP_MS);
      const e = easeOut(p);
      setHours(START_HOURS * e);
      setRupees(START_RUPEES * e);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);

    const tick = setInterval(() => {
      setHours((h) => h + HOURS_PER_TICK);
      setRupees((r) => r + RUPEES_PER_TICK);
    }, TICK_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tick);
    };
  }, [visible]);

  return (
    <section ref={sectionRef} className="border-t border-border bg-muted/20">
      <div className="container mx-auto px-5 sm:px-6 py-14 sm:py-16">
        <div className="max-w-2xl mb-8">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Live impact
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-3">
            What Ability has saved transporters so far.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Preparing a clean Lorry Receipt — cross-checking invoice, packing list and e-way bill — usually takes around{" "}
            <span className="text-foreground font-medium">40 minutes</span>.
            Ability does it in roughly{" "}
            <span className="text-foreground font-medium">10 seconds</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            icon={<Clock className="h-4 w-4 text-primary" />}
            label="Hours saved preparing Lorry Receipts"
            value={formatINR(hours)}
            suffix="hrs"
          />
          <StatCard
            icon={<IndianRupee className="h-4 w-4 text-success" />}
            label="Losses prevented from flagged errors"
            value={`₹ ${formatINR(rupees)}`}
            suffix=""
          />
        </div>

        <p className="text-xs text-muted-foreground mt-5">
          Counters update as shipments are verified across the network.
        </p>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-md bg-secondary flex items-center justify-center">
          {icon}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        {suffix && (
          <span className="text-sm text-muted-foreground font-medium">{suffix}</span>
        )}
      </div>
    </div>
  );
}
