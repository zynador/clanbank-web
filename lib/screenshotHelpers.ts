import { supabase } from "@/lib/supabaseClient";

/**
 * Generiert eine signed URL für einen Screenshot-Pfad.
 * Screenshots werden als Pfade gespeichert (z.B. "clan-uuid/deposit-uuid.jpg"),
 * nicht als vollständige URLs.
 *
 * @param path - Der Pfad im "screenshots" Bucket
 * @param expiresIn - Gültigkeitsdauer in Sekunden (Default: 1 Stunde)
 * @returns Die signed URL oder null bei Fehler
 */
export async function getScreenshotUrl(
  path: string | null | undefined,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!path) return null;

  // Falls es schon eine vollständige URL ist, direkt zurückgeben
  if (path.startsWith("http")) return path;

  const { data, error } = await supabase.storage
    .from("screenshots")
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Fehler beim Generieren der Screenshot-URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Prüft anhand des Pfades, ob es sich um ein PDF handelt.
 */
export function isScreenshotPdf(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.toLowerCase().endsWith(".pdf");
}
