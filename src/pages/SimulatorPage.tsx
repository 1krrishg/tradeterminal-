import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, X, Loader2, ArrowRight, Globe, Package, DollarSign, Search, CheckCircle2, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavBar } from "@/components/landing/NavBar";
import { Footer } from "@/components/landing/Footer";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const COUNTRIES = [
  "United States", "China", "European Union", "Canada", "Mexico", "Japan", "India",
  "South Korea", "United Kingdom", "Australia", "Brazil", "Singapore",
  "Turkey", "Vietnam", "Indonesia", "Thailand", "Malaysia",
];

type Mode = "document" | "manual";
type TradeMode = "exporter" | "importer";
type HtsResult = { hts8: string; description: string; mfn_rate: number };

interface CbpRuling {
  number: string | null;
  subject: string | null;
  date: string | null;
  hs_match: boolean;
}

interface ClassificationCandidate {
  hts8: string;
  heading: string;
  description: string;
  gri_rule: string;
  reasoning: string;
  confidence: number;
  disqualified: string;
  mfn_rate: number | null;
  usitc_validated: boolean;
  cbp_ruling: CbpRuling | null;
}

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
  const [originCountry, setOriginCountry] = useState("United States");
  const [destination, setDestination] = useState("");

  // When trade mode switches, reset origin/destination to sensible defaults
  const handleTradeModeChange = (tm: TradeMode) => {
    setTradeMode(tm);
    if (tm === "importer") {
      // Importing TO the US — origin should be the foreign country, not the US
      setOriginCountry("");
      setDestination("United States");
    } else {
      // Exporting FROM the US
      setOriginCountry("United States");
      setDestination("");
    }
  };
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

  // Classification state
  const [classifying, setClassifying] = useState(false);
  const [candidates, setCandidates] = useState<ClassificationCandidate[]>([]);
  const [showClassification, setShowClassification] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ClassificationCandidate | null>(null);
  const [showDisqualified, setShowDisqualified] = useState(false);

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
        oil: ["oil", "vegetable oil", "petroleum", "crude oil"],
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
        plastic: ["plastic", "polymer", "resin"],
        rubber: ["rubber"],
        paper: ["paper", "paperboard"],
        cardboard: ["cardboard", "paperboard"],
        cement: ["cement"],
        concrete: ["concrete", "cement"],

        // Energy & chemicals
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
    setSelectedCandidate(null);
    setCandidates([]);
    setShowClassification(false);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProducts(val), 300);
  };

  const selectProduct = (r: HtsResult) => {
    setHsCode(r.hts8);
    setProductName(r.description);
    setProductQuery(`${r.description} (HS ${r.hts8})`);
    setShowDropdown(false);
    setCandidates([]);
    setShowClassification(false);
    setSelectedCandidate(null);
  };

  const selectCandidate = (c: ClassificationCandidate) => {
    setSelectedCandidate(c);
    setHsCode(c.hts8);
    setProductName(c.description);
    setShowClassification(false);
  };

  const runClassification = async () => {
    if (!productQuery.trim() || productQuery.length < 3) {
      toast({ title: "Describe the product first", description: "Type what the product is, then click Classify.", variant: "destructive" });
      return;
    }
    setClassifying(true);
    setShowDropdown(false);
    setCandidates([]);
    setShowClassification(false);
    setSelectedCandidate(null);
    setHsCode("");
    setProductName("");
    try {
      const { data, error } = await supabase.functions.invoke("classify-hs", {
        body: { description: productQuery },
      });
      if (error) throw error;
      const list: ClassificationCandidate[] = data?.candidates ?? [];
      if (list.length === 0) throw new Error("No candidates returned");
      setCandidates(list);
      setShowClassification(true);
      // Auto-select the top candidate
      selectCandidate(list[0]);
    } catch {
      toast({ title: "Classification failed", description: "Try a more specific product description.", variant: "destructive" });
    } finally {
      setClassifying(false);
    }
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
      if (data.origin_country) setOriginCountry(data.origin_country);
      else if (!data.destination_country && data.origin_country) setDestination(data.origin_country);
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

  const LOADING_STAGES = [
    "Identifying your product for customs...",
    "Pulling 29 years of rate history...",
    "Checking live retaliation from China, EU, Canada, India...",
    "Checking for FTA preferential rates...",
    "Running risk analysis...",
    "Building your recommendation...",
  ];
  const [loadingStage, setLoadingStage] = useState(0);

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
    setLoadingStage(0);

    // Advance loading stages while API call runs
    const stageInterval = setInterval(() => {
      setLoadingStage(prev => (prev < LOADING_STAGES.length - 1 ? prev + 1 : prev));
    }, 900);

    try {
      const { data, error } = await supabase.functions.invoke("simulate-tariff", {
        body: { hs_code: hsCode, destination_country: destination, origin_country: originCountry || "United States", shipment_value: value, product_name: productName, trade_mode: tradeMode, incoterms: incoterms || undefined, quantity: quantity || undefined },
      });
      if (error) throw error;
      navigate("/results", { state: { result: data, input: { hsCode, productName, destination, shipmentValue: value, tradeMode }, classification: selectedCandidate } });
    } catch {
      toast({ title: "Simulation failed", description: "Could not generate simulation. Try again.", variant: "destructive" });
    } finally {
      clearInterval(stageInterval);
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
          <div className="text-xs font-medium text-muted-foreground mb-2">I am…</div>
          <div className="flex gap-2">
            {(["exporter", "importer"] as TradeMode[]).map((tm) => (
              <button
                key={tm}
                onClick={() => handleTradeModeChange(tm)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${tradeMode === tm ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                <span className="hidden sm:inline">{tm === "exporter" ? "🚢 Exporter — shipping goods out" : "📦 Importer — bringing goods in"}</span>
                <span className="sm:hidden">{tm === "exporter" ? "🚢 Exporter" : "📦 Importer"}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {tradeMode === "exporter"
              ? "See what the destination country charges on your goods — live retaliation rates + 29 years of duty history."
              : "See what the destination country charges on goods you're shipping in — MFN duty + any additional tariffs."}
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

            {/* Product search + classification */}
            <div>
              <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Product
              </Label>

              {/* Search input + action buttons */}
              <div ref={searchRef} className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Describe product or paste HS code…"
                      value={productQuery}
                      onChange={(e) => handleProductInput(e.target.value)}
                      onFocus={() => productQuery.length >= 2 && setShowDropdown(true)}
                      onKeyDown={(e) => { if (e.key === "Enter") { setShowDropdown(false); runClassification(); } }}
                      className="pl-9"
                    />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={runClassification}
                    disabled={classifying || productQuery.trim().length < 3}
                    className="shrink-0 text-xs px-3 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Classify →"}
                  </Button>
                </div>

                {/* Quick search dropdown (HS code lookup or keyword) */}
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
                    No quick matches — click <strong>Classify →</strong> for GRI analysis.
                  </div>
                )}
              </div>

              {/* Classification loading state */}
              {classifying && (
                <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-foreground">Classifying under HTSUS…</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Applying GRI rules · checking CBP rulings · validating in USITC</div>
                  </div>
                </div>
              )}

              {/* Classification card */}
              {!classifying && candidates.length > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">HS Classification · GRI Analysis</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowClassification(!showClassification)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showClassification ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {showClassification && (
                    <div className="divide-y divide-border">
                      {candidates.map((c, i) => {
                        const isSelected = selectedCandidate?.hts8 === c.hts8;
                        const confColor = c.confidence >= 75 ? "text-success" : c.confidence >= 55 ? "text-warning" : "text-muted-foreground";
                        const confBg = c.confidence >= 75 ? "bg-success" : c.confidence >= 55 ? "bg-warning" : "bg-muted-foreground";
                        return (
                          <button
                            key={c.hts8}
                            onClick={() => selectCandidate(c)}
                            className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Radio indicator */}
                              <div className={`mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-muted-foreground/40"}`}>
                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-bold text-foreground">{c.hts8}</span>
                                  <span className={`text-xs font-semibold ${confColor}`}>{c.confidence}%</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">GRI {c.gri_rule}</span>
                                  {i === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Recommended</span>}
                                </div>

                                {/* Confidence bar */}
                                <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${confBg}`} style={{ width: `${c.confidence}%` }} />
                                </div>

                                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{c.description}</p>
                                <p className="text-xs text-foreground/70 mt-1 italic">"{c.reasoning}"</p>

                                {/* CBP ruling citation */}
                                {c.cbp_ruling?.number && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <ExternalLink className="h-3 w-3 text-primary shrink-0" />
                                    <span className="text-[10px] text-primary">
                                      CBP Ruling {c.cbp_ruling.number}
                                      {c.cbp_ruling.date ? ` (${c.cbp_ruling.date.substring(0, 4)})` : ""}
                                      {c.cbp_ruling.hs_match ? " · HS match ✓" : ""}
                                    </span>
                                  </div>
                                )}

                                {/* USITC validation badge */}
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  {c.usitc_validated ? (
                                    <span className="text-[10px] text-success flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" /> USITC validated
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-warning flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" /> Not in USITC DB
                                    </span>
                                  )}
                                  {c.mfn_rate !== null && c.mfn_rate > 0 && (
                                    <span className="text-[10px] text-muted-foreground">· US MFN: {(c.mfn_rate * 100).toFixed(1)}%</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Disqualified headings toggle */}
                  {selectedCandidate?.disqualified && selectedCandidate.disqualified.length > 5 && (
                    <div className="border-t border-border">
                      <button
                        onClick={() => setShowDisqualified(!showDisqualified)}
                        className="w-full px-4 py-2 text-left text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {showDisqualified ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        Headings considered and rejected
                      </button>
                      {showDisqualified && (
                        <div className="px-4 pb-3 text-[10px] text-muted-foreground leading-relaxed">
                          {selectedCandidate.disqualified}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit trail footer */}
                  <div className="px-4 py-2 bg-muted/20 border-t border-border text-[10px] text-muted-foreground">
                    Classification basis: WCO GRI · USITC HTSUS 2026 · CBP CROSS rulings database
                  </div>
                </div>
              )}

              {/* Selected code confirmation */}
              {hsCode && !showClassification && (
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    HS {hsCode} selected
                    {selectedCandidate && <span className="text-muted-foreground">· {selectedCandidate.confidence}% confidence · GRI {selectedCandidate.gri_rule}</span>}
                    {!selectedCandidate && <span className="text-muted-foreground">· USITC 2026</span>}
                  </div>
                  {candidates.length > 0 && (
                    <button
                      onClick={() => setShowClassification(true)}
                      className="text-[10px] text-primary underline underline-offset-2"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Origin + Destination */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  {tradeMode === "exporter" ? "Origin (shipping FROM)" : "Origin (manufactured in)"}
                </Label>
                <Select value={originCountry} onValueChange={setOriginCountry}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select origin…" />
                  </SelectTrigger>
                  <SelectContent>
                    {["United States", ...COUNTRIES.filter(c => c !== "United States")].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  {tradeMode === "exporter" ? "Destination (shipping TO)" : "Destination (entering)"}
                </Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tradeMode === "exporter" ? "Select destination…" : "Select destination…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {originCountry && destination && (
              <div className="text-xs text-muted-foreground -mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                WTO will check preferential rates for {originCountry} → {destination} corridor
              </div>
            )}

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
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{LOADING_STAGES[loadingStage]}</>
                : tradeMode === "exporter"
                  ? <>Simulate export risk <ArrowRight className="ml-2 h-4 w-4" /></>
                  : <>Simulate import cost <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
            {simulating && (
              <div className="mt-3 rounded-lg border border-border bg-muted/20 overflow-hidden">
                {LOADING_STAGES.map((stage, i) => (
                  <div key={stage} className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${i === loadingStage ? "bg-primary/5 text-foreground" : i < loadingStage ? "text-success" : "text-muted-foreground/40"}`}>
                    {i < loadingStage
                      ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                      : i === loadingStage
                        ? <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                        : <div className="h-3 w-3 rounded-full border border-muted-foreground/20 shrink-0" />}
                    {stage}
                  </div>
                ))}
              </div>
            )}
            {!simulating && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Queries official rate history going back to 1998 · live scraped retaliation rates
              </p>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
