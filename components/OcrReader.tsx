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
  const fixed = cleaned.replace(/^T(\d)/, "7$1");
  const match = fixed.match(/^(\d+(?:\.\d+)?)([KMB]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
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
        if (!hasValidDeposit(fullText)) { setStatus("no_recipient"); return; }

        const imageWidth = data.words.length > 0
          ? Math.max(...data.words.map(w => w.bbox.x1))
          : 720;
        const colWidth = imageWidth / 5;

        // Benachbarte Wörter zusammenfügen: "6,81" + "M" → "6,81M"
        type MergedWord = { text: string; x: number; y: number; };
        const words = data.words;
        const merged: MergedWord[] = [];

        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          const next = words[i + 1];
          const isNumber = /^\d[\d.,]*$/.test(w.text.trim());
          const nextIsSuffix = next && /^[KkMmBb]$/.test(next.text.trim());
          const nextIsClose = next && (next.bbox.x0 - w.bbox.x1) < 60;

          if (isNumber && nextIsSuffix && nextIsClose) {
            // Zusammenfügen
            merged.push({ text: w.text.trim() + next.text.trim(), x: w.bbox.x0, y: w.bbox.y0 });
            i++; // nächstes Wort überspringen
          } else {
            merged.push({ text: w.text.trim(), x: w.bbox.x0, y: w.bbox.y0 });
          }
        }

        console.log("=== MERGED WORDS MIT WERT:", merged.filter(w => parseValue(w.text) !== null).map(w => ({
          text: w.text, value: parseValue(w.text), x: w.x, y: w.y, spalte: Math.floor(w.x / colWidth)
        })));

        // Y-Positionen der "senden an" Zeilen
        const sendenAnYPositions = data.words
          .filter(w => w.text.toLowerCase() === "senden")
          .map(w => w.bbox.y0);

        console.log("=== SENDEN AN Y:", sendenAnYPositions);

        const totals = [0, 0, 0, 0, 0];

        for (const w of merged) {
          const value = parseValue(w.text);
          if (!value || value < 1000) continue;

          // Muss unter einer "senden an" Zeile liegen
          const isUnderSendenAn = sendenAnYPositions.some(y => w.y > y);
          if (!isUnderSendenAn) continue;

          const col = Math.min(Math.floor(w.x / colWidth), 4);
          console.log(`=== ZUORDNUNG: ${w.text} → ${RESOURCES[col]} (Spalte ${col}, x=${w.x})`);
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
