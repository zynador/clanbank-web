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
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                📷 Screenshot ansehen
              </button>
            ) : (
              <span className="text-xs text-red-400/70">⚠ Kein Screenshot vorhanden</span>
            )}

            {/* Ablehnen-Formular */}
            {isRejecting && (
              <div className="bg-[#0f1117] border border-red-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-red-400 font-medium">Ablehnungsgrund (optional)</p>
                <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="z.B. Falscher Spielername im Screenshot"
                  className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                <div className="flex gap-2">
                  <button onClick={handleReject} disabled={isActing}
                    className="text-xs px-3 py-1.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-40">
                    {isActing ? "..." : "✕ Ablehnen bestätigen"}
                  </button>
                  <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                    className="text-xs px-3 py-1.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Korrigieren-Formular */}
            {isCorrecting && (
              <div className="bg-[#0f1117] border border-blue-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-blue-400 font-medium">Korrektur Menge ({dep.resource_type})</p>
                <input type="number" value={correctAmount} onChange={(e) => setCorrectAmount(e.target.value)}
                  placeholder={dep.amount.toString()}
                  className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                <div className="flex gap-2">
                  <button onClick={handleCorrectAndApprove} disabled={isActing || !correctAmount}
                    className="text-xs px-3 py-1.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-40">
                    {isActing ? "..." : "✓ Korrigieren & Genehmigen"}
                  </button>
                  <button onClick={() => { setCorrectingDep(null); setCorrectAmount(""); }}
                    className="text-xs px-3 py-1.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Aktions-Buttons */}
            {!isRejecting && !isCorrecting && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleApprove(dep)} disabled={isActing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:opacity-40 transition-colors">
                  {isActing ? "..." : "✓ Genehmigen"}
                </button>
                <button onClick={() => { setCorrectingDep(dep); setCorrectAmount(dep.amount.toString()); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
                  ✎ Korrigieren & Genehmigen
                </button>
                <button onClick={() => setRejectingId(dep.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors">
                  ✕ Ablehnen
                </button>
              </div>
            )}
          </div>
        );
      })}

      {lightboxUrl && (
        <ScreenshotLightbox url={lightboxUrl} isPdf={lightboxIsPdf} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
