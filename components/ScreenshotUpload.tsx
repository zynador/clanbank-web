"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_AGE_MS = 4 * 24 * 60 * 60 * 1000; // 4 Tage
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ScreenshotUploadProps {
  clanId: string;
  depositId?: string;
  existingUrl?: string | null;
  onUploadComplete: (url: string | null, hash?: string) => void;
  disabled?: boolean;
  isOfficerOrAdmin?: boolean;
}

export default function ScreenshotUpload({
  clanId,
  depositId,
  existingUrl,
  onUploadComplete,
  disabled = false,
  isOfficerOrAdmin = false,
}: ScreenshotUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdf = preview?.endsWith(".pdf") || fileName?.endsWith(".pdf");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // 1. Dateityp
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Nur JPG, PNG oder PDF erlaubt.");
      return;
    }

    // 2. Dateigröße
    if (file.size > MAX_FILE_SIZE) {
      setError("Datei ist zu groß (max. 5 MB).");
      return;
    }

    // 3. Alter prüfen
    const fileAge = Date.now() - file.lastModified;
    if (fileAge > MAX_FILE_AGE_MS) {
      setError("Dieser Screenshot ist älter als 4 Tage und wird nicht akzeptiert.");
      return;
    }

    // 4. SHA-256 Hash berechnen
    let hash: string;
    try {
      hash = await computeSHA256(file);
    } catch {
      setError("Hash-Berechnung fehlgeschlagen.");
      return;
    }

    // 5. Duplikat prüfen
    const { data: isDuplicate, error: rpcErr } = await supabase.rpc(
      "check_screenshot_hash",
      { p_hash: hash }
    );
    if (rpcErr) {
      setError("Duplikat-Prüfung fehlgeschlagen: " + rpcErr.message);
      return;
    }
    if (isDuplicate) {
      await supabase.rpc('log_duplicate_attempt', { p_hash: hash })
      setError(
        isOfficerOrAdmin
          ? "⚠️ Duplikat erkannt: Dieser Screenshot wurde bereits für eine andere Einzahlung verwendet. Möglicher Betrugsversuch."
          : "Dieser Screenshot wurde bereits für eine andere Einzahlung verwendet."
      );
      return;
    }

    setFileName(file.name);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // 7. Upload
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${clanId}/${depositId || `temp_${Date.now()}`}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      // 8. Hash mitgeben
      onUploadComplete(filePath, hash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      setError(message);
      onUploadComplete(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName(null);
    setError(null);
    onUploadComplete(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Screenshot (PFLICHT)
      </label>

      {!preview && !fileName && (
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS}
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
            id="screenshot-input"
          />
          <label
            htmlFor="screenshot-input"
            className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors
              ${disabled || uploading
                ? "border-gray-700 text-gray-600 cursor-not-allowed"
                : "border-gray-600 text-gray-400 hover:border-teal-500 hover:text-teal-400"
              }`}
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Wird hochgeladen...</span>
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Screenshot hochladen (JPG, PNG, PDF – max. 5 MB, max. 4 Tage alt)</span>
              </>
            )}
          </label>
        </div>
      )}

      {(preview || fileName) && !uploading && (
        <div className="relative inline-block">
          {preview && !isPdf ? (
            <img
              src={preview}
              alt="Screenshot-Vorschau"
              className="h-20 w-20 object-cover rounded-lg border border-gray-600"
            />
          ) : (
            <div className="h-20 w-20 flex items-center justify-center rounded-lg border border-gray-600 bg-gray-800">
              <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {!disabled && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              title="Entfernen"
            >
              ✕
            </button>
          )}
          {fileName && (
            <p className="text-xs text-gray-500 mt-1 max-w-[80px] truncate">{fileName}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
