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
1. Einem Zeitstempel (Datum + Uhrzeit, z.B. "15.03. 09:15") — direkt am Eintrag sichtbar
2. Einem grünen Header: "Ressourcen senden an: [Name]"
3. Genau 5 Ressourcen-Slots nebeneinander, von LINKS nach RECHTS:
   Slot 1 = CASH, Slot 2 = ARMS, Slot 3 = CARGO, Slot 4 = METAL, Slot 5 = DIAMOND
4. Unter jedem Slot: ein Zahlenwert ODER "-"

WICHTIG - Slot-Reihenfolge:
- Slot 4 (METAL) = vierter von links = zweiter von rechts
- Slot 5 (DIAMOND) = ganz rechts außen
- Immer von links nach rechts zählen: 1, 2, 3, 4, 5

ZAHLENFORMAT: "7,25 M" = 7250000, "500 K" = 500000, "-" = 0

AUFGABE:
Schritt 1: Finde alle Einträge mit "Bam bamm" im grünen Header.
Schritt 2: Für jeden Bam-bamm-Eintrag: lies Zeitstempel, dann alle 5 Slot-Werte.
Schritt 3: Gib jeden Eintrag EINZELN aus — NICHT summieren.

Ignoriere alle "sind von"-Einträge und alle anderen Empfänger.

Antworte NUR mit einem JSON-Array als letzte Zeile (kein Markdown, keine Backticks):
[{"timestamp":"15.03. 09:15","Cash":0,"Arms":0,"Cargo":0,"Metal":0,"Diamond":0}]

Regeln:
- Ein Objekt pro Bam-bamm-Eintrag
- Falls kein Zeitstempel lesbar: timestamp = ""
- Falls keine Bam-bamm-Einträge: []`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 2048,
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

    // JSON-Array extrahieren — letztes [...] in der Antwort
    const arrayMatch = text.match(/\[[\s\S]*?\]/g);

    // Fallback: altes Format [{...Cash...}] ohne timestamp
    const objectMatch = text.match(/\{[^{}]*"Cash"[^{}]*\}/g);

    let parsed: Array<{
      timestamp: string;
      Cash: number;
      Arms: number;
      Cargo: number;
      Metal: number;
      Diamond: number;
    }> = [];

    if (arrayMatch) {
      try {
        const candidate = JSON.parse(arrayMatch[arrayMatch.length - 1]);
        if (Array.isArray(candidate)) {
          parsed = candidate.map((item) => ({
            timestamp: item.timestamp ?? "",
            Cash:      Number(item.Cash)    || 0,
            Arms:      Number(item.Arms)    || 0,
            Cargo:     Number(item.Cargo)   || 0,
            Metal:     Number(item.Metal)   || 0,
            Diamond:   Number(item.Diamond) || 0,
          }));
        }
      } catch { /* weiter zum Fallback */ }
    }

    // Fallback: altes Einzelobjekt-Format → in Array mit leerem Timestamp wrappen
    if (parsed.length === 0 && objectMatch) {
      try {
        const obj = JSON.parse(objectMatch[objectMatch.length - 1]);
        const hasAny = ["Cash","Arms","Cargo","Metal","Diamond"].some((k) => Number(obj[k]) > 0);
        if (hasAny) {
          parsed = [{
            timestamp: "",
            Cash:      Number(obj.Cash)    || 0,
            Arms:      Number(obj.Arms)    || 0,
            Cargo:     Number(obj.Cargo)   || 0,
            Metal:     Number(obj.Metal)   || 0,
            Diamond:   Number(obj.Diamond) || 0,
          }];
        }
      } catch { /* leer lassen */ }
    }

    if (parsed.length === 0) {
      throw new Error(`Kein JSON in Antwort: ${text.slice(0, 300)}`);
    }

    return NextResponse.json({ result: parsed });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
