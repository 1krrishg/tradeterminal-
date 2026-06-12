import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Radio, TrendingDown } from "lucide-react";

type TariffEntry = {
  product_name: string;
  destination_country: string;
  effective_rate: number;
  retaliation_rate: number;
};

export function LiveTicker() {
  const [items, setItems] = useState<TariffEntry[]>([]);
  const [lastSync, setLastSync] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tariff_rates")
        .select("product_name,destination_country,effective_rate,retaliation_rate")
        .gt("retaliation_rate", 0)
        .order("effective_rate", { ascending: false });
      if (data) setItems(data);
      setLastSync(new Date().toLocaleTimeString());
    }
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  if (items.length === 0) return null;

  // Duplicate for seamless loop
  const all = [...items, ...items];

  return (
    <div className="border-b border-border bg-muted/40 overflow-hidden">
      <div className="flex items-center">
        {/* Label */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-r border-border bg-primary text-primary-foreground z-10">
          <Radio className="h-3 w-3 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap">Live Tariffs</span>
        </div>

        {/* Scrolling tape */}
        <div className="overflow-hidden flex-1 relative">
          <div className="flex animate-ticker whitespace-nowrap gap-0">
            {all.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-5 py-2.5 border-r border-border/40 text-sm">
                <TrendingDown className="h-3 w-3 text-destructive flex-shrink-0" />
                <span className="font-medium text-foreground">{item.product_name}</span>
                <span className="text-muted-foreground">→ {item.destination_country}</span>
                <span className="font-mono font-bold text-destructive">{item.effective_rate}%</span>
                {item.retaliation_rate > 0 && (
                  <span className="text-[11px] text-muted-foreground">(+{item.retaliation_rate}% retaliation)</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Sync time */}
        {lastSync && (
          <div className="flex-shrink-0 px-3 py-2.5 border-l border-border text-[10px] font-mono text-muted-foreground whitespace-nowrap">
            {lastSync}
          </div>
        )}
      </div>
    </div>
  );
}
