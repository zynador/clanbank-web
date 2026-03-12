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
2. Einer Zeile mit 5 Icons von LINKS nach RECHTS:
   - Icon 1 (ganz links): Geldscheine = CASH
   - Icon 2: Patronen/Munition = ARMS
   - Icon 3: Holzkiste = CARGO
   - Icon 4: Silberbarren = METAL
   - Icon 5 (ganz rechts): Edelstein/Diamant = DIAMOND
3. Unter jedem Icon: ein Zahlenwert ODER "-" (= kein Wert)

ZAHLENFORMAT: "7,25 M" = 7250000, "1,5 M" = 1500000, "500 K" = 500000, "-" = 0

SCHRITT 1: Liste alle Einträge mit Empfänger "Bam bamm" auf.
Für JEDEN Bam-bamm-Eintrag schreibe:
Zeile X: Cash=[wert], Arms=[wert], Cargo=[wert], Metal=[wert], Diamond=[wert]

SCHRITT 2: Summiere jeden Ressourcentyp über alle Zeilen.

SCHRITT 3: Gib NUR dieses JSON aus (letzte Zeile deiner Antwort, kein Markdown):
{"Cash":0,"Arms":0,"Cargo":0,"Metal":0,"Diamond":0}

Ignoriere alle Einträge mit "sind von" und alle Einträge mit anderen Empfängern als "Bam bamm".`;

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
    let text = data.content?.[0]?.text?.trim() ?? "";

    // Letztes JSON-Objekt aus der Antwort extrahieren (nach dem Reasoning)
    const jsonMatch = text.match(/\{[^{}]*"Cash"[^{}]*\}/);
    if (!jsonMatch) throw new Error(`Kein JSON in Antwort: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
