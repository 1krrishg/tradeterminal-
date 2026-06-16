import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, X, Loader2, ArrowRight, Globe, Package, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DESTINATION_COUNTRIES = [
  "China", "European Union", "Canada", "Mexico", "Japan", "India",
  "South Korea", "United Kingdom", "Australia", "Brazil", "Singapore",
  "Turkey", "Vietnam", "Indonesia", "Thailand", "Malaysia",
];

type Mode = "document" | "manual";
type HtsResult = { hts8: string; description: string; mfn_rate: number };

export default function SimulatorPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("document");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [hsCode, setHsCode] = useState("");
  const [productName, setProductName] = useState("");
  const [destination, setDestination] = useState("");
  const [shipmentValue, setShipmentValue] = useState("");

  // Product search state
  const [productQuery, setProductQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HtsResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchProducts = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    setSearching(true);
    try {
      // If it looks like an HS code, search by code; otherwise full-text search
      const isCode = /^\d+$/.test(q.trim());
      let query = supabase
        .from("hts_catalog")
        .select("hts8, description, mfn_rate")
        .limit(8);

      if (isCode) {
        query = query.like("hts8", `${q}%`);
      } else {
        query = query.ilike("description", `%${q}%`);
      }

      const { data } = await query;
      setSearchResults(data ?? []);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleProductInput = (val: string) => {
    setProductQuery(val);
    setHsCode("");
    setProductName("");
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProducts(val), 300);
  };

  const selectProduct = (r: HtsResult) => {
    setHsCode(r.hts8);
    setProductName(r.description);
    setProductQuery(`${r.description} (HS ${r.hts8})`);
    setShowDropdown(false);
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("extract-shipment", {
        body: { file_base64: base64, file_name: file.name, file_type: file.type },
      });
      if (error) throw error;
      if (data.hs_code) {
        setHsCode(data.hs_code);
        setProductQuery(data.product_name ? `${data.product_name} (HS ${data.hs_code})` : `HS ${data.hs_code}`);
      }
      if (data.product_name) setProductName(data.product_name);
      if (data.destination_country) setDestination(data.destination_country);
      if (data.shipment_value) setShipmentValue(String(data.shipment_value));
      setMode("manual");
      toast({ title: "Document read", description: "Review the extracted fields and simulate." });
    } catch {
      toast({ title: "Extraction failed", description: "Could not read the document. Fill in manually.", variant: "destructive" });
      setMode("manual");
    } finally {
      setExtracting(false);
    }
  };

  const handleSimulate = async () => {
    if (!hsCode || !destination || !shipmentValue) {
      toast({ title: "Missing fields", description: "Select a product, destination, and shipment value.", variant: "destructive" });
      return;
    }
    const value = parseFloat(shipmentValue.replace(/[^0-9.]/g, ""));
    if (isNaN(value) || value <= 0) {
      toast({ title: "Invalid value", description: "Enter a valid shipment value in USD.", variant: "destructive" });
      return;
    }
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke("simulate-tariff", {
        body: { hs_code: hsCode, destination_country: destination, shipment_value: value, product_name: productName },
      });
      if (error) throw error;
      navigate("/results", { state: { result: data, input: { hsCode, productName, destination, shipmentValue: value } } });
    } catch {
      toast({ title: "Simulation failed", description: "Could not generate simulation. Try again.", variant: "destructive" });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main className="container mx-auto px-5 sm:px-6 py-12 max-w-2xl">

        <div className="mb-8">
          <div className="text-xs font-medium uppercase tracking-wider text-primary mb-2">Tariff simulator</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2">Simulate a shipment</h1>
          <p className="text-muted-foreground text-sm">Search any of 12,788 products or upload a trade document. We combine 25 years of USITC rate history with live scraped tariff data.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-6">
          {(["document", "manual"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${mode === m ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {m === "document" ? "Upload document" : "Enter manually"}
            </button>
          ))}
        </div>

        {/* Document upload */}
        {mode === "document" && (
          <div className="mb-6">
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors bg-muted/20 p-8 text-center cursor-pointer"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileInput} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <div className="font-medium text-foreground text-sm">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="ml-2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Drop your invoice, packing list, or trade document</p>
                  <p className="text-xs text-muted-foreground">PDF, JPG, PNG · Mistral AI reads the document</p>
                </>
              )}
            </div>
            {file && (
              <Button onClick={handleExtract} disabled={extracting} className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reading document…</> : <><FileText className="h-4 w-4 mr-2" />Extract shipment details</>}
              </Button>
            )}
            <div className="mt-4 text-center">
              <button onClick={() => setMode("manual")} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Skip — enter details manually
              </button>
            </div>
          </div>
        )}

        {/* Manual form */}
        {mode === "manual" && (
          <div className="space-y-5 mb-6">

            {/* Product search */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Product
              </Label>
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search 12,788 products or paste HS code…"
                    value={productQuery}
                    onChange={(e) => handleProductInput(e.target.value)}
                    onFocus={() => productQuery.length >= 2 && setShowDropdown(true)}
                    className="pl-9"
                  />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        key={r.hts8}
                        onClick={() => selectProduct(r)}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                      >
                        <div className="text-sm font-medium text-foreground truncate">{r.description}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-muted-foreground">HS {r.hts8}</span>
                          {r.mfn_rate > 0 && (
                            <span className="text-xs text-muted-foreground">· {(r.mfn_rate * 100).toFixed(1)}% MFN</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && !searching && searchResults.length === 0 && productQuery.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg p-3 text-sm text-muted-foreground">
                    No products found. Try a different keyword or paste the HS code directly.
                  </div>
                )}
              </div>

              {hsCode && (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-success">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  HS {hsCode} selected · from USITC 2026 database
                </div>
              )}
            </div>

            {/* Destination */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Destination country
              </Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination…" />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATION_COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shipment value */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> Shipment value (USD)
              </Label>
              <Input
                placeholder="e.g. 500000"
                value={shipmentValue}
                onChange={(e) => setShipmentValue(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>
        )}

        {mode === "manual" && (
          <>
            <Button
              onClick={handleSimulate}
              disabled={simulating || !hsCode || !destination || !shipmentValue}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11 font-medium"
            >
              {simulating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Simulating — pulling 25yr history + live rates…</>
                : <>Simulate tariff impact <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Queries USITC 1998–2026 history + live scraped retaliation rates
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
