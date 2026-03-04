"use client";

import { useEffect } from "react";

interface ScreenshotLightboxProps {
  url: string;
  isPdf?: boolean;
  onClose: () => void;
}

export default function ScreenshotLightbox({ url, isPdf, onClose }: ScreenshotLightboxProps) {
  // ESC zum Schließen
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Schließen-Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
      >
        ✕
      </button>

      {/* Inhalt */}
      <div
        className="max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf ? (
          <iframe
            src={url}
            className="w-[80vw] h-[85vh] rounded-lg"
            title="Screenshot PDF"
          />
        ) : (
          <img
            src={url}
            alt="Screenshot"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
