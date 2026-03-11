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

function fixOcrText(text: string): string {
  return text
    .replace(/\bT(\d)/g, "7$1")
    .replace(/[=:]/g, "")
    .replace(/\|/g, "1");
}

function detectResource(line: string): keyof OcrResult | null {
  const l = line.toLowerCase();
  if (l.includes("cash")) return "Cash";
  if (l.includes("arms") || l.includes("waffe")) return "Arms";
  if (l.includes("cargo") || l.includes("kargo")) return "Cargo";
  if (l.includes("metal") || l.includes("metall")) return "Metal";
  if (l.includes("diamond") || l.includes("diamant")) return "Diamond";
  return null;
}

function hasBamBamm(text: string): boolean {
  const n = text.toLowerCase().replace(/\s+/g, " ");
  return n.includes("bam bamm") || n.includes("bambamm") || n.includes("bam bam");
}

function extractAmounts(rawText: string): OcrResult | null {
  if (!hasBamBamm(rawText)) return null;
  const result: OcrResult = { Cash: "", Arms: "", Cargo: "", Metal: "", Diamond: "" };
  let found = false;
  const lines = fixOcrText(rawText).split("\n");
  for (const line of lines) {
    const resource = detectResource(line);
    if (!resource) continue;
    const numMatch = line.match(/(\d[\d.,]*\s*[KkMmBb]?)/);
    if (!numMatch) continue;
    const value = parseValue(numMatch[1]);
    if (value && value > 0) {
      result[resource] = String(value);
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
        // Pfad → Signed URL via Supabase
        const { data: signedData, error: signedError } = await supabase.storage
          .from("screenshots")
          .createSignedUrl(imageUrl!, 60);

        if (signedError || !signedData?.signedUrl) throw new Error("Signed URL fehlgeschlagen");

        // Bild laden → Canvas → PNG Blob
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = signedData.signedUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);

        const pngUrl = await new Promise<string>((resolve, reject) => {
          canvas.toBlob((b) => {
            if (!b) { reject(new Error("toBlob failed")); return; }
            resolve(URL.createObjectURL(b));
          }, "image/png");
        });

        // Tesseract OCR
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data } = await worker.recognize(pngUrl);
        await worker.terminate();
        URL.revokeObjectURL(pngUrl);

        if (cancelled) return;

        const text = data.text;
        console.log("=== OCR RAW TEXT ===", text);
        console.log("=== HAT BAM BAMM:", hasBamBamm(text));

        if (!hasBamBamm(text)) { setStatus("no_recipient"); return; }

        const amounts = extractAmounts(text);
        console.log("=== AMOUNTS:", amounts);

        if (!amounts) { setStatus("error"); return; }

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
          <p className="text-teal-400 font-medium text-xs uppercase tracking-wide">✓ Erkannte Werte</p>
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
