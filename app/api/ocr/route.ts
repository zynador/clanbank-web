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

Das Bild zeigt einen Ressourcen-Transport-Bericht. Jeder Eintrag hat:
- Einen grünen Header: "Ressourcen senden an: [Name]"
- Darunter eine Zeile mit genau 5 Icons von LINKS nach RECHTS:
  Position 1 (ganz links): Cash (Geldscheine)
  Position 2: Arms (Munition/Patronen)
  Position 3: Cargo (Holzkiste)
  Position 4: Metal (Silberbarren)
  Position 5 (ganz rechts): Diamond (Edelstein)
- Unter jedem Icon steht ein Wert oder "-"

WICHTIG: Jede Zeile kann einen Wert an EINER ANDEREN Position haben!
Beispiel: Zeile 1 hat Wert unter Position 5 (=Diamond), Zeile 2 unter Position 4 (=Metal), usw.

Zahlenformat: "7,25 M" = 7250000, "500 K" = 500000, "1,5 M" = 1500000, "-" = 0

AUFGABE:
Gehe jede Zeile mit "Bam bamm" als Empfänger durch.
Ignoriere "sind von"-Einträge und Einträge mit anderen Empfängern.

Für jede Bam-bamm-Zeile bestimme:
- Welcher Wert steht unter Icon an Position 1 (Cash)?
- Welcher Wert steht unter Icon an Position 2 (Arms)?
- Welcher Wert steht unter Icon an Position 3 (Cargo)?
- Welcher Wert steht unter Icon an Position 4 (Metal)?
- Welcher Wert steht unter Icon an Position 5 (Diamond)?

Summiere alle Werte pro Ressource über alle Bam-bamm-Zeilen.

Antworte NUR mit diesem JSON, kein Markdown, keine Backticks:
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
    text = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(text);
    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
