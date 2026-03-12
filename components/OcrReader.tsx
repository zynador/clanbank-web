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

function parseValue(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(/,/g, ".").toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KMB]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

// Prüft ob "senden an" vorkommt und "sind von" nicht
function hasValidDeposit(text: string): boolean {
  const n = text.toLowerCase();
  return n.includes("senden an") && !n.includes("sind von");
}

function extractAmounts(rawText: string): OcrResult | null {
  const lines = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const totals: Record<string, number> = { Cash: 0, Arms: 0, Cargo: 0, Metal: 0, Diamond: 0 };
  let foundAny = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.toLowerCase().includes("senden an")) continue;

    const valueLine = lines[i + 1] || "";
    const tokens = valueLine
      .split(/\s{2,}|\t/)
      .map(t => t.trim())
      .filter(t => t.length > 0);

    console.log("=== VALUE LINE:", valueLine);
    console.log("=== TOKENS:", tokens);

    for (let j = 0; j < Math.min(tokens.length, 5); j++) {
      const token = tokens[j];
      if (token === "-" || token === "") continue;
      const value = parseValue(token);
      if (value && value > 0) {
        totals[RESOURCES[j]] += value;
        foundAny = true;
      }
    }
  }

  if (!foundAny) return null;

  return {
    Cash: totals.Cash > 0 ? String(totals.Cash) : "",
    Arms: totals.Arms > 0 ? String(totals.Arms) : "",
    Cargo: totals.Cargo > 0 ? String(totals.Cargo) : "",
    Metal: totals.Metal > 0 ? String(totals.Metal) : "",
    Diamond: totals.Diamond > 0 ? String(totals.Diamond) : "",
  };
}

export default function OcrReader({ imageUrl, onResult }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error" | "no_recipient">("idle");
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
          .createSignedUrl(imageUrl!, 60);

        if (signedError || !signedData?.signedUrl) throw new Error("Signed URL fehlgeschlagen");

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data } = await worker.recognize(signedData.signedUrl);
        await worker.terminate();

        if (cancelled) return;

        const text = data.text;
        console.log("=== OCR RAW TEXT ===\n", text);
        console.log("=== HAT GÜLTIGE EINZAHLUNG:", hasValidDeposit(text));

        if (!hasValidDeposit(text)) {
          setStatus("no_recipient");
          return;
        }

        const amounts = extractAmounts(text);
        console.log("=== AMOUNTS:", amounts);

        if (!amounts) {
          setStatus("error");
          return;
        }

        setSuggestion(amounts);
        setStatus("done");
      } catch (e) {
        console.error("OCR Fehler:", e);
        if (!cancelled) setStatus("error");
      }
    }

    runOcr();
    return () => { cancelled = true; };
  }, [imageUrl]);

  function handleConfirm() {
    if (suggestion) { onResult(suggestion); setConfirmed(true); }
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
      {status === "no_recipient" && (
        <p className="text-yellow-400 text-xs">
          ⚠️ Kein gültiger Empfänger erkannt. Bitte manuell eintragen.
        </p>
      )}
      {status === "error" && (
        <p className="text-red-400 text-xs">
          ✕ Erkennung fehlgeschlagen – bitte manuell eintragen.
        </p>
      )}
      {status === "done" && suggestion && !confirmed && (
        <>
          <p className="text-teal-400 font-medium text-xs uppercase tracking-wide">✓ Erkannte Werte</p>
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
        <p className="text-gray-500 text-xs">✓ Werte wurden ins Formular übernommen.</p>
      )}
    </div>
  );
}
