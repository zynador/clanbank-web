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

WICHTIGE REGELN:
- Jeder Eintrag hat einen grünen Header "Ressourcen senden an: [Name]"
- Darunter stehen IMMER genau 5 Icons in fester Reihenfolge von links nach rechts: Cash, Arms, Cargo, Metal, Diamond
- Unter jedem Icon steht entweder ein Wert ODER "-" (= 0)
- Pro Zeile können alle 5, nur eine, oder mehrere Ressourcen einen Wert haben
- "5 M" oder "5,0 M" = 5000000, "500 K" oder "500,0 K" = 500000, "-" = 0
- Kleine Zahlen ohne Suffix wie "4" bedeuten einfach 4 (NICHT 4 Millionen!)

DEINE AUFGABE:
1. Finde ALLE Einträge mit Empfänger "Bam bamm" (orangefarbener Text im grünen Header)
2. Für jeden Bam-bamm-Eintrag: lies den Wert unter JEDEM der 5 Icons einzeln ab (Position 1=Cash, 2=Arms, 3=Cargo, 4=Metal, 5=Diamond)
3. Summiere alle Werte pro Ressource über alle Bam-bamm-Einträge
4. Ignoriere Einträge an andere Empfänger vollständig
5. Ignoriere Einträge mit "sind von" vollständig (= eingehende Transfers)

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
