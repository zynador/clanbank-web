import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "Keine imageUrl" }, { status: 400 });

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Bild konnte nicht geladen werden");
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";

    const prompt = `Du analysierst einen Screenshot aus dem Spiel "The Grand Mafia".
Das Bild zeigt einen Ressourcen-Transport-Bericht mit mehreren Einträgen.
Jeder Eintrag besteht aus:
1. Einem Zeitstempel (Datum + Uhrzeit, z.B. "15.03. 09:15")
2. Einem grünen Header: "Ressourcen senden an: [Name]"
3. Genau 5 Ressourcen-Slots nebeneinander, von LINKS nach RECHTS in dieser festen Reihenfolge:
   Slot 1 = CASH (Geldscheine-Icon, ganz links)
   Slot 2 = ARMS (Patronen/Munitions-Icon)
   Slot 3 = CARGO (braune Holzkisten-Icon, Mitte)
   Slot 4 = METAL (Silberbarren-Icon, vierter von links)
   Slot 5 = DIAMOND (Diamant/Edelstein-Icon, ganz rechts)
4. Unter jedem Slot: ein Zahlenwert ODER "-"

WICHTIG - Metal vs Diamond:
- Slot 4 (METAL) ist der VIERTE Slot von links = zweiter von rechts
- Slot 5 (DIAMOND) ist der FÜNFTE Slot = ganz rechts außen
- Zähle die Slots immer von links nach rechts: 1, 2, 3, 4, 5

ZAHLENFORMAT: "7,25 M" = 7250000, "500 K" = 500000, "-" = 0

AUFGABE - gehe so vor:
Schritt 1: Finde alle Einträge mit "Bam bamm" im grünen Header.
Schritt 2: Für jeden Bam-bamm-Eintrag lies den Zeitstempel (direkt über oder unter dem Header).
Schritt 3: Für jeden Eintrag zähle die 5 Slots und notiere alle Werte.
Schritt 4: Gib JEDEN Eintrag einzeln aus – NICHT summieren.

Ignoriere "sind von"-Einträge und alle anderen Empfänger.

Letzte Zeile der Antwort (nur JSON-Array, kein Markdown):
[{"timestamp":"15.03. 09:15","Cash":0,"Arms":0,"Cargo":0,"Metal":0,"Diamond":0}]

Wenn mehrere Einträge: ein Objekt pro Eintrag im Array.
Wenn kein Bam-bamm-Eintrag gefunden: leeres Array [].`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: contentType, data: base64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Fehler: ${err}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim() ?? "";

    // Letztes JSON-Array aus der Antwort extrahieren
    const arrayMatch = text.match(/\[[\s\S]*\]/g);
    if (!arrayMatch) throw new Error(`Kein JSON-Array in Antwort: ${text.slice(0, 200)}`);

    const parsed: Array<{
      timestamp: string;
      Cash: number;
      Arms: number;
      Cargo: number;
      Metal: number;
      Diamond: number;
    }> = JSON.parse(arrayMatch[arrayMatch.length - 1]);

    if (!Array.isArray(parsed)) throw new Error("OCR-Antwort ist kein Array");

    return NextResponse.json({ result: parsed });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
