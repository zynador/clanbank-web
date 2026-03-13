"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScreenshotUpload from "@/components/ScreenshotUpload";
import ScreenshotThumb from "@/components/ScreenshotThumb";
import OcrReader from "@/components/OcrReader";

type DepositStatus = "pending" | "approved" | "rejected";
type DepositRow = {
  id: string;
  user_id: string;
  resource_type: string;
  amount: number;
  note: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  status: DepositStatus;
  rejection_reason: string | null;
  profiles: { display_name: string | null; ingame_name: string | null } | null;
};
type DepositGroup = {
  key: string;
  screenshot_url: string | null;
  deposits: DepositRow[];
  player: string;
  user_id: string;
  date: string;
  status: DepositStatus;
};

function StatusBadge({ status }: { status: DepositStatus }) {
  if (status === "approved") return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">✓ Genehmigt</span>;
  if (status === "pending") return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">⏳ Ausstehend</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">✗ Abgelehnt</span>;
}

const RESOURCE_ORDER = ["Cash", "Arms", "Cargo", "Metal", "Diamond"];

function groupDeposits(deposits: DepositRow[]): DepositGroup[] {
  const map = new Map<string, DepositRow[]>();
  for (const d of deposits) {
    const key = d.screenshot_url || d.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.entries()).map(([key, deps]) => {
    const first = deps[0];
    const player = first.profiles?.ingame_name || first.profiles?.display_name || "Unbekannt";
    const statusPriority: DepositStatus[] = ["rejected", "pending", "approved"];
    const status = statusPriority.find((s) => deps.some((d) => d.status === s)) ?? "approved";
    return { key, screenshot_url: first.screenshot_url, deposits: deps, player, user_id: first.user_id, date: first.created_at, status };
  });
}

export default function DepositsPage() {
  return <ProtectedRoute><DepositsContent /></ProtectedRoute>;
}

function DepositsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formAmounts, setFormAmounts] = useState<Record<string, string>>({ Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "" });
  const [note, setNote] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isManualMode, setIsManualMode] = useState(true);
  const isOfficerOrAdmin = profile?.role === "admin" || profile?.role === "offizier";

  function handleOcrResult(amounts: Record<string, string>) {
    setFormAmounts((prev) => ({
      Cash: amounts.Cash || prev.Cash,
      Arms: amounts.Arms || prev.Arms,
      Cargo: amounts.Cargo || prev.Cargo,
      Metal: amounts.Metal || prev.Metal,
      Diamond: amounts.Diamond || prev.Diamond,
    }));
    setIsManualMode(false);
  }

  function handleOcrManual() {
    setFormAmounts({ Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "" });
    setIsManualMode(true);
  }

  const fetchDeposits = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const query = supabase
      .from("deposits")
      .select("*, profiles!deposits_user_id_fkey(display_name, ingame_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!isOfficerOrAdmin) query.eq("user_id", profile.id);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setDeposits((data as DepositRow[]) || []);
    setLoading(false);
  }, [profile, isOfficerOrAdmin]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  async function handleSubmit() {
    if (!profile) return;
    const hasAmount = RESOURCE_ORDER.some((r) => parseFloat(formAmounts[r]) > 0);
    if (!hasAmount) { setError("Mindestens eine Ressource muss > 0 sein."); return; }
    if (!screenshotUrl) { setError("Bitte lade einen Screenshot hoch (Pflichtfeld)."); return; }
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.rpc("create_bulk_deposit", {
      input_cash: parseFloat(formAmounts.Cash) || 0,
      input_arms: parseFloat(formAmounts.Arms) || 0,
      input_cargo: parseFloat(formAmounts.Cargo) || 0,
      input_metal: parseFloat(formAmounts.Metal) || 0,
      input_diamond: parseFloat(formAmounts.Diamond) || 0,
      input_note: note || null,
      input_screenshot_url: screenshotUrl,
      input_manual: isManualMode,
    });
    if (err) { setError(err.message); }
    else {
      setSuccess("Einzahlung gespeichert!");
      setFormAmounts({ Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "" });
      setNote("");
      setScreenshotUrl(null);
      setIsManualMode(false);
      fetchDeposits();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const { error: err } = await supabase.rpc("soft_delete_deposit", { input_deposit_id: id });
    if (err) setError(err.message);
    else fetchDeposits();
  }

  async function handleDeleteGroup(group: DepositGroup) {
    if (!confirm(`${group.deposits.length} Einzahlung(en) löschen?`)) return;
    for (const d of group.deposits) await handleDelete(d.id);
  }

  async function handleResubmitGroup(group: DepositGroup) {
    for (const d of group.deposits) {
      await supabase.rpc("resubmit_deposit", { input_deposit_id: d.id });
    }
    setSuccess("Erneut eingereicht – wartet auf Genehmigung.");
    fetchDeposits();
  }

  const formatAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };
  const formatDate = (s: string) => new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const groups = groupDeposits(deposits);

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="text-teal-400 hover:text-teal-300 text-sm">← Dashboard</button>
          <span className="text-sm text-gray-400">{profile?.ingame_name || profile?.username}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}<button className="ml-2 text-red-400 hover:text-red-200" onClick={() => setError(null)}>✕</button></div>}
        {success && <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-3 text-sm">{success}<button className="ml-2 text-green-400 hover:text-green-200" onClick={() => setSuccess(null)}>✕</button></div>}

        {/* Formular */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4">Neue Einzahlung</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {RESOURCE_ORDER.map((r) => (
              <div key={r}>
                <label className="block text-xs text-gray-500 mb-1">{r}</label>
                <input type="number" min="0" value={formAmounts[r]}
                  onChange={(e) => setFormAmounts((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Notiz (optional)</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionale Notiz"
              className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500" />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Screenshot <span className="text-red-400">*</span></label>
            {profile?.clan_id && (
              <ScreenshotUpload clanId={profile.clan_id} existingUrl={screenshotUrl}
                onUploadComplete={(url) => setScreenshotUrl(url)} />
            )}
            <OcrReader imageUrl={screenshotUrl} onResult={handleOcrResult} onManual={handleOcrManual} />
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
            {submitting ? "Speichern..." : "Einzahlung speichern"}
          </button>
        </section>

        {/* Liste */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4">Einzahlungen</h2>
          {loading ? <p className="text-gray-500 text-sm">Lade...</p> :
           groups.length === 0 ? <p className="text-gray-500 text-sm">Keine Einzahlungen gefunden.</p> : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key} className="border border-gray-700 rounded-lg p-4 bg-[#0f1117]">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      <ScreenshotThumb path={group.screenshot_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <StatusBadge status={group.status} />
                        <span className="text-xs text-gray-600 shrink-0">{formatDate(group.date)}</span>
                      </div>
                      {isOfficerOrAdmin && (
                        <p className="text-xs text-gray-500 mb-2">{group.player}</p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                        {group.deposits.map((dep) => (
                          <span key={dep.id} className="text-sm font-medium text-teal-400">
                            {dep.resource_type} {formatAmount(dep.amount)}
                          </span>
                        ))}
                      </div>
                      {group.deposits[0].note && (
                        <p className="text-xs text-gray-500 mb-2">{group.deposits[0].note}</p>
                      )}
                      {group.status === "rejected" && group.deposits[0].rejection_reason && (
                        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 mb-2">
                          Abgelehnt: {group.deposits[0].rejection_reason}
                        </p>
                      )}
                      <div className="flex gap-2 flex-wrap mt-2">
                        {group.status === "rejected" && group.user_id === profile?.id && (
                          <button onClick={() => handleResubmitGroup(group)}
                            className="text-xs text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-2 py-1">
                            ↺ Erneut einreichen
                          </button>
                        )}
                        {(group.user_id === profile?.id || isOfficerOrAdmin) && (
                          <button onClick={() => handleDeleteGroup(group)}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded px-2 py-1">
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
