"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabaseClient";
import ScreenshotUpload from "@/components/ScreenshotUpload";
import ScreenshotLightbox from "@/components/ScreenshotLightbox";
import { getScreenshotUrl, isScreenshotPdf } from "@/lib/screenshotHelpers";

// ── Typen ──────────────────────────────────────────────────
type ResourceType = "Cash" | "Cargo" | "Arms" | "Metal" | "Diamond";

interface Deposit {
  id: string;
  user_id: string;
  resource_type: ResourceType;
  amount: number;
  note: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  profiles?: { display_name: string; ingame_name: string };
}

// ── Ressource-Icons ────────────────────────────────────────
const RESOURCE_CONFIG: Record<ResourceType, { label: string; icon: string; color: string }> = {
  Cash: { label: "Cash", icon: "/cash.png", color: "#22c55e" },
  Arms: { label: "Arms", icon: "/arms.png", color: "#ef4444" },
  Cargo: { label: "Cargo", icon: "/cargo.png", color: "#3b82f6" },
  Metal: { label: "Metal", icon: "/metal.png", color: "#a855f7" },
  Diamond: { label: "Diamond", icon: "/diamond.png", color: "#06b6d4" },
};

// ── Zahlen formatieren ─────────────────────────────────────
function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("de-DE");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Hauptkomponente ────────────────────────────────────────
export default function DepositsPage() {
  return (
    <ProtectedRoute>
      <DepositsContent />
    </ProtectedRoute>
  );
}

function DepositsContent() {
  const { profile } = useAuth();

  // Formular-State
  const [resourceType, setResourceType] = useState<ResourceType | "">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Liste-State
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bearbeiten-State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editResource, setEditResource] = useState<ResourceType | "">("");
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editScreenshotPath, setEditScreenshotPath] = useState<string | null>(null);

  // Löschen-Bestätigung
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Lightbox-State
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIsPdf, setLightboxIsPdf] = useState(false);

  // Screenshot-URLs Cache (signierte URLs für die Thumbnail-Anzeige)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // ── Signed URLs für Screenshots generieren ─────────────
  const loadSignedUrls = useCallback(async (depositsList: Deposit[]) => {
    const withScreenshots = depositsList.filter((d) => d.screenshot_url);
    if (withScreenshots.length === 0) return;

    const urls: Record<string, string> = {};
    await Promise.all(
      withScreenshots.map(async (d) => {
        const url = await getScreenshotUrl(d.screenshot_url);
        if (url) urls[d.id] = url;
      })
    );
    setSignedUrls(urls);
  }, []);

  // ── Einzahlungen laden ─────────────────────────────────
  const loadDeposits = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("deposits")
        .select("id, user_id, resource_type, amount, note, screenshot_url, created_at, updated_at, updated_by, profiles(display_name, ingame_name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const depositsList = (data as unknown as Deposit[]) || [];
      setDeposits(depositsList);
      loadSignedUrls(depositsList);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setIsLoading(false);
    }
  }, [loadSignedUrls]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  // ── Lightbox öffnen ────────────────────────────────────
  async function openLightbox(screenshotUrlPath: string) {
    const url = await getScreenshotUrl(screenshotUrlPath);
    if (url) {
      setLightboxUrl(url);
      setLightboxIsPdf(isScreenshotPdf(screenshotUrlPath));
    }
  }

  // ── Einzahlung erstellen ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!resourceType) {
      setErrorMessage("Bitte wähle eine Ressource aus.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Bitte gib eine gültige Menge ein (größer als 0).");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("create_deposit", {
        input_resource_type: resourceType,
        input_amount: parsedAmount,
        input_note: note.trim() || null,
        input_screenshot_url: screenshotPath,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage(
        `${formatNumber(parsedAmount)} ${resourceType} erfolgreich eingezahlt!`
      );
      setResourceType("");
      setAmount("");
      setNote("");
      setScreenshotPath(null);
      loadDeposits();

      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage("Fehler: " + message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Einzahlung bearbeiten ──────────────────────────────
  function startEdit(deposit: Deposit) {
    setEditingId(deposit.id);
    setEditResource(deposit.resource_type);
    setEditAmount(deposit.amount.toString());
    setEditNote(deposit.note || "");
    setEditScreenshotPath(deposit.screenshot_url || null);
    setDeletingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditResource("");
    setEditAmount("");
    setEditNote("");
    setEditScreenshotPath(null);
  }

  async function saveEdit() {
    if (!editingId || !editResource) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Menge muss größer als 0 sein.");
      return;
    }

    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc("update_deposit", {
        input_deposit_id: editingId,
        input_resource_type: editResource,
        input_amount: parsedAmount,
        input_note: editNote.trim() || null,
        input_screenshot_url: editScreenshotPath,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage("Einzahlung aktualisiert ✓");
      cancelEdit();
      loadDeposits();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage("Fehler: " + message);
    }
  }

  // ── Einzahlung löschen (Soft-Delete) ──────────────────
  async function handleDelete(depositId: string) {
    setErrorMessage("");

    try {
      const { data, error } = await supabase.rpc("soft_delete_deposit", {
        input_deposit_id: depositId,
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      setSuccessMessage("Einzahlung gelöscht ✓");
      setDeletingId(null);
      loadDeposits();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      setErrorMessage("Fehler: " + message);
    }
  }

  // ── Berechtigung prüfen ────────────────────────────────
  function canEdit(deposit: Deposit): boolean {
    if (!profile) return false;
    if (deposit.user_id === profile.id) return true;
    if (profile.role === "admin" || profile.role === "offizier") return true;
    return false;
  }

  function canDelete(deposit: Deposit): boolean {
    if (!profile) return false;
    if (deposit.user_id === profile.id) return true;
    if (profile.role === "admin") return true;
    return false;
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Lightbox */}
      {lightboxUrl && (
        <ScreenshotLightbox
          url={lightboxUrl}
          isPdf={lightboxIsPdf}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-200 transition-colors">
              ← Dashboard
            </a>
            <span className="text-gray-600">|</span>
            <h1 className="text-xl font-bold text-gray-100">Einzahlungen</h1>
          </div>
          {profile && (
            <span className="text-sm text-gray-400">
              {profile.ingame_name || profile.display_name}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* ── Erfolgsmeldung ──────────────────────────── */}
        {successMessage && (
          <div className="bg-green-900/40 border border-green-700 rounded-xl px-5 py-4 text-green-300 text-center animate-fade-in">
            {successMessage}
          </div>
        )}

        {/* ── Fehlermeldung ───────────────────────────── */}
        {errorMessage && (
          <div className="bg-red-900/40 border border-red-700 rounded-xl px-5 py-4 text-red-300 text-center">
            {errorMessage}
            <button
              onClick={() => setErrorMessage("")}
              className="ml-3 text-red-400 hover:text-red-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Einzahlungsformular ─────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-5 text-gray-200">
            Neue Einzahlung
          </h2>

          <div className="space-y-5">
            {/* Ressource auswählen */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Ressource
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.keys(RESOURCE_CONFIG) as ResourceType[]).map((res) => {
                  const cfg = RESOURCE_CONFIG[res];
                  const isSelected = resourceType === res;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResourceType(res)}
                      className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-current bg-gray-800 scale-[1.03] shadow-lg"
                          : "border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800"
                      }`}
                      style={isSelected ? { borderColor: cfg.color, color: cfg.color } : {}}
                    >
                      <img src={cfg.icon} alt={cfg.label} className="w-8 h-8 object-contain" />
                      <span className={`text-sm font-medium ${isSelected ? "" : "text-gray-300"}`}>
                        {cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Menge */}
            <div>
              <label htmlFor="amount" className="block text-sm text-gray-400 mb-2">
                Menge
              </label>
              <input
                id="amount"
                type="number"
                min="1"
                step="any"
                placeholder="z.B. 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Notiz */}
            <div>
              <label htmlFor="note" className="block text-sm text-gray-400 mb-2">
                Notiz{" "}
                <span className="text-gray-600">(optional)</span>
              </label>
              <input
                id="note"
                type="text"
                placeholder="z.B. Kriegswoche 12"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Screenshot-Upload */}
            {profile && (
              <ScreenshotUpload
                clanId={profile.clan_id}
                onUploadComplete={(path) => setScreenshotPath(path)}
              />
            )}

            {/* Submit-Button */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !resourceType || !amount}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-xl transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Wird gespeichert..." : "Einzahlung speichern"}
            </button>
          </div>
        </section>

        {/* ── Einzahlungsliste ────────────────────────── */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-5 text-gray-200">
            Letzte Einzahlungen
          </h2>

          {isLoading ? (
            <div className="text-center py-10 text-gray-500">
              Wird geladen...
            </div>
          ) : deposits.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Noch keine Einzahlungen vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((deposit) => {
                const cfg = RESOURCE_CONFIG[deposit.resource_type];
                const isOwn = deposit.user_id === profile?.id;
                const isEditing = editingId === deposit.id;
                const isDeleting = deletingId === deposit.id;
                const thumbnailUrl = signedUrls[deposit.id];
                const hasPdf = isScreenshotPdf(deposit.screenshot_url);

                return (
                  <div
                    key={deposit.id}
                    className={`border rounded-xl p-4 transition-colors ${
                      isOwn
                        ? "border-blue-900/50 bg-blue-950/20"
                        : "border-gray-800 bg-gray-800/30"
                    }`}
                  >
                    {isEditing ? (
                      /* ── Bearbeitungsmodus ──────────── */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(Object.keys(RESOURCE_CONFIG) as ResourceType[]).map(
                            (res) => {
                              const c = RESOURCE_CONFIG[res];
                              const sel = editResource === res;
                              return (
                                <button
                                  key={res}
                                  type="button"
                                  onClick={() => setEditResource(res)}
                                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-sm transition-all cursor-pointer ${
                                    sel
                                      ? "border-current bg-gray-800"
                                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                                  }`}
                                  style={sel ? { borderColor: c.color, color: c.color } : {}}
                                >
                                  <img src={c.icon} alt={c.label} className="w-5 h-5 object-contain inline" />
                                  <span>{c.label}</span>
                                </button>
                              );
                            }
                          )}
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                          placeholder="Menge"
                        />
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:border-blue-500"
                          placeholder="Notiz (optional)"
                          maxLength={200}
                        />
                        {/* Screenshot im Bearbeitungsmodus */}
                        {profile && (
                          <ScreenshotUpload
                            clanId={profile.clan_id}
                            depositId={editingId || undefined}
                            existingUrl={thumbnailUrl || null}
                            onUploadComplete={(path) => setEditScreenshotPath(path)}
                          />
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Anzeigemodus ──────────────── */
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="text-2xl flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: cfg.color + "20" }}
                          >
                            <img src={cfg.icon} alt={cfg.label} className="w-8 h-8 object-contain" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-100">
                                {formatNumber(deposit.amount)}
                              </span>
                              <span
                                className="text-sm font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: cfg.color + "20",
                                  color: cfg.color,
                                }}
                              >
                                {cfg.label}
                              </span>
                              {isOwn && (
                                <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                                  Eigene
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-0.5">
                              {deposit.profiles?.ingame_name ||
                                deposit.profiles?.display_name ||
                                "Unbekannt"}{" "}
                              · {formatDate(deposit.created_at)}
                            </div>
                            {deposit.note && (
                              <div className="text-sm text-gray-400 mt-1 truncate">
                                📝 {deposit.note}
                              </div>
                            )}
                            {deposit.updated_at && deposit.updated_at !== deposit.created_at && (
                              <div className="text-xs text-gray-600 mt-0.5">
                                ✏️ Bearbeitet am {formatDate(deposit.updated_at)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Rechte Seite: Thumbnail + Aktionen */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Screenshot-Thumbnail */}
                          {deposit.screenshot_url && (
                            <button
                              onClick={() => openLightbox(deposit.screenshot_url!)}
                              className="flex-shrink-0 group relative"
                              title="Screenshot anzeigen"
                            >
                              {hasPdf ? (
                                <div className="w-10 h-10 rounded-lg border border-gray-600 bg-gray-800 flex items-center justify-center group-hover:border-amber-500 transition-colors cursor-pointer">
                                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              ) : thumbnailUrl ? (
                                <img
                                  src={thumbnailUrl}
                                  alt="Screenshot"
                                  className="w-10 h-10 object-cover rounded-lg border border-gray-600 group-hover:border-amber-500 transition-colors cursor-pointer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg border border-gray-600 bg-gray-800 flex items-center justify-center animate-pulse">
                                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              {/* Hover-Overlay */}
                              <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                              </div>
                            </button>
                          )}

                          {/* Aktionen */}
                          {(canEdit(deposit) || canDelete(deposit)) && !isDeleting && (
                            <div className="flex gap-1">
                              {canEdit(deposit) && (
                                <button
                                  onClick={() => startEdit(deposit)}
                                  className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors cursor-pointer"
                                  title="Bearbeiten"
                                >
                                  ✏️
                                </button>
                              )}
                              {canDelete(deposit) && (
                                <button
                                  onClick={() => setDeletingId(deposit.id)}
                                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                                  title="Löschen"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          )}

                          {/* Löschen-Bestätigung */}
                          {isDeleting && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDelete(deposit.id)}
                                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors cursor-pointer"
                              >
                                Ja, löschen
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors cursor-pointer"
                              >
                                Nein
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
