import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Regulation {
  id: string;
  authority: string;
  corridor: string;
  title: string;
  summary: string;
  source_url: string | null;
  created_at: string;
}

const CORRIDOR_DOT: Record<string, string> = {
  "India-Nepal": "bg-blue-500",
  "India-Bhutan": "bg-purple-500",
  "India-Bangladesh": "bg-green-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RegulationPreview() {
  const [items, setItems] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("regulations")
      .select("id, authority, corridor, title, summary, source_url, created_at")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="border-t border-border py-16 sm:py-20">
      <div className="container mx-auto px-5 sm:px-6">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live · updated daily
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              What changed in your corridor today
            </h2>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-lg">
              Scraped daily from DGFT, CBIC, Nepal Customs, Bangladesh NBR, and Bhutan MoF.
            </p>
          </div>
          <Link
            to="/regulations"
            className="hidden sm:flex items-center gap-1.5 text-sm text-primary hover:underline flex-shrink-0"
          >
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-24 mb-3" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {items.map(reg => (
              <div key={reg.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${CORRIDOR_DOT[reg.corridor] ?? "bg-muted-foreground"}`} />
                  <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide truncate">{reg.authority}</span>
                  <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">{timeAgo(reg.created_at)}</span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">{reg.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{reg.summary}</p>
                {reg.source_url && (
                  <a
                    href={reg.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-auto"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 sm:hidden">
          <Link to="/regulations" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            See all updates <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
