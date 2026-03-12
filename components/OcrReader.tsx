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
  const match = fixed.match(/^(\d+(?:\.\d+)?)([KM]?)$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (num > 100) return null;
  return Math.round(num);
}

// Prüft ob ein Wort ein Header-Anker ist (senden-Varianten ODER "bam")
function isHeaderAnchor(text: string): boolean {
  const t = text.toLowerCase().trim();
  // "senden" und häufige OCR-Fehler davon
  if (/^s[ae]n[dt][ae]n$/.test(t)) return true;
  // "bam" als direkter Anker (robust erkannt)
  if (t === "bam") return true;
  return false;
}

// Prüft ob eine Header-Zeile auf Bam bamm zeigt
function lineIsBamBamm(lineText: string): boolean {
  const t = lineText.toLowerCase();
  return t.includes("bam");
}

// Prüft ob eine Header-Zeile eine "sind von"-Zeile ist (ignorieren)
function lineIsSindVon(lineText: string): boolean {
  const t = lineText.toLowerCase();
  return t.includes("sind") && t.includes("von");
}

type StatusType = "idle" | "loading" | "done" | "error" | "no_recipient";

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
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("screenshots")
            .createSignedUrl(imageUrl!, 60);

        if (signedError || !signedData?.signedUrl)
          throw new Error("Signed URL fehlgeschlagen");

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = "anonymous";
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = signedData.signedUrl;
        });

        let recognizeTarget: string = signedData.signedUrl;
        if (img.naturalWidth < 600) {
          const scale = 3;
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth * scale;
          canvas.height = img.naturalHeight * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          recognizeTarget = canvas.toDataURL("image/png");
        }

        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("eng");
        const { data } = await worker.recognize(recognizeTarget);
        await worker.terminate();

        if (cancelled) return;

        const words = data.words;
        const imageHeight =
          words.length > 0
            ? Math.max(...words.map((w) => w.bbox.y1))
            : 1600;
        const imageWidth =
          words.length > 0
            ? Math.max(...words.map((w) => w.bbox.x1))
            : 720;

        // SCHRITT 1: Header-Zeilen erkennen
        // Anker: "senden"-Varianten oder "bam" — robust gegen OCR-Fehler
        type Header = { y: number; isBamBamm: boolean; nextY: number };

        const anchorWords = words.filter((w) => isHeaderAnchor(w.text));

        // Dedupliziere: mehrere Anker in derselben Zeile → nur einer
        const tolerance = Math.max(25, (imageHeight / 1600) * 25);
        const seenY: number[] = [];
        const uniqueAnchors = anchorWords.filter((w) => {
          const isDup = seenY.some((y) => Math.abs(y - w.bbox.y0) < tolerance);
          if (!isDup) seenY.push(w.bbox.y0);
          return !isDup;
        });

        if (uniqueAnchors.length === 0) {
          setStatus("no_recipient");
          return;
        }

        // Sortiere nach Y-Position
        uniqueAnchors.sort((a, b) => a.bbox.y0 - b.bbox.y0);

        const headers: Header[] = [];

        for (let i = 0; i < uniqueAnchors.length; i++) {
          const anchor = uniqueAnchors[i];
          const headerY = anchor.bbox.y0;

          // Alle Wörter in dieser Header-Zeile (±tolerance px)
          const lineText = words
            .filter((w) => Math.abs(w.bbox.y0 - headerY) < tolerance)
            .map((w) => w.text)
            .join(" ");

          // "sind von"-Zeilen komplett ignorieren
          if (lineIsSindVon(lineText)) continue;

          const isBamBamm = lineIsBamBamm(lineText);

          const nextY =
            i + 1 < uniqueAnchors.length
              ? uniqueAnchors[i + 1].bbox.y0
              : imageHeight;

          headers.push({ y: headerY, isBamBamm, nextY });
        }

        const bamHeaders = headers.filter((h) => h.isBamBamm);
        if (bamHeaders.length === 0) {
          setStatus("no_recipient");
          return;
        }

        // SCHRITT 2: Wörter zusammenführen (Zahl + Suffix)
        type MergedWord = { text: string; x: number; y: number };
        const merged: MergedWord[] = [];

        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          const next = words[i + 1];
          const isNumber = /^\d[\d.,]*$/.test(w.text.trim());
          const nextIsSuffix = next && /^[KkMm]$/.test(next.text.trim());
          const nextIsClose = next && next.bbox.x0 - w.bbox.x1 < 60;

          if (isNumber && nextIsSuffix && nextIsClose) {
            merged.push({
              text: w.text.trim() + next.text.trim(),
              x: w.bbox.x0,
              y: w.bbox.y0,
            });
            i++;
          } else {
            merged.push({
              text: w.text.trim(),
              x: w.bbox.x0,
              y: w.bbox.y0,
            });
          }
        }

        // SCHRITT 3: Spaltenberechnung nur aus Bam-bamm-Bereichen
        const bamValueWords = merged.filter((w) => {
          const v = parseValue(w.text);
          if (!v || v < 1000) return false;
          return bamHeaders.some((h) => w.y > h.y && w.y < h.nextY);
        });

        let colWidth: number;
        let colOffset: number;

        if (bamValueWords.length >= 2) {
          const xPositions = bamValueWords.map((w) => w.x);
          const minX = Math.min(...xPositions);
          const maxX = Math.max(...xPositions);
          colOffset = minX - (maxX - minX) / 8;
          colWidth = (maxX - colOffset) / 4.5;
        } else if (bamValueWords.length === 1) {
          colOffset = 0;
          colWidth = imageWidth / 5;
        } else {
          setStatus("error");
          return;
        }

        function getCol(x: number): number {
          return Math.min(
            Math.max(Math.floor((x - colOffset) / colWidth), 0),
            4
          );
        }

        // SCHRITT 4: Nur Werte aus Bam-bamm-Zeilen summieren
        const totals = [0, 0, 0, 0, 0];

        for (const w of merged) {
          const value = parseValue(w.text);
          if (!value || value < 1000) continue;
          const inBamArea = bamHeaders.some(
            (h) => w.y > h.y && w.y < h.nextY
          );
          if (!inBamArea) continue;
          const col = getCol(w.x);
          totals[col] += value;
        }

        // SCHRITT 5: Ergebnis
        const result: OcrResult = {
          Cash: totals[0] > 0 ? String(totals[0]) : "",
          Arms: totals[1] > 0 ? String(totals[1]) : "",
          Cargo: totals[2] > 0 ? String(totals[2]) : "",
          Metal: totals[3] > 0 ? String(totals[3]) : "",
          Diamond: totals[4] > 0 ? String(totals[4]) : "",
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
    return () => {
      cancelled = true;
    };
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
