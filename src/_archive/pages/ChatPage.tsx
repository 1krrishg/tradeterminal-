import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Send, Plus, MessageSquare, LogOut, Paperclip,
  FileCheck2, ShieldAlert, AlertTriangle, X, Menu,
  CheckCircle2, XCircle, Wrench, Mic, MicOff, Loader2, Truck, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { runRedFlagEngine } from "@/lib/redFlagEngine";
import { reconcileDocuments } from "@/lib/documentReconciler";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { validateGSTIN, validateHSN, editLorryReceipt } from "@/lib/agentTools";
import { useShipments } from "@/hooks/useShipments";
import { matchRegulations } from "@/lib/regulationMatcher";
import type { RegulationMatch } from "@/lib/regulationMatcher";
import { detectFixRequest } from "@/lib/fixRequestDetector";
import { RegulationImpactBanner } from "@/components/chat/RegulationImpactBanner";
import { EditApprovalCard } from "@/components/chat/EditApprovalCard";
import type { RiskCategory } from "@/types/risk";
import type { LorryReceiptData } from "@/types/lr";

interface Conversation { id: string; title: string; created_at: string; user_id: string; }
interface Message { id: string; conversation_id: string; role: "user" | "assistant"; content: string; created_at: string; }

interface PendingPatch {
  diff: Array<{ field: string; old: any; new: any; reason: string }>;
  patch: Record<string, any>;
  explanation: string;
  messageId: string;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const HSN_RE = /^\d{4}(\d{2}(\d{2})?)?$/;

function detectGSTIN(text: string): string | null {
  const tokens = text.trim().split(/\s+/);
  for (const t of tokens) {
    if (GSTIN_RE.test(t)) return t.toUpperCase();
  }
  return null;
}

function detectHSN(text: string): string | null {
  const tokens = text.trim().split(/\s+/);
  for (const t of tokens) {
    const cleaned = t.replace(/[\s.]/g, "");
    if (HSN_RE.test(cleaned) && (cleaned.length === 4 || cleaned.length === 6 || cleaned.length === 8)) return cleaned;
  }
  return null;
}

// ─── Card components ────────────────────────────────────────────────────────

function formatINR(val: unknown): string {
  const num = parseFloat(String(val ?? "").replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return String(val ?? "—");
  return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatKg(val: unknown): string {
  const num = parseFloat(String(val ?? "").replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return String(val ?? "—");
  return num.toLocaleString("en-IN") + " kg";
}

function ExtractionCard({ data, extractedData }: { data: Record<string, unknown>; extractedData?: LorryReceiptData | null }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-3">
        <FileCheck2 className="h-5 w-5 text-green-600" />
        <span className="font-semibold text-green-800 dark:text-green-400 text-sm">Lorry Receipt Extracted</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
        {[
          ["Consignor", String(data.consignor_name ?? "—")],
          ["Invoice No.", String(data.invoice_number ?? "—")],
          ["Gross Weight", formatKg(data.total_gross_weight)],
          ["Total Value", formatINR(data.total_value)],
          ["Line Items", String(data.line_items_count ?? "—")],
          ["Confidence", data.confidence !== undefined ? `${data.confidence}%` : "—"],
        ].map(([label, val]) => (
          <div key={String(label)}>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-medium truncate">{val}</div>
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-100"
        onClick={() => navigate("/bilty", { state: { data: extractedData } })}>
        View full bilty
      </Button>
    </div>
  );
}

const CATEGORY_STYLES: Record<RiskCategory, { badge: string; label: string }> = {
  clean: { badge: "bg-green-100 text-green-800 border-green-200", label: "Clean" },
  attention: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Needs Attention" },
  problem: { badge: "bg-red-100 text-red-800 border-red-200", label: "Likely Problem" },
};

function RiskCard({ data }: { data: Record<string, unknown> }) {
  const category = (data.category as RiskCategory) ?? "clean";
  const styles = CATEGORY_STYLES[category];
  const topFlags = Array.isArray(data.top_flags) ? data.top_flags as string[] : [];
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 max-w-sm w-full">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-5 w-5" />
        <span className="font-semibold text-sm">Risk Analysis</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
          Score: {Number(data.score ?? 0)} — {styles.label}
        </span>
      </div>
      {topFlags.length > 0 && (
        <ul className="space-y-1 mb-3">
          {topFlags.slice(0, 3).map((flag, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
              {flag}
            </li>
          ))}
        </ul>
      )}
      {data.needs_review && (
        <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-200 px-2.5 py-0.5 text-xs font-medium text-orange-800">
          <AlertTriangle className="h-3 w-3" />Manual review recommended
        </div>
      )}
    </div>
  );
}

function GSTINBadge({ gstin, result }: { gstin: string; result: ReturnType<typeof validateGSTIN> }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs max-w-sm w-full ${result.valid ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
      {result.valid
        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
      <div>
        <div className={`font-semibold ${result.valid ? "text-green-800 dark:text-green-400" : "text-red-800 dark:text-red-400"}`}>
          GSTIN {result.valid ? "Valid" : "Invalid"}: {gstin}
        </div>
        {result.valid
          ? <div className="text-muted-foreground mt-0.5">State: {result.stateCode} · PAN: {result.pan}</div>
          : <div className="text-red-700 dark:text-red-400 mt-0.5">{result.error}</div>}
      </div>
    </div>
  );
}

function HSNBadge({ hsn, result }: { hsn: string; result: ReturnType<typeof validateHSN> }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs max-w-sm w-full ${result.valid ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
      {result.valid
        ? <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
        : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
      <div>
        <div className={`font-semibold ${result.valid ? "text-blue-800 dark:text-blue-400" : "text-red-800 dark:text-red-400"}`}>
          HSN {result.valid ? "Valid" : "Invalid"}: {hsn}
        </div>
        {result.valid
          ? <div className="text-muted-foreground mt-0.5">{result.digits}-digit code</div>
          : <div className="text-red-700 dark:text-red-400 mt-0.5">{result.error}</div>}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  latestExtracted,
  pendingPatch,
  onApprove,
  onReject,
  regulationMatches,
  onDismissRegulations,
}: {
  msg: Message;
  latestExtracted?: LorryReceiptData | null;
  pendingPatch?: PendingPatch | null;
  onApprove?: () => void;
  onReject?: () => void;
  regulationMatches?: RegulationMatch[];
  onDismissRegulations?: () => void;
}) {
  if (msg.content.startsWith("__EXTRACTION_CARD__")) {
    try {
      const json = JSON.parse(msg.content.slice("__EXTRACTION_CARD__".length));
      return <div className="flex justify-start"><ExtractionCard data={json} extractedData={latestExtracted} /></div>;
    } catch { /* fall through */ }
  }
  if (msg.content.startsWith("__RISK_CARD__")) {
    try {
      const json = JSON.parse(msg.content.slice("__RISK_CARD__".length));
      return <div className="flex justify-start"><RiskCard data={json} /></div>;
    } catch { /* fall through */ }
  }
  if (msg.content.startsWith("__REGULATION_BANNER__")) {
    if (regulationMatches && regulationMatches.length > 0 && onDismissRegulations) {
      try {
        const json = JSON.parse(msg.content.slice("__REGULATION_BANNER__".length));
        return (
          <div className="flex justify-start w-full max-w-lg">
            <RegulationImpactBanner
              matches={regulationMatches}
              corridor={json.corridor ?? ""}
              onDismiss={onDismissRegulations}
            />
          </div>
        );
      } catch { /* fall through */ }
    }
    return null;
  }
  if (msg.content.startsWith("__GSTIN_BADGE__")) {
    try {
      const json = JSON.parse(msg.content.slice("__GSTIN_BADGE__".length));
      return <div className="flex justify-start"><GSTINBadge gstin={json.gstin} result={json.result} /></div>;
    } catch { /* fall through */ }
  }
  if (msg.content.startsWith("__HSN_BADGE__")) {
    try {
      const json = JSON.parse(msg.content.slice("__HSN_BADGE__".length));
      return <div className="flex justify-start"><HSNBadge hsn={json.hsn} result={json.result} /></div>;
    } catch { /* fall through */ }
  }
  if (msg.content.startsWith("__EDIT_APPROVAL_CARD__")) {
    try {
      const json = JSON.parse(msg.content.slice("__EDIT_APPROVAL_CARD__".length));
      const isThisPending = pendingPatch?.messageId === msg.id;
      return (
        <div className="flex justify-start">
          <EditApprovalCard
            title={json.explanation ?? "Proposed Changes"}
            diff={json.diff ?? []}
            onApprove={isThisPending && onApprove ? onApprove : () => {}}
            onReject={isThisPending && onReject ? onReject : () => {}}
            isApplied={!isThisPending && json.applied === true}
          />
        </div>
      );
    } catch { /* fall through */ }
  }
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
        msg.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId: string }>();
  const { toast } = useToast();
  const { sendMessage, streamingText, isStreaming } = useStreamingChat();
  const { saveShipment } = useShipments();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [latestExtracted, setLatestExtracted] = useState<LorryReceiptData | null>(null);
  const [lastExtractedData, setLastExtractedData] = useState<Record<string, any> | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Saved user mode — persists in localStorage ───────────────────────────
  const [userMode, setUserMode] = useState<"transporter" | "exporter" | null>(() => {
    const saved = localStorage.getItem("ability_user_mode");
    return (saved === "transporter" || saved === "exporter") ? saved : null;
  });

  const saveMode = (mode: "transporter" | "exporter") => {
    localStorage.setItem("ability_user_mode", mode);
    setUserMode(mode);
  };

  // ── Voice input ──────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecording = useCallback(async () => {
    // If already recording — stop and transcribe
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });

        // Don't transcribe if audio is too short (< 0.5s = likely accidental tap)
        if (blob.size < 3000) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, mimeType === "audio/webm" ? "audio.webm" : "audio.mp4");
          const { data, error } = await supabase.functions.invoke("transcribe", { body: formData });
          if (error || data?.error) {
            toast({ title: "Voice failed", description: data?.error ?? error?.message ?? "Try again.", variant: "destructive" });
          } else {
            const transcript: string = data?.text?.trim() ?? "";
            if (transcript) setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
          }
        } catch {
          toast({ title: "Voice error", description: "Transcription failed.", variant: "destructive" });
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone blocked", description: "Allow mic access in your browser settings.", variant: "destructive" });
    }
  }, [isRecording, toast]);
  const [regulationMatches, setRegulationMatches] = useState<RegulationMatch[]>([]);
  const [pendingPatch, setPendingPatch] = useState<PendingPatch | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth", { state: { from: "/chat" } }); return; }
      setUserId(session.user.id);
      fetchConversations(session.user.id);
    });
  }, [navigate]);

  useEffect(() => {
    if (conversationId) fetchMessages(conversationId);
    else { setMessages([]); setRegulationMatches([]); setPendingPatch(null); }
  }, [conversationId]);

  useEffect(() => { scrollToBottom(); }, [messages, loading, isStreaming, streamingText]);

  const fetchConversations = async (uid: string) => {
    const { data } = await supabase.from("conversations").select("*").eq("user_id", uid).order("updated_at", { ascending: false });
    setConversations(data || []);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("conversations").delete().eq("id", convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (conversationId === convId) navigate("/chat");
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
    const msgs = (data as Message[]) || [];
    setMessages(msgs);

    // Restore extracted data from shipments table so agent has context on reload
    const { data: shipment } = await supabase
      .from("shipments")
      .select("extracted_data")
      .eq("conversation_id", convId)
      .maybeSingle();
    if (shipment?.extracted_data) {
      setLastExtractedData(shipment.extracted_data as Record<string, any>);
      setLatestExtracted(shipment.extracted_data as LorryReceiptData);
    }
  };

  const insertMessage = async (convId: string, role: "user" | "assistant", content: string): Promise<Message | null> => {
    const { data, error } = await supabase.from("messages").insert({ conversation_id: convId, role, content }).select().single();
    if (error) { console.error(error); return null; }
    return data as Message;
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const handleNewConversation = async (prefill?: string) => {
    if (!userId) return;
    // If user has a saved mode and no custom prefill, start with that mode's welcome
    if (userMode && !prefill) { await startConversationWithMode(userMode); return; }
    const { data, error } = await supabase.from("conversations").insert({ title: "New Shipment", user_id: userId }).select().single();
    if (error) { toast({ title: "Error", description: "Failed to create conversation.", variant: "destructive" }); return; }
    setConversations(prev => [data, ...prev]);
    if (prefill) setInputText(prefill);
    navigate(`/chat/${data.id}`);
  };

  const handleModeSelect = async (mode: "transporter" | "exporter") => {
    if (!userId) return;
    saveMode(mode); // remember forever
    await startConversationWithMode(mode);
  };

  const startConversationWithMode = async (mode: "transporter" | "exporter") => {
    if (!userId) return;
    const title = mode === "transporter" ? "New Bilty" : "Document Check";
    const { data, error } = await supabase.from("conversations").insert({ title, user_id: userId }).select().single();
    if (error) { toast({ title: "Error", description: "Failed to create conversation.", variant: "destructive" }); return; }
    setConversations(prev => [data, ...prev]);

    const welcome = mode === "transporter"
      ? "Ready to generate your bilty. Attach your **invoice** (required) + packing list, e-way bill, or LC using the 📎 button."
      : "Ready to check your documents. Attach your **invoice** + packing list, e-way bill, or LC using the 📎 button. I'll flag every mismatch.";

    await supabase.from("messages").insert({ conversation_id: data.id, role: "assistant", content: welcome });
    navigate(`/chat/${data.id}`);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.type === "application/pdf") {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1200;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("load failed")); };
      img.src = url;
    });

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runExtraction = async (convId: string, files: File[]) => {
    const userMsg = await insertMessage(convId, "user", `I uploaded ${files.map(f => f.name).join(", ")}. Please analyze this shipment.`);
    if (userMsg) setMessages(prev => [...prev, userMsg]);

    const loadMsg: Message = { id: "loading", conversation_id: convId, role: "assistant", content: "Extracting documents…", created_at: new Date().toISOString() };
    setMessages(prev => [...prev, loadMsg]);
    setLoading(true);

    try {
      const documents = await Promise.all(files.map(async (f) => {
        const base64 = await fileToBase64(f);
        return { name: f.name, type: "image", data: base64, category: "INVOICE" };
      }));

      const { data, error } = await supabase.functions.invoke("extract-lr", { body: { documents, generatePdf: false } });
      if (error || data?.error) throw new Error(error?.message || data?.error);

      const extracted = data.data as LorryReceiptData;
      const confidence = data.extraction_confidence ?? 80;
      setLatestExtracted(extracted);
      setLastExtractedData(extracted as Record<string, any>);

      setMessages(prev => prev.filter(m => m.id !== "loading"));

      const currentMode = localStorage.getItem("ability_user_mode") ?? "transporter";

      // Auto-run risk engine with reconciliation
      const hasLCDocs = files.some(f => f.name.toLowerCase().includes("lc") || f.name.toLowerCase().includes("letter"));
      const reconciliation = reconcileDocuments(extracted, hasLCDocs);
      const risk = runRedFlagEngine(extracted as Parameters<typeof runRedFlagEngine>[0], reconciliation, confidence);

      if (currentMode === "exporter") {
        // Exporter gets a compliance report — no bilty, no "View full bilty" button
        const issues = risk.triggeredSignals.map(s => s.detail);
        const complianceLines: string[] = [];

        complianceLines.push(`**Documents analyzed** — ${files.map(f => f.name).join(", ")}`);
        complianceLines.push(`**Consignor:** ${extracted.consignor_name || "Not found"}`);
        complianceLines.push(`**Invoice:** ${extracted.invoice_number || "Not found"} · Value: ${extracted.summary?.total_value || extracted.declared_value || "—"} · Weight: ${extracted.summary?.total_gross_weight || extracted.gross_weight_kg || "—"} kg`);
        complianceLines.push("");

        if (issues.length === 0) {
          complianceLines.push("✅ **No issues found.** Documents look consistent. Ready for dispatch.");
        } else {
          complianceLines.push(`⚠️ **${issues.length} issue${issues.length > 1 ? "s" : ""} found — fix before dispatch:**`);
          issues.forEach((issue, i) => complianceLines.push(`${i + 1}. ${issue}`));
        }

        complianceLines.push("");
        complianceLines.push("Ask me anything about these documents or type what you want to fix.");

        const complianceMsg = await insertMessage(convId, "assistant", complianceLines.join("\n"));
        if (complianceMsg) setMessages(prev => [...prev, complianceMsg]);
      } else {
        // Transporter gets the extraction card + bilty button
        const cardContent = "__EXTRACTION_CARD__" + JSON.stringify({
          consignor_name: extracted.consignor_name,
          invoice_number: extracted.invoice_number,
          total_gross_weight: extracted.summary?.total_gross_weight || extracted.gross_weight_kg,
          total_value: extracted.summary?.total_value || extracted.declared_value,
          line_items_count: extracted.line_items?.length ?? 0,
          confidence,
        });
        const extractionMsg = await insertMessage(convId, "assistant", cardContent);
        if (extractionMsg) setMessages(prev => [...prev, extractionMsg]);

        const riskContent = "__RISK_CARD__" + JSON.stringify({
          score: risk.score,
          category: risk.category,
          triggered_count: risk.triggeredSignals.length,
          top_flags: risk.triggeredSignals.slice(0, 3).map((s) => s.detail),
          needs_review: risk.needsReview,
        });
        const riskMsg = await insertMessage(convId, "assistant", riskContent);
        if (riskMsg) setMessages(prev => [...prev, riskMsg]);
      }

      // PHASE 4: Save shipment
      try {
        await saveShipment({
          conversationId: convId,
          extractedData: extracted as Record<string, any>,
          riskScore: risk.score,
          riskCategory: risk.category,
        });
      } catch (saveErr: any) {
        console.error("Failed to save shipment:", saveErr);
        toast({ title: "Save failed", description: saveErr?.message || JSON.stringify(saveErr), variant: "destructive" });
      }

      // PHASE 4: Fetch regulations and match
      try {
        const { data: regulationsData } = await supabase.from("regulations").select("*");
        const regulations = regulationsData ?? [];
        if (regulations.length > 0) {
          const corridor =
            (extracted as any).corridor ??
            (extracted as any).origin_state ??
            "";
          const matches = matchRegulations(
            { corridor, extractedData: extracted as Record<string, any>, riskCategory: risk.category },
            regulations
          );
          if (matches.length > 0) {
            setRegulationMatches(matches);
            const bannerContent = "__REGULATION_BANNER__" + JSON.stringify({ corridor, count: matches.length });
            const bannerMsg = await insertMessage(convId, "assistant", bannerContent);
            if (bannerMsg) setMessages(prev => [...prev, bannerMsg]);
          }
        }
      } catch (regErr) {
        console.error("Failed to fetch/match regulations:", regErr);
      }

    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== "loading"));
      toast({ title: "Extraction failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (loading || isStreaming) return;
    if (!conversationId) { handleNewConversation(inputText || undefined); return; }

    if (attachedFiles.length > 0) {
      const files = [...attachedFiles];
      setAttachedFiles([]);
      setInputText("");
      await runExtraction(conversationId, files);
      return;
    }

    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Client-side GSTIN validation
    const gstinMatch = detectGSTIN(text);
    if (gstinMatch) {
      const result = validateGSTIN(gstinMatch);
      const userMsg = await insertMessage(conversationId, "user", text);
      if (userMsg) setMessages(prev => [...prev, userMsg]);
      const badgeContent = "__GSTIN_BADGE__" + JSON.stringify({ gstin: gstinMatch, result });
      const badgeMsg = await insertMessage(conversationId, "assistant", badgeContent);
      if (badgeMsg) setMessages(prev => [...prev, badgeMsg]);
      if (messages.filter(m => m.role === "user").length === 0) {
        const newTitle = text.slice(0, 60);
        await supabase.from("conversations").update({ title: newTitle }).eq("id", conversationId);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
      }
      return;
    }

    // Client-side HSN validation
    const hsnMatch = detectHSN(text);
    if (hsnMatch) {
      const result = validateHSN(hsnMatch);
      const userMsg = await insertMessage(conversationId, "user", text);
      if (userMsg) setMessages(prev => [...prev, userMsg]);
      const badgeContent = "__HSN_BADGE__" + JSON.stringify({ hsn: hsnMatch, result });
      const badgeMsg = await insertMessage(conversationId, "assistant", badgeContent);
      if (badgeMsg) setMessages(prev => [...prev, badgeMsg]);
      if (messages.filter(m => m.role === "user").length === 0) {
        const newTitle = text.slice(0, 60);
        await supabase.from("conversations").update({ title: newTitle }).eq("id", conversationId);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
      }
      return;
    }

    // PHASE 5: Fix request detection
    const hasExtractedData = !!lastExtractedData || messages.some(m => m.content.startsWith("__EXTRACTION_CARD__"));
    const fixDetection = detectFixRequest(text, hasExtractedData);

    if (fixDetection.isFixRequest && fixDetection.confidence >= 0.6 && lastExtractedData) {
      const userMsg = await insertMessage(conversationId, "user", text);
      if (userMsg) setMessages(prev => [...prev, userMsg]);

      const fixLoadMsg: Message = {
        id: "fix-loading",
        conversation_id: conversationId,
        role: "assistant",
        content: "Analyzing document for fixes…",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fixLoadMsg]);
      setLoading(true);

      try {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        const { data: fixData, error: fixError } = await supabase.functions.invoke("fix-document", {
          body: { extractedData: lastExtractedData, fixRequest: text, conversationHistory: history },
        });

        setMessages(prev => prev.filter(m => m.id !== "fix-loading"));

        if (fixError || fixData?.error) throw new Error(fixError?.message || fixData?.error);

        const { diff, patch, explanation } = fixData;

        const cardContent = "__EDIT_APPROVAL_CARD__" + JSON.stringify({ diff, patch, explanation, applied: false });
        const cardMsg = await insertMessage(conversationId, "assistant", cardContent);
        if (cardMsg) {
          setMessages(prev => [...prev, cardMsg]);
          setPendingPatch({ diff, patch, explanation, messageId: cardMsg.id });
        }
      } catch (err) {
        setMessages(prev => prev.filter(m => m.id !== "fix-loading"));
        toast({ title: "Fix failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
      } finally {
        setLoading(false);
      }

      if (messages.filter(m => m.role === "user").length === 0) {
        const newTitle = text.slice(0, 60);
        await supabase.from("conversations").update({ title: newTitle }).eq("id", conversationId);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
      }
      return;
    }

    const userMsg = await insertMessage(conversationId, "user", text);
    if (!userMsg) return;
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Auto-title
    if (messages.filter(m => m.role === "user").length === 0) {
      const newTitle = text.slice(0, 60);
      await supabase.from("conversations").update({ title: newTitle }).eq("id", conversationId);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, title: newTitle } : c));
    }

    try {
      // Build clean history for Groq — replace card messages with readable summaries
      // and inject extracted data as context so the agent knows what was extracted
      const cleanHistory = updatedMessages.map(m => {
        if (m.content.startsWith("__EXTRACTION_CARD__")) {
          try {
            const card = JSON.parse(m.content.slice("__EXTRACTION_CARD__".length));
            return { role: m.role as "user" | "assistant", content: `[Extraction complete: Consignor: ${card.consignor_name || "unknown"}, Invoice: ${card.invoice_number || "unknown"}, Weight: ${card.total_gross_weight || "unknown"} kg, Value: ${card.total_value || "unknown"}, Line items: ${card.line_items_count ?? 0}]` };
          } catch { return null; }
        }
        if (m.content.startsWith("__RISK_CARD__") || m.content.startsWith("__REGULATION_BANNER__") || m.content.startsWith("__GSTIN_BADGE__") || m.content.startsWith("__EDIT_APPROVAL_CARD__")) {
          return null;
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      }).filter(Boolean) as { role: "user" | "assistant"; content: string }[];

      // Inject full extracted data as assistant context if available
      if (lastExtractedData) {
        const d = lastExtractedData as Record<string, any>;
        const summary = [
          `Extracted shipment data:`,
          `Consignor: ${d.consignor_name || "N/A"} | GSTIN: ${d.consignor_gstin || "N/A"} | IEC: ${d.consignor_iec || "N/A"} | PAN: ${d.consignor_pan || "N/A"}`,
          `Consignee: ${d.consignee_name || "N/A"}`,
          `Notify Party: ${d.notify_party_name || "N/A"} | IEC: ${d.notify_party_iec || "N/A"}`,
          `Invoice: ${d.invoice_number || "N/A"} dated ${d.invoice_date || "N/A"}`,
          `From: ${d.from_location || d.origin_city || "N/A"} → To: ${d.destination_city || "N/A"}`,
          `Vehicle: ${d.vehicle_number || "N/A"} | E-Way Bill: ${d.eway_bill_number || "N/A"}`,
          `LC: ${d.lc_number || "None"} | LUT ARN: ${d.lut_arn || "None"}`,
          `Line items: ${(d.line_items || []).map((i: any) => `${i.description} HSN:${i.hsn_code} Qty:${i.quantity} ${i.unit} Pkgs:${i.number_of_packages} NetWt:${i.net_weight_kg}kg GrossWt:${i.gross_weight_kg}kg Val:${i.value}`).join(" | ")}`,
          `Total: Pkgs:${d.summary?.total_packages || "N/A"} NetWt:${d.summary?.total_net_weight || "N/A"}kg GrossWt:${d.summary?.total_gross_weight || "N/A"}kg Value:${d.summary?.total_value || "N/A"}`,
          `Freight: ${d.freight_terms || "N/A"} | Delivery: ${d.delivery_terms || "N/A"}`,
        ].join("\n");
        cleanHistory.unshift({ role: "assistant", content: summary });
      }

      const reply = await sendMessage(
        conversationId,
        text,
        cleanHistory
      );
      if (reply) {
        const assistantMsg = await insertMessage(conversationId, "assistant", reply);
        if (assistantMsg) setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to get AI response.", variant: "destructive" });
    }
  };

  const handleApproveEdit = async () => {
    if (!pendingPatch || !lastExtractedData || !conversationId) return;
    const { patch, explanation, messageId } = pendingPatch;
    const { updated } = editLorryReceipt(lastExtractedData, patch, explanation);
    setLastExtractedData(updated);
    setLatestExtracted(updated as LorryReceiptData);

    // Mark message as applied in DB
    const updatedContent = "__EDIT_APPROVAL_CARD__" + JSON.stringify({
      diff: pendingPatch.diff,
      patch,
      explanation,
      applied: true,
    });
    await supabase.from("messages").update({ content: updatedContent }).eq("id", messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: updatedContent } : m));
    setPendingPatch(null);

    // Also update shipment if saved
    try {
      await saveShipment({
        conversationId,
        extractedData: updated,
        riskScore: 0,
        riskCategory: "clean",
      });
    } catch { /* non-critical */ }
  };

  const handleRejectEdit = () => {
    setPendingPatch(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px";
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const selectedConv = conversations.find(c => c.id === conversationId);

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <span className="font-semibold text-base tracking-tight">Ability</span>
        <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-3 py-3 space-y-2">
        <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm" onClick={() => { handleNewConversation(); setMobileSidebarOpen(false); }}>
          <Plus className="h-4 w-4" />
          {userMode === "transporter" ? "New Bilty" : userMode === "exporter" ? "New Document Check" : "New conversation"}
        </Button>
        {userMode && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {userMode === "transporter" ? <Truck className="h-3 w-3" /> : <Package className="h-3 w-3" />}
              {userMode === "transporter" ? "Transporter / Logistics" : "Exporter / Importer"}
            </span>
            <button onClick={() => { localStorage.removeItem("ability_user_mode"); setUserMode(null); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2">
              Switch
            </button>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-0.5 pb-4">
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">No conversations yet</p>
          )}
          {conversations.map(conv => (
            <div key={conv.id} className={`group relative flex items-center rounded-lg transition-colors hover:bg-accent ${conv.id === conversationId ? "bg-accent" : ""}`}>
              <button onClick={() => { navigate(`/chat/${conv.id}`); setMobileSidebarOpen(false); }}
                className="flex-1 text-left px-3 py-2.5 min-w-0">
                <div className={`truncate text-sm font-medium ${conv.id === conversationId ? "text-accent-foreground" : "text-muted-foreground"}`}>{conv.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{formatDate(conv.created_at)}</div>
              </button>
              <button onClick={(e) => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 mr-2 p-1 rounded hover:bg-destructive/20 hover:text-destructive text-muted-foreground transition-all shrink-0"
                title="Delete conversation">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  );

  const isBusy = loading || isStreaming;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 z-50 flex flex-col border-r border-border bg-muted/95">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-muted/20 shrink-0">
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 min-w-0 h-full">
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center p-6">
            {userMode ? (
              // Mode already saved — just show a start button
              <div className="flex flex-col items-center gap-5 max-w-sm w-full text-center">
                <div className="h-12 w-12 rounded-xl bg-secondary border border-border flex items-center justify-center">
                  {userMode === "transporter" ? <Truck className="h-6 w-6 text-primary" /> : <Package className="h-6 w-6 text-primary" />}
                </div>
                <div>
                  <p className="text-lg font-semibold">{userMode === "transporter" ? "Transporter / Logistics" : "Exporter / Importer"}</p>
                  <p className="text-sm text-muted-foreground mt-1">{userMode === "transporter" ? "Upload docs → generate bilty + risk checks" : "Upload docs → compliance report, what to fix before dispatch"}</p>
                </div>
                <Button onClick={() => startConversationWithMode(userMode)} className="w-full max-w-xs">
                  <Plus className="h-4 w-4 mr-2" />New {userMode === "transporter" ? "Bilty" : "Document Check"}
                </Button>
                <button onClick={() => { localStorage.removeItem("ability_user_mode"); setUserMode(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                  Switch role
                </button>
              </div>
            ) : (
              // First time — pick mode, saves permanently
              <div className="flex flex-col items-center gap-6 max-w-lg w-full">
                <div className="text-center">
                  <p className="text-xl font-semibold">What do you need to do?</p>
                  <p className="text-sm text-muted-foreground mt-1">Pick once — we'll remember your role.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button onClick={() => handleModeSelect("transporter")}
                    className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all p-5">
                    <Truck className="h-6 w-6 text-primary mb-3" />
                    <div className="font-semibold text-sm text-foreground mb-1">Transporter / Logistics</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">I need to make a bilty / LR for a shipment.</p>
                  </button>
                  <button onClick={() => handleModeSelect("exporter")}
                    className="group text-left rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all p-5">
                    <Package className="h-6 w-6 text-primary mb-3" />
                    <div className="font-semibold text-sm text-foreground mb-1">Exporter / Importer</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">I need to check if my shipment documents are correct before dispatch.</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center px-4 py-3 border-b border-border shrink-0 gap-2">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <h1 className="font-semibold text-sm truncate">{selectedConv?.title ?? "Conversation"}</h1>
            </div>
            <ScrollArea className="flex-1 px-4 py-4">
              <div className="flex flex-col gap-3 max-w-3xl mx-auto">
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    latestExtracted={latestExtracted}
                    pendingPatch={pendingPatch}
                    onApprove={handleApproveEdit}
                    onReject={handleRejectEdit}
                    regulationMatches={regulationMatches}
                    onDismissRegulations={() => setRegulationMatches([])}
                  />
                ))}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-muted text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                      {streamingText || <span className="animate-pulse text-muted-foreground">Thinking…</span>}
                    </div>
                  </div>
                )}
                {loading && !isStreaming && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl px-4 py-2.5 bg-muted text-muted-foreground text-sm animate-pulse flex items-center gap-2">
                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="shrink-0 border-t border-border px-4 py-3">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 max-w-3xl mx-auto">
                  {attachedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-xs">
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={handleFilesSelected} />
                <Button variant="ghost" size="icon" className="shrink-0 mb-0.5 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                {/* Mic button — click to start, click again to stop */}
                <Button
                  variant="ghost" size="icon"
                  className={`shrink-0 mb-0.5 transition-colors ${isRecording ? "text-destructive bg-destructive/10 animate-pulse" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={toggleRecording}
                  disabled={isBusy || isTranscribing}
                  title={isRecording ? "Click to stop recording" : "Click to speak (Hindi / Nepali / English)"}
                >
                  {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Textarea ref={textareaRef} value={inputText} onChange={handleTextareaChange} onKeyDown={handleKeyDown}
                  placeholder={attachedFiles.length > 0 ? "Add a note or just press Send…" : "Ask anything, or tap 🎤 to speak (Hindi / Nepali / English)…"}
                  className="flex-1 resize-none min-h-[40px] max-h-[96px] py-2 text-sm" rows={1} disabled={isBusy} />
                <Button size="icon" onClick={handleSend} disabled={isBusy || (!inputText.trim() && attachedFiles.length === 0)} className="shrink-0 mb-0.5">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
