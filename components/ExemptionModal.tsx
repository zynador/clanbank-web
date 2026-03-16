"use client";

import { useState } from "react";
import { ExemptionReason, EXEMPTION_LABELS, EXEMPTION_ICONS } from "@/types/exemptions";
import { useExemptions } from "@/hooks/useExemptions";

interface Props {
  userId: string;
  ingameName: string;
  onClose: () => void;
}

const REASONS: ExemptionReason[] = ["urlaub", "raidleiter", "krank", "sonstiges"];

export default function ExemptionModal({ userId, ingameName, onClose }: Props) {
  const { getExemptionForUser, setExemption, removeExemption } = useExemptions();
  const existing = getExemptionForUser(userId);

  const [reason, setReason] = useState<ExemptionReason>(existing?.reason ?? "urlaub");
  const [note, setNote] = useState(existing?.note ?? "");
  const [unlimited, setUnlimited] = useState(existing ? existing.end_date === null : false);
  const [startDate, setStartDate] = useState(
    existing?.start_date ?? new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!unlimited && !endDate) {
      setError("Bitte ein Enddatum wählen oder 'Unbegrenzt' aktivieren.");
      return;
    }
    setSaving(true);
    try {
      await setExemption({
        p_user_id:    userId,
        p_reason:     reason,
        p_note:       note.trim() || null,
        p_start_date: startDate,
        p_end_date:   unlimited ? null : endDate,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setRemoving(true);
    try {
      await removeExemption(userId);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Ausnahmestatus
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">{ingameName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Grund */}
          <div>
            <label className="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Grund
            </label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    reason === r
                      ? "border-blue-500/50 bg-blue-600/10 text-blue-300"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
                  }`}
                >
                  <span>{EXEMPTION_ICONS[r]}</span>
                  <span>{EXEMPTION_LABELS[r]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notiz */}
          <div>
            <label className="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Notiz {reason !== "sonstiges" && <span className="normal-case text-zinc-600">(optional)</span>}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={reason === "sonstiges" ? "Grund beschreiben…" : "z.B. Familienurlaub, Raidleiter KW13…"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Zeitraum */}
          <div>
            <label className="block text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Zeitraum
            </label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-400 w-16">Von</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-zinc-400 w-16">Bis</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={unlimited}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={unlimited}
                    onChange={(e) => setUnlimited(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-blue-600 transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
                <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  Unbegrenzt (kein Enddatum)
                </span>
              </label>
            </div>
          </div>

          {/* Fehler */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-800">
          {existing && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition-colors disabled:opacity-50"
            >
              {removing ? "Wird aufgehoben…" : "Status aufheben"}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Wird gespeichert…" : existing ? "Aktualisieren" : "Speichern"}
          </button>
        </div>

      </div>
    </div>
  );
}
