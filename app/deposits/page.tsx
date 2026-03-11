"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScreenshotUpload from "@/components/ScreenshotUpload";

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

function StatusBadge({ status }: { status: DepositStatus }) {
  if (status === "approved")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800">✓ Genehmigt</span>;
  if (status === "pending")
    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-800">⏳ Ausstehend</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800">✗ Abgelehnt</span>;
}

const RESOURCE_ORDER = ["Cash", "Arms", "Cargo", "Metal", "Diamond"];

export default function DepositsPage() {
  return (
    <ProtectedRoute>
      <DepositsContent />
    </ProtectedRoute>
  );
}

function DepositsContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formAmounts, setFormAmounts] = useState<Record<string, string>>({
    Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "",
  });
  const [note, setNote] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editResource, setEditResource] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editScreenshotUrl, setEditScreenshotUrl] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const isOfficerOrAdmin = profile?.role === "admin" || profile?.role === "offizier";

  const fetchDeposits = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const query = supabase
      .from("deposits")
      .select("*, profiles!deposits_user_id_fkey(display_name, ingame_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!isOfficerOrAdmin) {
      query.eq("user_id", profile.id);
    }

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
    });
    if (err) { setError(err.message); }
    else {
      setSuccess("Einzahlung gespeichert! Wartet auf Offizier-Genehmigung.");
      setFormAmounts({ Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "" });
      setNote("");
      setScreenshotUrl(null);
      fetchDeposits();
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Einzahlung wirklich löschen?")) return;
    const { error: err } = await supabase.rpc("soft_delete_deposit", { input_deposit_id: id });
    if (err) setError(err.message);
    else fetchDeposits();
  }

  async function handleResubmit(id: string) {
    const { error: err } = await supabase.rpc("resubmit_deposit", { input_deposit_id: id });
    if (err) setError(err.message);
    else { setSuccess("Erneut eingereicht – wartet auf Genehmigung."); fetchDeposits(); }
  }

  function startEdit(dep: DepositRow) {
    setEditingId(dep.id);
    setEditResource(dep.resource_type);
    setEditAmount(String(dep.amount));
    setEditNote(dep.note || "");
    setEditScreenshotUrl(dep.screenshot_url);
  }

  async function saveEdit(id: string) {
    setEditSubmitting(true);
    const { error: err } = await supabase.rpc("update_deposit", {
      input_deposit_id: id,
      input_resource_type: editResource,
      input_amount: parseFloat(editAmount),
      input_note: editNote || null,
      input_screenshot_url: editScreenshotUrl,
    });
    if (err) setError(err.message);
    else { setEditingId(null); fetchDeposits(); }
    setEditSubmitting(false);
  }

  const formatAmount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      <header className="border-b border-gray-800 bg-[#161822] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => router.push("/dashboard")} className="text-teal-400 hover:text-teal-300 text-sm">
            ← Dashboard
          </button>
          <span className="text-sm text-gray-400">{profile?.ingame_name || profile?.username}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
            {error}
            <button className="ml-2 text-red-400 hover:text-red-200" onClick={() => setError(null)}>✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-3 text-sm">
            {success}
            <button className="ml-2 text-green-400 hover:text-green-200" onClick={() => setSuccess(null)}>✕</button>
          </div>
        )}

        {/* Formular */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4">Neue Einzahlung</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {RESOURCE_ORDER.map((r) => (
              <div key={r}>
                <label className="block text-xs text-gray-500 mb-1">{r}</label>
                <input
                  type="number"
                  min="0"
                  value={formAmounts[r]}
                  onChange={(e) => setFormAmounts((p) => ({ ...p, [r]: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Notiz (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optionale Notiz"
              className="w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              Screenshot <span className="text-red-400">*</span>
            </label>
            {profile?.clan_id && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                existingUrl={screenshotUrl}
                onUploadComplete={(url) => setScreenshotUrl(url)}
              />
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {submitting ? "Speichern..." : "Einzahlung speichern"}
          </button>
        </section>

        {/* Liste */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-5">
          <h2 className="text-base font-medium text-gray-300 mb-4">Einzahlungen</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Lade...</p>
          ) : deposits.length === 0 ? (
            <p className="text-gray-500 text-sm">Keine Einzahlungen gefunden.</p>
          ) : (
            <div className="space-y-3">
              {deposits.map((dep) => (
                <div key={dep.id} className="border border-gray-700 rounded-lg p-4 bg-[#0f1117]">
                  {editingId === dep.id ? (
                    <div className="space-y-3">
                      <select
                        value={editResource}
                        onChange={(e) => setEditResource(e.target.value)}
                        className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm"
                      >
                        {RESOURCE_ORDER.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Notiz"
                        className="w-full bg-[#161822] border border-gray-700 rounded px-3 py-2 text-sm"
                      />
                      {profile?.clan_id && (
                        <ScreenshotUpload
                          clanId={profile.clan_id}
                          existingUrl={editScreenshotUrl}
                          onUploadComplete={(url) => setEditScreenshotUrl(url)}
                        />
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(dep.id)}
                          disabled={editSubmitting}
                          className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded py-1.5 text-sm"
                        >
                          {editSubmitting ? "..." : "Speichern"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded py-1.5 text-sm"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-teal-400">
                            {dep.resource_type} – {formatAmount(dep.amount)}
                          </span>
                          <StatusBadge status={dep.status} />
                        </div>
                        <span className="text-xs text-gray-600 shrink-0">{formatDate(dep.created_at)}</span>
                      </div>
                      {isOfficerOrAdmin && dep.profiles && (
                        <p className="text-xs text-gray-500 mb-1">
                          {dep.profiles.ingame_name || dep.profiles.display_name || "Unbekannt"}
                        </p>
                      )}
                      {dep.note && <p className="text-xs text-gray-500 mb-1">{dep.note}</p>}
                      {dep.status === "rejected" && dep.rejection_reason && (
                        <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 mb-2">
                          Abgelehnt: {dep.rejection_reason}
                        </p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {(dep.user_id === profile?.id || isOfficerOrAdmin) && dep.status !== "approved" && (
                          <button
                            onClick={() => startEdit(dep)}
                            className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-2 py-1"
                          >
                            Bearbeiten
                          </button>
                        )}
                        {dep.status === "rejected" && dep.user_id === profile?.id && (
                          <button
                            onClick={() => handleResubmit(dep.id)}
                            className="text-xs text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-2 py-1"
                          >
                            ↺ Erneut einreichen
                          </button>
                        )}
                        {(dep.user_id === profile?.id || isOfficerOrAdmin) && (
                          <button
                            onClick={() => handleDelete(dep.id)}
                            className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded px-2 py-1"
                          >
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
