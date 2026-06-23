import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, RefreshCw, AlertCircle, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

interface Regulation {
  id: string;
  authority: string;
  corridor: string;
  title: string;
  summary: string;
  source_url: string | null;
  effective_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const CORRIDORS = ["All", "India-Nepal", "India-Bhutan", "India-Bangladesh"];

const CORRIDOR_COLORS: Record<string, string> = {
  "India-Nepal": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  "India-Bhutan": "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
  "India-Bangladesh": "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
  "All": "bg-secondary text-muted-foreground border-border",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function RegulationsPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCoridor, setActiveCorridor] = useState("All");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function fetchRegulations() {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("regulations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (activeCoridor !== "All") {
      query = query.eq("corridor", activeCoridor);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
    } else {
      setRegulations(data ?? []);
      setLastFetched(new Date());
    }
    setLoading(false);
  }

  useEffect(() => { fetchRegulations(); }, [activeCoridor]);

  const grouped = regulations.reduce<Record<string, Regulation[]>>((acc, r) => {
    const key = r.corridor || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <main className="flex-1 container mx-auto px-5 sm:px-6 py-10 sm:py-14 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Updated daily · 11:30am IST
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">
            Corridor Compliance Feed
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl">
            Live regulatory updates scraped daily from DGFT, CBIC, Nepal Customs, Bangladesh NBR, and Bhutan MoF. Know before your truck moves.
          </p>
          {lastFetched && (
            <p className="text-xs text-muted-foreground mt-2">
              Fetched {timeAgo(lastFetched.toISOString())}
            </p>
          )}
        </div>

        {/* Corridor filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {CORRIDORS.map(c => (
            <button
              key={c}
              onClick={() => setActiveCorridor(c)}
              className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                activeCoridor === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={fetchRegulations}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-6">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-24 mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-full mb-1" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && regulations.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm mb-1">No regulations found yet.</p>
            <p className="text-xs">The scraper runs daily at 11:30am IST. Check back soon.</p>
          </div>
        )}

        {/* Grouped results */}
        {!loading && !error && regulations.length > 0 && (
          <div className="space-y-8">
            {(activeCoridor === "All" ? Object.keys(grouped).sort() : [activeCoridor]).map(corridor => {
              const items = grouped[corridor];
              if (!items?.length) return null;
              return (
                <div key={corridor}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${CORRIDOR_COLORS[corridor] ?? CORRIDOR_COLORS["All"]}`}>
                      {corridor}
                    </span>
                    <span className="text-xs text-muted-foreground">{items.length} update{items.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-3">
                    {items.map(reg => (
                      <RegulationCard key={reg.id} reg={reg} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        {!loading && regulations.length > 0 && (
          <div className="mt-12 rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Want to know how these rules affect your shipment?
            </p>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link to="/auth">Upload your documents →</Link>
            </Button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function RegulationCard({ reg }: { reg: Regulation }) {
  return (
    <div className="rounded-xl border border-border bg-card hover:border-primary/30 transition-colors p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            {reg.authority}
          </span>
          {reg.effective_date && (
            <span className="text-[11px] text-muted-foreground">
              · effective {new Date(reg.effective_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(reg.created_at)}</span>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1.5 leading-snug">{reg.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{reg.summary}</p>

      <div className="flex items-center gap-2 flex-wrap">
        {reg.tags.map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground">
            {tag}
          </span>
        ))}
        {reg.source_url && (
          <a
            href={reg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
