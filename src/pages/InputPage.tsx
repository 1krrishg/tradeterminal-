import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Globe, Package, MapPin, Zap, Shield, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeRoute } from "@/lib/api";
import { getDemoResult } from "@/lib/demo-data";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES = [
  "Nepal", "India", "China", "Japan", "Brazil", "United States", "Germany",
  "Bangladesh", "Vietnam", "Indonesia", "Thailand", "Malaysia", "Sri Lanka",
  "Pakistan", "Mexico", "Turkey", "Egypt", "Nigeria", "Kenya", "Ethiopia",
  "South Korea", "Singapore", "Australia", "United Kingdom", "France",
  "Canada", "Argentina", "Colombia", "Peru", "Saudi Arabia",
];

const DEMO_ROUTES = [
  { product: "Cardamom", origin: "India", destination: "Japan" },
  { product: "Spices", origin: "Nepal", destination: "India" },
  { product: "Textiles", origin: "Bangladesh", destination: "Germany" },
  { product: "Coffee", origin: "Ethiopia", destination: "Japan" },
  { product: "Handicrafts", origin: "India", destination: "United States" },
];

const LOADING_STAGES = [
  "Scraping customs regulations via Bright Data...",
  "Pulling live market prices from local ecommerce...",
  "Embedding multilingual documents via BGE-M3...",
  "Running RAG retrieval from ChromaDB...",
  "Extracting structure with Qwen3.5-2B on Runpod...",
  "Fetching carrier rates from Freightos...",
  "Calculating landed cost and margin gap...",
];

export default function InputPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [product, setProduct] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [shipmentValue, setShipmentValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);

  const canSubmit = product.trim().length > 0 && origin.length > 0 && destination.length > 0 && !loading;

  const handleAnalyze = async () => {
    if (!canSubmit) return;
    if (origin === destination) {
      toast({ title: "Same country", description: "Origin and destination must be different.", variant: "destructive" });
      return;
    }

    const demo = getDemoResult(product.trim(), origin, destination);
    if (demo) {
      navigate("/dashboard", { state: { result: { ...demo, shipment_value_usd: shipmentValue ? parseFloat(shipmentValue) : null } } });
      return;
    }

    setLoading(true);
    setStage(0);
    const interval = setInterval(() => {
      setStage(prev => (prev < LOADING_STAGES.length - 1 ? prev + 1 : prev));
    }, 1200);

    try {
      const result = await analyzeRoute({
        product: product.trim(),
        origin,
        destination,
        shipment_value_usd: shipmentValue ? parseFloat(shipmentValue) : undefined,
      });
      navigate("/dashboard", { state: { result } });
    } catch (err: any) {
      toast({
        title: "Backend not running",
        description: "Start the Python backend or use a demo route below.",
        variant: "destructive",
      });
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  const runDemo = (d: typeof DEMO_ROUTES[0]) => {
    const result = getDemoResult(d.product, d.origin, d.destination);
    if (result) navigate("/dashboard", { state: { result } });
    else {
      setProduct(d.product);
      setOrigin(d.origin);
      setDestination(d.destination);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">TradeTerminal</span>
        </div>
        <div className="text-xs text-muted-foreground hidden sm:block">Runpod Flash · Bright Data · WTO API · Freightos</div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/20 bg-primary-soft text-primary text-xs font-medium mb-5">
              <Zap className="h-3 w-3" /> RAG-powered trade intelligence · Runpod Flash
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 leading-tight">
              Will it clear customs?<br />Will it make money?
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              Enter a product, origin, and destination. Get compliance requirements and live market pricing in one dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4 mb-5">
            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Product
              </Label>
              <Input
                placeholder="e.g. Cardamom, Textiles, Coffee, Handicrafts…"
                value={product}
                onChange={e => setProduct(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAnalyze()}
                className="text-sm"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Origin
                </Label>
                <Select value={origin} onValueChange={setOrigin} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Ships from…" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Destination
                </Label>
                <Select value={destination} onValueChange={setDestination} disabled={loading}>
                  <SelectTrigger><SelectValue placeholder="Ships to…" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Shipment value (USD) <span className="text-muted-foreground/50 normal-case font-normal">— optional</span>
              </Label>
              <Input
                placeholder="e.g. 5000  ·  leave blank for 100kg standard estimate"
                value={shipmentValue}
                onChange={e => setShipmentValue(e.target.value.replace(/[^0-9.]/g, ""))}
                className="text-sm"
                disabled={loading}
                type="number"
                min={0}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                If left blank, analysis is estimated for a standard 100kg shipment at market ex-works price.
              </p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!canSubmit}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{LOADING_STAGES[stage]}</>
                : <>Analyze this route <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>

            {loading && (
              <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                {LOADING_STAGES.map((s, i) => (
                  <div key={s} className={`flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${i === stage ? "bg-primary/5 text-foreground" : i < stage ? "text-success" : "text-muted-foreground/40"}`}>
                    {i < stage
                      ? <span className="text-success">✓</span>
                      : i === stage
                        ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        : <span className="h-3 w-3 block" />}
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-2">Try a pre-analyzed route (instant):</div>
            <div className="flex gap-2 justify-center flex-wrap">
              {DEMO_ROUTES.map(d => (
                <button
                  key={`${d.origin}-${d.destination}`}
                  onClick={() => runDemo(d)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition-colors text-muted-foreground cursor-pointer"
                >
                  {d.product} · {d.origin} → {d.destination}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full text-center">
          {[
            { icon: Shield, label: "Compliance", desc: "Required docs, certifications, duties, restrictions — every item with confidence score and government source link" },
            { icon: TrendingUp, label: "Market Intel", desc: "Live local prices from BigBasket, Rakuten, Mercado Libre + multilingual consumer sentiment" },
            { icon: Zap, label: "Margin Gap", desc: "Full landed cost vs local market price — instant go/no-go on route profitability" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="p-4">
              <div className="h-8 w-8 rounded-lg bg-primary-soft mx-auto mb-2 flex items-center justify-center">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm font-medium text-foreground mb-1">{label}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        TradeTerminal · Runpod Flash Hack Day · Bright Data · Runpod Flash · WTO API · Freightos
      </footer>
    </div>
  );
}
