"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getScreenshotUrl, isScreenshotPdf } from "@/lib/screenshotHelpers";
import ScreenshotLightbox from "@/components/ScreenshotLightbox";

type ResourceType = "Cash" | "Arms" | "Cargo" | "Metal" | "Diamond";

const RESOURCE_CONFIG: Record<ResourceType, { color: string; icon: string }> = {
  Cash:    { color: "#22c55e", icon: "/cash.png" },
  Arms:    { color: "#ef4444", icon: "/arms.png" },
  Cargo:   { color: "#3b82f6", icon: "/cargo.png" },
  Metal:   { color: "#a855f7", icon: "/metal.png" },
  Diamond: { color: "#06b6d4", icon: "/diamond.png" },
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

interface DepositGroup {
  key: string;
  screenshot_url: string | null;
  deposits: PendingDeposit[];
  player: string;
  date: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("de-DE");
}

function groupDeposits(deposits: PendingDeposit[]): DepositGroup[] {
  const map = new Map<string, PendingDeposit[]>();
  for (const d of deposits) {
    const key = d.screenshot_url || d.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).map(([key, deps]) => {
    const first = deps[0];
    const player = first.profiles?.ingame_name || first.profiles?.display_name || first.profiles?.username || "?";
    return { key, screenshot_url: first.screenshot_url, deposits: deps, player, date: first.created_at };
  });
}

export default function ApprovalQueue() {
  const [pending, setPending] = useState<PendingDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIsPdf, setLightboxIsPdf] = useState(false);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);

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

  const openScreenshot = async (url: string) => {
    const signed = await getScreenshotUrl(url);
    if (signed) {
      setLightboxIsPdf(isScreenshotPdf(url));
      setLightboxUrl(signed);
    }
  };

  const handleApproveGroup = async (group: DepositGroup) => {
    setActionKey(group.key);
    for (const dep of group.deposits) {
      await supabase.rpc("approve_deposit", { input_deposit_id: dep.id });
    }
    setActionKey(null);
    loadPending();
  };

  const handleRejectGroup = async (group: DepositGroup) => {
    setActionKey(group.key);
    for (const dep of group.deposits) {
      await supabase.rpc("reject_deposit", {
        input_deposit_id: dep.id,
        input_reason: rejectReason.trim() || null,
      });
    }
    setActionKey(null);
    setRejectingKey(null);
    setRejectReason("");
    loadPending();
  };

  if (loading) return <p className="text-gray-500 text-sm">Lade ausstehende Einzahlungen...</p>;

  const groups = groupDeposits(pending);

  if (groups.length === 0) return (
    <div className="text-center py-8">
      <p className="text-2xl mb-2">✅</p>
      <p className="text-gray-400 text-sm">Keine ausstehenden Einzahlungen.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{groups.length} ausstehende Einzahlung{groups.length !== 1 ? "en" : ""}</p>
      {groups.map((group) => {
        const isActing = actionKey === group.key;
        const isRejecting = rejectingKey === group.key;
        return (
          <div key={group.key} className="border border-yellow-500/20 bg-yellow-500/5 rounded-xl p-4 space-y-3">

            {/* Header: Spieler + Datum */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-200">{group.player}</span>
              <span className="text-xs text-gray-600">
                {new Date(group.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>

            {/* Ressourcen */}
            <div className="flex flex-wrap gap-3">
              {group.deposits.map((dep) => {
                const cfg = RESOURCE_CONFIG[dep.resource_type];
                return (
                  <span key={dep.id} className="inline-flex items-center gap-1.5 text-sm font-mono" style={{ color: cfg.color }}>
                    <img src={cfg.icon} alt="" className="w-4 h-4" />
                    {formatNumber(dep.amount)} {dep.resource_type}
                  </span>
                );
              })}
            </div>

            {/* Notiz */}
            {group.deposits[0].note && (
              <p className="text-xs text-gray-500 italic">„{group.deposits[0].note}"</p>
            )}

            {/* Screenshot */}
            {group.screenshot_url ? (
              <button
                onClick={() => openScreenshot(group.screenshot_url!)}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                📷 Screenshot ansehen
              </button>
            ) : (
              <span className="text-xs text-red-400/70">⚠ Kein Screenshot vorhanden</span>
            )}

            {/* Ablehnen-Formular */}
            {isRejecting && (
              <div className="bg-[#0f1117] border border-red-500/20 rounded-lg p-3 space-y-2">
                <p className="text-xs text-red-400 font-medium">Ablehnungsgrund (optional)</p>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="z.B. Falscher Spielername im Screenshot"
                  className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectGroup(group)}
                    disabled={isActing}
                    className="text-xs px-3 py-1.5 rounded bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 disabled:opacity-40"
                  >
                    {isActing ? "..." : "✕ Ablehnen bestätigen"}
                  </button>
                  <button
                    onClick={() => { setRejectingKey(null); setRejectReason(""); }}
                    className="text-xs px-3 py-1.5 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}

            {/* Aktions-Buttons */}
            {!isRejecting && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleApproveGroup(group)}
                  disabled={isActing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 disabled:opacity-40 transition-colors"
                >
                  {isActing ? "..." : `✓ Genehmigen${group.deposits.length > 1 ? ` (${group.deposits.length})` : ""}`}
                </button>
                <button
                  onClick={() => setRejectingKey(group.key)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 transition-colors"
                >
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
