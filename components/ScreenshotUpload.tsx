"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.pdf";

interface ScreenshotUploadProps {
  clanId: string;
  depositId?: string; // Falls beim Erstellen noch nicht vorhanden, wird temporärer Name genutzt
  existingUrl?: string | null;
  onUploadComplete: (url: string | null) => void;
  disabled?: boolean;
}

export default function ScreenshotUpload({
  clanId,
  depositId,
  existingUrl,
  onUploadComplete,
  disabled = false,
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

    // Validierung: Dateityp
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Nur JPG, PNG oder PDF erlaubt.");
      return;
    }

    // Validierung: Dateigröße
    if (file.size > MAX_FILE_SIZE) {
      setError("Datei ist zu groß (max. 5 MB).");
      return;
    }

    setFileName(file.name);

    // Vorschau für Bilder
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      // PDF – kein Bild-Preview
      setPreview(null);
    }

    // Upload
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${clanId}/${depositId || `temp_${Date.now()}`}.${fileExt}`;

      // Falls schon eine Datei existiert, überschreiben
      const { error: uploadError } = await supabase.storage
        .from("screenshots")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Signed URL generieren (1 Jahr gültig)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("screenshots")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      // Pfad speichern (nicht die signed URL, die erneuern wir beim Anzeigen)
      onUploadComplete(filePath);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Screenshot (PFLICHT)
      </label>

      {/* Datei-Auswahl */}
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
                : "border-gray-600 text-gray-400 hover:border-amber-500 hover:text-amber-400"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Screenshot hochladen (JPG, PNG, PDF – max. 5 MB)</span>
              </>
            )}
          </label>
        </div>
      )}

      {/* Vorschau */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
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

      {/* Fehlermeldung */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
