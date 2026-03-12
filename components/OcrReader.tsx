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
  // T→7 Korrektur (bekannter OCR-Fehler)
  const fixed = cleaned.replace(/^T(\d)/, "7$1");
  const match = fixed.match(/^(\d+(?:\.\d+)?)\s*([KMB]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  // Plausibilitätsprüfung: Rohzahl ohne Suffix muss < 100 sein (sonst Komma verschluckt)
  if (num > 100) return null;
  return Math.round(num);
}

function hasValidDeposit(text: string): boolean {
  const n = text.toLowerCase();
  return n.includes("senden an") && !n.includes("sind von");
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

        const fullText = data.text;
        console.log("=== OCR RAW TEXT ===\n", fullText);

        if (!hasValidDeposit(fullText)) {
          setStatus("no_recipient");
          return;
        }

        // Bildbreite ermitteln für Spaltenberechnung
        const imageWidth = data.words.length > 0
          ? Math.max(...data.words.map(w => w.bbox.x1))
          : 720;
        const colWidth = imageWidth / 5;

        console.log("=== BILDBREITE:", imageWidth, "SPALTENBREITE:", colWidth);

        // Alle Wörter die wie Ressourcenwerte aussehen (Zahl + K/M oder nur Zahl)
        const valueWords = data.words.filter(w => {
          const t = w.text.trim();
          return /^\d[\d.,]*\s*[KkMm]?$/.test(t) && t !== "-";
        });

        console.log("=== ALLE WÖRTER:", data.words.map(w => ({
  text: w.text,
  x: w.bbox.x0,
  y: w.bbox.y0,
})));
console.log("=== WERT-WÖRTER:", valueWords.map(w => ({
  text: w.text,
  x: w.bbox.x0,
  y: w.bbox.y0,
  spalte: Math.floor(w.bbox.x0 / colWidth),
  parsedValue: parseValue(w.text)
})));

        // Nur Wörter in Zeilen nach "senden an" berücksichtigen
        // Wir suchen "senden an" Zeilen und schauen welche Wörter darunter liegen
        const sendenAnWords = data.words.filter(w =>
          w.text.toLowerCase().includes("senden") ||
          w.text.toLowerCase().includes("an")
        );

        const sendenAnYPositions = sendenAnWords
          .filter((w, i, arr) => {
            // Gruppe von "senden" + "an" Wörter
            return w.text.toLowerCase() === "senden" ||
              (arr[i-1]?.text.toLowerCase() === "senden" && w.text.toLowerCase() === "an");
          })
          .map(w => w.bbox.y0);

        console.log("=== SENDEN AN Y-POSITIONEN:", sendenAnYPositions);

        // Totals pro Ressource (Spalte)
        const totals = [0, 0, 0, 0, 0];

        for (const word of valueWords) {
          const value = parseValue(word.text);
          if (!value || value < 100) continue; // Unter 100 ignorieren (Datum etc.)

          // Spalte bestimmen (0=Cash, 1=Arms, 2=Cargo, 3=Metal, 4=Diamond)
          const col = Math.min(Math.floor(word.bbox.x0 / colWidth), 4);

          // Prüfen ob dieses Wort unter einer "senden an" Zeile liegt
          const isUnderSendenAn = sendenAnYPositions.some(y => word.bbox.y0 > y);
          if (!isUnderSendenAn) continue;

          console.log(`=== WERT: ${word.text} → Spalte ${col} (${RESOURCES[col]}), y=${word.bbox.y0}`);
          totals[col] += value;
        }

        const result: OcrResult = {
          Cash: totals[0] > 0 ? String(totals[0]) : "",
          Arms: totals[1] > 0 ? String(totals[1]) : "",
          Cargo: totals[2] > 0 ? String(totals[2]) : "",
          Metal: totals[3] > 0 ? String(totals[3]) : "",
          Diamond: totals[4] > 0 ? String(totals[4]) : "",
        };

        console.log("=== RESULT:", result);

        const hasAny = RESOURCES.some(r => result[r] !== "");
        if (!hasAny) { setStatus("error"); return; }

        setSuggestion(result);
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
