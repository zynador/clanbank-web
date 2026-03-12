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
};

const RESOURCES = ["Cash", "Arms", "Cargo", "Metal", "Diamond"] as const;
type StatusType = "idle" | "loading" | "done" | "error";

export default function OcrReader({ imageUrl, onResult }: Props) {
  const [status, setStatus] = useState<StatusType>("idle");
  const [suggestion, setSuggestion] = useState<OcrResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setStatus("idle");
      setSuggestion(null);
      setConfirmed(false);
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setSuggestion(null);
    setConfirmed(false);

    async function runOcr() {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("screenshots")
          .createSignedUrl(imageUrl!, 120);

        if (signedError || !signedData?.signedUrl)
          throw new Error("Signed URL fehlgeschlagen");

        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: signedData.signedUrl }),
        });

        if (!res.ok) throw new Error("API Fehler");
        const json = await res.json();
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

  function handleConfirm() {
    if (suggestion) {
      onResult(suggestion);
      setConfirmed(true);
    }
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
      {status === "done" && suggestion && !confirmed && (
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
              onClick={handleConfirm}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Werte übernehmen
            </button>
            <button
              onClick={() => setConfirmed(true)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm transition-colors"
            >
              Ignorieren
            </button>
          </div>
        </>
      )}
      {confirmed && (
        <p className="text-gray-500 text-xs">
          ✓ Werte wurden ins Formular übernommen.
        </p>
      )}
    </div>
  );
}
