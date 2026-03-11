"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getScreenshotUrl, isScreenshotPdf } from "@/lib/screenshotHelpers";
import ScreenshotLightbox from "@/components/ScreenshotLightbox";

// ─── Typen ────────────────────────────────────────────────────────
type ResourceType = "Cash" | "Arms" | "Cargo" | "Metal" | "Diamond";

const RESOURCE_CONFIG: Record<ResourceType, { label: string; icon: string; color: string }> = {
  Cash:    { label: "Cash",    icon: "/cash.png",    color: "#22c55e" },
  Arms:    { label: "Arms",    icon: "/arms.png",    color: "#ef4444" },
  Cargo:   { label: "Cargo",   icon: "/cargo.png",   color: "#3b82f6" },
  Metal:   { label: "Metal",   icon: "/metal.png",   color: "#a855f7" },
  Diamond: { label: "Diamond", icon: "/diamond.png", color: "#06b6d4" },
};

interface PendingDeposit {
  id: string;
  user_id: string;
  resource_type: ResourceType;
  amount: number;
  note: string | null;
  screenshot_url: string | null;
  created_at: string;
  profiles: { username: string; ingame_name: string | null; display_name: string | null };
}

function formatNumber(n: number): string {
  return n.toLocaleString("de-DE");
}

// ─── ApprovalQueue Komponente ─────────────────────────────────────
export default function ApprovalQueue() {
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIsPdf, setLightboxIsPdf] = useState(false);

  // Ablehnen-Dialog
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Korrigieren-Dialog
  const [correctingDep, setCorrectingDep] = useState<PendingDeposit | null>(null);
  const [correctAmount, setCorrectAmount] = useState("");

  // Aktion läuft
  const [actionId, setActionId] = useState<string | null>(null);

  // ─── Laden ──────────────────────────────────────────────────────
  const loadPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("deposits")
      .select("*, profiles!deposits_user_id_fkey(username, ingame_name, display_name)")
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (!error && data) setPending(data as unknown as PendingDeposit[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  // ─── Screenshot öffnen ───────────────────────────────────────────
  const openScreenshot = async (url: string) => {
    const signed = await getScreenshotUrl(url);
    if (signed) {
      setLightboxIsPdf(isScreenshotPdf(url));
      setLightboxUrl(signed);
    }
  };

  // ─── Genehmigen ─────────────────────────────────────────────────
  const handleApprove = async (dep: PendingDeposit) => {
    setActionId(dep.id);
    const { data, error } = await supabase.rpc("approve_deposit", { input_deposit_id: dep.id });
    setActionId(null);
    if (!error && (data as { success: boolean })?.success) loadPending();
  };

  // ─── Ablehnen ───────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectingId) return;
    setActionId(rejectingId);
    const { data, error } = await supabase.rpc("reject_deposit", {
      input_deposit_id: rejectingId,
      input_reason: rejectReason.trim() || null,
    });
    setActionId(null);
    if (!error && (data as { success: boolean })?.success) {
      setRejectingId(null);
      setRejectReason("");
      loadPending();
    }
  };

  // ─── Korrigieren + Genehmigen ────────────────────────────────────
  const handleCorrectAndApprove = async () => {
    if (!correctingDep) return;
    const newAmount = parseInt(correctAmount.replace(/\D/g, ""), 10);
    if (!newAmount || newAmount <= 0) return;
    setActionId(correctingDep.id);

    // Erst Wert korrigieren
    await supabase.rpc("update_deposit", {
      input_deposit_id: correctingDep.id,
      input_resource_type: correctingDep.resource_type,
      input_amount: newAmount,
      input_note: correctingDep.note || "",
      input_screenshot_url: correctingDep.screenshot_url || null,
    });

    // Dann genehmigen
    const { data, error } = await supabase.rpc("approve_deposit", { input_deposit_id: correctingDep.id });
    setActionId(null);
    if (!error && (data as { success: boolean })?.success) {
      setCorrectingDep(null);
      setCorrectAmount("");
      loadPending();
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  if (loading) return <p className="text-gray-500 text-sm">Lade ausstehende Einzahlungen...</p>;

  if (pending.length === 0) return (
    <div className="text-center py-8">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-gray-400 text-sm">Keine ausstehenden Einzahlungen.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{pending.length} ausstehende Einzahlung{pending.length !== 1 ? "en" : ""}</p>

      {pending.map((dep) => {
        const config = RESOURCE_CONFIG[dep.resource_type];
        const playerName = dep.profiles?.ingame_name || dep.profiles?.display_name || dep.profiles?.username || "?";
        const isActing = actionId === dep.id;
        const isRejecting = rejectingId === dep.id;
        const isCorrecting = correctingDep?.id === dep.id;

        return (
          <div key={dep.id} className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-3">
            {/* Spieler + Ressource + Datum */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">{playerName}</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-mono" style={{ color: config.color }}>
                  <img src={config.icon} alt="" className="w-4 h-4" />
                  {formatNumber(dep.amount)} {dep.resource_type}
                </span>
                {dep.note && <span className="text-xs text-gray-500 italic">„{dep.note}"</span>}
              </div>
              <span className="text-xs text-gray-600">
                {new Date(dep.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Screenshot */}
            {dep.screenshot_url ? (
              <button onClick={() => openScreenshot(dep.screenshot_url!)}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20
