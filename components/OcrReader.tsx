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

type OcrTransfer = {
  timestamp: string;
  Cash: number;
  Arms: number;
  Cargo: number;
  Metal: number;
  Diamond: number;
};

type Lang = "de" | "en";

type Props = {
  imageUrl: string | null;
  onResult: (amounts: OcrResult, gameTimestamps: string[]) => void;
  onManual: () => void;
  lang?: Lang;
};

const RESOURCES = ["Cash", "Arms", "Cargo", "Metal", "Diamond"] as const;
type StatusType = "idle" | "loading" | "done" | "error";

function fingerprint(t: OcrTransfer): string {
  return `${t.timestamp}|${t.Cash}|${t.Arms}|${t.Cargo}|${t.Metal}|${t.Diamond}`;
}

export default function OcrReader({ imageUrl, onResult, onManual, lang = "de" }: Props) {
  const [status, setStatus] = useState<StatusType>("idle");
  const [newTransfers, setNewTransfers] = useState<OcrTransfer[]>([]);
  const [knownTransfers, setKnownTransfers] = useState<OcrTransfer[]>([]);
  const [decision, setDecision] = useState<"none" | "accepted" | "manual">("none");

  const t = {
    analyzing:     { de: "Screenshot wird analysiert...",       en: "Analyzing screenshot..." },
    error:         { de: "✕ Erkennung fehlgeschlagen – bitte manuell eintragen.", en: "✕ Recognition failed – please enter manually." },
    recognized:    { de: "✓ Neue Transfers",                    en: "✓ New transfers" },
    already_known: { de: "Bereits erfasst",                     en: "Already recorded" },
    accept:        { de: "Werte übernehmen",                    en: "Use values" },
    manual:        { de: "Manuell eingeben",                    en: "Enter manually" },
    no_new:        { de: "Alle Transfers in diesem Screenshot wurden bereits erfasst.", en: "All transfers in this screenshot have already been recorded." },
    warning: {
      de: "⚠️ Manuelle Eingabe nur verwenden, wenn die erkannten Werte nicht zum Screenshot passen. Manuell eingegebene Einzahlungen werden von einem Offizier geprüft, bevor sie in die Statistik zählen.",
      en: "⚠️ Only use manual entry if the recognized values don't match the screenshot. Manually entered deposits will be reviewed by an officer before counting in statistics.",
    },
    accepted_msg: { de: "✓ Erkannte Werte wurden ins Formular übernommen.",            en: "✓ Recognized values have been applied to the form." },
    manual_msg:   { de: "⚠️ Bitte Ressource und Menge manuell eintragen. Deine Einzahlung wird von einem Offizier geprüft.", en: "⚠️ Please enter resource and amount manually. Your deposit will be reviewed by an officer." },
  };

  useEffect(() => {
    if (!imageUrl) {
      setStatus("idle");
      setNewTransfers([]);
      setKnownTransfers([]);
      setDecision("none");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setNewTransfers([]);
    setKnownTransfers([]);
    setDecision("none");

    async function runOcr() {
      try {
        // 1. Signed URL für OCR
        const { data: signedData, error: signedError } = await supabase.storage
          .from("screenshots")
          .createSignedUrl(imageUrl!, 300);
        if (signedError || !signedData?.signedUrl)
          throw new Error("Signed URL fehlgeschlagen: " + signedError?.message);

        // 2. OCR aufrufen → Array von Einzeltransfers
        const res = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: signedData.signedUrl }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error("API Fehler: " + (json.error ?? res.status));
        if (json.error) throw new Error(json.error);
        if (cancelled) return;

        const transfers = json.result as OcrTransfer[];
        if (!Array.isArray(transfers) || transfers.length === 0) {
          setStatus("error");
          return;
        }

        // 3. Bekannte Fingerprints aus DB laden (mit Duplikaten)
        const { data: knownData } = await supabase.rpc("get_known_timestamps");
        const knownList = (knownData as string[]) ?? [];

        // Häufigkeiten der bekannten Fingerprints zählen
        const knownCount = new Map<string, number>();
        for (const fp of knownList) {
          knownCount.set(fp, (knownCount.get(fp) ?? 0) + 1);
        }

        // 4. Transfers in neu / bereits erfasst aufteilen (Häufigkeitsvergleich)
        const newT: OcrTransfer[] = [];
        const knownT: OcrTransfer[] = [];
        const seenCount = new Map<string, number>();

        for (const transfer of transfers) {
          const fp = fingerprint(transfer);
          const seen = seenCount.get(fp) ?? 0;
          const known = knownCount.get(fp) ?? 0;
          if (seen < known) {
            knownT.push(transfer);
          } else {
            newT.push(transfer);
          }
          seenCount.set(fp, seen + 1);
        }

        if (cancelled) return;
        setNewTransfers(newT);
        setKnownTransfers(knownT);
        setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    runOcr();
    return () => { cancelled = true; };
  }, [imageUrl]);

  function sumTransfers(transfers: OcrTransfer[]): OcrResult {
    const sums = { Cash: 0, Arms: 0, Cargo: 0, Metal: 0, Diamond: 0 };
    for (const tr of transfers) {
      sums.Cash    += tr.Cash;
      sums.Arms    += tr.Arms;
      sums.Cargo   += tr.Cargo;
      sums.Metal   += tr.Metal;
      sums.Diamond += tr.Diamond;
    }
    return {
      Cash:    sums.Cash    > 0 ? String(sums.Cash)    : "",
      Arms:    sums.Arms    > 0 ? String(sums.Arms)    : "",
      Cargo:   sums.Cargo   > 0 ? String(sums.Cargo)   : "",
      Metal:   sums.Metal   > 0 ? String(sums.Metal)   : "",
      Diamond: sums.Diamond > 0 ? String(sums.Diamond) : "",
    };
  }

  function formatTransferRow(transfer: OcrTransfer): string {
    const parts = RESOURCES
      .filter((r) => transfer[r] > 0)
      .map((r) => `${r} ${Number(transfer[r]).toLocaleString("de-DE")}`);
    return parts.length > 0 ? parts.join(" · ") : "–";
  }

  function handleAccept() {
    if (newTransfers.length === 0) return;
    const result = sumTransfers(newTransfers);
    const timestamps = newTransfers.map((tr) => fingerprint(tr));
    onResult(result, timestamps);
    setDecision("accepted");
  }

  function handleManual() {
    onManual();
    setDecision("manual");
  }

  if (status === "idle") return null;

  const allAlreadyKnown = status === "done" && newTransfers.length === 0;

  return (
    <div className="mt-3 rounded-lg border border-gray-700 bg-[#0f1117] p-4 text-sm space-y-3">

      {status === "loading" && (
        <div className="flex items-center gap-2 text-gray-400">
          <span className="animate-spin inline-block">⏳</span>
          <span>{t.analyzing[lang]}</span>
        </div>
      )}

      {status === "error" && (
        <p className="text-red-400 text-xs">{t.error[lang]}</p>
      )}

      {status === "done" && decision === "none" && (
        <>
          {newTransfers.length > 0 && (
            <>
              <p className="text-teal-400 font-medium text-xs uppercase tracking-wide">
                {t.recognized[lang]}
              </p>
              <div className="space-y-1">
                {newTransfers.map((transfer, i) => (
                  <div key={i} className="bg-[#161822] rounded px-3 py-2 flex justify-between items-center gap-4">
                    <span className="text-gray-400 text-xs shrink-0">{transfer.timestamp}</span>
                    <span className="text-white text-xs font-medium text-right">{formatTransferRow(transfer)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {knownTransfers.length > 0 && (
            <>
              <p className="text-gray-600 font-medium text-xs uppercase tracking-wide mt-2">
                {t.already_known[lang]}
              </p>
              <div className="space-y-1">
                {knownTransfers.map((transfer, i) => (
                  <div key={i} className="bg-[#0d0f14] rounded px-3 py-2 flex justify-between items-center gap-4 opacity-40">
                    <span className="text-gray-500 text-xs line-through shrink-0">{transfer.timestamp}</span>
                    <span className="text-gray-500 text-xs line-through text-right">{formatTransferRow(transfer)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {allAlreadyKnown && (
            <p className="text-yellow-500 text-xs">{t.no_new[lang]}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAccept}
              disabled={newTransfers.length === 0}
              className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {t.accept[lang]}
            </button>
            <button
              onClick={handleManual}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg py-2 text-sm transition-colors"
            >
              {t.manual[lang]}
            </button>
          </div>
          <p className="text-yellow-600 text-xs leading-relaxed">{t.warning[lang]}</p>
        </>
      )}

      {decision === "accepted" && (
        <p className="text-teal-500 text-xs">{t.accepted_msg[lang]}</p>
      )}

      {decision === "manual" && (
        <p className="text-yellow-500 text-xs">{t.manual_msg[lang]}</p>
      )}

    </div>
  );
}
