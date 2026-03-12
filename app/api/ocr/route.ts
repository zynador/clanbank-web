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
1. Einem grünen Header: "Ressourcen senden an: [Name]"
2. Genau 5 Ressourcen-Slots nebeneinander, von LINKS nach RECHTS in dieser festen Reihenfolge:
   Slot 1 = CASH (Geldscheine-Icon, ganz links)
   Slot 2 = ARMS (Patronen/Munitions-Icon)
   Slot 3 = CARGO (braune Holzkisten-Icon, Mitte)
   Slot 4 = METAL (Silberbarren-Icon, vierter von links)
   Slot 5 = DIAMOND (Diamant/Edelstein-Icon, ganz rechts)
3. Unter jedem Slot: ein Zahlenwert ODER "-"

WICHTIG - Metal vs Diamond:
- Slot 4 (METAL) ist der VIERTE Slot von links = zweiter von rechts
- Slot 5 (DIAMOND) ist der FÜNFTE Slot = ganz rechts außen
- Zähle die Slots immer von links nach rechts: 1, 2, 3, 4, 5

ZAHLENFORMAT: "7,25 M" = 7250000, "500 K" = 500000, "-" = 0

AUFGABE - gehe so vor:
Schritt 1: Finde alle Einträge mit "Bam bamm" im grünen Header.
Schritt 2: Für jeden Bam-bamm-Eintrag, zähle die 5 Slots von links nach rechts und notiere:
  Zeile X: Slot1(Cash)=[wert], Slot2(Arms)=[wert], Slot3(Cargo)=[wert], Slot4(Metal)=[wert], Slot5(Diamond)=[wert]
Schritt 3: Summiere alle Werte pro Ressource.
Schritt 4: Ausgabe als JSON in der letzten Zeile.

Ignoriere "sind von"-Einträge und alle anderen Empfänger.

Letzte Zeile der Antwort (nur JSON, kein Markdown):
{"Cash":0,"Arms":0,"Cargo":0,"Metal":0,"Diamond":0}`;

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

    // Letztes JSON-Objekt aus der Antwort extrahieren (nach dem Reasoning)
    const jsonMatch = text.match(/\{[^{}]*"Cash"[^{}]*\}/g);
    if (!jsonMatch) throw new Error(`Kein JSON in Antwort: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[jsonMatch.length - 1]);
    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
