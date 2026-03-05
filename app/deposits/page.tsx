"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScreenshotUpload from "@/components/ScreenshotUpload";
import ScreenshotLightbox from "@/components/ScreenshotLightbox";
import { getScreenshotUrl, isScreenshotPdf } from "@/lib/screenshotHelpers";
import { supabase } from "@/lib/supabaseClient";

// ─── Typen & Konfiguration ──────────────────────────────────────

type ResourceType = "Cash" | "Arms" | "Cargo" | "Metal" | "Diamond";

const RESOURCE_ORDER: ResourceType[] = ["Cash", "Arms", "Cargo", "Metal", "Diamond"];

const RESOURCE_CONFIG: Record<ResourceType, { label: string; icon: string; color: string }> = {
  Cash:    { label: "Cash",    icon: "/cash.png",    color: "#22c55e" },
  Arms:    { label: "Arms",    icon: "/arms.png",    color: "#ef4444" },
  Cargo:   { label: "Cargo",   icon: "/cargo.png",   color: "#3b82f6" },
  Metal:   { label: "Metal",   icon: "/metal.png",   color: "#a855f7" },
  Diamond: { label: "Diamond", icon: "/diamond.png", color: "#06b6d4" },
};

type ResourceValues = Record<ResourceType, string>;

const EMPTY_VALUES: ResourceValues = {
  Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "",
};

// ─── Hilfsfunktionen ────────────────────────────────────────────

/**
 * Normalisiert Eingaben wie "500K", "2.5M", "500.000", "2,5M" → Zahl
 */
function parseResourceInput(raw: string): number {
  if (!raw || raw.trim() === "" || raw.trim() === "-") return 0;

  let cleaned = raw.trim().toUpperCase();

  // Multiplikatoren
  let multiplier = 1;
  if (cleaned.endsWith("B")) {
    multiplier = 1_000_000_000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("M")) {
    multiplier = 1_000_000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("K")) {
    multiplier = 1_000;
    cleaned = cleaned.slice(0, -1);
  }

  // Tausender-Trennzeichen entfernen:
  // "500.000" oder "1.234.567" → Punkte sind Tausender wenn kein Komma vorhanden
  // "2,5" oder "2.5" → Dezimal
  if (multiplier > 1) {
    // Bei K/M/B: Komma oder Punkt als Dezimal behandeln
    cleaned = cleaned.replace(",", ".");
  } else {
    // Ohne Suffix: Format erkennen
    const hasDot = cleaned.includes(".");
    const hasComma = cleaned.includes(",");

    if (hasDot && hasComma) {
      // "1.234,56" → Punkt = Tausender, Komma = Dezimal
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (hasComma && !hasDot) {
      // "2,5" → Komma = Dezimal  |  "1,234,567" → Komma = Tausender
      const parts = cleaned.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        // Dezimalkomma: "2,5" oder "123,45"
        cleaned = cleaned.replace(",", ".");
      } else {
        // Tausender-Komma: "1,234,567"
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (hasDot && !hasComma) {
      // "500.000" vs "2.5"
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3 && parts[0].length >= 1) {
        // "500.000" → Tausender-Punkt
        cleaned = cleaned.replace(/\./g, "");
      } else if (parts.length > 2) {
        // "1.234.567" → Tausender-Punkte
        cleaned = cleaned.replace(/\./g, "");
      }
      // Sonst: "2.5" bleibt Dezimalpunkt
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * multiplier);
}

/**
 * Formatiert eine Zahl für die Anzeige: 1234567 → "1.234.567"
 */
function formatNumber(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("de-DE");
}

// ─── Typen für Deposits-Liste ────────────────────────────────────

interface DepositRow {
  id: string;
  user_id: string;
  resource_type: ResourceType;
  amount: number;
  note: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  profiles: {
    username: string;
    ingame_name: string | null;
    display_name: string | null;
  };
}

// ─── Haupt-Komponente ────────────────────────────────────────────

export default function DepositsPage() {
  return (
    <ProtectedRoute>
      <DepositsContent />
    </ProtectedRoute>
  );
}

function DepositsContent() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  // Formular-State
  const [values, setValues] = useState<ResourceValues>({ ...EMPTY_VALUES });
  const [note, setNote] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Einzahlungsliste
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);

  // Inline-Bearbeitung
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Refs für programmatisches Befüllen (OCR-Vorbereitung)
  const inputRefs = useRef<Record<ResourceType, HTMLInputElement | null>>({
    Cash: null, Arms: null, Cargo: null, Metal: null, Diamond: null,
  });

  // ─── Programmatisches Befüllen (für spätere OCR) ─────────────
  const setResourceValues = useCallback((newValues: Partial<Record<ResourceType, number>>) => {
    setValues((prev) => {
      const updated = { ...prev };
      for (const [key, val] of Object.entries(newValues)) {
        if (RESOURCE_ORDER.includes(key as ResourceType) && typeof val === "number" && val > 0) {
          updated[key as ResourceType] = formatNumber(val);
        }
      }
      return updated;
    });
  }, []);

  // Expose für OCR-Integration auf Window (optional)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__clanbank_setValues = setResourceValues;
    return () => {
      delete (window as unknown as Record<string, unknown>).__clanbank_setValues;
    };
  }, [setResourceValues]);

  // ─── Einzahlungen laden ──────────────────────────────────────
  const loadDeposits = useCallback(async () => {
    setLoadingDeposits(true);
    const { data, error } = await supabase
      .from("deposits")
      .select("*, profiles!deposits_user_id_fkey(username, ingame_name, display_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setDeposits(data as unknown as DepositRow[]);
    }
    setLoadingDeposits(false);
  }, []);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  // ─── Formular absenden ───────────────────────────────────────
  const handleSubmit = async () => {
    // Werte parsen
    const parsed: Record<ResourceType, number> = {
      Cash: parseResourceInput(values.Cash),
      Arms: parseResourceInput(values.Arms),
      Cargo: parseResourceInput(values.Cargo),
      Metal: parseResourceInput(values.Metal),
      Diamond: parseResourceInput(values.Diamond),
    };

    const filledCount = Object.values(parsed).filter((v) => v > 0).length;
    if (filledCount === 0) {
      setFeedback({ type: "error", text: "Mindestens eine Ressource muss einen Wert > 0 haben." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const { data, error } = await supabase.rpc("create_bulk_deposit", {
      input_cash: parsed.Cash,
      input_arms: parsed.Arms,
      input_cargo: parsed.Cargo,
      input_metal: parsed.Metal,
      input_diamond: parsed.Diamond,
      input_note: note.trim(),
      input_screenshot_url: screenshotUrl,
    });

    setSubmitting(false);

    if (error) {
      setFeedback({ type: "error", text: "Fehler: " + error.message });
      return;
    }

    const result = data as { success: boolean; message: string; count?: number };
    if (result?.success) {
      setFeedback({ type: "success", text: result.message });
      setValues({ ...EMPTY_VALUES });
      setNote("");
      setScreenshotUrl(null);
      loadDeposits();
    } else {
      setFeedback({ type: "error", text: result?.message || "Unbekannter Fehler." });
    }
  };

  // ─── Inline-Bearbeitung ──────────────────────────────────────
  const startEdit = (dep: DepositRow) => {
    setEditingId(dep.id);
    setEditAmount(dep.amount.toString());
    setEditNote(dep.note || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditNote("");
  };

  const saveEdit = async (dep: DepositRow) => {
    const newAmount = parseResourceInput(editAmount);
    if (newAmount <= 0) return;

    const { data, error } = await supabase.rpc("update_deposit", {
      input_deposit_id: dep.id,
      input_amount: newAmount,
      input_note: editNote.trim(),
    });

    if (!error && (data as { success: boolean })?.success) {
      cancelEdit();
      loadDeposits();
    }
  };

  const softDelete = async (dep: DepositRow) => {
    if (!confirm(`Einzahlung wirklich löschen? (${dep.resource_type}: ${formatNumber(dep.amount)})`)) return;

    const { data, error } = await supabase.rpc("soft_delete_deposit", {
      input_deposit_id: dep.id,
    });

    if (!error && (data as { success: boolean })?.success) {
      loadDeposits();
    }
  };

  // ─── Berechtigungsprüfung ─────────────────────────────────────
  const canEdit = (dep: DepositRow) => {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    if (profile.role === "offizier") return true;
    return dep.user_id === profile.id;
  };

  const canDelete = (dep: DepositRow) => {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    return dep.user_id === profile.id;
  };

  // ─── Vorschau der geparsten Werte ─────────────────────────────
  const parsedPreview = RESOURCE_ORDER.map((r) => ({
    resource: r,
    parsed: parseResourceInput(values[r]),
  })).filter((p) => p.parsed > 0);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#161822]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <h1 className="text-lg font-semibold text-white">Einzahlungen</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {profile?.ingame_name || profile?.username}
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* ─── Schnell-Eingabeformular ─────────────────────────── */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-medium text-gray-300 mb-5">Neue Einzahlung</h2>

          {/* 5 Ressourcen-Felder */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {RESOURCE_ORDER.map((resource) => {
              const config = RESOURCE_CONFIG[resource];
              const parsed = parseResourceInput(values[resource]);
              const hasValue = values[resource].trim() !== "" && parsed > 0;

              return (
                <div
                  key={resource}
                  className="relative group rounded-lg border transition-all duration-200"
                  style={{
                    borderColor: hasValue ? config.color + "66" : "#374151",
                    backgroundColor: hasValue ? config.color + "0a" : "transparent",
                  }}
                >
                  {/* Icon + Label */}
                  <div className="flex flex-col items-center pt-3 pb-1 px-2">
                    <img
                      src={config.icon}
                      alt={config.label}
                      className="w-8 h-8 object-contain mb-1"
                      draggable={false}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </span>
                  </div>

                  {/* Eingabefeld */}
                  <div className="px-2 pb-3">
                    <input
                      ref={(el) => { inputRefs.current[resource] = el; }}
                      type="text"
                      inputMode="text"
                      placeholder="-"
                      value={values[resource]}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [resource]: e.target.value }))
                      }
                      className="w-full bg-[#0f1117] border border-gray-700 rounded-md px-3 py-2 text-center text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 transition-all"
                      style={{
                        // @ts-expect-error CSS custom property for focus ring
                        "--tw-ring-color": config.color + "80",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = config.color;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#374151";
                      }}
                    />
                    {/* Geparster Wert als Vorschau */}
                    {hasValue && (
                      <div
                        className="text-xs text-center mt-1 opacity-70"
                        style={{ color: config.color }}
                      >
                        {formatNumber(parsed)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hinweis unter den Feldern */}
          <p className="text-xs text-gray-600 mt-2">
            Eingabe: 500000 · 500K · 2.5M · 500.000 — leere Felder werden übersprungen
          </p>

          {/* Vorschau der Batch */}
          {parsedPreview.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {parsedPreview.map(({ resource, parsed }) => (
                <span
                  key={resource}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: RESOURCE_CONFIG[resource].color + "1a",
                    color: RESOURCE_CONFIG[resource].color,
                  }}
                >
                  <img src={RESOURCE_CONFIG[resource].icon} alt="" className="w-3.5 h-3.5" />
                  {formatNumber(parsed)}
                </span>
              ))}
            </div>
          )}

          {/* Notiz */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Optionale Notiz (gilt für alle Ressourcen)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#0f1117] border border-gray-700 rounded-md px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
            />
          </div>

          {/* Screenshot-Upload */}
          <div className="mt-4">
           <ScreenshotUpload
              clanId={profile?.clan_id || ""}
              existingUrl={screenshotUrl}
              onUploadComplete={(url) => setScreenshotUrl(url)}
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                feedback.type === "success"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || parsedPreview.length === 0}
            className="mt-4 w-full sm:w-auto px-8 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white"
          >
            {submitting
              ? "Speichern..."
              : parsedPreview.length > 0
                ? `${parsedPreview.length} Einzahlung${parsedPreview.length > 1 ? "en" : ""} speichern`
                : "Einzahlung speichern"}
          </button>
        </section>

        {/* ─── Einzahlungsliste ────────────────────────────────── */}
        <section className="bg-[#161822] border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-medium text-gray-300 mb-4">
            Letzte Einzahlungen
          </h2>

          {loadingDeposits ? (
            <p className="text-gray-500 text-sm">Laden...</p>
          ) : deposits.length === 0 ? (
            <p className="text-gray-500 text-sm">Noch keine Einzahlungen vorhanden.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-800">
                    <th className="pb-3 pr-4">Spieler</th>
                    <th className="pb-3 pr-4">Ressource</th>
                    <th className="pb-3 pr-4 text-right">Menge</th>
                    <th className="pb-3 pr-4">Notiz</th>
                    <th className="pb-3 pr-4">Screenshot</th>
                    <th className="pb-3 pr-4">Datum</th>
                    <th className="pb-3">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((dep) => {
                    const config = RESOURCE_CONFIG[dep.resource_type];
                    const isEditing = editingId === dep.id;
                    const playerName =
                      dep.profiles?.ingame_name || dep.profiles?.display_name || dep.profiles?.username || "?";

                    return (
                      <tr key={dep.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="py-3 pr-4 text-gray-300">{playerName}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex items-center gap-1.5">
                            <img src={config.icon} alt="" className="w-4 h-4" />
                            <span style={{ color: config.color }}>{config.label}</span>
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-gray-200">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="w-28 bg-[#0f1117] border border-gray-600 rounded px-2 py-1 text-right text-sm text-white"
                            />
                          ) : (
                            formatNumber(dep.amount)
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 max-w-[150px] truncate">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full bg-[#0f1117] border border-gray-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="Notiz"
                            />
                          ) : (
                            dep.note || "–"
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {dep.screenshot_url ? (
                            <button
                                onClick={async () => {
                                const url = await getScreenshotUrl(dep.screenshot_url!);
                                if (url) setLightboxUrl(url);
                              }}
                              className="text-blue-400 hover:text-blue-300 text-xs underline"
                            >
                              Anzeigen
                            </button>
                          ) : (
                            <span className="text-gray-600">–</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(dep.created_at).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => saveEdit(dep)}
                                className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-xs px-2 py-1 rounded bg-gray-600/20 text-gray-400 hover:bg-gray-600/30"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              {canEdit(dep) && (
                                <button
                                  onClick={() => startEdit(dep)}
                                  className="text-xs px-2 py-1 rounded bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700"
                                >
                                  ✎
                                </button>
                              )}
                              {canDelete(dep) && (
                                <button
                                  onClick={() => softDelete(dep)}
                                  className="text-xs px-2 py-1 rounded bg-gray-700/50 text-red-400/60 hover:text-red-400 hover:bg-red-900/20"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Lightbox */}
      {lightboxUrl && (
        <ScreenshotLightbox
          url={lightboxUrl}
          isPdf={isScreenshotPdf(lightboxUrl)}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </div>
  );
}
