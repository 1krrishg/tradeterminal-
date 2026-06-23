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

const COUNTRIES = [
  "China", "European Union", "Canada", "Mexico", "Japan", "India",
  "South Korea", "United Kingdom", "Australia", "Brazil", "Singapore",
  "Turkey", "Vietnam", "Indonesia", "Thailand", "Malaysia",
];

type Mode = "document" | "manual";
type TradeMode = "exporter" | "importer";
type HtsResult = { hts8: string; description: string; mfn_rate: number };

export default function SimulatorPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("document");
  const [tradeMode, setTradeMode] = useState<TradeMode>("exporter");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [hsCode, setHsCode] = useState("");
  const [productName, setProductName] = useState("");
  const [destination, setDestination] = useState("");
  const [shipmentValue, setShipmentValue] = useState("");
  const [incoterms, setIncoterms] = useState("");
  const [quantity, setQuantity] = useState("");
  const [exporterName, setExporterName] = useState("");
  const [importerName, setImporterName] = useState("");
  const [extractedPreview, setExtractedPreview] = useState<Record<string, string> | null>(null);

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
      const isCode = /^\d+$/.test(q.trim());
      if (isCode) {
        const { data } = await supabase
          .from("hts_catalog")
          .select("hts8, description, mfn_rate")
          .like("hts8", `${q}%`)
          .limit(8);
        setSearchResults(data ?? []);
        setShowDropdown(true);
        return;
      }

      // Map everyday terms → USITC language
      const synonyms: Record<string, string[]> = {
        // Computers & electronics
        laptop: ["automatic data processing", "portable", "computer"],
        laptops: ["automatic data processing", "portable", "computer"],
        notebook: ["automatic data processing", "portable"],
        computer: ["automatic data processing", "computing"],
        computers: ["automatic data processing"],
        pc: ["automatic data processing"],
        desktop: ["automatic data processing"],
        server: ["automatic data processing", "server"],
        tablet: ["automatic data processing", "tablet"],
        ipad: ["automatic data processing", "tablet"],
        monitor: ["monitor", "display", "visual display"],
        display: ["monitor", "display"],
        screen: ["monitor", "display"],
        printer: ["printer", "printing"],
        keyboard: ["keyboard"],
        mouse: ["mouse", "pointing device"],
        hard: ["disk", "storage", "magnetic"],
        ssd: ["solid state", "storage"],
        usb: ["usb", "connector"],
        cable: ["cable", "insulated"],
        charger: ["charger", "battery", "transformer"],

        // Phones & comms
        phone: ["telephone", "cellular"],
        phones: ["telephone", "cellular"],
        smartphone: ["telephone", "cellular"],
        smartphones: ["telephone", "cellular"],
        iphone: ["telephone", "cellular"],
        android: ["telephone", "cellular"],
        mobile: ["telephone", "cellular"],
        handset: ["telephone", "handset"],
        microphone: ["microphone"],
        speaker: ["loudspeaker", "microphone", "sound"],
        headphones: ["headphone", "earphone", "microphone"],
        headset: ["headphone", "earphone", "microphone"],
        earbuds: ["earphone", "headphone"],
        camera: ["camera", "photographic"],
        webcam: ["camera", "video"],

        // TVs & home electronics
        tv: ["television", "monitor", "reception"],
        television: ["television", "reception"],
        oled: ["television", "monitor"],
        lcd: ["television", "monitor", "flat panel"],
        projector: ["projector", "optical"],
        router: ["router", "network", "transmission"],
        modem: ["modem", "transmission"],
        wifi: ["network", "transmission", "radio"],

        // Vehicles
        car: ["motor vehicle", "passenger"],
        cars: ["motor vehicle", "passenger"],
        automobile: ["motor vehicle", "passenger"],
        vehicle: ["motor vehicle"],
        vehicles: ["motor vehicle"],
        suv: ["motor vehicle", "passenger"],
        sedan: ["motor vehicle", "passenger"],
        van: ["motor vehicle", "passenger"],
        bus: ["bus", "motor vehicle"],
        truck: ["motor vehicle", "truck"],
        pickup: ["motor vehicle", "truck"],
        motorcycle: ["motorcycle", "moped"],
        motorbike: ["motorcycle", "moped"],
        bike: ["bicycle", "motorcycle"],
        bicycle: ["bicycle"],
        scooter: ["motorcycle", "moped", "scooter"],
        electric: ["electric", "motor"],
        ev: ["electric vehicle", "motor"],
        tractor: ["tractor", "agricultural"],
        engine: ["engine", "motor"],
        tire: ["tyre", "rubber"],
        tires: ["tyre", "rubber"],
        tyre: ["tyre", "rubber"],
        parts: ["parts", "component"],

        // Clothing & textiles
        shoes: ["footwear"],
        shoe: ["footwear"],
        sneakers: ["footwear", "athletic"],
        boots: ["footwear", "boot"],
        sandals: ["footwear", "sandal"],
        shirt: ["apparel", "garment", "knit"],
        shirts: ["apparel", "garment", "knit"],
        tshirt: ["apparel", "garment", "knit"],
        jacket: ["apparel", "garment", "outerwear"],
        coat: ["apparel", "garment", "outerwear"],
        jeans: ["apparel", "garment", "denim"],
        pants: ["apparel", "garment", "trouser"],
        trousers: ["apparel", "garment", "trouser"],
        dress: ["apparel", "garment", "dress"],
        suit: ["apparel", "garment", "suit"],
        hat: ["apparel", "garment", "hat"],
        gloves: ["apparel", "garment", "glove"],
        socks: ["apparel", "garment", "hosiery"],
        underwear: ["apparel", "garment", "underwear"],
        clothes: ["apparel", "garment", "textile"],
        clothing: ["apparel", "garment", "textile"],
        fabric: ["textile", "fabric", "woven"],
        cotton: ["cotton"],
        silk: ["silk"],
        wool: ["wool"],
        leather: ["leather"],
        nylon: ["nylon", "synthetic"],
        polyester: ["polyester", "synthetic"],

        // Food & agriculture
        soybean: ["soya", "soybean"],
        soybeans: ["soya", "soybean"],
        soy: ["soya", "soybean"],
        corn: ["maize", "corn"],
        maize: ["maize", "corn"],
        wheat: ["wheat", "cereal"],
        rice: ["rice"],
        sugar: ["sugar", "cane"],
        coffee: ["coffee"],
        cocoa: ["cocoa", "chocolate"],
        chocolate: ["chocolate", "cocoa"],
        chicken: ["poultry", "fowl", "chicken"],
        poultry: ["poultry", "fowl"],
        beef: ["bovine", "beef"],
        pork: ["swine", "pork"],
        fish: ["fish", "seafood"],
        seafood: ["fish", "seafood", "crustacean"],
        shrimp: ["shrimp", "crustacean"],
        lobster: ["lobster", "crustacean"],
        salmon: ["salmon", "fish"],
        tuna: ["tuna", "fish"],
        milk: ["milk", "dairy"],
        cheese: ["cheese", "dairy"],
        butter: ["butter", "dairy"],
        eggs: ["egg", "poultry"],
        orange: ["orange", "citrus"],
        apple: ["apple", "fruit"],
        banana: ["banana", "fruit"],
        nuts: ["nut", "edible"],
        peanuts: ["peanut", "groundnut"],
        soyoil: ["soya oil", "vegetable oil"],
        oil: ["oil", "vegetable oil"],
        olive: ["olive", "oil"],

        // Metals & materials
        steel: ["steel", "iron"],
        iron: ["iron", "steel"],
        aluminum: ["aluminum", "aluminium"],
        aluminium: ["aluminum", "aluminium"],
        copper: ["copper"],
        gold: ["gold", "precious metal"],
        silver: ["silver", "precious metal"],
        zinc: ["zinc"],
        nickel: ["nickel"],
        titanium: ["titanium"],
        lumber: ["lumber", "wood", "timber"],
        wood: ["wood", "lumber", "timber"],
        timber: ["timber", "wood", "lumber"],
        plywood: ["plywood", "wood"],
        glass: ["glass"],
        plastic: ["plastic", "polymer"],
        rubber: ["rubber"],
        paper: ["paper", "paperboard"],
        cardboard: ["cardboard", "paperboard"],
        cement: ["cement"],
        concrete: ["concrete", "cement"],

        // Energy & chemicals
        oil: ["petroleum", "crude oil"],
        petroleum: ["petroleum", "crude oil"],
        gas: ["gas", "petroleum"],
        lng: ["liquefied natural gas", "petroleum"],
        coal: ["coal"],
        solar: ["photovoltaic", "solar"],
        panel: ["photovoltaic", "panel"],
        battery: ["battery", "accumulator"],
        batteries: ["battery", "accumulator"],
        fertilizer: ["fertilizer", "fertiliser"],
        chemical: ["chemical"],
        paint: ["paint", "varnish"],
        plastic: ["plastic", "polymer", "resin"],

        // Pharma & medical
        medicine: ["pharmaceutical", "medicament"],
        drug: ["pharmaceutical", "medicament"],
        drugs: ["pharmaceutical", "medicament"],
        vaccine: ["vaccine", "pharmaceutical"],
        medical: ["medical", "surgical", "pharmaceutical"],
        device: ["medical", "apparatus", "instrument"],
        syringe: ["syringe", "medical"],
        mask: ["mask", "protective"],
        glove: ["glove", "protective"],

        // Semiconductors & tech components
        semiconductor: ["semiconductor", "integrated circuit"],
        chip: ["semiconductor", "integrated circuit"],
        chips: ["semiconductor", "integrated circuit"],
        microchip: ["semiconductor", "integrated circuit"],
        transistor: ["transistor", "semiconductor"],
        diode: ["diode", "semiconductor"],
        circuit: ["integrated circuit", "semiconductor"],
        processor: ["processor", "integrated circuit"],
        memory: ["memory", "integrated circuit"],
        ram: ["memory", "integrated circuit"],

        // Aircraft & maritime
        aircraft: ["aircraft", "airplane"],
        airplane: ["aircraft", "airplane"],
        helicopter: ["helicopter", "aircraft"],
        drone: ["drone", "aircraft", "unmanned"],
        boat: ["vessel", "boat"],
        ship: ["vessel", "ship"],
        yacht: ["vessel", "yacht"],
        container: ["container", "vessel"],

        // Furniture & home
        furniture: ["furniture", "seat"],
        sofa: ["sofa", "seat", "furniture"],
        chair: ["chair", "seat", "furniture"],
        table: ["table", "furniture"],
        bed: ["bed", "furniture"],
        mattress: ["mattress", "furniture"],
        lamp: ["lamp", "lighting"],
        appliance: ["appliance", "machine"],
        refrigerator: ["refrigerator", "cooling"],
        fridge: ["refrigerator", "cooling"],
        washing: ["washing machine", "laundry"],
        dishwasher: ["dishwasher", "machine"],
        oven: ["oven", "cooking"],
        microwave: ["microwave", "cooking"],
        aircon: ["air conditioner", "cooling"],
        ac: ["air conditioner", "cooling"],
        vacuum: ["vacuum cleaner"],

        // Watches & luxury
        watch: ["watch", "timepiece"],
        watches: ["watch", "timepiece"],
        jewelry: ["jewelry", "jewellery", "precious"],
        jewellery: ["jewelry", "jewellery"],
        diamond: ["diamond", "precious stone"],
        perfume: ["perfume", "cosmetic"],
        cosmetics: ["cosmetic", "beauty"],
        makeup: ["cosmetic", "beauty"],

        // Toys & sports
        toy: ["toy", "game"],
        toys: ["toy", "game"],
        game: ["game", "toy"],
        console: ["game console", "video game"],
        playstation: ["game console"],
        xbox: ["game console"],
        bicycle: ["bicycle"],
        golf: ["golf", "sporting"],
        sports: ["sporting", "sport"],
        gym: ["sporting", "exercise"],
      };

      const lower = q.toLowerCase().trim();
      // Exact match first, then try each individual word in a multi-word query
      const mapped = synonyms[lower];
      let terms: string[];
      if (mapped) {
        terms = mapped;
      } else {
        // Try each word individually against the synonym map, collect all hits
        const words = lower.split(/\s+/);
        const wordMapped = words.flatMap(w => synonyms[w] ?? []);
        // If any word matched, use those terms + the original query
        terms = wordMapped.length > 0 ? [...new Set([q, ...wordMapped])] : [q];
      }

      // Run searches for each term in parallel, deduplicate by hts8
      const results = await Promise.all(
        terms.slice(0, 4).map(t =>
          supabase
            .from("hts_catalog")
            .select("hts8, description, mfn_rate")
            .ilike("description", `%${t}%`)
            .limit(8)
        )
      );

      const seen = new Set<string>();
      const merged: typeof searchResults = [];
      for (const { data } of results) {
        for (const row of (data ?? [])) {
          if (!seen.has(row.hts8)) {
            seen.add(row.hts8);
            merged.push(row);
          }
        }
      }

      setSearchResults(merged.slice(0, 8));
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

      // Populate form fields
      if (data.hs_code) {
        setHsCode(data.hs_code);
        setProductQuery(data.product_name ? `${data.product_name} (HS ${data.hs_code})` : `HS ${data.hs_code}`);
      }
      if (data.product_name) setProductName(data.product_name);
      // For importers, origin_country = their trading partner; for exporters, destination_country
      if (data.destination_country) setDestination(data.destination_country);
      if (data.origin_country && !data.destination_country) setDestination(data.origin_country);
      if (data.shipment_value) setShipmentValue(String(data.shipment_value));
      if (data.incoterms) setIncoterms(data.incoterms);
      if (data.quantity) setQuantity(data.quantity);
      if (data.exporter_name) setExporterName(data.exporter_name);
      if (data.importer_name) setImporterName(data.importer_name);

      // Build preview card showing everything extracted
      const preview: Record<string, string> = {};
      if (data.product_name) preview["Product"] = data.product_name;
      if (data.hs_code) preview["HS Code"] = data.hs_code;
      if (data.origin_country) preview["Origin"] = data.origin_country;
      if (data.destination_country) preview["Destination"] = data.destination_country;
      if (data.shipment_value) preview["Value"] = `$${Number(data.shipment_value).toLocaleString()}${data.currency && data.currency !== "USD" ? ` (${data.currency})` : ""}`;
      if (data.incoterms) preview["Incoterms"] = data.incoterms;
      if (data.quantity) preview["Quantity"] = data.quantity;
      if (data.exporter_name) preview["Exporter"] = data.exporter_name;
      if (data.importer_name) preview["Importer"] = data.importer_name;
      if (data.notes) preview["Notes"] = data.notes;
      setExtractedPreview(Object.keys(preview).length > 0 ? preview : null);

      setMode("manual");
      const fieldCount = Object.keys(preview).length;
      toast({ title: `Document read — ${fieldCount} fields extracted`, description: "Review and simulate." });
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
        body: { hs_code: hsCode, destination_country: destination, shipment_value: value, product_name: productName, trade_mode: tradeMode, incoterms: incoterms || undefined, quantity: quantity || undefined },
      });
      if (error) throw error;
      navigate("/results", { state: { result: data, input: { hsCode, productName, destination, shipmentValue: value, tradeMode } } });
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
          <p className="text-muted-foreground text-sm">Search any of 12,788 products or upload a trade document. We combine 29 years of USITC rate history with live scraped tariff data.</p>
        </div>

        {/* Importer / Exporter toggle */}
        <div className="mb-5">
          <div className="text-xs font-medium text-muted-foreground mb-2">I am a US…</div>
          <div className="flex gap-2">
            {(["exporter", "importer"] as TradeMode[]).map((tm) => (
              <button
                key={tm}
                onClick={() => setTradeMode(tm)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${tradeMode === tm ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                <span className="hidden sm:inline">{tm === "exporter" ? "🚢 Exporter — selling abroad" : "📦 Importer — buying from abroad"}</span>
                <span className="sm:hidden">{tm === "exporter" ? "🚢 Exporter" : "📦 Importer"}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {tradeMode === "exporter"
              ? "See what foreign countries charge on your goods — live retaliation + 29yr US export duty history."
              : "See what the US charges on goods you bring in — MFN duty + Section 301/232 additional duties."}
          </p>
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

        {/* Extracted document preview */}
        {mode === "manual" && extractedPreview && (
          <div className="mb-5 rounded-xl border border-primary/20 bg-primary-soft overflow-hidden">
            <div className="px-4 py-2.5 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Extracted from document</span>
              </div>
              <button onClick={() => setExtractedPreview(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="divide-y divide-primary/10">
              {Object.entries(extractedPreview).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2 text-[10px] text-muted-foreground bg-primary/5">
              Fields pre-filled below — review and adjust before simulating
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
                  <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden max-h-60 overflow-y-auto">
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

            {/* Country */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                {tradeMode === "exporter" ? "Destination country (where you're shipping TO)" : "Origin country (where you're importing FROM)"}
              </Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={tradeMode === "exporter" ? "Select destination…" : "Select origin country…"} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
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

            {/* Incoterms + Quantity — optional, shown collapsed */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">
                  Incoterms <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Select value={incoterms} onValueChange={setIncoterms}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="e.g. FOB" />
                  </SelectTrigger>
                  <SelectContent>
                    {["FOB", "CIF", "DDP", "EXW", "DAP", "CFR", "FCA", "CPT", "CIP", "DAT"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">
                  Quantity <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g. 100 units"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
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
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Simulating — pulling 29yr history + live rates…</>
                : tradeMode === "exporter"
                  ? <>Simulate export risk <ArrowRight className="ml-2 h-4 w-4" /></>
                  : <>Simulate import cost <ArrowRight className="ml-2 h-4 w-4" /></>}
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
