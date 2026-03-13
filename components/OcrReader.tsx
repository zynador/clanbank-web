"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type OcrResult = {
  Cash: string;
  Arms: string;
  Cargo: string;
  Metal: string;
  Diamond: string;
};

type Props = {
  imageUrl: string | null;
  onResult: (amounts: OcrResult) => void;
  onManual: () => void;
};

const RESOURCES = ["Cash", "Arms", "Cargo", "Metal", "Diamond"] as const;
type StatusType = "idle" | "loading" | "done" | "error";

export default function OcrReader({ imageUrl, onResult, onManual }: Props) {
  const [status, setStatus] = useState<StatusType>("idle");
  const [suggestion, setSuggestion] = useState<OcrResult | null>(null);
  const [decision, setDecision] = useState<"none" | "accepted" | "manual">("none");

  useEffect(() => {
    if (!imageUrl) {
      setStatus("idle");
      setSuggestion(null);
      setDecision("none");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setSuggestion(null);
    setDecision("none");

    async function runOcr() {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("screenshots")
          .createSignedUrl(imageUrl!, 300);

        if (signedError || !signedData?.signedUrl)
          throw new Error("Signed URL fehlgeschlagen: " + signedError?.message);

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: signedData.signedUrl }),
        });

        const json = await res.json();

        if (!res.ok) throw new Error("API Fehler: " + (json.error ?? res.status));
        if (json.error) throw new Error(json.error);
        if (cancelled) return;

        const raw = json.result as Record<string, number>;
        const result: OcrResult = {
          Cash: raw.Cash > 0 ? String(raw.Cash) : "",
          Arms: raw.Arms > 0 ? String(raw.Arms) : "",
          Cargo: raw.Cargo > 0 ? String(raw.Cargo) : "",
          Metal: raw.Metal > 0 ? String(raw.Metal) : "",
          Diamond: raw.Diamond > 0 ? String(raw.Diamond) : "",
        };

        const hasAny = RESOURCES.some((r) => result[r] !== "");
        if (!hasAny) {
          setStatus("error");
          return;
        }

        setSuggestion(result);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    runOcr();
    return () => { cancelled = true; };
  }, [imageUrl]);

  function handleAccept() {
    if (suggestion) {
      onResult(suggestion);
      setDecision("accepted");
    }
  }

  function handleManual() {
    onManual();
    setDecision("manual");
  }

  if (status === "idle") return null;

  return (
    <div className="mt-3 rounded-lg border border-gray-700 bg-[#0f1117] p-4 text-sm space-y-3">

      {status === "loading" && (
        <div className="flex items-center gap-2 text-gray-400">
          <span className="animate-spin inline-block">⏳</span>
          <span>Screenshot wird analysiert...</span>
        </div>
      )}

      {status === "error" && (
        <p className="text-red-400 text-xs">
          ✕ Erkennung fehlgeschlagen – bitte manuell eintragen.
        </p>
      )}

      {status === "done" && suggestion && decision === "none" && (
        <>
          <p className="text-teal-400 font-medium text-xs uppercase tracking-wide">
            ✓ Erkannte Werte
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RESOURCES.map((r) =>
              suggestion[r] ? (
                <div key={r} className="bg-[#161822] rounded px-3 py-2">
                  <span className="text-gray-500 text-xs">{r}</span>
                  <p className="text-white text-sm font-medium">
                    {Number(suggestion[r]).toLocaleString("de-DE")}
                  </p>
                </div>
              ) : null
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAccept}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Werte übernehmen
            </button>
            <button
              onClick={handleManual}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm transition-colors"
            >
              Manuell eingeben
            </button>
          </div>
          <p className="text-yellow-600 text-xs leading-relaxed">
            ⚠️ Manuelle Eingabe nur verwenden, wenn die erkannten Werte
            nicht zum Screenshot passen. Manuell eingegebene Einzahlungen
            werden von einem Offizier geprüft, bevor sie in die Statistik zählen.
          </p>
        </>
      )}

      {decision === "accepted" && (
        <p className="text-teal-500 text-xs">
          ✓ Erkannte Werte wurden ins Formular übernommen.
        </p>
      )}

      {decision === "manual" && (
        <p className="text-yellow-500 text-xs">
          ⚠️ Bitte Ressource und Menge manuell eintragen. Deine Einzahlung
          wird von einem Offizier geprüft.
        </p>
      )}

    </div>
  );
}
