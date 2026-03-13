"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  path: string | null;
};

export default function ScreenshotThumb({ path }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!path) return;
    supabase.storage
      .from("screenshots")
      .createSignedUrl(path, 60 * 60 * 3)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [path]);

  if (!path || !url) return null;

  const isPdf = path.endsWith(".pdf");

  return (
    <>
      {isPdf ? (
        
         <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 border border-gray-700 rounded px-2 py-1 mt-2">
           
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          PDF ansehen
        </a>
      ) : (
        <img
          src={url}
          alt="Screenshot"
          onClick={() => setLightbox(true)}
          className="h-12 w-12 object-cover rounded border border-gray-700 cursor-pointer hover:border-teal-500 mt-2 transition-colors"
          title="Screenshot anzeigen"
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(false)}
              className="absolute -top-10 right-0 text-white text-sm hover:text-gray-300"
            >
              ✕ Schließen
            </button>
            <img
              src={url}
              alt="Screenshot Vollansicht"
              className="w-full rounded-lg border border-gray-700"
            />
          </div>
        </div>
      )}
    </>
  );
}
