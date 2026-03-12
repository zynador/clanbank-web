import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: "Keine imageUrl" }, { status: 400 });
    }

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Bild konnte nicht geladen werden");
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";

    const prompt = `Du analysierst einen Screenshot aus dem Spiel "The Grand Mafia".
Das Bild zeigt einen Ressourcen-Transport-Bericht mit mehreren Einträgen.

Jeder Eintrag hat einen grünen Header mit "Ressourcen senden an: [Name]".
Darunter stehen 5 Ressourcen-Spalten mit Icons: Cash, Arms, Cargo, Metal, Diamond.
Werte wie "5 M" bedeuten 5.000.000. "500 K" bedeutet 500.000. "-" bedeutet 0.

Deine Aufgabe:
1. Finde ALLE Einträge wo der Empfänger "Bam bamm" ist
2. Summiere die Werte pro Ressource über ALLE Bam-bamm-Einträge
3. Ignoriere Einträge an andere Empfänger
4. Ignoriere Einträge mit "sind von" (eingehende Transfers)

Gib die Summen als ganze Zahlen zurück (5M = 5000000).

Antworte NUR mit diesem JSON, kein Markdown, keine Backticks, keine Erklärung:
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
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: contentType, data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API Fehler: ${err}`);
    }

    const data = await response.json();
    let text = data.content?.[0]?.text?.trim() ?? "";

    // Markdown-Backticks entfernen falls vorhanden
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();

    const parsed = JSON.parse(text);
    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
