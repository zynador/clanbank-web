"use client";
import { useEffect, useState } from "react";

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

// Hilfsfunktion: Text → Zahl (z.B. "2,2M" → 2200000)
function parseValue(raw: string): number | null {
  const cleaned = raw
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .toUpperCase();

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*([KMB]?)$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const suffix = match[2];

  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

// Bekannte OCR-Fehler korrigieren
function fixOcrText(text: string): string {
  return text
    .replace(/\bT(\d)/g, "7$1")   // T44K → 744K
    .replace(/[=:]/g, "")         // Striche als Trennzeichen ignorieren
    .replace(/\|/g, "1");         // | oft als 1 falsch erkannt
}

// Ressource aus Zeile erkennen
function detectResource(line: string): string | null {
  const l = line.toLowerCase();
  if (l.includes("cash")) return "Cash";
  if (l.includes("arms") || l.includes("waffe") || l.includes("arm")) return "Arms";
  if (l.includes("cargo") || l.includes("kargo")) return "Cargo";
  if (l.includes("metal") || l.includes("metall")) return "Metal";
  if (l.includes("diamond") || l.includes("diamant")) return "Diamond";
  return null;
}

// Ist "Bam bamm" als Empfänger erkennbar?
function hasBamBamm(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  return (
    normalized.includes("bam bamm") ||
    normalized.includes("bambamm") ||
    normalized.includes("bam bam")
  );
}

// Hauptfunktion: OCR-Text → Ressourcen-Beträge
function extractAmounts(rawText: string): OcrResult | null {
  if (!hasBamBamm(rawText)) return null;

  const result: OcrResult = {
    Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "",
  };
  let found = false;

  const fixed = fixOcrText(rawText);
  const lines = fixed.split("\n");

  for (const line of lines) {
    const resource = detectResource(line);
    if (!resource) continue;

    // Zahl in der Zeile suchen
    const numMatch = line.match(/(\d[\d.,]*\s*[KkMmBb]?)/);
    if (!numMatch) continue;

    const value = parseValue(numMatch[1]);
    if (value && value > 0) {
      result[resource as keyof OcrResult] = String(value);
      found = true;
    }
  }

  return found ? result : null;
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
        // Tesseract.js dynamisch laden (kein Build-Fehler bei SSR)
        const { createWorker } = await import("tesseract.js");

        const worker = await createWorker("eng");
        const { data } = await worker.recognize(imageUrl!);
        await worker.terminate();

        if (cancelled) return;

        const text = data.text;
        const amounts = extractAmounts(text);

        if (!hasBamBamm(text)) {
          setStatus("no_recipient");
          return;
        }

        if (!amounts) {
          setStatus("error");
          return;
        }

        setSuggestion(amounts);
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
          <span className="animate-spin">⏳</span>
          <span>Screenshot wird analysiert...</span>
        </div>
      )}

      {status === "no_recipient" && (
        <p className="text-yellow-400 text-xs">
          ⚠️ Kein gültiger Empfänger erkannt (erwartet: „Bam bamm"). Bitte manuell eintragen.
        </p>
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
            {(["Cash", "Arms", "Cargo", "Metal", "Diamond"] as const).map((r) =>
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
